// Synthetic demo data only. Never run against a database containing real patient data.
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { config } from "../config.js";
import { Case, Integration, Org, Task, User, Workflow } from "../db/models.js";
import { writeAudit } from "../services/audit.js";
import { nextRef } from "../services/refs.js";

await mongoose.connect(config.mongoUri);
if (await Org.exists({ name: "Demo Health Group" })) { console.log("Already seeded."); process.exit(0); }
const password = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString("base64url") + "aA1!";
const hash = await bcrypt.hash(password, 12);
const org = await Org.create({ name: "Demo Health Group", sites: ["Site A", "Site B"] });
const mk = (name, email, role, sites = []) => User.create({ orgId: org._id, name, email, role, sites, passwordHash: hash, state: "Active" });
const [amina, omar, sara] = [
  await mk("Amina Khalid", "amina@demo.example", "Operations administrator", ["Site A"]), await mk("Omar Haddad", "omar@demo.example", "Team lead"),
  await mk("Sara Nasser", "sara@demo.example", "Compliance officer"), await mk("Yusuf Rahman", "yusuf@demo.example", "IT administrator"),
];
await Workflow.insertMany([
  { orgId: org._id, name: "Referral intake", version: 3, state: "Active", requiredFields: ["Referral date", "Referring facility", "Insurance member no.", "Requested service"], requiredDocuments: ["Referral letter", "ID", "Insurance form"], slaDays: 3, ownerName: "Omar Haddad" },
  { orgId: org._id, name: "Document completeness", version: 1, state: "Draft", requiredFields: [], requiredDocuments: ["Per payer checklist"], slaDays: 5, ownerName: "Omar Haddad" },
  { orgId: org._id, name: "Administrative case summary", version: 1, state: "Active", requiredFields: [], requiredDocuments: ["Case documents"], slaDays: 3, ownerName: "Omar Haddad" },
]);
await Integration.insertMany([
  { orgId: org._id, name: "Secure file import (SFTP)", purpose: "Referral batch import", status: "Connected", lastSync: new Date(Date.now() - 12 * 60000), scope: "Read: referral PDFs", ownerName: "Yusuf Rahman" },
  { orgId: org._id, name: "EMR export (FHIR) - sandbox", purpose: "Case status sync", status: "Awaiting approval", scope: "Not yet granted", ownerName: "Yusuf Rahman" },
  { orgId: org._id, name: "OCR provider", purpose: "Scanned document text", status: "Degraded", lastSync: new Date(Date.now() - 2 * 3600e3), scope: "Document images", ownerName: "Omar Haddad" },
]);
const wfs = ["Referral intake", "Document completeness", "Administrative case summary"], st = ["New", "Needs review", "Incomplete", "In progress", "Completed"];
for (let i = 0; i < 12; i++) {
  const received = new Date(Date.now() - (i % 8) * 864e5);
  const c = await Case.create({ orgId: org._id, ref: await nextRef(org._id, "case"), workflow: wfs[i % 3], patientRef: `PT-${3170 + i * 7}`, site: i % 2 ? "Site A" : "Site B", received,
    due: new Date(received.getTime() + 3 * 864e5), status: st[i % st.length], missingItems: i % 3 === 1 ? ["Insurance member no."] : [], ownerId: [amina, omar][i % 2]._id, createdBy: omar._id });
  if (i < 6) await Task.create({ orgId: org._id, ref: await nextRef(org._id, "task"), title: "Request missing insurance number", caseId: c._id, caseRef: c.ref, ownerId: amina._id, due: c.due });
}
await writeAudit({ orgId: org._id, actorId: sara._id, actorName: sara.name, event: "Demo data seeded" });
console.log(`Seeded. All demo users share this password (shown once): ${password}`);
await mongoose.disconnect();
