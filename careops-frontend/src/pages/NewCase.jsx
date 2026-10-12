import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { PageHeader, useToast } from "../components/ui.jsx";

const OK_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_MB = 20;

export default function NewCase() {
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ workflow: "Referral intake", ref: "", patientRef: "", site: "Site A", received: new Date().toISOString().slice(0, 10), notes: "" });
  const [files, setFiles] = useState([]);
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function addFiles(list) {
    const bad = [...list].filter((x) => !OK_TYPES.includes(x.type) || x.size > MAX_MB * 1048576);
    if (bad.length) toast(`Unsupported or oversized file: ${bad.map((b) => b.name).join(", ")}. Use PDF, JPEG or PNG under ${MAX_MB} MB.`, true);
    setFiles([...files, ...[...list].filter((x) => !bad.includes(x))]);
  }
  async function submit(draft) {
    const e = {};
    if (!f.patientRef.trim()) e.patientRef = "Enter the minimum necessary patient reference (a source-system ID or token, not a name).";
    if (/\d{3}-?\d{4}-?\d{7}-?\d/.test(f.patientRef)) e.patientRef = "This looks like a national ID number. Use a source-system reference instead.";
    setErrs(e);
    if (Object.keys(e).length) return;
    const c = await api.createCase({ ...f, draft, fileNames: files.map((x) => x.name) });
    toast(draft ? "Draft saved" : `Case ${c.id} created. Next: review extracted fields.`);
    nav(`/app/cases/${draft ? "CASE-1001" : c.id}`);
  }
  return (
    <>
      <PageHeader title="Create case" sub="Add only what the workflow needs" />
      <form className="card" style={{ maxWidth: 720 }} onSubmit={(e) => { e.preventDefault(); submit(false); }} noValidate>
        <label htmlFor="wf">Workflow type</label>
        <select id="wf" value={f.workflow} onChange={set("workflow")}><option>Referral intake</option><option>Document completeness</option><option>Administrative case summary</option></select>
        <label htmlFor="ref">Source-system reference (optional)</label>
        <input id="ref" value={f.ref} onChange={set("ref")} />
        <label htmlFor="pr">Patient reference</label>
        <input id="pr" value={f.patientRef} onChange={set("patientRef")} aria-invalid={!!errs.patientRef} aria-describedby="pr-e" />
        <div id="pr-e" className="err" role="alert">{errs.patientRef}</div>
        <div className="grid g2" style={{ gap: 12 }}>
          <div><label htmlFor="site">Site</label><select id="site" value={f.site} onChange={set("site")}><option>Site A</option><option>Site B</option></select></div>
          <div><label htmlFor="rec">Received date</label><input id="rec" type="date" value={f.received} onChange={set("received")} /></div>
        </div>
        <label htmlFor="up">Documents</label>
        <input id="up" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" capture="environment" onChange={(e) => addFiles(e.target.files)} />
        {files.map((x) => <div key={x.name} className="small">{x.name} ({Math.round(x.size / 1024)} KB)</div>)}
        <label htmlFor="n">Notes</label>
        <textarea id="n" rows={3} value={f.notes} onChange={set("notes")} />
        <div className="small muted">Don't add unnecessary sensitive details. Notes are visible to authorised case staff.</div>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn">Submit to workflow</button>
          <button type="button" className="btn secondary" onClick={() => submit(true)}>Save draft</button>
        </div>
      </form>
    </>
  );
}
