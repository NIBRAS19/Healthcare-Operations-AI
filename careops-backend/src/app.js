import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errors.js";
import auth from "./routes/auth.js";
import cases from "./routes/cases.js";
import documents from "./routes/documents.js";
import { tasks, audit, users, integrations, workflows, reports } from "./routes/admin.js";

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // set to your real proxy hop count so rate limits and audit IPs are accurate
app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api", rateLimit({ windowMs: 60000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ ok: true })); // no data, no auth
app.use("/api/auth", auth);
// Everything below requires a valid session; each route then checks its own permission server-side
app.use("/api/cases", authenticate, cases);
app.use("/api/documents", authenticate, documents);
app.use("/api/tasks", authenticate, tasks);
app.use("/api/audit", authenticate, audit);
app.use("/api/users", authenticate, users);
app.use("/api/integrations", authenticate, integrations);
app.use("/api/workflows", authenticate, workflows);
app.use("/api/reports", authenticate, reports);
app.use("/api", (_req, res) => res.status(404).json({ message: "Not found" }));
app.use(errorHandler);
