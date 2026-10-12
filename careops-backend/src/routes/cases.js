import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { can, siteScope } from "../middleware/auth.js";
import { wrap, HttpError, notFound } from "../middleware/errors.js";
import { Case, Doc, Field, Summary, User, Workflow, STATUSES } from "../db/models.js";
import { auditReq } from "../services/audit.js";
import { caseOut } from "../services/serialize.js";
import { nextRef } from "../services/refs.js";
import { buildSummary } from "../services/ai.js";
import { processDocument, ingest } from "../services/documents.js";

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1048576, files: 10 } });
const scoped = (req, extra = {}) => ({ orgId: req.user.orgId, ...siteScope(req.user), ...extra });
const find = async (req, ref) => { const c = await Case.findOne(scoped(req, { ref: String(ref) })).populate("ownerId", "name"); if (!c) throw notFound("Case not found"); return c; };
const touch = (c) => { c.lastActivityAt = new Date(); return c.save(); };

r.get("/", can("case:read"), wrap(async (req, res) => {
  const list = await Case.find(scoped(req)).sort({ received: -1 }).limit(1000).populate("ownerId", "name");
  res.json(list.map(caseOut));
}));

r.get("/:ref", can("case:read"), wrap(async (req, res) => {
  const c = await find(req, req.params.ref);
  await auditReq(req, { event: "Case viewed", object: c.ref });
  res.json(caseOut(c));
}));

// patientRef must be a source-system token: no spaces, so names can't be stored by accident
const createSchema = z.object({
  workflow: z.string().min(1).max(80), ref: z.string().max(80).optional(), patientRef: z.string().regex(/^[A-Za-z0-9\-_•]{3,40}$/, "Use a source-system reference or token, not a name"),
  site: z.string().max(80), received: z.coerce.date(), notes: z.string().max(2000).optional(), draft: z.boolean().optional(), confirmDuplicate: z.boolean().optional(),
});
r.post("/", can("case:write"), wrap(async (req, res) => {
  const b = createSchema.parse(req.body);
  if (req.user.sites.length && !req.user.sites.includes(b.site)) throw new HttpError(403, "Permission denied");
  const dup = await Case.findOne({ orgId: req.user.orgId, patientRef: b.patientRef, workflow: b.workflow, status: { $nin: ["Completed", "Cancelled"] } });
  if (dup && !b.confirmDuplicate) throw new HttpError(409, "A similar open case exists. Confirm to create another.", { duplicateOf: dup.ref });
  const wf = await Workflow.findOne({ orgId: req.user.orgId, name: b.workflow });
  const c = await Case.create({
    orgId: req.user.orgId, ref: await nextRef(req.user.orgId, "case"), workflow: b.workflow, patientRef: b.patientRef, sourceRef: b.ref, site: b.site, received: b.received,
    due: new Date(b.received.getTime() + (wf?.slaDays || 3) * 864e5), notes: b.notes, draft: !!b.draft, createdBy: req.user._id, ownerId: req.user._id,
  });
  await auditReq(req, { event: "Case created", object: c.ref });
  res.status(201).json({ id: c.ref, status: c.status });
}));

r.post("/bulk-assign", can("case:assign"), wrap(async (req, res) => {
  const { ids } = z.object({ ids: z.array(z.string().max(40)).min(1).max(100) }).parse(req.body);
  const cases = await Case.find(scoped(req, { ref: { $in: ids } }));
  for (const c of cases) { c.ownerId = req.user._id; await touch(c); await auditReq(req, { event: "Case assigned", object: c.ref }); }
  res.json({ ok: true, assigned: cases.length });
}));

r.post("/:ref/assign", can("case:assign"), wrap(async (req, res) => {
  const { userId } = z.object({ userId: z.string().optional() }).parse(req.body || {});
  const owner = userId ? await User.findOne({ _id: userId, orgId: req.user.orgId, state: "Active" }) : req.user;
  if (!owner) throw notFound("User not found");
  const c = await find(req, req.params.ref); c.ownerId = owner._id; await touch(c);
  await auditReq(req, { event: "Case assigned", object: c.ref }); res.json({ ok: true });
}));

r.post("/:ref/status", can("case:write"), wrap(async (req, res) => {
  const { status } = z.object({ status: z.enum(STATUSES) }).parse(req.body);
  if (status === "Approved") throw new HttpError(400, "Use the summary approval action"); // "Approved" must mean a human review
  const c = await find(req, req.params.ref); const from = c.status; c.status = status; await touch(c);
  await auditReq(req, { event: `Status changed: ${from} to ${status}`, object: c.ref }); res.json({ ok: true });
}));

// Upload: validated by content, de-duplicated by hash, then processed asynchronously
r.post("/:ref/documents", can("doc:write"), upload.array("files", 10), wrap(async (req, res) => {
  const c = await find(req, req.params.ref);
  const confirmDup = req.query.confirmDuplicate === "1";
  const out = [];
  for (const f of req.files || []) out.push(await ingest({ req, c, file: f, confirmDup }));
  res.status(202).json({ documents: out });
  for (const d of out.filter((x) => x.ok)) setImmediate(() => processDocument(d._id).catch(() => {}));
}));

r.get("/:ref/summary", can("case:read"), wrap(async (req, res) => {
  const c = await find(req, req.params.ref);
  let s = await Summary.findOne({ orgId: c.orgId, caseId: c._id }).sort({ generatedAt: -1 });
  if (!s) {
    const docs = await Doc.find({ orgId: c.orgId, caseId: c._id });
    const fields = await Field.find({ orgId: c.orgId, documentId: { $in: docs.map((d) => d._id) }, status: { $ne: "rejected" } });
    const byDoc = Object.fromEntries(docs.map((d) => [String(d._id), d.ref]));
    const facts = fields.filter((f) => f.value && f.snippet);
    const missing = [...new Set(fields.filter((f) => !f.value).map((f) => f.label))];
    const g = buildSummary({ caseRef: c.ref, workflow: c.workflow, facts, missing });
    s = await Summary.create({ orgId: c.orgId, caseId: c._id, text: g.text, generator: g.generator, generatedAt: new Date(), count: docs.length,
      sources: facts.map((f) => ({ doc: byDoc[String(f.documentId)], page: f.page, snippet: f.snippet })) });
    await auditReq(req, { event: "AI summary generated", object: c.ref, model: g.generator });
  }
  res.json({ text: s.text, sources: s.sources, generated: s.generatedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC", count: s.count, reviewed: !!s.reviewedAt });
}));

r.post("/:ref/summary/approve", can("summary:review"), wrap(async (req, res) => {
  const c = await find(req, req.params.ref);
  const s = await Summary.findOne({ orgId: c.orgId, caseId: c._id }).sort({ generatedAt: -1 });
  if (!s) throw new HttpError(409, "Generate and review the summary before approving it");
  s.reviewedBy = req.user._id; s.reviewedAt = new Date(); await s.save();
  c.status = "Approved"; await touch(c);
  await auditReq(req, { event: "Summary approved", object: c.ref, model: s.generator });
  res.json({ ok: true });
}));
export default r;
