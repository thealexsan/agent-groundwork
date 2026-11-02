#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { repoRoot, removeClaim } = await import(pathToFileURL(join(here, "lib", "worktree.mjs")).href);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 1500);
  });
}

const input = await readStdin();
let payload = {};
try {
  payload = JSON.parse(input || "{}");
} catch {
  process.exit(0);
}

const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const root = repoRoot(cwd);
if (!root) process.exit(0);

removeClaim(root, (payload.session_id || "").slice(0, 8));
