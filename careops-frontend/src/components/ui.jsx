import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

/* Status chip: icon + text, never colour alone */
const TONE = {
  New: ["info", "●"], Processing: ["info", "◔"], "Needs review": ["warning", "!"], Incomplete: ["warning", "◐"],
  "Ready for approval": ["info", "✓?"], Approved: ["success", "✓"], "In progress": ["info", "▶"],
  "Waiting for external information": ["neutral", "…"], Completed: ["success", "✓"], Processed: ["success", "✓"],
  Failed: ["danger", "✕"], Cancelled: ["neutral", "–"], Overdue: ["danger", "⏰"], Success: ["success", "✓"], Denied: ["danger", "✕"],
  Connected: ["success", "✓"], Degraded: ["warning", "!"], "Awaiting approval": ["neutral", "…"], Active: ["success", "✓"], Draft: ["neutral", "✎"],
  Invited: ["neutral", "✉"], "Not reviewed": ["neutral", "○"], "High": ["success", "✓"], "Review required": ["warning", "!"], "Not detected": ["danger", "∅"],
};
export function StatusChip({ status }) {
  const [tone, icon] = TONE[status] || ["neutral", "•"];
  return <span className={`chip ${tone}`}><span aria-hidden="true">{icon}</span>{status}</span>;
}

/* Toasts with screen-reader announcement */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((msg, bad) => {
    const id = Math.random();
    setList((l) => [...l, { id, msg, bad }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{list.map((t) => <div key={t.id} className={`toast ${t.bad ? "bad" : ""}`}>{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="row between" style={{ marginBottom: 16 }}>
      <div><h1>{title}</h1>{sub && <div className="muted">{sub}</div>}</div>
      <div className="row">{children}</div>
    </div>
  );
}

export const Skeleton = () => <div aria-busy="true" aria-label="Loading">{[80, 100, 60, 90].map((w, i) => <div key={i} className="skel" style={{ width: `${w}%` }} />)}</div>;
export const Empty = ({ title, hint, children }) => <div className="empty"><h3>{title}</h3><p>{hint}</p>{children}</div>;

/* Handles loading / error / permission-denied / empty states in one place */
export function Async({ state, children, empty }) {
  if (state.loading) return <div className="card"><Skeleton /></div>;
  if (state.error) {
    const denied = state.error.message === "Permission denied";
    return (
      <div className="card" role="alert">
        <h3>{denied ? "You don't have access to this page" : "Couldn't load this data"}</h3>
        <p className="muted">{denied ? "Ask your administrator to review your role. No data was shown." : "Your filters are kept. Check your connection and try again."}</p>
        {!denied && <button className="btn secondary" onClick={state.retry}>Retry</button>}
      </div>
    );
  }
  if (empty && (!state.data || state.data.length === 0)) return <div className="card">{empty}</div>;
  return children(state.data);
}

/* Generic table: columns = [{key,label,render?}], sticky header, pagination, optional row click */
export function DataTable({ columns, rows, onRow, pageSize = 10, selectable, selected = [], onSelect }) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState(null);
  let r = rows;
  if (sort) r = [...rows].sort((a, b) => String(a[sort.k]).localeCompare(String(b[sort.k])) * sort.dir);
  const pages = Math.max(1, Math.ceil(r.length / pageSize));
  useEffect(() => setPage(0), [rows.length]);
  const view = r.slice(page * pageSize, page * pageSize + pageSize);
  return (
    <>
      <div className="tw">
        <table>
          <thead><tr>
            {selectable && <th><span className="small">Select</span></th>}
            {columns.map((c) => (
              <th key={c.key} aria-sort={sort?.k === c.key ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
                <button className="btn ghost sm" style={{ padding: 0, color: "inherit" }} onClick={() => setSort({ k: c.key, dir: sort?.k === c.key ? -sort.dir : 1 })}>{c.label}{sort?.k === c.key ? (sort.dir > 0 ? " ▲" : " ▼") : ""}</button>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {view.map((row, i) => (
              <tr key={row.id || i} className={onRow ? "click" : ""} onClick={() => onRow?.(row)}
                  tabIndex={onRow ? 0 : undefined} onKeyDown={(e) => e.key === "Enter" && onRow?.(row)}>
                {selectable && <td onClick={(e) => e.stopPropagation()}><input type="checkbox" style={{ width: 18, minHeight: 18 }} aria-label={`Select ${row.id}`} checked={selected.includes(row.id)} onChange={() => onSelect(selected.includes(row.id) ? selected.filter((x) => x !== row.id) : [...selected, row.id])} /></td>}
                {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key] || <span className="muted">-</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row between small muted" style={{ marginTop: 8 }}>
        <span>{r.length} result{r.length === 1 ? "" : "s"}</span>
        <span className="row">
          <button className="btn secondary sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          Page {page + 1} of {pages}
          <button className="btn secondary sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </span>
      </div>
    </>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return <div className="tabs" role="tablist">{tabs.map((t) => <button key={t} role="tab" aria-selected={value === t} onClick={() => onChange(t)}>{t}</button>)}</div>;
}

export function Drawer({ title, onClose, children }) {
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="row between"><h2>{title}</h2><button className="btn ghost sm" onClick={onClose}>Close</button></div>
        {children}
      </aside>
    </>
  );
}

/* Confirmation for consequential actions: states what happens, count, reversibility */
export function Confirm({ title, body, count, reversible, confirmLabel, onConfirm, onCancel, danger }) {
  return (
    <Drawer title={title} onClose={onCancel}>
      <p>{body}</p>
      {count != null && <p><b>Affected records:</b> {count}</p>}
      <p className="muted">{reversible ? "This can be reversed." : "This cannot be reversed."} The action is recorded in the audit log.</p>
      <div className="row"><button className={`btn ${danger ? "danger" : ""}`} onClick={onConfirm}>{confirmLabel}</button><button className="btn secondary" onClick={onCancel}>Cancel</button></div>
    </Drawer>
  );
}

/* AI suggestion: always labelled, with source + review state + accept/edit/reject */
export function AISuggestion({ label, value, conf, page, snippet, doc, onAccept, onReject, onEdit, onOpenSource }) {
  const unverified = !snippet;
  return (
    <div className="ai">
      <div className="row between"><span className="tag">AI suggestion</span><StatusChip status={conf} /></div>
      <div style={{ margin: "6px 0" }}><b>{label}:</b> {value || <span className="muted">Not detected in this document. Check the source or enter it manually.</span>}</div>
      <div className="small muted">
        {unverified ? "Unverified: no source evidence." : <>Source: {doc ? `${doc}, ` : ""}page {page}{" "}<button className="cite" onClick={() => onOpenSource?.(snippet)}>Open source</button></>}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" disabled={unverified} onClick={onAccept}>Accept</button>
        <button className="btn secondary sm" onClick={onEdit}>Edit</button>
        <button className="btn secondary sm" onClick={onReject}>Reject</button>
      </div>
    </div>
  );
}

export const Timeline = ({ items }) => (
  <div className="tl">{items.map((e, i) => <div key={i}><b>{e.event}</b><div className="small muted">{e.actor} · {e.ts}</div></div>)}</div>
);
