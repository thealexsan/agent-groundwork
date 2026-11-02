#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const { repoRoot, isPrimaryWorktree, currentBranch, touchClaim, readClaims } = await import(pathToFileURL(join(here, "lib", "worktree.mjs")).href);

const { loadConfig, override } = await import(pathToFileURL(join(here, "lib", "config.mjs")).href);
const { commentViolations } = await import(pathToFileURL(join(here, "lib", "comments.mjs")).href);

const ATTRIBUTION =
  /co-authored-by:\s*(claude|gemini|antigravity|cursor|copilot|codex|devin|windsurf|aider|jules)|generated with \[?(claude code|antigravity|cursor|copilot|gemini|codex)|noreply@anthropic\.com/i;

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

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function tokenize(segment) {
  const tokens = [];
  let current = "";
  let quote = "";
  for (let i = 0; i < segment.length; i += 1) {
    const char = segment[i];
    if (quote) {
      if (char === quote) quote = "";
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function gitSubcommand(segment) {
  const tokens = tokenize(segment);
  let directory = null;
  let index = 0;
  while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) index += 1;
  if (index >= tokens.length) return null;
  if (tokens[index] === "env") {
    index += 1;
    while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) index += 1;
  }
  if (index >= tokens.length) return null;
  const binary = tokens[index].split(/[\\/]/).pop().replace(/\.exe$/i, "");
  if (binary !== "git") return null;
  index += 1;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === "-C") directory = tokens[index + 1];
    if (token === "-C" || token === "-c" || token === "--git-dir" || token === "--work-tree") {
      index += 2;
      continue;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    return { name: token, args: tokens.slice(index + 1), directory };
  }
  return null;
}

function expandHome(path) {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path.replace(/^\$\{?HOME\}?(?=\/|$)/, homedir());
}

function knownDirectory(from, path) {
  if (!path) return from;
  const expanded = expandHome(path);
  return expanded.includes("$") || expanded.includes("`") ? from : resolve(from, expanded);
}

function movedTo(segment, from) {
  const tokens = tokenize(segment);
  const verb = tokens[0]?.replace(/^\(+/, "");
  if (verb !== "cd" && verb !== "pushd") return from;
  if (tokens.length === 1) return homedir();
  return tokens[1] === "-" ? from : knownDirectory(from, tokens[1]);
}

function segments(command) {
  return command.split(/&&|\|\||;|\n|(?<!\|)\|(?!\|)/g).map((s) => s.trim()).filter(Boolean);
}

function envAllows(command, name) {
  return new RegExp(`${name}=1`).test(command) || process.env[name] === "1";
}

const input = await readStdin();
let payload = {};
try {
  payload = JSON.parse(input || "{}");
} catch {
  allow();
}

const command = payload.tool_input?.command || "";
if (!command) allow();

const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const root = repoRoot(cwd);
if (!root) allow();

const config = loadConfig(root);
const session = (payload.session_id || "").slice(0, 8);
const otherAgents = touchClaim(root, session);

function authorsCommitOrPullRequest(segment) {
  const tokens = tokenize(segment);
  const binary = tokens[0]?.split('/').pop();
  if (binary === 'gh') {
    return tokens.includes('pr') || tokens.includes('release') || tokens.includes('issue');
  }
  const sub = gitSubcommand(segment);
  return Boolean(sub) && ['commit', 'tag', 'merge', 'revert', 'cherry-pick', 'notes'].includes(sub.name);
}

if (segments(command).some(authorsCommitOrPullRequest) && ATTRIBUTION.test(command)) {
  deny(
    "This repo's commits and pull requests carry the user's identity and no assistant attribution: " +
      "no `Co-Authored-By` for an assistant, no `Generated with …` line, no assistant noreply address. " +
      "Rewrite the message or body without those lines. (CLAUDE.md — 'Commits are the user's'.)"
  );
}

let directory = cwd;
for (const segment of segments(command)) {
  directory = movedTo(segment, directory);
  const sub = gitSubcommand(segment);
  if (!sub) continue;
  const repository = repoRoot(knownDirectory(directory, sub.directory));
  if (!repository) continue;
  const rules = repository === root ? config : loadConfig(repository);
  const agentsThere = repository === root ? otherAgents : readClaims(repository).filter((c) => c.session !== session);

  if (sub.name === "commit" && !sub.args.includes("--amend")) {
    const branch = currentBranch(repository);
    if (branch === rules.mainBranch && !envAllows(command, override(rules, "MAIN_COMMIT"))) {
      deny(
        `Refusing to commit on \`${rules.mainBranch}\`. ` +
          (rules.mainDeploys ? "A merge there deploys to production by itself, so work " : "Work ") +
          "lands through a branch and a pull request:\n\n" +
          "    git checkout -b <type>/<topic>\n" +
          "    git commit …\n" +
          "    git push -u origin <type>/<topic>\n" +
          `    gh pr create --base ${rules.mainBranch}\n\n` +
          `If you genuinely mean to commit there: prefix the command with \`${override(rules, "MAIN_COMMIT")}=1\`.`
      );
    }

    if (!envAllows(command, override(rules, "COMMENTS"))) {
      const violations = commentViolations(repository, rules);
      if (violations.length > 0) {
        deny(
          "The staged diff adds comments to code files, which this repo does not allow " +
            "(only toolchain directives with the rule named). Move the explanation into a name, a constant, a test, " +
            "`HANDOVER.md` or a README, then commit again:\n\n" +
            violations.slice(0, 20).map((v) => `    ${v}`).join("\n") +
            (violations.length > 20 ? `\n    … and ${violations.length - 20} more` : "")
        );
      }
    }
  }

  if (sub.name === "checkout" || sub.name === "switch") {
    const movesHead = sub.args.some((a) => !a.startsWith("-")) && !sub.args.includes("--");
    const creates = sub.args.includes("-b") || sub.args.includes("-B") || sub.args.includes("-c");
    if (movesHead && !creates && isPrimaryWorktree(repository) && !envAllows(command, override(rules, "BRANCH_SWITCH"))) {
      const others = agentsThere.filter((c) => c.path === repository);
      if (others.length > 0) {
        const list = others.map((o) => `    ${o.account} · session ${o.session} · seen ${o.seenAt}`).join("\n");
        deny(
          "Another agent is working in this repository and this is the shared primary checkout — " +
            "switching branches here moves their working tree too.\n\n" +
            `Live agents:\n${list}\n\n` +
            "Take your own worktree instead — call the EnterWorktree tool. CLAUDE.md instructs it for " +
            "this case, so it is authorised: the session moves itself and a hook prepares the worktree " +
            "and shares .agent/ with the primary checkout.\n\n" +
            "If you are certain no other chat is reading this directory: prefix the command with " +
            `\`${override(rules, "BRANCH_SWITCH")}=1\`.`
        );
      }
    }
  }
}

allow();
