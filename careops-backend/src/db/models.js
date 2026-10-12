import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;
const oid = (ref) => ({ type: Schema.Types.ObjectId, ref });
// Every tenant-owned collection carries orgId; routes always filter by it (tenant isolation is enforced server-side).
const base = { orgId: { ...oid("Org"), required: true, index: true } };

export const ROLES = ["Operations administrator", "Team lead", "Compliance officer", "IT administrator", "Executive analyst", "Clinical reviewer"];
export const STATUSES = ["New", "Processing", "Needs review", "Incomplete", "Ready for approval", "Approved", "In progress", "Waiting for external information", "Completed", "Failed", "Cancelled"];

export const Org = model("Org", new Schema({ name: String, sites: [String], counters: { type: Map, of: Number, default: {} } }, { timestamps: true }));

export const User = model("User", new Schema({
  ...base, name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: String, role: { type: String, enum: ROLES, required: true }, sites: { type: [String], default: [] }, // [] = all sites
  state: { type: String, enum: ["Active", "Invited", "Disabled"], default: "Invited" }, mfaEnabled: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 0 }, // increment to revoke every session
  failedLogins: { type: Number, default: 0 }, lockUntil: Date, lastSignIn: Date, inviteHash: String, inviteExpires: Date,
}, { timestamps: true }));

export const Workflow = model("Workflow", new Schema({
  ...base, name: String, version: { type: Number, default: 1 }, state: { type: String, enum: ["Active", "Draft"], default: "Draft" },
  requiredFields: [String], requiredDocuments: [String], slaDays: { type: Number, default: 3 }, ownerName: String,
}, { timestamps: true }));

export const Case = model("Case", new Schema({
  ...base, ref: { type: String, required: true }, workflow: String, patientRef: String, // minimum-necessary token, never a name
  sourceRef: String, site: String, received: Date, due: Date, status: { type: String, enum: STATUSES, default: "New" },
  missingItems: [String], exception: { type: String, default: "" }, ownerId: oid("User"), notes: String, draft: Boolean,
  createdBy: oid("User"), lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true }).index({ orgId: 1, ref: 1 }, { unique: true }));

export const Doc = model("Document", new Schema({
  ...base, ref: String, caseId: oid("Case"), caseRef: String, name: String, storageKey: String, sha256: String, mime: String, size: Number,
  type: { type: String, default: "Unclassified" }, language: { type: String, default: "Unknown" },
  processing: { type: String, enum: ["Processing", "Processed", "Failed"], default: "Processing" },
  review: { type: String, enum: ["Not reviewed", "Needs review", "Reviewed"], default: "Not reviewed" }, version: { type: Number, default: 1 },
  aiRun: { provider: String, at: Date }, uploadedBy: oid("User"),
}, { timestamps: true }).index({ orgId: 1, ref: 1 }, { unique: true }).index({ orgId: 1, sha256: 1 }));

export const Field = model("Field", new Schema({
  ...base, documentId: oid("Document"), label: String, value: { type: String, default: "" }, originalValue: { type: String, default: "" },
  conf: { type: String, enum: ["High", "Review required", "Not detected"], default: "Not detected" }, page: Number, snippet: { type: String, default: "" },
  status: { type: String, enum: ["suggested", "accepted", "rejected", "edited"], default: "suggested" },
  revisions: [{ by: oid("User"), at: Date, from: String, to: String }], // edits never overwrite the original AI output
}, { timestamps: true }));

export const Summary = model("Summary", new Schema({
  ...base, caseId: oid("Case"), text: String, sources: [{ doc: String, page: Number, snippet: String }], count: Number,
  generator: String, generatedAt: Date, reviewedBy: oid("User"), reviewedAt: Date,
}));

export const Task = model("Task", new Schema({
  ...base, ref: String, title: String, caseId: oid("Case"), caseRef: String, ownerId: oid("User"),
  priority: { type: String, enum: ["Standard", "High"], default: "Standard" }, // operational only, never clinical
  due: Date, status: { type: String, enum: ["In progress", "Completed"], default: "In progress" },
}, { timestamps: true }));

export const Integration = model("Integration", new Schema({
  ...base, name: String, purpose: String, status: { type: String, enum: ["Not configured", "Awaiting approval", "Connected", "Degraded", "Failed", "Disabled"], default: "Awaiting approval" },
  lastSync: Date, scope: String, ownerName: String, // credentials are NEVER stored here; use a secrets manager
}, { timestamps: true }));

const audit = new Schema({
  ...base, seq: Number, ts: Date, actorId: oid("User"), actorName: String, event: String, object: String,
  outcome: { type: String, enum: ["Success", "Denied", "Failure"] }, model: String, ip: String, prevHash: String, hash: String,
}).index({ orgId: 1, seq: 1 }, { unique: true });
// Append-only: block updates and deletes at the model layer (also restrict DB-user permissions in production)
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndDelete", "deleteOne", "deleteMany", "replaceOne"]) {
  audit.pre(op, function () { throw new Error("Audit events are append-only"); });
}
audit.pre("save", function (next) { if (!this.isNew) return next(new Error("Audit events are append-only")); next(); });
export const AuditEvent = model("AuditEvent", audit);
export const toId = (s) => new Types.ObjectId(String(s));
