import { Case, Doc, Field, Workflow } from "../db/models.js";
import { auditReq, writeAudit } from "./audit.js";
import { extractFields } from "./ai.js";
import { nextRef } from "./refs.js";
import { safeName, saveFile, scanFile, sha256, sniff } from "./files.js";

const DEFAULT_FIELDS = ["Referral date", "Referring facility", "Insurance member no.", "Requested service"];

export async function ingest({ req, c, file, confirmDup }) {
  const mime = sniff(file.buffer);
  if (!mime) return { ok: false, name: safeName(file.originalname), error: "Unsupported file. Use PDF, JPEG or PNG." };
  await scanFile(file.buffer);
  const hash = sha256(file.buffer);
  const dup = await Doc.findOne({ orgId: c.orgId, sha256: hash });
  if (dup && !confirmDup) return { ok: false, name: safeName(file.originalname), error: "Possible duplicate. Confirm to upload anyway.", duplicateOf: dup.ref };
  const d = await Doc.create({
    orgId: c.orgId, ref: await nextRef(c.orgId, "doc"), caseId: c._id, caseRef: c.ref, name: safeName(file.originalname), storageKey: await saveFile(file.buffer),
    sha256: hash, mime, size: file.size, uploadedBy: req.user._id,
  });
  await auditReq(req, { event: "Document uploaded", object: d.ref });
  return { ok: true, _id: d._id, id: d.ref, name: d.name };
}

// Runs in the background. If AI fails the document is marked Failed and staff continue manually; nothing is lost.
export async function processDocument(docId) {
  const d = await Doc.findById(docId);
  if (!d) return;
  d.processing = "Processing"; await d.save();
  try {
    const c = await Case.findById(d.caseId);
    const wf = await Workflow.findOne({ orgId: d.orgId, name: c.workflow });
    const out = await extractFields({ requiredFields: wf?.requiredFields?.length ? wf.requiredFields : DEFAULT_FIELDS });
    await Field.deleteMany({ orgId: d.orgId, documentId: d._id, status: "suggested" });
    await Field.insertMany(out.fields.map((f) => ({ ...f, orgId: d.orgId, documentId: d._id, originalValue: f.value })));
    d.type = out.type; d.language = out.language; d.aiRun = { provider: out.provider, at: new Date() };
    d.processing = "Processed"; d.review = "Needs review"; await d.save();
    c.missingItems = out.fields.filter((f) => !f.value).map((f) => f.label);
    if (["New", "Processing"].includes(c.status)) c.status = "Needs review";
    c.lastActivityAt = new Date(); await c.save();
    await writeAudit({ orgId: d.orgId, event: "Document processed", object: d.ref, model: out.provider });
  } catch (e) {
    d.processing = "Failed"; await d.save();
    await writeAudit({ orgId: d.orgId, event: "Document processing", object: d.ref, outcome: "Failure" });
  }
}
