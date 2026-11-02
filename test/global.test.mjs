import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

process.env.GROUNDWORK_OWNER = "someone";

import { SKILL, catalogTable, fetchParts, refreshCache, withCatalog } from "../global/catalog.mjs";
import { PARTS_CACHE, nodeOnPath, sync, withBlock } from "../global/sync.mjs";
import { STANDING_SLOTS, SLOT_LIMIT, slots, standingSkills } from "../global/hooks/standing-skills.mjs";

const GLOBAL = join(dirname(fileURLToPath(import.meta.url)), "..", "global");

function machine() {
  const home = realpathSync.native(mkdtempSync(join(tmpdir(), "groundwork-home-")));
  for (const directory of [".claude/skills", ".codex/skills", ".gemini", ".claude_account9", ".claude_account8"]) {
    mkdirSync(join(home, directory), { recursive: true });
  }
  writeFileSync(join(home, ".claude", "CLAUDE.md"), "# Mine\n\nKeep this.\n");
  writeFileSync(join(home, ".claude", "settings.json"), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: "theirs" }] }] } }));
  writeFileSync(join(home, ".claude_account8", "CLAUDE.md"), "an account's own\n");
  return home;
}

test("the sync gives every agent present the rule, shares the skill, links the accounts and registers the hook, once", () => {
  const home = machine();
  const said = sync({ home, node: "/usr/local/bin/node" });

  const claude = readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8");
  assert.match(claude, /^# Mine\n\nKeep this\.\n\n<!-- groundwork:our-stack:start -->\n## Our stack and our parts/);
  assert.match(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8"), /Use our ready parts first/);
  assert.match(readFileSync(join(home, ".gemini", "GEMINI.md"), "utf8"), /Use our ready parts first/);
  assert.equal(existsSync(join(home, ".copilot")), false);

  assert.match(readFileSync(join(home, ".agents", "skills", "our-stack", "SKILL.md"), "utf8"), /^---\nname: our-stack/);
  for (const agent of [".claude", ".codex"]) {
    const link = join(home, agent, "skills", "our-stack");
    assert.equal(lstatSync(link).isSymbolicLink(), true);
    assert.equal(realpathSync(link), join(home, ".agents", "skills", "our-stack"));
  }

  assert.equal(realpathSync(join(home, ".claude_account9", "CLAUDE.md")), join(home, ".claude", "CLAUDE.md"));
  assert.equal(realpathSync(join(home, ".claude_account9", "settings.json")), join(home, ".claude", "settings.json"));
  assert.equal(readFileSync(join(home, ".claude_account8", "CLAUDE.md"), "utf8"), "an account's own\n");
  assert.ok(said.some((line) => /claude_account8\/CLAUDE\.md is its own file/.test(line)));

  const starts = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8")).hooks.SessionStart;
  assert.equal(starts.length, 2 + STANDING_SLOTS);
  assert.deepEqual(starts[1].hooks[0], { type: "command", command: "/usr/local/bin/node", args: [join(GLOBAL, "hooks", "our-stack.mjs").split(sep).join("/")], timeout: 10 });
  const standing = join(GLOBAL, "hooks", "standing-skills.mjs").split(sep).join("/");
  assert.deepEqual(starts.slice(2).map((entry) => entry.hooks[0].args), Array.from({ length: STANDING_SLOTS }, (_, slot) => [standing, String(slot)]));

  const again = sync({ home, node: "/usr/local/bin/node" });
  assert.deepEqual(again.filter((line) => !/claude_account8/.test(line)), []);
  assert.equal(readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8"), claude);
});

test("a changed rule replaces the block in place instead of adding a second", () => {
  const once = withBlock("# Mine\n", "old rule");
  const twice = withBlock(`${once}\n## After\n`, "new rule");
  assert.equal(twice, "# Mine\n\n<!-- groundwork:our-stack:start -->\nnew rule\n<!-- groundwork:our-stack:end -->\n\n## After\n");
});

test("an agent installed later, and a new account, are picked up by the next session start", () => {
  const home = machine();
  sync({ home });
  mkdirSync(join(home, ".copilot"));
  mkdirSync(join(home, ".claude_account10"));
  writeFileSync(join(home, PARTS_CACHE), JSON.stringify({ parts: [{ name: "newpart", description: "Something new", kind: "Go", version: "v0.3.0" }] }));

  const result = spawnSync(process.execPath, [join(GLOBAL, "hooks", "our-stack.mjs")], { encoding: "utf8", input: "{}", env: { ...process.env, HOME: home, USERPROFILE: home } });
  assert.equal(result.status, 0, result.stderr);
  const context = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(context, /^## Our stack and our parts/);
  assert.match(context, /rules written for GitHub Copilot CLI/);
  assert.match(context, /claude_account10\/CLAUDE\.md linked/);
  assert.match(readFileSync(join(home, ".copilot", "copilot-instructions.md"), "utf8"), /Build on this stack by default/);
  assert.match(context, /skill our-stack written/);
  assert.match(readFileSync(join(home, ".claude", "skills", "our-stack", "SKILL.md"), "utf8"), /\| `newpart` \| Something new \| Go \| `v0.3.0` \|\n<!-- groundwork:parts:end -->/);
});

function repository(name, { topics = ["our-part"], language = "Go", release = null, tag = null, description = `${name} does a thing`, archived = false } = {}) {
  return {
    name,
    description,
    isArchived: archived,
    primaryLanguage: language ? { name: language } : null,
    latestRelease: release ? { tagName: release } : null,
    refs: { nodes: tag ? [{ name: tag }] : [] },
    repositoryTopics: { nodes: topics.map((topic) => ({ topic: { name: topic } })) },
  };
}

const answer = (nodes) => () => JSON.stringify({ data: { repositoryOwner: { repositories: { nodes } } } });

test("the catalog lists the repositories with the our-part topic, Go first, at their release or else their newest tag", () => {
  const parts = fetchParts(
    answer([
      repository("loom", { language: "TypeScript", release: "v0.2.0", tag: "v0.2.0" }),
      repository("warden", { tag: "v0.1.0" }),
      repository("app", { topics: [], release: "v1.0.0" }),
      repository("old", { archived: true, release: "v0.1.0" }),
      repository("charter", { release: "v0.3.0", tag: "v0.4.0-rc", description: null }),
      repository("draft"),
    ]),
  );
  assert.deepEqual(parts.map((part) => part.name), ["loom", "warden", "charter", "draft"]);
  assert.equal(
    catalogTable(parts),
    [
      "| Part | What it does | Kind | Latest |",
      "|---|---|---|---|",
      "| `charter` | no description yet; read its README | Go | `v0.3.0` |",
      "| `draft` | draft does a thing | Go | no release |",
      "| `warden` | warden does a thing | Go | `v0.1.0` |",
      "| `loom` | loom does a thing | JS | `v0.2.0` |",
    ].join("\n"),
  );
});

test("the committed skill carries a generated catalog, and a refresh that finds no part writes no cache", () => {
  const skill = readFileSync(SKILL, "utf8");
  assert.equal(withCatalog(skill, "x"), withCatalog(withCatalog(skill, "y"), "x"));

  const home = realpathSync.native(mkdtempSync(join(tmpdir(), "groundwork-home-")));
  assert.throws(() => refreshCache(join(home, PARTS_CACHE), answer([repository("app", { topics: [] })])), /no repository of someone has the our-part topic/);
  assert.equal(existsSync(join(home, PARTS_CACHE)), false);
  refreshCache(join(home, PARTS_CACHE), answer([repository("warden", { tag: "v0.1.0" })]));
  assert.equal(JSON.parse(readFileSync(join(home, PARTS_CACHE), "utf8")).parts[0].version, "v0.1.0");
});

test("a hook registered in shell form by an older version is replaced in place by the exec form, which PowerShell runs too", () => {
  const home = machine();
  const old = `"/usr/local/bin/node" "${join(GLOBAL, "hooks", "our-stack.mjs")}"`;
  writeFileSync(join(home, ".claude", "settings.json"), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: old, timeout: 10 }] }] } }));
  sync({ home, node: "C:/Program Files/nodejs/node.exe" });
  const starts = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8")).hooks.SessionStart;
  assert.equal(starts.length, 1 + STANDING_SLOTS);
  assert.equal(starts[0].hooks[0].command, "C:/Program Files/nodejs/node.exe");
  assert.match(starts[0].hooks[0].args[0], /global\/hooks\/our-stack\.mjs$/);
});

