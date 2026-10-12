import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(q.get("expired") ? "Your session expired. Sign in again to continue." : "");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!email || !pw) return setError("Enter your work email and password.");
    setBusy(true);
    try {
      const r = await login(email, pw);
      nav(r.mfa ? "/login?mfa=1" : "/app/overview"); // wire a /mfa page when the backend issues MFA challenges
    } catch {
      // Generic message: never reveal whether the account exists. Password is not kept.
      setError("We couldn't sign you in with those details. Check them and try again, or contact your administrator.");
      setPw("");
    } finally { setBusy(false); }
  }
  return (
    <div className="login">
      <div className="brand">
        <h1 style={{ fontSize: 34 }}>CareOps AI</h1>
        <p style={{ maxWidth: 380, fontSize: 16 }}>Clear administrative workflows. AI suggestions with source evidence. Every action reviewed and recorded.</p>
      </div>
      <div className="form">
        <form className="card" onSubmit={submit} noValidate aria-labelledby="t">
          <h2 id="t">Sign in</h2>
          {error && <div className="err" role="alert">{error}</div>}
          <label htmlFor="email">Work email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="pw">Password</label>
          <input id="pw" type={show ? "text" : "password"} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <label style={{ fontWeight: 400 }}><input type="checkbox" style={{ width: 16, minHeight: 16 }} checked={show} onChange={() => setShow(!show)} /> Show password</label>
          <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 12 }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <button type="button" className="btn secondary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} disabled>Continue with SSO</button>
          <p className="small muted">Demo mode: any email and password works. <Link to="/login">Forgot password?</Link></p>
        </form>
      </div>
    </div>
  );
}
