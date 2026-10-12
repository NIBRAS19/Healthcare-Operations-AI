import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, useLoad } from "../api/client.js";
import { Async, Confirm, DataTable, Empty, PageHeader, StatusChip, useToast } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const VIEWS = ["All", "My work", "Needs review", "Incomplete", "Due today", "Overdue", "Unassigned"];
const today = () => new Date().toISOString().slice(0, 10);

function CaseTable({ title, sub, queue }) {
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const initial = { review: "Needs review", overdue: "Overdue", incomplete: "Incomplete" }[sp.get("view")] || "All";
  const [view, setView] = useState(initial);
  const [q, setQ] = useState(sp.get("q") || "");
  const [wf, setWf] = useState("");
  const [sel, setSel] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const state = useLoad(api.cases);

  const filter = (c) => {
    if (q && !`${c.id} ${c.workflow}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (wf && c.workflow !== wf) return false;
    return {
      "My work": c.owner === user?.name, "Needs review": c.status === "Needs review", Incomplete: c.missing > 0,
      "Due today": c.due === today(), Overdue: c.due < today() && !["Completed", "Cancelled"].includes(c.status), Unassigned: !c.owner, All: true,
    }[view];
  };
  const cols = [
    { key: "id", label: "Case ID", render: (c) => <Link to={`/app/cases/${c.id}`} onClick={(e) => e.stopPropagation()}>{c.id}</Link> },
    { key: "workflow", label: "Workflow" }, { key: "patientRef", label: "Patient reference" }, { key: "received", label: "Received" },
    { key: "status", label: "Status", render: (c) => <StatusChip status={c.status} /> },
    { key: "exception", label: "Missing / exception", render: (c) => (c.missing || c.exception) ? <>{c.missing ? `${c.missing} missing · ` : ""}{c.exception || "Needs review"}</> : <span className="muted">None</span> },
    { key: "owner", label: "Owner", render: (c) => c.owner || <span className="muted">Unassigned</span> },
    { key: "due", label: "Due", render: (c) => <>{c.due} {c.due < today() && !["Completed", "Cancelled"].includes(c.status) && <StatusChip status="Overdue" />}</> },
    { key: "lastActivity", label: "Last activity" },
  ];
  return (
    <>
      <PageHeader title={title} sub={sub}><Link className="btn" to="/app/cases/new">Create case</Link></PageHeader>
      <div className="row" style={{ marginBottom: 12 }}>
        {VIEWS.map((v) => <button key={v} className={`btn sm ${view === v ? "" : "secondary"}`} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input style={{ maxWidth: 260 }} aria-label="Search cases" placeholder="Search by case ID or workflow" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ maxWidth: 240 }} aria-label="Filter by workflow" value={wf} onChange={(e) => setWf(e.target.value)}>
          <option value="">All workflows</option><option>Referral intake</option><option>Document completeness</option><option>Administrative case summary</option>
        </select>
        {sel.length > 0 && <button className="btn secondary sm" onClick={() => setConfirm(true)}>Assign {sel.length} selected</button>}
      </div>
      <Async state={state}>{(all) => {
        const rows = all.filter(filter);
        return rows.length === 0 ? <div className="card"><Empty title="No matching cases" hint="Try removing a filter or choosing a different view." /></div>
          : <DataTable columns={cols} rows={rows} selectable onSelect={setSel} selected={sel} onRow={(c) => nav(`/app/cases/${c.id}`)} />;
      }}</Async>
      {confirm && <Confirm title="Assign selected cases" body="Assign the selected cases to yourself. Existing owners will be replaced." count={sel.length} reversible confirmLabel="Assign cases"
        onCancel={() => setConfirm(false)} onConfirm={async () => { await api.action("/cases/bulk-assign", { ids: sel }); toast(`Assigned ${sel.length} cases`); setSel([]); setConfirm(false); }} />}
    </>
  );
}
export const Queue = () => <CaseTable title="Work Queue" sub="Decide what to work on next" queue />;
export const Cases = () => <CaseTable title="Cases" sub="Search and manage case lifecycle" />;
