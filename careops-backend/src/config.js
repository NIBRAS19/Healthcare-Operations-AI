import "dotenv/config";
const need = (k) => { if (!process.env[k]) throw new Error(`Missing required env var ${k}`); return process.env[k]; };
const env = process.env.NODE_ENV || "development";
const jwtSecret = need("JWT_SECRET");
if (jwtSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
export const config = {
  env, prod: env === "production", port: +(process.env.PORT || 5000), mongoUri: need("MONGO_URI"), jwtSecret,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173", sessionMinutes: +(process.env.SESSION_MINUTES || 30),
  storageDir: process.env.STORAGE_DIR || "./storage", aiEnabled: process.env.AI_ENABLED === "true", aiProvider: process.env.AI_PROVIDER || "none",
  malwareScanner: process.env.MALWARE_SCANNER || "",
};
