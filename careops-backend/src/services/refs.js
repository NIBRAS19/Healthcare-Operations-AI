import { Org } from "../db/models.js";
// Atomic per-org counters -> CASE-1001, DOC-5001, T-1
const START = { case: 1000, doc: 5000, task: 0 };
const PREFIX = { case: "CASE-", doc: "DOC-", task: "T-" };
export async function nextRef(orgId, kind) {
  const org = await Org.findByIdAndUpdate(orgId, { $inc: { [`counters.${kind}`]: 1 } }, { new: true });
  return `${PREFIX[kind]}${START[kind] + org.counters.get(kind)}`;
}
