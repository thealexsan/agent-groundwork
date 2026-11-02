#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { repoRoot, isPrimaryWorktree, touchClaim } = await import(pathToFileURL(join(here, "lib", "worktree.mjs")).href);

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
if (!root || !isPrimaryWorktree(root)) process.exit(0);

const comparable = (path) => (process.platform === "win32" ? path.replaceAll("\\", "/").toLowerCase() : path);
const target = comparable(payload.tool_input?.file_path || "");
if (target && !target.startsWith(comparable(root))) process.exit(0);
if (target.includes("/.agent/")) process.exit(0);

const session = (payload.session_id || "").slice(0, 8);
const others = touchClaim(root, session).filter((c) => c.path === root);
if (others.length === 0) process.exit(0);

const list = others.map((o) => `    ${o.account} · session ${o.session} · last seen ${o.seenAt}`).join("\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        "Another agent is live in this same checkout, so writing here would collide with it:\n\n" +
        `${list}\n\n` +
        "Take your own worktree first — call the EnterWorktree tool. CLAUDE.md instructs it for " +
        "exactly this case, the session moves into the worktree by itself, and a hook prepares " +
        "it and shares .agent/ with the primary checkout. " +
        "Then make this edit there.",
    },
  })
);
