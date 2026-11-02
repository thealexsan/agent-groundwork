import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

const CLAIM_STALE_MS = 90 * 60 * 1000;

export function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function repoRoot(cwd) {
  return git(["rev-parse", "--show-toplevel"], cwd);
}

export function isPrimaryWorktree(cwd) {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  const own = git(["rev-parse", "--path-format=absolute", "--git-dir"], cwd);
  return Boolean(common) && common === own;
}

export function currentBranch(cwd) {
  return git(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd) || git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

export function worktrees(cwd) {
  const out = git(["worktree", "list", "--porcelain"], cwd);
  const list = [];
  let entry = null;
  for (const line of out.split("\n")) {
    if (line.startsWith("worktree ")) {
      entry = { path: line.slice(9), branch: "detached" };
      list.push(entry);
    } else if (line.startsWith("branch ") && entry) {
      entry.branch = line.slice(7).replace("refs/heads/", "");
    }
  }
  return list;
}

function claimsPath(cwd) {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  return common ? join(common, "agent-claims.json") : "";
}

export function readClaims(cwd) {
  const path = claimsPath(cwd);
  if (!path) return [];
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const cutoff = Date.now() - CLAIM_STALE_MS;
  return parsed.filter((c) => c && typeof c.path === "string" && Date.parse(c.seenAt || "") > cutoff);
}

export function writeClaims(cwd, claims) {
  const path = claimsPath(cwd);
  if (!path) return false;
  const temp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(claims, null, 2)}
`);
    renameSync(temp, path);
    return true;
  } catch {
    return false;
  }
}

export function writeClaim(cwd, claim) {
  const others = readClaims(cwd).filter((c) => c.session !== claim.session);
  writeClaims(cwd, [...others, claim].sort((a, b) => a.path.localeCompare(b.path)));
  return others;
}

export function touchClaim(cwd, session) {
  const claims = readClaims(cwd);
  const mine = claims.find((c) => c.session === session);
  if (!mine) return claims;
  const root = repoRoot(cwd);
  if (root) {
    mine.path = root;
    mine.branch = currentBranch(root);
    mine.primary = isPrimaryWorktree(root);
  }
  mine.seenAt = new Date().toISOString();
  writeClaims(cwd, claims);
  return claims.filter((c) => c.session !== session);
}

export function removeClaim(cwd, session) {
  const kept = readClaims(cwd).filter((c) => c.session !== session);
  writeClaims(cwd, kept);
  return kept;
}
