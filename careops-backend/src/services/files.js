import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";

const MAGIC = { "application/pdf": [0x25, 0x50, 0x44, 0x46], "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47] };
// Trust file contents, not the client's declared type or extension
export const sniff = (buf) => Object.entries(MAGIC).find(([, sig]) => sig.every((b, i) => buf[i] === b))?.[0] || null;
export const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export const safeName = (n) => path.basename(String(n)).replace(/[^\w.\- ]/g, "_").slice(0, 120) || "document";

// Hook for a real scanner (e.g. ClamAV). Production refuses uploads until one is configured.
export async function scanFile(_buf) {
  if (config.prod && !config.malwareScanner) throw new HttpError(503, "Upload is unavailable until malware scanning is configured");
  // TODO: call your scanner here and throw HttpError(422, ...) when infected
}
const full = (key) => path.join(config.storageDir, key);
export async function saveFile(buf) {
  await fs.mkdir(config.storageDir, { recursive: true, mode: 0o700 });
  const key = crypto.randomUUID();
  await fs.writeFile(full(key), buf, { mode: 0o600 });
  return key;
}
export const readStream = (key) => createReadStream(full(key));
export const readFile = (key) => fs.readFile(full(key));
