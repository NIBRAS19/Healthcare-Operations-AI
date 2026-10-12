import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../db/models.js";
import { auditReq } from "../services/audit.js";
import { wrap } from "./errors.js";

export const COOKIE = "careops_session";
// Server-side RBAC. Note IT administrators get NO case/document content access by default (PRD: separate config from patient content).
export const PERMS = {
  "Operations administrator": ["case:read", "case:write", "case:assign", "doc:read", "doc:write", "task:read", "task:write", "report:read", "summary:review", "audit:activity"],
  "Team lead": ["case:read", "case:write", "case:assign", "doc:read", "doc:write", "task:read", "task:write", "report:read", "summary:review", "audit:activity", "user:read", "workflow:read", "workflow:write", "integration:read"],
  "Compliance officer": ["audit:read", "audit:export", "report:read"],
  "IT administrator": ["user:read", "user:write", "integration:read", "integration:write", "workflow:read", "workflow:write", "audit:read"],
  "Executive analyst": ["report:read"],
  "Clinical reviewer": ["case:read", "doc:read", "summary:review"],
};
export const PRIVILEGED = ["IT administrator", "Compliance officer", "Team lead"];

export const authenticate = wrap(async (req, res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ message: "Session expired" });
  let p;
  try { p = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] }); } catch { return res.status(401).json({ message: "Session expired" }); }
  const user = await User.findById(p.sub);
  if (!user || user.state !== "Active" || user.tokenVersion !== p.tv) return res.status(401).json({ message: "Session expired" });
  req.user = user;
  next();
});

export const can = (perm) => wrap(async (req, res, next) => {
  if (PERMS[req.user.role]?.includes(perm)) return next();
  await auditReq(req, { event: "Access denied", object: perm, outcome: "Denied" });
  res.status(403).json({ message: "Permission denied" });
});
export const hasPerm = (user, perm) => PERMS[user.role]?.includes(perm);
// Site-level scope: an empty sites list means all sites
export const siteScope = (user) => (user.sites?.length ? { site: { $in: user.sites } } : {});
export const signSession = (user) => jwt.sign({ sub: String(user._id), tv: user.tokenVersion }, config.jwtSecret, { algorithm: "HS256", expiresIn: `${config.sessionMinutes}m` });
export const cookieOpts = () => ({ httpOnly: true, secure: config.prod, sameSite: "strict", maxAge: config.sessionMinutes * 60000, path: "/" });
