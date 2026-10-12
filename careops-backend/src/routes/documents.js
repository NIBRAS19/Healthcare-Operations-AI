import { Router } from "express";
import { z } from "zod";
import { can, siteScope } from "../middleware/auth.js";
import { wrap, HttpError, notFound } from "../middleware/errors.js";
import { Case, Doc, Field } from "../db/models.js";
import { auditReq } from "../services/audit.js";
import { docOut, fieldOut } from "../services/serialize.js";
import { processDocument } from "../services/documents.js";
import { readStream } from "../services/files.js";

const r = Router();
// Documents are only visible through cases the user is allowed to see (site scope applies here too)
async function visibleCaseIds(req) { return (await Case.find({ orgId: req.user.orgId, ...siteScope(req.user) }).select("_id")).map((c) => c._id); }
async function findDoc(req, ref) {
  const d = await Doc.findOne({ orgId: req.user.orgId, ref: String(ref), caseId: { $in: await visibleCaseIds(req) } });
  if (!d) throw notFound("Document not found");
  return d;
}

r.get("/", can("doc:read"), wrap(async (req, res) => {
  const list = await Doc.find({ orgId: req.user.orgId, caseId: { $in: await visibleCaseIds(req) } }).sort({ createdAt: -1 }).limit(1000);
  res.json(list.map(docOut));
}));

r.get("/:ref/fields", can("doc:read"), wrap(async (req, res) => {
  const d = await findDoc(req, req.params.ref);
  await auditReq(req, { event: "Document viewed", object: d.ref });
  res.json((await Field.find({ orgId: d.orgId, documentId: d._id })).map(fieldOut));
}));

// accept | reject | edit. Edits keep the original AI output and add a revision.
r.patch("/:ref/fields/:fieldId", can("doc:write"), wrap(async (req, res) => {
  const b = z.object({ action: z.enum(["accept", "reject", "edit"]), value: z.string().max(500).optional() }).parse(req.body);
  const d = await findDoc(req, req.params.ref);
  const f = await Field.findOne({ _id: req.params.fieldId, orgId: d.orgId, documentId: d._id });
  if (!f) throw notFound("Field not found");
  if (b.action === "accept") { if (!f.snippet) throw new HttpError(409, "No source evidence. Edit the value manually instead."); f.status = "accepted"; }
  if (b.action === "reject") f.status = "rejected";
  if (b.action === "edit") { if (b.value == null) throw new HttpError(400, "Value required"); f.revisions.push({ by: req.user._id, at: new Date(), from: f.value, to: b.value }); f.value = b.value; f.status = "edited"; }
  await f.save();
  await auditReq(req, { event: `Field ${b.action}`, object: `${d.ref}/${f.label}` });
  res.json(fieldOut(f));
}));

r.post("/:ref/reprocess", can("doc:write"), wrap(async (req, res) => {
  const d = await findDoc(req, req.params.ref);
  await auditReq(req, { event: "Document reprocess requested", object: d.ref });
  res.status(202).json({ ok: true });
  setImmediate(() => processDocument(d._id).catch(() => {}));
}));

// Files stream through the API after an authorisation check; raw storage paths/URLs are never exposed
r.get("/:ref/file", can("doc:read"), wrap(async (req, res) => {
  const d = await findDoc(req, req.params.ref);
  await auditReq(req, { event: "Document downloaded", object: d.ref });
  res.setHeader("Content-Type", d.mime); res.setHeader("Content-Disposition", `attachment; filename="${d.name.replace(/"/g, "")}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  readStream(d.storageKey).on("error", () => res.destroy()).pipe(res);
}));
export default r;
