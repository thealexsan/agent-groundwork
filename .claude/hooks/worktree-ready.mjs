#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const { repoRoot, worktrees, touchClaim, git } = await import(pathToFileURL(join(here, "lib", "worktree.mjs")).href);
const { scaffold } = await import(pathToFileURL(join(here, "lib", "scaffold.mjs")).href);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 2000);
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

const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], root);
const primary = common ? dirname(common) : root;

const prepared = [];
for (const worktree of worktrees(root)) {
  if (worktree.path === primary) continue;
  if (existsSync(join(worktree.path, ".agent"))) continue;
  const done = scaffold(primary, worktree.path);
  if (done.length > 0) prepared.push({ path: worktree.path, branch: worktree.branch, done });
}

if (prepared.length === 0) process.exit(0);

if (prepared.length === 1) {
  touchClaim(prepared[0].path, (payload.session_id || "").slice(0, 8));
}

const lines = ["## Worktree prepared", ""];
for (const entry of prepared) {
  lines.push(`\`${entry.path}\` on \`${entry.branch}\``);
  for (const step of entry.done) lines.push(`- ${step}`);
}
lines.push("");
lines.push("It is a real checkout now: dependencies are in place and the working notes are shared");
lines.push("with every other agent. Work here, commit here, push from here.");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: lines.join("\n") },
  })
);
