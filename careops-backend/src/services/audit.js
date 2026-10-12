import crypto from "node:crypto";
import { AuditEvent } from "../db/models.js";
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const payload = (e) => `${e.prevHash}|${e.seq}|${new Date(e.ts).toISOString()}|${e.actorId || ""}|${e.event}|${e.object || ""}|${e.outcome}|${e.model || ""}`;

// Hash-chained, per-organisation. The unique (orgId, seq) index makes concurrent writers retry instead of forking the chain.
export async function writeAudit({ orgId, actorId, actorName, event, object = "", outcome = "Success", model = "", ip = "" }) {
  if (!orgId) return;
  for (let i = 0; i < 5; i++) {
    const last = await AuditEvent.findOne({ orgId }).sort({ seq: -1 }).lean();
    const e = { orgId, seq: (last?.seq || 0) + 1, ts: new Date(), actorId, actorName, event, object, outcome, model, ip, prevHash: last?.hash || "GENESIS" };
    e.hash = sha(payload(e));
    try { return await AuditEvent.create(e); } catch (err) { if (err.code !== 11000) throw err; }
  }
  throw new Error("Could not append audit event");
}
export const auditReq = (req, o) => writeAudit({ orgId: req.user?.orgId, actorId: req.user?._id, actorName: req.user?.name, ip: req.ip, ...o });

export async function verifyChain(orgId) {
  let prev = "GENESIS", n = 0;
  for await (const e of AuditEvent.find({ orgId }).sort({ seq: 1 }).lean()) {
    if (e.prevHash !== prev || sha(payload(e)) !== e.hash) return { ok: false, brokenAtSeq: e.seq, checked: n };
    prev = e.hash; n++;
  }
  return { ok: true, checked: n };
}
