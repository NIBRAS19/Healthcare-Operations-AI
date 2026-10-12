// Shapes match what the React frontend already expects.
const day = (x) => (x ? new Date(x).toISOString().slice(0, 10) : "");
const stamp = (x) => new Date(x).toISOString().replace("T", " ").slice(0, 16);
const ago = (x) => { const m = Math.max(1, Math.round((Date.now() - new Date(x)) / 60000)); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
export const caseOut = (c) => ({ id: c.ref, workflow: c.workflow, patientRef: c.patientRef, received: day(c.received), status: c.status, missing: c.missingItems?.length || 0, exception: c.exception || "", owner: c.ownerId?.name || "", due: day(c.due), site: c.site, lastActivity: ago(c.lastActivityAt) });
export const docOut = (d) => ({ id: d.ref, name: d.name, type: d.type, caseId: d.caseRef, language: d.language, uploaded: day(d.createdAt), processing: d.processing, review: d.review, version: d.version });
export const fieldOut = (f) => ({ id: String(f._id), label: f.label, value: f.value, conf: f.conf, page: f.page ?? null, snippet: f.snippet, status: f.status });
export const taskOut = (t) => ({ id: t.ref, title: t.title, caseId: t.caseRef, owner: t.ownerId?.name || "", priority: t.priority, due: day(t.due), status: t.status, last: ago(t.updatedAt) });
export const auditOut = (e, full) => ({ id: `EVT-${e.seq}`, ts: stamp(e.ts), actor: e.actorName || "System", event: e.event, object: e.object, outcome: e.outcome, model: e.model || "", ...(full ? { ip: e.ip } : {}) });
export const userOut = (u) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, scope: u.sites?.length ? u.sites.join(", ") : "All sites", mfa: u.mfaEnabled, state: u.state, lastSignIn: u.lastSignIn ? day(u.lastSignIn) : "-" });
export const integrationOut = (i) => ({ id: String(i._id), name: i.name, purpose: i.purpose, status: i.status, lastSync: i.lastSync ? ago(i.lastSync) : "-", scope: i.scope, owner: i.ownerName });
export const workflowOut = (w) => ({ id: String(w._id), name: w.name, version: w.version, state: w.state, required: w.requiredDocuments.join(", "), owner: w.ownerName, updated: day(w.updatedAt) });
