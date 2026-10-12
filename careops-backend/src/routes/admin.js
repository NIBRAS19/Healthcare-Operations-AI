import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { can, hasPerm, siteScope } from "../middleware/auth.js";
import { wrap, HttpError, notFound } from "../middleware/errors.js";
import { AuditEvent, Case, Integration, Task, User, Workflow, ROLES } from "../db/models.js";
import { auditReq, verifyChain } from "../services/audit.js";
import { auditOut, integrationOut, taskOut, userOut, workflowOut } from "../services/serialize.js";
import { nextRef } from "../services/refs.js";

export const tasks = Router(), audit = Router(), users = Router(), integrations = Router(), workflows = Router(), reports = Router();

/* ---------- Tasks ---------- */
tasks.get("/", can("task:read"), wrap(async (req, res) => {
  const visible = (await Case.find({ orgId: req.user.orgId, ...siteScope(req.user) }).select("_id")).map((c) => c._id);
  res.json((await Task.find({ orgId: req.user.orgId, caseId: { $in: visible } }).sort({ due: 1 }).limit(1000).populate("ownerId", "name")).map(taskOut));
}));
tasks.post("/", can("task:write"), wrap(async (req, res) => {
  const b = z.object({ title: z.string().min(1).max(200), caseRef: z.string(), ownerId: z.string().optional(), priority: z.enum(["Standard", "High"]).optional(), due: z.coerce.date() }).parse(req.body);
  const c = await Case.findOne({ orgId: req.user.orgId, ref: b.caseRef, ...siteScope(req.user) });
  if (!c) throw notFound("Case not found");
  const t = await Task.create({ orgId: req.user.orgId, ref: await nextRef(req.user.orgId, "task"), title: b.title, caseId: c._id, caseRef: c.ref, ownerId: b.ownerId || req.user._id, priority: b.priority, due: b.due });
  await auditReq(req, { event: "Task created", object: t.ref }); res.status(201).json({ id: t.ref });
}));
tasks.patch("/:ref", can("task:write"), wrap(async (req, res) => {
  const { status } = z.object({ status: z.enum(["In progress", "Completed"]) }).parse(req.body);
  const t = await Task.findOne({ orgId: req.user.orgId, ref: req.params.ref });
  if (!t) throw notFound("Task not found");
  t.status = status; await t.save(); await auditReq(req, { event: status === "Completed" ? "Task completed" : "Task reopened", object: t.ref }); res.json({ ok: true });
}));

/* ---------- Audit ---------- */
// Compliance/IT see everything. Operational staff see only recent activity, without login or denied-access events or IPs.
audit.get("/", wrap(async (req, res) => {
  const full = hasPerm(req.user, "audit:read");
  if (!full && !hasPerm(req.user, "audit:activity")) return can("audit:read")(req, res);
  const q = { orgId: req.user.orgId };
  if (!full) q.event = { $nin: ["Login", "Logout", "Access denied", "Sessions revoked"] };
  for (const k of ["event", "outcome"]) if (full && typeof req.query[k] === "string") q[k] = req.query[k];
  if (full && typeof req.query.object === "string") q.object = req.query.object;
  const list = await AuditEvent.find(q).sort({ seq: -1 }).limit(full ? 500 : 10).lean();
  res.json(list.map((e) => auditOut(e, full)));
}));
audit.get("/verify", can("audit:read"), wrap(async (req, res) => res.json(await verifyChain(req.user.orgId))));
audit.get("/export", can("audit:export"), wrap(async (req, res) => {
  const list = await AuditEvent.find({ orgId: req.user.orgId }).sort({ seq: 1 }).lean();
  await auditReq(req, { event: "Audit export created" });
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  res.type("text/csv").send(["seq,ts,actor,event,object,outcome,hash", ...list.map((e) => [e.seq, e.ts.toISOString(), e.actorName, e.event, e.object, e.outcome, e.hash].map(esc).join(","))].join("\n"));
}));

/* ---------- Users ---------- */
users.get("/", can("user:read"), wrap(async (req, res) => res.json((await User.find({ orgId: req.user.orgId }).sort({ name: 1 })).map(userOut))));
users.post("/", can("user:write"), wrap(async (req, res) => {
  const b = z.object({ name: z.string().min(1).max(120), email: z.string().email(), role: z.enum(ROLES), sites: z.array(z.string()).optional() }).parse(req.body);
  if (await User.exists({ email: b.email.toLowerCase() })) throw new HttpError(409, "A user with this email already exists");
  const token = crypto.randomBytes(32).toString("hex");
  const u = await User.create({ ...b, orgId: req.user.orgId, state: "Invited", inviteHash: crypto.createHash("sha256").update(token).digest("hex"), inviteExpires: new Date(Date.now() + 72 * 3600e3) });
  await auditReq(req, { event: "User invited", object: u.email });
  // Send this token by email in production. It is returned once here only so a demo can complete the flow.
  res.status(201).json({ ...userOut(u), ...(process.env.NODE_ENV !== "production" ? { inviteToken: token } : {}) });
}));
users.patch("/:id", can("user:write"), wrap(async (req, res) => {
  const b = z.object({ role: z.enum(ROLES).optional(), state: z.enum(["Active", "Disabled"]).optional() }).parse(req.body);
  const u = await User.findOne({ _id: req.params.id, orgId: req.user.orgId });
  if (!u) throw notFound("User not found");
  if (String(u._id) === String(req.user._id)) throw new HttpError(400, "You can't change your own role or status");
  if (b.role) u.role = b.role;
  if (b.state) u.state = b.state;
  u.tokenVersion += 1; // role or status change revokes existing sessions
  await u.save(); await auditReq(req, { event: "User changed", object: u.email }); res.json(userOut(u));
}));

/* ---------- Integrations & workflows ---------- */
integrations.get("/", can("integration:read"), wrap(async (req, res) => res.json((await Integration.find({ orgId: req.user.orgId })).map(integrationOut))));
integrations.post("/:id/pause", can("integration:write"), wrap(async (req, res) => {
  const i = await Integration.findOne({ _id: req.params.id, orgId: req.user.orgId });
  if (!i) throw notFound("Integration not found");
  i.status = "Disabled"; await i.save(); await auditReq(req, { event: "Integration paused", object: i.name }); res.json({ ok: true });
}));
workflows.get("/", can("workflow:read"), wrap(async (req, res) => res.json((await Workflow.find({ orgId: req.user.orgId })).map(workflowOut))));

/* ---------- Reports ---------- */
const MIN_GROUP = 5; // small-group suppression to reduce re-identification risk
reports.get("/summary", can("report:read"), wrap(async (req, res) => {
  const rows = await Case.aggregate([{ $match: { orgId: req.user.orgId } }, { $group: { _id: { workflow: "$workflow", status: "$status" }, n: { $sum: 1 } } }]);
  res.json({ timezone: "Asia/Dubai", minGroupSize: MIN_GROUP, rows: rows.map((r) => ({ workflow: r._id.workflow, status: r._id.status, count: r.n < MIN_GROUP ? null : r.n, suppressed: r.n < MIN_GROUP })) });
}));
