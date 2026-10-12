import { useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const NAV = [
  ["overview", "Overview"], ["queue", "Work Queue"], ["cases", "Cases"], ["documents", "Documents"], ["tasks", "Tasks"],
  ["reports", "Reports"], ["audit", "Audit & Governance", "audit"], ["integrations", "Integrations", "integrations"], ["settings/users", "Settings", "settings"],
];
const ENV = import.meta.env.VITE_ENV_LABEL || "Demo environment";

export default function Layout() {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  return (
    <div className="shell">
      <nav className={`side ${open ? "open" : ""}`} aria-label="Main navigation">
        <div className="logo">CareOps AI</div>
        {NAV.filter(([, , area]) => !area || can(area)).map(([to, label]) => (
          <NavLink key={to} to={`/app/${to}`} onClick={() => setOpen(false)}>{label}</NavLink>
        ))}
        <NavLink to="/app/help">Help</NavLink>
        <NavLink to="/app/system-status">System status</NavLink>
      </nav>
      <div>
        <div className="demo" role="note">{ENV}: synthetic data only. Do not enter real patient information.</div>
        <header className="top">
          <button className="btn secondary sm menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle navigation">Menu</button>
          <select aria-label="Organisation and site" style={{ maxWidth: 220 }} defaultValue="all">
            <option value="all">{user?.org || "Demo Health Group"}: all sites</option><option>Site A</option><option>Site B</option>
          </select>
          <form className="grow" role="search" onSubmit={(e) => { e.preventDefault(); nav(`/app/cases?q=${encodeURIComponent(e.target.q.value)}`); }}>
            <input name="q" aria-label="Search cases and documents by ID" placeholder="Search by case or document ID" />
          </form>
          <Link to="/app/help" className="btn ghost sm">Help</Link>
          <div style={{ position: "relative" }}>
            <button className="btn secondary sm" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{user?.name || "Account"}</button>
            {menu && (
              <div className="card" role="menu" style={{ position: "absolute", right: 0, top: 40, width: 220, zIndex: 10 }}>
                <div className="small muted">{user?.role}</div>
                <Link role="menuitem" to="/app/settings/profile" onClick={() => setMenu(false)}>My profile</Link><br />
                <button className="btn ghost sm" role="menuitem" onClick={logout}>Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main id="main"><Outlet /></main>
      </div>
    </div>
  );
}
