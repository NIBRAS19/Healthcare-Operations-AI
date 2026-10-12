import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { COOKIE, authenticate, cookieOpts, signSession } from "../middleware/auth.js";
import { wrap, HttpError } from "../middleware/errors.js";
import { Org, User } from "../db/models.js";
import { auditReq, writeAudit } from "../services/audit.js";

const r = Router();
const DUMMY = bcrypt.hashSync("not-a-real-password", 12); // equalises timing for unknown accounts
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: "Too many attempts. Try again later." } });
const creds = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });
const strongPw = z.string().min(12).max(200);

r.post("/login", limiter, wrap(async (req, res) => {
  const { email, password } = creds.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() });
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY);
  const locked = user?.lockUntil && user.lockUntil > new Date();
  if (!user || !ok || locked || user.state !== "Active") {
    if (user && !ok && !locked) { user.failedLogins += 1; if (user.failedLogins >= 5) { user.lockUntil = new Date(Date.now() + 15 * 60000); user.failedLogins = 0; } await user.save(); }
    if (user) await writeAudit({ orgId: user.orgId, actorId: user._id, actorName: user.name, event: "Login", outcome: "Failure", ip: req.ip });
    throw new HttpError(401, "Invalid credentials"); // identical for unknown account, wrong password, lockout, disabled
  }
  user.failedLogins = 0; user.lockUntil = undefined; user.lastSignIn = new Date(); await user.save();
  req.user = user;
  await auditReq(req, { event: "Login" });
  res.cookie(COOKIE, signSession(user), cookieOpts());
  const org = await Org.findById(user.orgId).lean();
  // mfa:false until a TOTP/SSO challenge is wired in (see README)
  res.json({ user: { name: user.name, role: user.role, org: org?.name, site: user.sites[0] || "All sites" }, mfa: false });
}));

r.post("/logout", authenticate, wrap(async (req, res) => { await auditReq(req, { event: "Logout" }); res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined }); res.json({}); }));
// Session revocation: bump tokenVersion so every issued token stops working
r.post("/logout-all", authenticate, wrap(async (req, res) => { req.user.tokenVersion += 1; await req.user.save(); await auditReq(req, { event: "Sessions revoked" }); res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined }); res.json({}); }));
r.get("/me", authenticate, (req, res) => res.json({ name: req.user.name, role: req.user.role }));

r.post("/accept-invite", limiter, wrap(async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(20).max(200), password: strongPw }).parse(req.body);
  const user = await User.findOne({ inviteHash: crypto.createHash("sha256").update(token).digest("hex"), inviteExpires: { $gt: new Date() } });
  if (!user) throw new HttpError(400, "This invitation is invalid or has expired");
  user.passwordHash = await bcrypt.hash(password, 12); user.state = "Active"; user.inviteHash = undefined; user.inviteExpires = undefined; await user.save();
  await writeAudit({ orgId: user.orgId, actorId: user._id, actorName: user.name, event: "Invitation accepted", ip: req.ip });
  res.json({ ok: true });
}));
export default r;
