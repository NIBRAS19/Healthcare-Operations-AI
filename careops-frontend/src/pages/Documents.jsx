import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, useLoad } from "../api/client.js";
import { AISuggestion, Async, DataTable, PageHeader, StatusChip, useToast } from "../components/ui.jsx";

export function Documents() {
  const nav = useNavigate();
  const toast = useToast();
  const [type, setType] = useState("");
  const state = useLoad(api.documents);
  const cols = [
    { key: "name", label: "Document", render: (d) => <><Link to={`/app/documents/${d.id}`} onClick={(e) => e.stopPropagation()}>{d.name}</Link><div className="small muted">{d.id}</div></> },
    { key: "type", label: "Type" }, { key: "caseId", label: "Case" }, { key: "language", label: "Language" }, { key: "uploaded", label: "Uploaded" },
    { key: "processing", label: "Processing", render: (d) => <StatusChip status={d.processing} /> },
    { key: "review", label: "Review", render: (d) => <StatusChip status={d.review} /> }, { key: "version", label: "Version", render: (d) => `v${d.version}` },
    { key: "a", label: "Actions", render: (d) => d.processing === "Failed" ? <button className="btn secondary sm" onClick={(e) => { e.stopPropagation(); toast("Reprocessing queued"); }}>Reprocess</button> : null },
  ];
  return (
    <>
      <PageHeader title="Documents" sub="Documents you are authorised to see" />
      <select style={{ maxWidth: 240, marginBottom: 12 }} aria-label="Filter by document type" value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">All document types</option><option>Referral letter</option><option>Insurance form</option><option>Identity document</option><option>Supporting report</option>
      </select>
      <Async state={state}>{(d) => <DataTable columns={cols} rows={d.filter((x) => !type || x.type === type)} onRow={(x) => nav(`/app/documents/${x.id}`)} />}</Async>
    </>
  );
}

export function DocumentReview() {
  const { id } = useParams();
  const toast = useToast();
  const docs = useLoad(api.documents);
  const fields = useLoad(() => api.fields(id), [id]);
  const [src, setSrc] = useState("");
  return (
    <Async state={docs}>{(all) => {
      const d = all.find((x) => x.id === id);
      if (!d) return <div className="card"><h2>Document not found</h2></div>;
      return (
        <>
          <div className="small muted"><Link to="/app/documents">Documents</Link> / {d.id}</div>
          <PageHeader title={d.name} sub={`${d.type} · linked to ${d.caseId} · v${d.version}`}><StatusChip status={d.processing} /></PageHeader>
          {d.processing === "Failed" && <div className="card" role="alert"><b>Processing failed; use manual review.</b> No data has been lost. <button className="btn secondary sm" onClick={() => toast("Reprocessing queued")}>Reprocess</button></div>}
          <div className="grid g2">
            <section className="card"><h2>Source document</h2>
              <div className="doc"><p>Referral letter (synthetic example)</p><p>Date of referral: 18 September 2026</p><p>Referring facility: Demo Medical Clinic</p><p>Service requested: outpatient imaging (type unclear)</p>
                {src && <p><mark>{src}</mark></p>}</div>
              <div className="row small muted" style={{ marginTop: 8 }}>Page 1 of 2</div></section>
            <section><h2>Extracted fields</h2>
              <p className="small muted">Edits never overwrite the original AI output; revisions are kept.</p>
              <Async state={fields}>{(f) => f.map((x) => <AISuggestion key={x.label} {...x} onOpenSource={setSrc} onAccept={() => toast(`${x.label} accepted`)} onReject={() => toast(`${x.label} rejected`)} onEdit={() => toast("Edit saved as a new revision")} />)}</Async>
              <button className="btn secondary sm" onClick={() => toast("Escalated; processing paused", true)}>Stop processing and escalate</button></section>
          </div>
        </>
      );
    }}</Async>
  );
}
