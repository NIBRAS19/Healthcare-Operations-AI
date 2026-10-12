import { useState } from "react";
import { Link } from "react-router-dom";
import { api, useLoad } from "../api/client.js";
import { Async, DataTable, Drawer, PageHeader, StatusChip, Tabs, useToast } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const today = () => new Date().toISOString().slice(0, 10);

export function Tasks() {
  const { user } = useAuth();
  const toast = useToast();
  const [view, setView] = useState("My tasks");
  const [open, setOpen] = useState(null);
  const state = useLoad(api.tasks);
  const f = (t) => ({ "My tasks": t.owner === user?.name, "Team tasks": true, "Due today": t.due === today(), Overdue: t.due < today() && t.status !== "Completed", Completed: t.status === "Completed" }[view]);
  const cols = [
    { key: "title", label: "Task" }, { key: "caseId", label: "Case", render: (t) => <Link to={`/app/cases/${t.caseId}`} onClick={(e) => e.stopPropagation()}>{t.caseId}</Link> },
    { key: "owner", label: "Owner" }, { key: "priority", label: "Operational priority" }, { key: "due", label: "Due" },
    { key: "status", label: "Status", render: (t) => <StatusChip status={t.status} /> }, { key: "last", label: "Last activity" },
  ];
  return (
    <>
      <PageHeader title="Tasks" sub="Priority is operational only and says nothing about clinical urgency" />
      <Tabs tabs={["My tasks", "Team tasks", "Due today", "Overdue", "Completed"]} value={view} onChange={setView} />
      <Async state={state}>{(t) => <DataTable columns={cols} rows={t.filter(f)} onRow={setOpen} />}</Async>
      {open && <Drawer title={open.title} onClose={() => setOpen(null)}>
        <p>Linked case: <Link to={`/app/cases/${open.caseId}`}>{open.caseId}</Link></p><p>Owner: {open.owner} · Due {open.due}</p>
        <div className="row"><button className="btn" onClick={() => { toast("Task completed and logged"); setOpen(null); }}>Complete</button><button className="btn secondary" onClick={() => toast("Escalated to team lead")}>Escalate</button></div></Drawer>}
    </>
  );
}

export function Reports() {
  const cs = useLoad(api.cases);
  const [range, setRange] = useState("30");
  return (
    <>
      <PageHeader title="Reports" sub="Operational metrics. Demo data."><select aria-label="Date range" style={{ width: 160 }} value={range} onChange={(e) => setRange(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></PageHeader>
      <Async state={cs}>{(c) => {
        const counts = c.reduce((a, x) => ({ ...a, [x.status]: (a[x.status] || 0) + 1 }), {});
        const max = Math.max(...Object.values(counts));
        return (
          <>
            <section className="card"><h2>Status distribution</h2>
              {Object.entries(counts).map(([s, n]) => <div key={s} className="row" style={{ marginBottom: 6 }}><span style={{ width: 230 }}>{s}</span><div style={{ flex: 1, background: "#EEF2F4", borderRadius: 4 }}><div style={{ width: `${(n / max) * 100}%`, background: "var(--brand-700)", height: 14, borderRadius: 4 }} /></div><b style={{ width: 28 }}>{n}</b></div>)}
              <p className="small muted">Definition: count of cases by current status. Time zone: Gulf Standard Time (UTC+4). Groups under 5 would be suppressed to reduce re-identification risk in real deployments.</p></section>
            <div className="row"><button className="btn secondary" onClick={() => {
              const csv = ["status,count", ...Object.entries(counts).map(([k, v]) => `${k},${v}`)].join("\n");
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "status-report-demo.csv"; a.click();
            }}>Export report (CSV)</button></div>
          </>
        );
      }}</Async>
    </>
  );
}

export function Audit() {
  const state = useLoad(api.audit);
  const [sel, setSel] = useState(null);
  const [outcome, setOutcome] = useState("");
  const cols = [
    { key: "ts", label: "Timestamp" }, { key: "actor", label: "Actor" }, { key: "event", label: "Event" }, { key: "object", label: "Object" },
    { key: "outcome", label: "Outcome", render: (e) => <StatusChip status={e.outcome} /> },
  ];
  return (
    <>
      <PageHeader title="Audit log" sub="Events can't be edited. Corrections are recorded as new events." />
      <select aria-label="Filter by outcome" style={{ maxWidth: 200, marginBottom: 12 }} value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">All outcomes</option><option>Success</option><option>Denied</option></select>
      <Async state={state}>{(a) => <DataTable columns={cols} rows={a.filter((e) => !outcome || e.outcome === outcome)} onRow={setSel} />}</Async>
      {sel && <Drawer title={sel.event} onClose={() => setSel(null)}>
        <p>Event ID: {sel.id}</p><p>Actor: {sel.actor}</p><p>Object: {sel.object}</p><p>Time: {sel.ts}</p>
        {sel.model && <p>AI model / prompt version: {sel.model}</p>}<p className="small muted">Before/after values appear here when policy permits.</p></Drawer>}
    </>
  );
}
