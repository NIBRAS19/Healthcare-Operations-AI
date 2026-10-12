import { api, useLoad } from "../api/client.js";
import { Async, Confirm, DataTable, PageHeader, StatusChip, useToast } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useState } from "react";

export function Integrations() {
  const state = useLoad(api.integrations);
  const toast = useToast();
  const [off, setOff] = useState(null);
  return (
    <>
      <PageHeader title="Integrations" sub="Approved connections only. Secrets are never shown." />
      <Async state={state}>{(list) => <div className="grid g2">{list.map((i) => (
        <section key={i.id} className="card">
          <div className="row between"><h3>{i.name}</h3><StatusChip status={i.status} /></div>
          <div className="muted">{i.purpose}</div>
          <div className="small">Permission scope: {i.scope}<br />Last sync: {i.lastSync} · Owner: {i.owner}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn secondary sm" onClick={() => toast("Connection test started (synthetic data)")}>Test connection</button>
            <button className="btn secondary sm" onClick={() => setOff(i)}>Pause</button></div>
        </section>))}</div>}</Async>
      {off && <Confirm danger title={`Pause ${off.name}`} body="Syncing will stop. Cases already imported are not affected." count={1} reversible confirmLabel="Pause integration"
        onCancel={() => setOff(null)} onConfirm={async () => { await api.action(`/integrations/${off.id}/pause`); toast("Integration paused and logged"); setOff(null); }} />}
    </>
  );
}

export function Users() {
  const state = useLoad(api.users);
  const toast = useToast();
  const cols = [
    { key: "name", label: "Name", render: (u) => <>{u.name}<div className="small muted">{u.email}</div></> }, { key: "role", label: "Role" }, { key: "scope", label: "Scope" },
    { key: "state", label: "Account", render: (u) => <StatusChip status={u.state} /> }, { key: "mfa", label: "MFA", render: (u) => (u.mfa ? "Enabled" : "Not set up") }, { key: "lastSignIn", label: "Last sign-in" },
  ];
  return (
    <>
      <PageHeader title="Users & roles" sub="Least privilege: grant only the access each role needs"><button className="btn" onClick={() => toast("Invitation form opens here")}>Invite user</button></PageHeader>
      <Async state={state}>{(u) => <DataTable columns={cols} rows={u} />}</Async>
    </>
  );
}

export function Workflows() {
  const state = useLoad(api.workflows);
  const cols = [{ key: "name", label: "Template" }, { key: "version", label: "Version", render: (w) => `v${w.version}` }, { key: "state", label: "State", render: (w) => <StatusChip status={w.state} /> },
    { key: "required", label: "Required documents" }, { key: "owner", label: "Owner" }, { key: "updated", label: "Updated" }];
  return (
    <>
      <PageHeader title="Workflow templates" sub="Publishing creates a new version. Existing cases keep their original version." />
      <Async state={state}>{(w) => <DataTable columns={cols} rows={w} />}</Async>
      <p className="small muted">A workflow can't be published without a manual-fallback path and any approval step your policy requires.</p>
    </>
  );
}

export function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  return (
    <>
      <PageHeader title="My profile" />
      <form className="card" style={{ maxWidth: 520 }} onSubmit={(e) => { e.preventDefault(); toast("Preferences saved"); }}>
        <label htmlFor="n">Name</label><input id="n" value={user?.name || ""} readOnly />
        <label htmlFor="l">Preferred language</label><select id="l"><option>English</option><option>العربية (Arabic)</option></select>
        <label htmlFor="d">Table density</label><select id="d"><option>Comfortable</option><option>Compact</option></select>
        <div className="row" style={{ marginTop: 16 }}><button className="btn">Save preferences</button></div>
      </form>
    </>
  );
}

export function Help() {
  return (
    <>
      <PageHeader title="Help centre" />
      <div className="grid g2">
        <section className="card"><h2>How AI suggestions work</h2><p>AI suggestions are drafts. Each one shows its source. You review, edit or reject it. AI never diagnoses, recommends treatment or approves claims.</p></section>
        <section className="card"><h2>If AI is unavailable</h2><p>Continue manually. Use "Enter manually" on any field. No case data is lost.</p></section>
        <section className="card"><h2>Report a problem</h2><p>Include a case or correlation ID if you wish. Never paste patient information into a report.</p></section>
      </div>
    </>
  );
}

export function SystemStatus() {
  const rows = [["Application API", "Connected"], ["Document processing queue", "Connected"], ["OCR provider", "Degraded"], ["AI provider", "Connected"], ["Storage", "Connected"], ["Integrations", "Degraded"]];
  return (
    <>
      <PageHeader title="System status" />
      <section className="card">{rows.map(([n, s]) => <div key={n} className="row between" style={{ padding: "6px 0" }}><span>{n}</span><StatusChip status={s} /></div>)}</section>
    </>
  );
}
