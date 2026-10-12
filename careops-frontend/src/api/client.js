// Single API layer. VITE_USE_MOCK=true serves synthetic data; otherwise it calls the Express API at /api.
import { useEffect, useState, useCallback } from "react";
import * as m from "../data/mock.js";
const MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 250));

async function http(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: "include", // httpOnly session cookie issued by the server
    headers: { "Content-Type": "application/json" }, ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { window.dispatchEvent(new Event("careops:session-expired")); throw new Error("Session expired"); }
  if (res.status === 403) throw new Error("Permission denied");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Request failed");
  return res.json();
}
const pick = (key, path) => (MOCK ? wait(m[key]) : http(path));

export const api = {
  login: (email, password) => MOCK ? wait({ user: { name: "Amina Khalid", role: "Operations administrator", org: "Demo Health Group", site: "Site A" }, mfa: false }) : http("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => (MOCK ? wait({}) : http("/auth/logout", { method: "POST" })),
  cases: () => pick("cases", "/cases"),
  documents: () => pick("documents", "/documents"),
  tasks: () => pick("tasks", "/tasks"),
  audit: () => pick("audit", "/audit"),
  users: () => pick("users", "/users"),
  integrations: () => pick("integrations", "/integrations"),
  workflows: () => pick("workflows", "/workflows"),
  fields: (docId) => (MOCK ? wait(m.fields) : http(`/documents/${docId}/fields`)),
  summary: (caseId) => (MOCK ? wait(m.summary) : http(`/cases/${caseId}/summary`)),
  createCase: (body) => (MOCK ? wait({ id: "CASE-1099", status: "New", ...body }) : http("/cases", { method: "POST", body })),
  action: (path, body) => (MOCK ? wait({ ok: true }) : http(path, { method: "POST", body })),
};

export function useLoad(fn, deps = []) {
  const [s, set] = useState({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    set((x) => ({ ...x, loading: true, error: null }));
    fn().then((data) => set({ data, error: null, loading: false })).catch((error) => set({ data: null, error, loading: false }));
  }, deps); // eslint-disable-line
  useEffect(run, [run]);
  return { ...s, retry: run };
}
