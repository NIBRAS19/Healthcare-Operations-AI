import { Link } from "react-router-dom";
import { api, useLoad } from "../api/client.js";
import { Async, PageHeader, StatusChip, Timeline } from "../components/ui.jsx";

export default function Overview() {
  const cs = useLoad(api.cases);
  const au = useLoad(api.audit);
  return (
    <>
      <PageHeader title="Overview" sub="What needs attention today">
        <Link className="btn" to="/app/cases/new">Create case</Link><Link className="btn secondary" to="/app/queue">View queue</Link>
      </PageHeader>
      <Async state={cs}>{(cases) => {
        const today = new Date().toISOString().slice(0, 10);
        const open = cases.filter((c) => !["Completed", "Cancelled"].includes(c.status));
        const overdue = open.filter((c) => c.due < today);
        const review = cases.filter((c) => c.status === "Needs review");
        const incompleteRate = Math.round((cases.filter((c) => c.missing > 0).length / cases.length) * 100);
        const kpis = [
          ["Open cases", open.length, "/app/queue", "Cases not yet completed or cancelled."],
          ["Needs review", review.length, "/app/queue?view=review", "Cases with AI output waiting for human review."],
          ["Overdue", overdue.length, "/app/queue?view=overdue", "Open cases past their due date."],
          ["Incomplete rate", `${incompleteRate}%`, "/app/queue?view=incomplete", "Share of cases with one or more missing items."],
          ["AI processing failures", cases.filter((c) => c.status === "Failed").length, "/app/documents", "Documents where processing failed; use manual review."],
        ];
        const byWf = ["Referral intake", "Document completeness", "Administrative case summary"].map((w) => ({ w, n: cases.filter((c) => c.workflow === w).length, done: cases.filter((c) => c.workflow === w && c.status === "Completed").length }));
        const max = Math.max(...byWf.map((x) => x.n), 1);
        const attention = open.filter((c) => c.exception || c.due < today).slice(0, 6);
        return (
          <>
            <div className="grid g4" style={{ marginBottom: 16 }}>
              {kpis.map(([l, v, to, def]) => <Link key={l} to={to} className="card kpi" title={def}><span className="muted">{l}</span><b>{v}</b><span className="small muted">{def}</span></Link>)}
            </div>
            <div className="grid g2">
              <section className="card"><h2>Needs attention</h2>
                {attention.length === 0 ? <p className="muted">Nothing needs attention right now.</p> : attention.map((c) => (
                  <div key={c.id} className="row between" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <Link to={`/app/cases/${c.id}`}>{c.id}</Link><span className="small muted">{c.exception || "Overdue"}</span>
                    {c.due < today ? <StatusChip status="Overdue" /> : <StatusChip status={c.status} />}
                  </div>))}
              </section>
              <section className="card"><h2>Workflow volume</h2>
                <div className="bars" role="img" aria-label={byWf.map((x) => `${x.w}: ${x.n} cases, ${x.done} completed`).join(". ")}>
                  {byWf.map((x) => <div key={x.w}><i style={{ height: `${(x.n / max) * 100}px` }} /><i className="b2" style={{ height: `${(x.done / max) * 100}px` }} />{x.w.split(" ")[0]}</div>)}
                </div>
                <p className="small muted">Dark: received. Light: completed. Demo data.</p>
              </section>
              <section className="card"><h2>Recent activity</h2><Async state={au}>{(a) => <Timeline items={a.slice(0, 5)} />}</Async></section>
              <section className="card"><h2>System health</h2>
                <div className="row between"><span>Document processing</span><StatusChip status="Connected" /></div>
                <div className="row between" style={{ marginTop: 8 }}><span>OCR provider</span><StatusChip status="Degraded" /></div>
                <p className="small muted">If AI is unavailable you can continue manually; no case data is lost.</p>
              </section>
            </div>
          </>
        );
      }}</Async>
    </>
  );
}
