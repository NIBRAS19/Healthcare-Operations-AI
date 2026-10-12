import { ZodError } from "zod";
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export class HttpError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; } }
export const notFound = (what = "Not found") => new HttpError(404, what); // same reply for "missing" and "not yours"
// Never log request bodies or documents (PHI-safe logs)
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) return res.status(400).json({ message: "Invalid input", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message, ...err.extra });
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "File is too large" });
  console.error(`[error] ${req.method} ${req.path} ${err?.name}: ${err?.message}`);
  res.status(500).json({ message: "Something went wrong. Try again or contact support." });
}
