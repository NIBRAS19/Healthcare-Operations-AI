// SYNTHETIC DEMO DATA ONLY - no real patient information.
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
export const users = [
  { id: "u1", name: "Amina Khalid", email: "amina@demo.example", role: "Operations administrator", scope: "Site A", mfa: true, state: "Active", lastSignIn: d(0) },
  { id: "u2", name: "Omar Haddad", email: "omar@demo.example", role: "Team lead", scope: "All sites", mfa: true, state: "Active", lastSignIn: d(-1) },
  { id: "u3", name: "Sara Nasser", email: "sara@demo.example", role: "Compliance officer", scope: "All sites", mfa: true, state: "Active", lastSignIn: d(-2) },
  { id: "u4", name: "Yusuf Rahman", email: "yusuf@demo.example", role: "IT administrator", scope: "All sites", mfa: false, state: "Invited", lastSignIn: "-" },
];
const st = ["New", "Processing", "Needs review", "Incomplete", "Ready for approval", "In progress", "Waiting for external information", "Completed", "Failed"];
const wf = ["Referral intake", "Document completeness", "Administrative case summary"];
export const cases = Array.from({ length: 24 }, (_, i) => ({
  id: `CASE-${1001 + i}`, workflow: wf[i % 3], patientRef: `PT-••${(3170 + i * 7) % 9000}`,
  received: d(-(i % 9)), status: st[i % st.length], missing: i % 4 === 1 ? 2 : i % 5 === 2 ? 1 : 0,
  exception: i % 7 === 3 ? "Uncertain identity match" : i % 4 === 1 ? "Missing documents" : i % 6 === 0 ? "Low OCR confidence" : "",
  owner: i % 5 === 4 ? "" : users[i % 3].name, due: d((i % 6) - 2), site: i % 2 ? "Site A" : "Site B", lastActivity: `${(i % 7) + 1}h ago`,
}));
export const documents = Array.from({ length: 14 }, (_, i) => ({
  id: `DOC-${5001 + i}`, name: ["Referral letter.pdf", "Insurance form.pdf", "ID scan.jpg", "Lab report.pdf"][i % 4],
  type: ["Referral letter", "Insurance form", "Identity document", "Supporting report"][i % 4], caseId: cases[i].id,
  language: i % 5 === 0 ? "Arabic / English" : "English", uploaded: d(-(i % 6)),
  processing: i === 6 ? "Failed" : i % 5 === 2 ? "Processing" : "Processed", review: i % 3 === 0 ? "Not reviewed" : "Needs review", version: 1 + (i % 2),
}));
export const fields = [
  { label: "Referral date", value: "2026-09-18", conf: "High", page: 1, snippet: "Date of referral: 18 September 2026" },
  { label: "Referring facility", value: "Demo Medical Clinic", conf: "High", page: 1, snippet: "Referring facility: Demo Medical Clinic" },
  { label: "Insurance member no.", value: "", conf: "Not detected", page: null, snippet: "" },
  { label: "Requested service", value: "Outpatient imaging", conf: "Review required", page: 2, snippet: "Service requested: outpatient imaging (type unclear)" },
];
export const tasks = Array.from({ length: 10 }, (_, i) => ({
  id: `T-${i + 1}`, title: ["Request missing insurance number", "Confirm patient reference", "Review extracted fields", "Approve administrative summary"][i % 4],
  caseId: cases[i].id, owner: users[i % 3].name, priority: ["Standard", "High", "Standard"][i % 3], due: d((i % 5) - 2),
  status: i % 4 === 3 ? "Completed" : "In progress", last: `${i + 1}h ago`,
}));
export const audit = Array.from({ length: 16 }, (_, i) => ({
  id: `EVT-${9001 + i}`, ts: new Date(Date.now() - i * 36e5 * 3).toISOString().replace("T", " ").slice(0, 16),
  actor: users[i % 4].name, event: ["Case viewed", "Field edited", "AI summary generated", "Summary approved", "Export created", "Access denied", "Login"][i % 7],
  object: cases[i].id, outcome: i % 7 === 5 ? "Denied" : "Success", model: i % 7 === 2 ? "model-v1 / prompt-v3" : "",
}));
export const integrations = [
  { id: "i1", name: "Secure file import (SFTP)", purpose: "Referral batch import", status: "Connected", lastSync: "12 min ago", scope: "Read: referral PDFs", owner: "Yusuf Rahman" },
  { id: "i2", name: "EMR export (FHIR) - sandbox", purpose: "Case status sync", status: "Awaiting approval", lastSync: "-", scope: "Not yet granted", owner: "Yusuf Rahman" },
  { id: "i3", name: "OCR provider", purpose: "Scanned document text", status: "Degraded", lastSync: "2 h ago", scope: "Document images", owner: "Omar Haddad" },
];
export const workflows = [
  { id: "w1", name: "Referral intake", version: 3, state: "Active", required: "Referral letter, ID, Insurance form", owner: "Omar Haddad", updated: d(-12) },
  { id: "w2", name: "Document completeness", version: 1, state: "Draft", required: "Per payer checklist", owner: "Omar Haddad", updated: d(-3) },
];
export const summary = {
  text: "Referral received 18 Sep 2026 from Demo Medical Clinic requesting outpatient imaging. Insurance member number was not detected in the supplied documents. Identity document supplied (1 page).",
  sources: [{ doc: "DOC-5001", page: 1, snippet: "Date of referral: 18 September 2026" }, { doc: "DOC-5003", page: 1, snippet: "Identity document, 1 page" }],
  generated: "today 09:14", count: 3,
};
