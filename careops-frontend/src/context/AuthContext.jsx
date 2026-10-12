import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
const DEMO = import.meta.env.VITE_USE_MOCK !== "false";

// UI visibility only. The server MUST enforce RBAC on every API call and object.
const AREA_ROLES = { audit: ["Compliance officer", "IT administrator"], integrations: ["IT administrator", "Team lead"], settings: ["IT administrator", "Team lead"] };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem("careops_user") || "null"));
  const nav = useNavigate();
  const save = (u) => { setUser(u); u ? sessionStorage.setItem("careops_user", JSON.stringify(u)) : sessionStorage.removeItem("careops_user"); };
  useEffect(() => {
    const h = () => { save(null); nav("/login?expired=1"); };
    window.addEventListener("careops:session-expired", h);
    return () => window.removeEventListener("careops:session-expired", h);
  }, []); // eslint-disable-line
  const can = (area) => !AREA_ROLES[area] || DEMO || (user && AREA_ROLES[area].includes(user.role));
  const login = async (e, p) => { const r = await api.login(e, p); if (!r.mfa) save(r.user); return r; };
  const logout = async () => { await api.logout().catch(() => {}); save(null); nav("/login"); };
  return <Ctx.Provider value={{ user, login, logout, can }}>{children}</Ctx.Provider>;
}
