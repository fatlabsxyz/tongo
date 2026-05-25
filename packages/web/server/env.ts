/**
 * Tiny .env loader for the standalone watcher process. Reads `.env.local` then
 * `.env` from the package root and only sets keys that aren't already in
 * process.env. No external dependency.
 */
import fs from "fs";
import path from "path";

function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function loadFile(filepath: string) {
  if (!fs.existsSync(filepath)) return;
  const parsed = parseEnv(fs.readFileSync(filepath, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const root = path.resolve(__dirname, "..");
loadFile(path.join(root, ".env.local"));
loadFile(path.join(root, ".env"));
