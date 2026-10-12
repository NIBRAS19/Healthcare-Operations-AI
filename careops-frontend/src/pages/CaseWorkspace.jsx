import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, useLoad } from "../api/client.js";
import { AISuggestion, Async, Confirm, StatusChip, Tabs, Timeline, useToast } from "../components/ui.jsx";

const TABS = ["Overview", "Documents", "AI review", "Tasks", "Activity & audit"];

export default function CaseWorkspace() {
  const { id } = useParams();
  const toast = useToast();
  const [tab, setTab] = useState("Overview");
  const [reviewed, setReviewed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState("Saved");
  const cs = useLoad(api.cases);
  const docs = useLoad(api.documents);
  const tasks = useLoad(api.tasks);
  const audit = useLoad(api.audit);
  const sum = useLoad(() => api.summary(id), [id]);
  const fields = useLoad(() => api.fields("DOC-5001"), []);

  return (
    <Async state={cs}>{(all) => {
      const c = all.find((x) => x.id === id);
      if (!c) return <div className="card"><h2>Case not found</h2><p className="muted">It may not exist, or you may not have access.</p><Link to="/app/cases">Back to cases</Link></div>;
      const uncertain = c.exception === "Uncertain identity match";
      const cta = uncertain ? "Verify patient reference" : c.missing ? "Request missing information" : !c.owner ? "Assign owner" : !reviewed ? "Review extracted fields" : "Approve administrative summary";
      const checklist = [["Referral letter", true], ["Identity document", true], ["Insurance member number", c.missing === 0]];
      return (
        <>
          <div className="small muted"><Link to="/app/cases">Cases</Link> / {c.id}</div>
          <div className="row between" style={{ margin: "6px 0 16px" }}>
            <div><h1>{c.id} <StatusChip status={reviewed ? "Approved" : c.status} /></h1>
              <div className="muted">{c.workflow} · {c.site} · Owner: {c.owner || "Unassigned"} · Due {c.due} · Updated {c.lastActivity}</div></div>
            <div className="row"><button className="btn secondary" onClick={() => toast("Owner assigned to you")}>Assign</button>
              <button className="btn" onClick={() => (cta.startsWith("Approve") ? setConfirm(true) : setTab(cta.startsWith("Request") ? "Tasks" : "AI review"))}>{cta}</button></div>
          </div>
          {uncertain && <div className="card" role="alert" style={{ borderColor: "var(--danger)" }}>
            <b>The patient/case association is uncertain.</b> Processing has paused until an authorised user verifies it.
            <div className="row" style={{ marginTop: 8 }}><button className="btn secondary sm" onClick={() => toast("Escalated to team lead")}>Stop processing and escalate</button></div></div>}
          <Tabs tabs={TABS} value={tab} onChange={setTab} />

          {tab === "Overview" && <div className="grid g2">
            <section className="card"><h2>Completeness checklist</h2>
              {checklist.map(([n, ok]) => <div key={n} className="row between" style={{ padding: "4px 0" }}><span>{n}</span>{ok ? <StatusChip status="Completed" /> : <StatusChip status="Incomplete" />}</div>)}
              {c.missing > 0 && <p className="small muted">Not detected in supplied documents: {c.missing} item(s). Check the source or request them.</p>}</section>
            <section className="card"><h2>Internal notes</h2>
              <textarea rows={4} aria-label="Internal note" value={note} onChange={(e) => { setNote(e.target.value); setSaved("Saving…"); setTimeout(() => setSaved("Saved"), 600); }} />
              <div className="small muted" role="status">{saved}</div></section></div>}

          {tab === "Documents" && <Async state={docs}>{(d) => <section className="card"><h2>Documents</h2>
            {d.filter((x) => x.caseId === id).length === 0 ? <p className="muted">No documents linked to this case yet.</p> :
              d.filter((x) => x.caseId === id).map((x) => <div key={x.id} className="row between" style={{ padding: "6px 0" }}>
                <Link to={`/app/documents/${x.id}`}>{x.name}</Link><span className="small muted">{x.type} · v{x.version}</span><StatusChip status={x.review} /></div>)}
            <p className="small muted">Showing documents for this case. Use the library to link others.</p></section>}</Async>}

          {tab === "AI review" && <div className="grid g2">
            <section>
              <Async state={sum}>{(s) => <div className="ai">
                <div className="row between"><span className="tag">AI-generated administrative summary</span><span className="small muted">Generated {s.generated} from {s.count} documents</span></div>
                <p>{s.text}</p><div className="small">Sources: {s.sources.map((x) => <button key={x.doc} className="cite" onClick={() => setSource(x.snippet)} style={{ marginRight: 8 }}>{x.doc}, p.{x.page}</button>)}</div>
                <p className="small muted">Review the linked sources before using it. "Not detected" does not mean the information doesn't exist.</p>
                <div className="row"><button className="btn secondary sm" onClick={() => toast("Draft opened for editing")}>Edit</button>
                  <button className="btn sm" disabled={reviewed} onClick={() => setConfirm(true)}>{reviewed ? "Reviewed" : "Mark summary reviewed"}</button></div></div>}</Async>
              <h3>Extracted fields</h3>
              <Async state={fields}>{(f) => f.map((x) => <AISuggestion key={x.label} {...x} doc="DOC-5001" onOpenSource={setSource} onAccept={() => toast(`${x.label} accepted`)} onReject={() => toast(`${x.label} rejected`)} onEdit={() => toast("Edit field")} />)}</Async>
            </section>
            <section className="card"><h3>Source evidence</h3>
              {source ? <div className="doc"><p>…</p><p><mark>{source}</mark></p><p>…</p></div> : <p className="muted">Select "Open source" on a field or citation to view the matching text. If a source can't be located you'll see "Source location unavailable".</p>}</section></div>}

          {tab === "Tasks" && <Async state={tasks}>{(t) => <section className="card"><h2>Tasks</h2>
            {t.filter((x) => x.caseId === id).length === 0 ? <p className="muted">No tasks yet.</p> : t.filter((x) => x.caseId === id).map((x) => <div key={x.id} className="row between" style={{ padding: "6px 0" }}><b>{x.title}</b><span className="small muted">{x.owner} · due {x.due}</span><StatusChip status={x.status} /></div>)}
            <button className="btn secondary sm" style={{ marginTop: 8 }} onClick={() => toast("Task created for missing evidence")}>Create task for missing evidence</button></section>}</Async>}

          {tab === "Activity & audit" && <Async state={audit}>{(a) => <section className="card"><h2>Timeline</h2><Timeline items={a.filter((e) => e.object === id).length ? a.filter((e) => e.object === id) : a.slice(0, 6)} /></section>}</Async>}

          {confirm && <Confirm title="Approve administrative summary" body="You are approving this summary as an administrative record after reviewing its sources. This is not a clinical validation." reversible confirmLabel="Approve summary"
            onCancel={() => setConfirm(false)} onConfirm={async () => { await api.action(`/cases/${id}/summary/approve`); setReviewed(true); setConfirm(false); toast("Summary approved and logged"); }} />}
        </>
      );
    }}</Async>
  );
}