test("the hook is registered with the node on the path, not a versioned install that an upgrade removes", () => {
  const bin = realpathSync.native(mkdtempSync(join(tmpdir(), "groundwork-bin-")));
  writeFileSync(join(bin, "node"), "");
  assert.equal(nodeOnPath(`/nonexistent${delimiter}${bin}${delimiter}/usr/bin`, "linux"), join(bin, "node"));
  assert.equal(nodeOnPath("/nonexistent", "linux"), process.execPath);
  writeFileSync(join(bin, "node.exe"), "");
  assert.equal(nodeOnPath(`/nonexistent${delimiter}${bin}`, "win32"), join(bin, "node.exe"));
});

function skill(root, name, body) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, "SKILL.md"), `---
name: ${name}
description: x
---

${body}
`);
}

test("the standing skills are injected in full, project ones before the global copy, split into slots under the hook output cap", () => {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "groundwork-project-")));
  const configDir = realpathSync.native(mkdtempSync(join(tmpdir(), "groundwork-config-")));
  skill(join(configDir, "skills"), "short-answers", "global short");
  skill(join(configDir, "skills"), "our-stack", "S".repeat(6000));
  skill(join(configDir, "skills"), "ask-first", "global ask");
  skill(join(root, ".claude", "skills"), "ask-first", "project ask");
  skill(join(root, ".claude", "skills"), "commit-discipline", "C".repeat(5000));
  skill(join(root, ".claude", "skills"), "release", "not standing");

  const found = standingSkills({ root, configDir });
  assert.deepEqual(found.map((entry) => entry.name), ["short-answers", "our-stack", "ask-first", "commit-discipline"]);
  assert.equal(found.find((entry) => entry.name === "ask-first").body, "project ask");

  const packed = slots(found);
  assert.equal(packed.length, 2);
  assert.ok(packed.every((text) => text.length <= SLOT_LIMIT + 400));
  assert.match(packed[0], /^Standing skills are loaded in full below and count as invoked or read: `short-answers`, `our-stack`, `ask-first`, `commit-discipline`./);
  assert.doesNotMatch(packed.join(""), /^---|name: |not standing/m);

  const hook = (slot) => spawnSync(process.execPath, [join(GLOBAL, "hooks", "standing-skills.mjs"), String(slot)], { encoding: "utf8", input: JSON.stringify({ cwd: root }), env: { ...process.env, CLAUDE_CONFIG_DIR: configDir } });
  assert.match(JSON.parse(hook(1).stdout).hookSpecificOutput.additionalContext, /# Skill `commit-discipline`/);
  assert.equal(hook(STANDING_SLOTS - 1).stdout, "");
});
