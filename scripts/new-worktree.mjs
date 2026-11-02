#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const USAGE = `new-worktree.mjs — give this chat its own checkout so two agents stop fighting over one.

    node scripts/new-worktree.mjs <type>/<topic> [directory]

Creates the branch off a fresh main, adds the worktree beside the primary checkout
(../<repo>-<topic> unless a directory is given), and makes it usable:

  .agent/          linked to the primary checkout, so every agent reads the same notes
  dependencies     copied as .claude/agent.json lists them

The primary checkout stays on main. Do not \`git checkout\` there while another chat is open.
`;

const [branch, directory] = process.argv.slice(2);
if (branch === "-h" || branch === "--help") {
  process.stdout.write(USAGE);
  process.exit(0);
}
if (!branch) {
  process.stderr.write(USAGE);
  process.exit(1);
}

const git = (args, options = {}) => execFileSync("git", args, { encoding: "utf8", ...options });
const primary = dirname(resolve(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim()));
const topic = branch.slice(branch.indexOf("/") + 1);
const target = resolve(directory ?? join(dirname(primary), `${basename(primary)}-${topic}`));

if (existsSync(target)) {
  console.error(`Already there: ${target}`);
  process.exit(1);
}

console.log(`Branching ${branch} off origin/main`);
git(["-C", primary, "fetch", "origin", "--quiet"], { stdio: "inherit" });
git(["-C", primary, "worktree", "add", "-b", branch, target, "origin/main"], { stdio: "inherit" });

const { scaffold } = await import(pathToFileURL(join(primary, ".claude", "hooks", "lib", "scaffold.mjs")).href);
for (const line of scaffold(primary, target)) console.log(`  ${line}`);

console.log(`\nReady. Open the next chat in:\n    ${target}`);
