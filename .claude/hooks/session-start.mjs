#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename } from "node:path";
import { hostname } from "node:os";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const { repoRoot, isPrimaryWorktree, currentBranch, worktrees, writeClaim } = await import(pathToFileURL(join(here, "lib", "worktree.mjs")).href);
const { loadConfig, standingRules } = await import(pathToFileURL(join(here, "lib", "config.mjs")).href);

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
  payload = {};
}

const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const root = repoRoot(cwd);
if (!root) {
  process.exit(0);
}

const config = loadConfig(root);
const branch = currentBranch(root);
const primary = isPrimaryWorktree(root);
const sessionId = payload.session_id || "unknown";
const account = basename(process.env.CLAUDE_CONFIG_DIR || `${process.env.HOME}/.claude`);

function linkAccountConfig(projectRoot) {
  const configDir = process.env.CLAUDE_CONFIG_DIR;
  if (!configDir) return null;
  const primaryConfig = join(process.env.HOME || "", ".claude");
  if (configDir === primaryConfig) return null;

  let alreadySharesPrimaryConfig = false;
  try {
    alreadySharesPrimaryConfig = lstatSync(join(configDir, "settings.json")).isSymbolicLink();
  } catch {
    alreadySharesPrimaryConfig = false;
  }
  if (alreadySharesPrimaryConfig) return null;

  const linker = join(projectRoot, "scripts", "link-claude-accounts.sh");
  if (!existsSync(linker)) return null;

  try {
    execFileSync(linker, [configDir], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return basename(configDir);
  } catch {
    return null;
  }
}

const linked = linkAccountConfig(root);

const others = writeClaim(root, {
  path: root,
  branch,
  primary,
  account,
  host: hostname(),
  session: sessionId.slice(0, 8),
  seenAt: new Date().toISOString(),
});

const lines = [];
const rules = standingRules(root);
if (rules) {
  lines.push(`## ${config.project} standing rules (injected every session, including after compaction)`);
  lines.push("");
  lines.push(rules);
  lines.push("");
}
lines.push("## This chat");
lines.push("");
lines.push(`- Worktree: \`${root}\`${primary ? " (primary checkout)" : ""}`);
lines.push(`- Branch: \`${branch}\``);
lines.push(`- Account config: \`${account}\``);

if (linked) {
  lines.push("");
  lines.push(`**\`${linked}\` was not sharing the user's Claude config and has just been linked to it.**`);
  lines.push("Tell the user in one line that this chat is still on the old settings — attribution, model,");
  lines.push("effort, plugins and the chat-length hook only take effect once they restart it.");
}

const sharingThisCheckout = others.filter((o) => o.path === root);
if (primary && sharingThisCheckout.length > 0) {
  lines.push("");
  lines.push("**Another agent is live in this same checkout.** Before your first edit, commit or branch");
  lines.push("switch, take your own worktree: call the **EnterWorktree** tool. That instruction is the");
  lines.push("project's, so the tool is authorised here — the session moves itself, and a hook prepares");
  lines.push("the worktree and shares `.agent/` with the primary checkout.");
  lines.push("Never `git checkout` here: it moves every chat reading this directory. Reading is fine.");
} else if (primary && others.length === 0) {
  lines.push("");
  lines.push("You are the only agent in this repository right now, so this checkout is yours and an");
  lines.push("ordinary branch is fine. If a second chat joins, move with **EnterWorktree**.");
}

const all = worktrees(root);
if (all.length > 1) {
  lines.push("");
  lines.push("## Worktrees on this machine");
  lines.push("");
  for (const w of all) {
    lines.push(`- \`${w.path}\` → \`${w.branch}\`${w.path === root ? "  ← this chat" : ""}`);
  }
}

if (others.length > 0) {
  lines.push("");
  lines.push("## Other agents live right now");
  lines.push("");
  for (const o of others) {
    lines.push(`- \`${o.path}\` → \`${o.branch}\` · ${o.account} · session ${o.session} · last seen ${o.seenAt}`);
  }
  lines.push("");
  lines.push("`.agent/` is shared with every worktree the project made, so their working notes are yours");
  lines.push("to read. Before changing a file another agent is likely to be in, say so in your reply.");
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: lines.join("\n"),
    },
  })
);
