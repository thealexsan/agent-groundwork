import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { install } from "../install.mjs";

function project({ git = true } = {}) {
  const directory = realpathSync.native(mkdtempSync(join(tmpdir(), "groundwork-")));
  if (git) {
    for (const args of [["init", "-q", "-b", "main"], ["config", "user.email", "t@example.com"], ["config", "user.name", "T"]]) {
      execFileSync("git", args, { cwd: directory });
    }
  }
  return directory;
}

const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function run(directory, command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: directory, encoding: "utf8", env: { ...process.env, ...env } });
  return { status: result.status, said: result.stdout + result.stderr };
}

function hook(directory, name, payload) {
  const result = spawnSync(process.execPath, [join(directory, ".claude", "hooks", name)], {
    cwd: directory,
    encoding: "utf8",
    input: JSON.stringify({ cwd: directory, session_id: "aaaaaaaa-1", ...payload }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: directory },
  });
  return result.stdout === "" ? null : JSON.parse(result.stdout).hookSpecificOutput;
}

const settings = { name: "Acme Shop", checks: "npm test", scopes: "api,web", description: "A shop.", prefix: "acme" };

test("every placeholder is filled and the project is named throughout", () => {
  const directory = project();
  const result = install(directory, settings, new Set(["deploys"]));

  for (const path of result.written) {
    assert.doesNotMatch(readFileSync(join(directory, path), "utf8"), /\{\{[A-Z_]+\}\}/, path);
  }

  assert.match(readFileSync(join(directory, "CLAUDE.md"), "utf8"), /# Acme Shop — repo rules[\s\S]*npm test[\s\S]*ACME_ALLOW_MAIN_COMMIT/);
  assert.equal(JSON.parse(readFileSync(join(directory, ".claude", "agent.json"), "utf8")).mainDeploys, true);
  assert.equal(readFileSync(join(directory, ".gitignore"), "utf8"), ".agent/\n");
  assert.equal(result.hooked, true);
  assert.equal(existsSync(join(directory, ".claude", "skills", "release")), false);

  const hooks = Object.values(JSON.parse(readFileSync(join(directory, ".claude", "settings.json"), "utf8")).hooks).flatMap((groups) => groups.flatMap((group) => group.hooks));
  assert.equal(hooks.length, 5);
  for (const hook of hooks) {
    assert.equal(hook.command, "node");
    assert.match(hook.args[0], /^\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/[a-z-]+\.mjs$/);
    assert.equal(existsSync(join(directory, hook.args[0].replace("${CLAUDE_PROJECT_DIR}/", ""))), true, hook.args[0]);
  }
  assert.match(readFileSync(join(directory, ".gitattributes"), "utf8"), /^\.githooks\/\* text eol=lf$/m);
});

test("a library gets the release skill and an existing file is kept unless forced", () => {
  const directory = project({ git: false });
  writeFileSync(join(directory, "CLAUDE.md"), "mine\n");

  const first = install(directory, settings, new Set(["library"]));
  assert.deepEqual(first.kept, ["CLAUDE.md"]);
  assert.equal(readFileSync(join(directory, "CLAUDE.md"), "utf8"), "mine\n");
  assert.equal(existsSync(join(directory, ".claude", "skills", "release", "SKILL.md")), true);
  assert.equal(first.hooked, false);

  install(directory, settings, new Set(["force"]));
  assert.match(readFileSync(join(directory, "CLAUDE.md"), "utf8"), /Acme Shop/);
});

test("the git hooks refuse main, comments and a push to main, and allow a clean branch commit", () => {
  const directory = project();
  install(directory, settings, new Set());

  writeFileSync(join(directory, "a.ts"), "export const a = 1;\n");
  run(directory, "git", ["add", "a.ts"]);
  assert.match(run(directory, "git", ["commit", "-m", "feat(api): a"]).said, /Refusing to commit on main/);
  assert.equal(run(directory, "git", ["commit", "-m", "feat(api): a"], { ACME_ALLOW_MAIN_COMMIT: "1" }).status, 0);

  run(directory, "git", ["checkout", "-q", "-b", "feat/b"]);
  writeFileSync(join(directory, "b.ts"), "// explains itself\nexport const b = 2;\n");
  run(directory, "git", ["add", "b.ts"]);
  assert.match(run(directory, "git", ["commit", "-m", "feat(api): b"]).said, /adds comments to code files/);

  writeFileSync(join(directory, "b.ts"), "// eslint-disable-next-line no-console\nexport const b = 2;\n");
  run(directory, "git", ["add", "b.ts"]);
  assert.equal(run(directory, "git", ["commit", "-m", "feat(api): b"]).status, 0);

  const push = spawnSync("sh", [join(directory, ".githooks", "pre-push")], { cwd: directory, encoding: "utf8", input: "refs/heads/main abc refs/heads/main def\n" });
  assert.equal(push.status, 1);
  const branch = spawnSync("sh", [join(directory, ".githooks", "pre-push")], { cwd: directory, encoding: "utf8", input: "refs/heads/feat/b abc refs/heads/feat/b def\n" });
  assert.equal(branch.status, 0);
});

test("the git hook and the git guard find the same comments, PHP's included", () => {
  const directory = project();
  install(directory, { ...settings, extensions: "php,py,ts,sh,go" }, new Set());
  run(directory, "git", ["checkout", "-q", "-b", "feat/c"]);
  writeFileSync(join(directory, "c.py"), "#!/usr/bin/env python3\n# why\nc = 1  # noqa: E501\n");
  writeFileSync(join(directory, "c.php"), "<?php\n# why too\n#[Override]\n// phpcs:ignore Generic.Files\n/** docblock */\nfunction c() {}\n");
  writeFileSync(join(directory, "c.ts"), "export const c = 1;\n");
  mkdirSync(join(directory, "querydb"));
  writeFileSync(join(directory, "querydb", "q.go"), "// Code generated by sqlc. DO NOT EDIT.\n// versions:\npackage querydb\n");
  writeFileSync(join(directory, "c.sh"), "#!/bin/sh\n# shellcheck disable=SC2016\n# why in shell\necho '$c'\n");
  run(directory, "git", ["add", "."]);

  const expected = ["c.php: # why too", "c.php: /** docblock */", "c.py: # why", "c.sh: # why in shell"];
  const committed = run(directory, "git", ["commit", "-m", "feat(api): c"]);
  assert.equal(committed.status, 1);
  assert.deepEqual(committed.said.split("\n").filter((line) => /^    c\./.test(line)).map((line) => line.trim()), expected);

  const guarded = hook(directory, "git-guard.mjs", { tool_input: { command: "git commit -m 'feat(api): c'" } });
  assert.deepEqual(guarded.permissionDecisionReason.split("\n").filter((line) => /^    c\./.test(line)).map((line) => line.trim()), expected);
});

test("session start injects the standing rules and says the checkout is free", () => {
  const directory = project();
  install(directory, settings, new Set());

  const output = hook(directory, "session-start.mjs", {});
  assert.match(output.additionalContext, /## Acme Shop standing rules/);
  assert.match(output.additionalContext, /Ask first/);
  assert.match(output.additionalContext, /only agent in this repository/);
});

test("the git guard refuses a commit on main and a comment, with the project's own override", () => {
  const directory = project();
  install(directory, settings, new Set(["deploys"]));
  hook(directory, "session-start.mjs", {});

  writeFileSync(join(directory, "a.go"), "package a\n\n// why\nvar A = 1\n");
  run(directory, "git", ["add", "a.go"]);

  const onMain = hook(directory, "git-guard.mjs", { tool_input: { command: "git commit -m 'feat: a'" } });
  assert.equal(onMain.permissionDecision, "deny");
  assert.match(onMain.permissionDecisionReason, /deploys to production[\s\S]*ACME_ALLOW_MAIN_COMMIT=1/);

  const commented = hook(directory, "git-guard.mjs", { tool_input: { command: "ACME_ALLOW_MAIN_COMMIT=1 git commit -m 'feat: a'" } });
  assert.match(commented.permissionDecisionReason, /a\.go: \/\/ why/);

  writeFileSync(join(directory, "a.go"), "package a\n\n//go:generate stringer\nvar A = 1\n");
  run(directory, "git", ["add", "a.go"]);
  assert.equal(hook(directory, "git-guard.mjs", { tool_input: { command: "ACME_ALLOW_MAIN_COMMIT=1 git commit -m 'feat: a'" } }), null);
  assert.equal(hook(directory, "git-guard.mjs", { tool_input: { command: "git status" } }), null);
});

test("a git command after cd, or with -C, is judged in the repository it runs in", () => {
  const here = project();
  install(here, settings, new Set());
  run(here, "git", ["commit", "-q", "--allow-empty", "-m", "chore: start"], { ACME_ALLOW_MAIN_COMMIT: "1" });
  hook(here, "session-start.mjs", { session_id: "aaaaaaaa-1" });
  hook(here, "session-start.mjs", { session_id: "bbbbbbbb-2" });
  const elsewhere = project();
  install(elsewhere, { ...settings, name: "Other", prefix: "other" }, new Set());

  const guard = (command) => hook(here, "git-guard.mjs", { session_id: "bbbbbbbb-2", tool_input: { command } });
  assert.match(guard("git checkout other").permissionDecisionReason, /ACME_ALLOW_BRANCH_SWITCH=1/);
  assert.equal(guard(`cd "${elsewhere}" && git checkout other`), null);
  assert.equal(guard(`git -C "${elsewhere}" checkout other`), null);
  assert.equal(guard(`(cd "${elsewhere}" && git switch other)`), null);
  assert.match(guard(`cd "${elsewhere}" && git commit -m 'feat: x'`).permissionDecisionReason, /OTHER_ALLOW_MAIN_COMMIT=1/);
  assert.match(guard(`cd "${elsewhere}" && cd "${here}" && git checkout other`).permissionDecisionReason, /ACME_ALLOW_BRANCH_SWITCH=1/);
  assert.match(guard('cd "$SOMEWHERE" && git checkout other').permissionDecisionReason, /ACME_ALLOW_BRANCH_SWITCH=1/);
});

test("a second agent in the same checkout is told, and its write and branch switch are refused", () => {
  const directory = project();
  install(directory, settings, new Set());
  run(directory, "git", ["commit", "-q", "--allow-empty", "-m", "chore: start"], { ACME_ALLOW_MAIN_COMMIT: "1" });

  hook(directory, "session-start.mjs", { session_id: "aaaaaaaa-1" });
  const second = hook(directory, "session-start.mjs", { session_id: "bbbbbbbb-2" });
  assert.match(second.additionalContext, /Another agent is live in this same checkout/);

  const write = hook(directory, "write-guard.mjs", { session_id: "bbbbbbbb-2", tool_input: { file_path: join(directory, "x.ts") } });
  assert.equal(write.permissionDecision, "deny");
  assert.equal(hook(directory, "write-guard.mjs", { session_id: "bbbbbbbb-2", tool_input: { file_path: join(directory, ".agent", "progress.md") } }), null);

  const switched = hook(directory, "git-guard.mjs", { session_id: "bbbbbbbb-2", tool_input: { command: "git checkout other" } });
  assert.match(switched.permissionDecisionReason, /ACME_ALLOW_BRANCH_SWITCH=1/);
  assert.equal(hook(directory, "git-guard.mjs", { session_id: "bbbbbbbb-2", tool_input: { command: "git checkout -b feat/x" } }), null);

  hook(directory, "session-end.mjs", { session_id: "aaaaaaaa-1" });
  assert.equal(hook(directory, "write-guard.mjs", { session_id: "bbbbbbbb-2", tool_input: { file_path: join(directory, "x.ts") } }), null);
});

test("ops adds CI and security, and the deploy files only for a project that deploys", () => {
  const plain = project();
  const ci = install(plain, settings, new Set(["ops"]));
  assert.ok(ci.written.includes(".github/workflows/ci.yml"));
  assert.ok(ci.written.includes(".github/workflows/security.yml"));
  assert.equal(existsSync(join(plain, ".github", "workflows", "deploy.yml")), false);
  assert.match(readFileSync(join(plain, ".github", "workflows", "ci.yml"), "utf8"), /run: \|\n\s+npm test\n/);

  const directory = project();
  const result = install(directory, { ...settings, domain: "shop.example.org" }, new Set(["ops", "deploys"]));
  for (const path of result.written) {
    assert.doesNotMatch(path, /\{\{/, path);
    assert.doesNotMatch(readFileSync(join(directory, path), "utf8"), /\{\{[A-Z_]+\}\}/, path);
  }

  assert.ok(result.written.includes("deploy/nginx/sites/shop.example.org.conf"));
  assert.ok(result.written.includes("deploy/nginx/snippets/acme-shop-edge.conf"));
  assert.match(readFileSync(join(directory, "deploy", "nginx", "snippets", "acme-shop-edge.conf"), "utf8"), /\$acme_shop_via_cloudflare = 0/);
  assert.match(readFileSync(join(directory, ".github", "workflows", "deploy.yml"), "utf8"), /branches: \[main\][\s\S]*\/var\/www\/acme-shop/);
  assert.match(readFileSync(join(directory, "ecosystem.config.js"), "utf8"), /"acme-shop-api"/);

  for (const script of [".github/scripts/wait-for-ssh.sh", "scripts/deploy/release.sh", "scripts/cloudflare-ranges.sh"]) {
    assert.equal(run(directory, "test", ["-x", script]).status, 0, script);
    assert.equal(run(directory, "bash", ["-n", script]).status, 0, script);
  }
});

test("plans add the plan documents, DEPLOY.md only for a project that deploys, and index them", () => {
  const bare = project();
  install(bare, settings, new Set());
  const rules = readFileSync(join(bare, "CLAUDE.md"), "utf8");
  assert.doesNotMatch(rules, /SCALING\.md|\{\{/);
  assert.match(rules, /git-ignored scratch directory\.\n$/);

  const plain = project();
  const some = install(plain, settings, new Set(["plans"]));
  assert.deepEqual(some.written.filter((path) => path.endsWith(".md") && !path.includes("/")).sort(), ["AGENTS.md", "CLAUDE.md", "HANDOVER.md", "NEXT_STEPS.md", "SCALING.md", "SECURITY_PLAN.md", "SEO_PLAN.md"]);

  const directory = project();
  install(directory, settings, new Set(["plans", "deploys", "ops"]));
  assert.match(readFileSync(join(directory, "DEPLOY.md"), "utf8"), /# Deploying Acme Shop[\s\S]*\/var\/www\/acme-shop/);
  assert.match(readFileSync(join(directory, "CLAUDE.md"), "utf8"), /- `DEPLOY.md` — what runs in production[\s\S]*- `SEO_PLAN.md` — [\s\S]*- `deploy\/README.md` — /);
  assert.match(readFileSync(join(directory, "AGENTS.md"), "utf8"), /\| `SCALING.md` \| before proposing infrastructure/);
});

test("rules adds the named path rules, indexes them, and refuses a name it does not have", () => {
  const bare = project();
  const none = install(bare, settings, new Set());
  assert.deepEqual(none.written.filter((path) => path.startsWith(".claude/rules/")).sort(), [".claude/rules/performance.md", ".claude/rules/security.md"]);

  const directory = project();
  const some = install(directory, { ...settings, rules: "go, nextjs, page-weight" }, new Set());
  assert.deepEqual(some.written.filter((path) => path.startsWith(".claude/rules/")).sort(), [".claude/rules/go.md", ".claude/rules/nextjs.md", ".claude/rules/page-weight.md", ".claude/rules/performance.md", ".claude/rules/security.md"]);
  assert.match(readFileSync(join(directory, ".claude/rules/go.md"), "utf8"), /^---\npaths:\n  - "\*\*\/\*\.go"/);
  assert.match(readFileSync(join(directory, "CLAUDE.md"), "utf8"), /- `.claude\/rules\/go.md` — how Go is written here[\s\S]*- `.claude\/rules\/page-weight.md` — /);
  assert.match(readFileSync(join(directory, "AGENTS.md"), "utf8"), /\| `.claude\/rules\/page-weight.md` \| before adding a dependency/);
  assert.match(readFileSync(join(directory, ".claude/rules/nextjs.md"), "utf8"), /^---\npaths:\n  - "\*\*\/app\/\*\*\/\*\.tsx"/);
  assert.match(readFileSync(join(directory, "AGENTS.md"), "utf8"), /\| `.claude\/rules\/nextjs.md` \| before writing a page/);
  assert.doesNotMatch(readFileSync(join(directory, "AGENTS.md"), "utf8"), /ui\.md/);

  const refused = project();
  assert.throws(() => install(refused, { ...settings, rules: "go,rust" }, new Set()), /Unknown --rules rust; there are /);
  assert.equal(existsSync(join(refused, "CLAUDE.md")), false);
});

test("a kept CLAUDE.md or AGENTS.md gets the template's version beside it to merge, and only when they differ", () => {
  const directory = project();
  writeFileSync(join(directory, "CLAUDE.md"), "# Our own rules\n");
  writeFileSync(join(directory, "HANDOVER.md"), "ours\n");

  const first = install(directory, { ...settings, rules: "go" }, new Set(["plans"]));
  assert.deepEqual(first.kept.sort(), ["CLAUDE.md", "HANDOVER.md"]);
  assert.deepEqual(first.beside, [{ path: "CLAUDE.md", merge: "CLAUDE.groundwork.md" }]);
  assert.equal(readFileSync(join(directory, "CLAUDE.md"), "utf8"), "# Our own rules\n");
  assert.match(readFileSync(join(directory, "CLAUDE.groundwork.md"), "utf8"), /# Acme Shop — repo rules[\s\S]*- `.claude\/rules\/go.md` — [\s\S]*- `SCALING.md` — /);
  assert.equal(existsSync(join(directory, "AGENTS.groundwork.md")), false);
  assert.equal(existsSync(join(directory, "HANDOVER.groundwork.md")), false);

  const cli = run(directory, "node", [join(dirname(fileURLToPath(import.meta.url)), "..", "install.mjs"), directory, "--name", "Acme Shop", "--checks", "npm test", "--scopes", "api,web", "--description", "A shop.", "--prefix", "acme", "--rules", "go", "--plans"]);
  assert.match(cli.said, /Merge each in, then delete it:\n  CLAUDE.groundwork.md → CLAUDE.md\n/);

  writeFileSync(join(directory, "CLAUDE.md"), readFileSync(join(directory, "CLAUDE.groundwork.md"), "utf8"));
  assert.deepEqual(install(directory, { ...settings, rules: "go" }, new Set(["plans"])).beside, []);
});

test("folders of code the project did not write are left out of the comment check", () => {
  const directory = project();
  const files = {
    "src/app.ts": "export const app = 1;\n",
    "vendor/lib.php": "<?php\n",
    "packages/upstream/LICENSE": "MIT\n",
    "packages/upstream/index.ts": "export const upstream = 1;\n",
    "packages/upstream/inner/LICENSE": "MIT\n",
    "docs/LICENSE": "CC-BY\n",
    ".agents/skills/brand/scripts/sync.py": "print(1)\n",
  };
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  }
  run(directory, "git", ["add", "."]);

  const result = install(directory, { ...settings, extensions: "php,py,ts" }, new Set());
  const expected = [".agents/skills/", "packages/upstream/", "vendor/"];
  assert.deepEqual(result.vendored, expected);
  assert.deepEqual(JSON.parse(readFileSync(join(directory, ".claude", "agent.json"), "utf8")).comments.ignore, expected);

  run(directory, "git", ["checkout", "-q", "-b", "feat/d"]);
  writeFileSync(join(directory, "vendor/lib.php"), "<?php\n// upstream's own\n");
  writeFileSync(join(directory, "src/app.ts"), "// ours\nexport const app = 1;\n");
  run(directory, "git", ["add", "vendor/lib.php", "src/app.ts"]);
  const committed = run(directory, "git", ["commit", "-m", "feat(api): d"]);
  assert.match(committed.said, /src\/app\.ts: \/\/ ours/);
  assert.doesNotMatch(committed.said, /vendor/);
});

test("business adds who-is-asking, names both people in every rule file, and an update keeps the project's edits", () => {
  const plain = project();
  install(plain, settings, new Set());
  assert.equal(existsSync(join(plain, ".claude", "skills", "who-is-asking")), false);
  assert.equal(JSON.parse(readFileSync(join(plain, ".claude", "agent.json"), "utf8")).people, null);
  assert.doesNotMatch(readFileSync(join(plain, ".claude", "standing-rules.md"), "utf8"), /who-is-asking|^\n/);

  const directory = project();
  install(directory, { ...settings, business: "Sam", engineer: "Robin" }, new Set());
  const skill = join(directory, ".claude", "skills", "who-is-asking", "SKILL.md");
  assert.match(readFileSync(skill, "utf8"), /^---\nname: who-is-asking\n[\s\S]*\| "I am Sam" · "This is Sam" \| \*\*Business mode\*\* \|\n[\s\S]*\| "I am Robin" · "This is Robin" \| \*\*Engineer mode\*\* \|/);
  assert.match(readFileSync(join(directory, ".claude", "standing-rules.md"), "utf8"), /^\*\*Who is asking — `who-is-asking`\.\*\*[\s\S]*"This is Robin" or no marker → engineer mode\.\n\n\*\*Ask first/);
  assert.match(readFileSync(join(directory, "CLAUDE.md"), "utf8"), /## Knowing who is asking is mandatory\n[\s\S]*Robin, who builds the product, and Sam/);
  assert.match(readFileSync(join(directory, "AGENTS.md"), "utf8"), /   ```\n\n5\. \*\*Know who is asking\*\*/);
  assert.match(readFileSync(join(directory, ".agents", "rules", "00-standing-rules.md"), "utf8"), /- Know who is asking: Sam gets screens/);
  assert.deepEqual(JSON.parse(readFileSync(join(directory, ".claude", "agent.json"), "utf8")).people, { business: "Sam", engineer: "Robin" });
  const context = hook(directory, "session-start.mjs", { source: "startup" });
  assert.match(context.additionalContext, /Who is asking — `who-is-asking`/);

  writeFileSync(skill, `${readFileSync(skill, "utf8")}| "انا فاروق" | **Business mode** |\n`);
  const updated = install(directory, {}, new Set(["update"]));
  assert.match(readFileSync(skill, "utf8"), /انا فاروق/);
  assert.deepEqual(updated.beside.map(({ merge }) => merge), [".claude/skills/who-is-asking/SKILL.groundwork.md"]);
  assert.match(readFileSync(join(directory, ".claude", "skills", "who-is-asking", "SKILL.groundwork.md"), "utf8"), /"I am Robin"/);

  const older = project();
  install(older, settings, new Set());
  const added = install(older, { business: "Sam" }, new Set(["update"]));
  assert.deepEqual(added.recorded, ["people"]);
  assert.match(readFileSync(join(older, ".claude", "skills", "who-is-asking", "SKILL.md"), "utf8"), /the engineer or Sam/);
  assert.deepEqual(JSON.parse(readFileSync(join(older, ".claude", "agent.json"), "utf8")).people, { business: "Sam", engineer: null });

  assert.throws(() => install(project(), { ...settings, engineer: "Robin" }, new Set()), /give --business too/);
});

test("a path the project owns is never written by an update: kept with the template beside, or left absent", () => {
  const directory = project();
  install(directory, settings, new Set());
  const config = join(directory, ".claude", "agent.json");
  writeFileSync(config, JSON.stringify({ ...JSON.parse(readFileSync(config, "utf8")), owned: [".claude/skills/git-commit-push/SKILL.md", ".claude/skills/ask-first/"] }));
  const skill = join(directory, ".claude", "skills", "git-commit-push", "SKILL.md");
  writeFileSync(skill, "ours\n");
  rmSync(join(directory, ".claude", "skills", "ask-first"), { recursive: true });

  const result = install(directory, {}, new Set(["update"]));
  assert.equal(readFileSync(skill, "utf8"), "ours\n");
  assert.deepEqual(result.beside.map(({ merge }) => merge), [".claude/skills/git-commit-push/SKILL.groundwork.md"]);
  assert.deepEqual(result.skippedOwned, [".claude/skills/ask-first/SKILL.md"]);
  assert.equal(existsSync(join(directory, ".claude", "skills", "ask-first")), false);
  const installed = Object.keys(JSON.parse(readFileSync(config, "utf8")).installed);
  assert.equal(installed.some((path) => path.includes("git-commit-push") || path.includes("ask-first")), false);
  assert.ok(installed.includes(".claude/hooks/git-guard.mjs"));
});

test("update refreshes the machinery with the project's own settings and leaves its writing alone", () => {
  const directory = project();
  install(directory, settings, new Set(["deploys"]));
  const saved = JSON.parse(readFileSync(join(directory, ".claude", "agent.json"), "utf8"));
  assert.equal(saved.checks, "npm test");
  assert.deepEqual(saved.scopes, ["api", "web"]);
  const shipped = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8")).version;
  assert.equal(saved.groundwork, shipped);
  writeFileSync(join(directory, ".claude", "agent.json"), JSON.stringify({ ...saved, groundwork: "0.1.0" }));

  writeFileSync(join(directory, ".claude", "hooks", "git-guard.mjs"), "old\n");
  writeFileSync(join(directory, ".githooks", "pre-commit"), "old\n");
  rmSync(join(directory, "scripts", "new-worktree.mjs"));
  writeFileSync(join(directory, "HANDOVER.md"), "our memory\n");
  writeFileSync(join(directory, "CLAUDE.md"), "our rules\n");
  writeFileSync(join(directory, ".claude", "settings.json"), "{}\n");

  const result = install(directory, {}, new Set(["update"]));
  assert.deepEqual(result.written.sort(), [".claude/hooks/git-guard.mjs", ".githooks/pre-commit", "scripts/new-worktree.mjs"]);
  assert.match(readFileSync(join(directory, ".githooks", "pre-commit"), "utf8"), /ACME_ALLOW_MAIN_COMMIT/);
  assert.equal(readFileSync(join(directory, "HANDOVER.md"), "utf8"), "our memory\n");
  assert.equal(readFileSync(join(directory, "CLAUDE.md"), "utf8"), "our rules\n");
  assert.deepEqual(result.beside.map(({ merge }) => merge).sort(), [".claude/settings.groundwork.json", "CLAUDE.groundwork.md"]);
  assert.match(readFileSync(join(directory, "CLAUDE.groundwork.md"), "utf8"), /# Acme Shop — repo rules[\s\S]*\n  npm test\n/);
  assert.deepEqual(result.skipped, []);
  const updated = JSON.parse(readFileSync(join(directory, ".claude", "agent.json"), "utf8"));
  assert.equal(updated.mainDeploys, true);
  assert.equal(updated.groundwork, shipped);
});

test("update offers the template's version beside a kept file once, and again only when the template's changes", () => {
  const directory = project();
  install(directory, settings, new Set());
  const config = join(directory, ".claude", "agent.json");
  writeFileSync(config, JSON.stringify({ ...JSON.parse(readFileSync(config, "utf8")), owned: [".claude/skills/ask-first/"] }));
  writeFileSync(join(directory, "CLAUDE.md"), "our rules\n");
  writeFileSync(join(directory, ".claude", "skills", "ask-first", "SKILL.md"), "ours\n");
  const besides = ["CLAUDE.groundwork.md", ".claude/skills/ask-first/SKILL.groundwork.md"];

  const first = install(directory, {}, new Set(["update"]));
  assert.deepEqual(first.beside.map(({ merge }) => merge).sort(), [...besides].sort());
  for (const merge of besides) rmSync(join(directory, merge));

  const second = install(directory, {}, new Set(["update"]));
  assert.deepEqual(second.beside, []);
  for (const merge of besides) assert.equal(existsSync(join(directory, merge)), false);

  const saved = JSON.parse(readFileSync(config, "utf8"));
  writeFileSync(config, JSON.stringify({ ...saved, offered: { ...saved.offered, "CLAUDE.md": "an earlier template" } }));
  const third = install(directory, {}, new Set(["update"]));
  assert.deepEqual(third.beside, [{ path: "CLAUDE.md", merge: "CLAUDE.groundwork.md" }]);
});

test("update leaves a skill that needs the gate when an older install did not record it, and refuses a project never installed", () => {
  const directory = project();
  install(directory, settings, new Set());
  const config = join(directory, ".claude", "agent.json");
  const { checks, scopes, ...older } = JSON.parse(readFileSync(config, "utf8"));
  assert.ok(checks && scopes);
  writeFileSync(config, JSON.stringify(older));
  const skill = join(directory, ".claude", "skills", "git-commit-push", "SKILL.md");
  writeFileSync(skill, "old\n");

  const unknown = install(directory, {}, new Set(["update"]));
  assert.deepEqual(unknown.skipped.find(({ path }) => path === ".claude/skills/git-commit-push/SKILL.md").missing, ["checks", "scopes"]);
  assert.deepEqual(unknown.skipped.map(({ path }) => path).sort(), [".agents/rules/00-standing-rules.md", ".claude/skills/git-commit-push/SKILL.md", ".claude/standing-rules.md", "AGENTS.md", "CLAUDE.md"]);
  assert.deepEqual(unknown.written, []);
  assert.deepEqual(unknown.beside, []);
  assert.equal(readFileSync(skill, "utf8"), "old\n");

  const told = install(directory, { checks: "npm test", scopes: "api,web", description: "A shop." }, new Set(["update"]));
  assert.deepEqual(told.written, [".claude/skills/git-commit-push/SKILL.md"]);
  assert.deepEqual(told.skipped, []);
  assert.deepEqual(told.beside, []);
  assert.deepEqual(told.recorded, ["checks", "scopes"]);
  assert.deepEqual(JSON.parse(readFileSync(config, "utf8")).scopes, ["api", "web"]);
  assert.deepEqual(install(directory, {}, new Set(["update"])).skipped, []);
  assert.match(readFileSync(skill, "utf8"), /`api` · `web`/);

  assert.throws(() => install(project(), {}, new Set(["update"])), /install first, without --update/);
});

test("update removes what this version no longer ships, unless the project changed it, and never the project's own", () => {
  const directory = project();
  install(directory, settings, new Set());
  const config = join(directory, ".claude", "agent.json");
  const saved = JSON.parse(readFileSync(config, "utf8"));
  assert.ok(saved.installed[".claude/hooks/git-guard.mjs"]);
  assert.ok(saved.installed[".githooks/pre-commit"]);

  const print = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);
  const hooks = join(directory, ".claude", "hooks");
  writeFileSync(join(hooks, "retired.mjs"), "shipped once\n");
  writeFileSync(join(hooks, "edited.mjs"), "shipped once, then changed here\n");
  writeFileSync(join(hooks, "ours.mjs"), "the project's own\n");
  saved.installed[".claude/hooks/retired.mjs"] = print("shipped once\n");
  saved.installed[".claude/hooks/edited.mjs"] = print("shipped once\n");
  writeFileSync(config, JSON.stringify(saved));

  const result = install(directory, {}, new Set(["update"]));
  assert.deepEqual(result.removed, [".claude/hooks/retired.mjs"]);
  assert.deepEqual(result.changedHere, [".claude/hooks/edited.mjs"]);
  assert.equal(existsSync(join(hooks, "retired.mjs")), false);
  assert.equal(existsSync(join(hooks, "edited.mjs")), true);
  assert.equal(existsSync(join(hooks, "ours.mjs")), true);
  const after = JSON.parse(readFileSync(config, "utf8")).installed;
  assert.equal(after[".claude/hooks/retired.mjs"], undefined);
  assert.equal(after[".claude/hooks/edited.mjs"], undefined);
  assert.ok(after[".claude/hooks/git-guard.mjs"]);
});

test("the installer runs when it is reached through a symbolic link", () => {
  const link = join(realpathSync.native(mkdtempSync(join(tmpdir(), "groundwork-link-"))), "groundwork");
  symlinkSync(join(dirname(fileURLToPath(import.meta.url)), ".."), link, "junction");
  const directory = project();
  const result = run(directory, "node", [join(link, "install.mjs"), directory, "--name", "Linked"]);
  assert.equal(result.status, 0, result.said);
  assert.match(result.said, /files written into/);
  assert.match(readFileSync(join(directory, "CLAUDE.md"), "utf8"), /# Linked — repo rules/);
});

function cloned(prefix) {
  const parent = realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
  const origin = join(parent, "origin.git");
  const directory = join(parent, "acme shop");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  execFileSync("git", ["clone", "-q", origin, directory], { stdio: "ignore" });
  for (const args of [["config", "user.email", "t@example.com"], ["config", "user.name", "T"], ["commit", "-q", "--allow-empty", "-m", "start"], ["push", "-q", "origin", "main"]]) {
    execFileSync("git", args, { cwd: directory });
  }
  install(directory, settings, new Set());
  mkdirSync(join(directory, ".agent"));
  mkdirSync(join(directory, "node_modules", "left-pad"), { recursive: true });
  writeFileSync(join(directory, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");
  return { parent, directory };
}

function prepared(worktree, primary) {
  assert.equal(realpathSync(join(worktree, ".agent")), join(primary, ".agent"));
  assert.equal(readFileSync(join(worktree, "node_modules", "left-pad", "index.js"), "utf8"), "module.exports = 1;\n");
  assert.equal(execFileSync("git", ["config", "core.hooksPath"], { cwd: worktree, encoding: "utf8" }).trim(), ".githooks");
}

test("new-worktree.mjs branches off the remote main beside the checkout and prepares it", () => {
  const { parent, directory } = cloned("groundwork-new-worktree-");
  const script = join(directory, "scripts", "new-worktree.mjs");

  assert.equal(run(directory, process.execPath, [script]).status, 1);
  assert.equal(run(directory, process.execPath, [script, "--help"]).status, 0);

  const result = run(directory, process.execPath, [script, "feat/billing"]);
  assert.equal(result.status, 0, result.said);
  const worktree = join(parent, "acme shop-billing");
  assert.match(result.said, new RegExp(`Open the next chat in:\\n\\s+${literally(worktree)}`));
  assert.equal(execFileSync("git", ["branch", "--show-current"], { cwd: worktree, encoding: "utf8" }).trim(), "feat/billing");
  prepared(worktree, directory);

  const again = run(directory, process.execPath, [script, "feat/billing"]);
  assert.equal(again.status, 1);
  assert.match(again.said, /Already there/);
});

test("the worktree hook prepares a new worktree once and says so", () => {
  const { parent, directory } = cloned("groundwork-worktree-hook-");
  const worktree = join(parent, "acme shop-hook");
  execFileSync("git", ["worktree", "add", "-q", "-b", "feat/hook", worktree], { cwd: directory, stdio: "ignore" });

  const told = hook(directory, "worktree-ready.mjs", { tool_name: "EnterWorktree" });
  const shown = process.platform === "win32" ? worktree.replaceAll("\\", "/") : worktree;
  assert.match(told.additionalContext, new RegExp(`## Worktree prepared\\n\\n\`${literally(shown)}\` on \`feat/hook\`\\n- .agent symlinked`));
  prepared(worktree, directory);

  assert.equal(hook(directory, "worktree-ready.mjs", { tool_name: "EnterWorktree" }), null);
});
