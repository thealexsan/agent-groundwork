import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { SLOT_LIMIT, catchUp, section, slots, standingDocs, standingItems } from "../global/hooks/standing-skills.mjs";

const GLOBAL = join(dirname(fileURLToPath(import.meta.url)), "..", "global");

function folder(prefix) {
  return realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
}

function skill(root, name, body) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, "SKILL.md"), `---\nname: ${name}\ndescription: x\n---\n\n${body}\n`);
}

test("a project names its own standing skills, a large one is split across slots, and what does not fit is named for the agent to load", () => {
  const root = folder("groundwork-project-");
  const configDir = folder("groundwork-config-");
  mkdirSync(join(root, ".claude"), { recursive: true });
  writeFileSync(join(root, ".claude", "agent.json"), JSON.stringify({ standingSkills: ["release", "huge", "more", "extra"], standingDocs: [] }));
  skill(join(root, ".claude", "skills"), "release", "ship it");
  skill(join(root, ".claude", "skills"), "huge", "H".repeat(SLOT_LIMIT));
  skill(join(root, ".claude", "skills"), "more", "M".repeat(SLOT_LIMIT - 500));
  skill(join(root, ".claude", "skills"), "extra", "E".repeat(SLOT_LIMIT - 500));
  skill(join(root, ".claude", "skills"), "ask-first", "not listed");

  const packed = slots(standingItems({ root, configDir }), { count: 3 });
  assert.equal(packed.length, 3);
  assert.match(packed[1], /^# Skill `huge`, part 1/);
  assert.match(packed[2], /# Skill `huge`, part 2[\s\S]*# Skill `more`/);
  assert.equal(packed.join("").match(/H/g).length, SLOT_LIMIT);
  assert.ok(packed.every((text) => text.length <= SLOT_LIMIT + 400));
  assert.match(packed[0], /load these yourself before your first reply: `extra`/);
  assert.match(packed[0], /ship it/);
  assert.doesNotMatch(packed.join(""), /not listed/);
});

test("the traps section of the handover is injected with the skills, whatever its number", () => {
  const root = folder("groundwork-project-");
  const configDir = folder("groundwork-config-");
  writeFileSync(join(root, "HANDOVER.md"), "# H\n\n## 5. Log\n\nold\n\n## 6. Traps\n\n1. **A trap.** Avoid it.\n\n## 7. Before\n\nlater\n");

  assert.equal(section(readFileSync(join(root, "HANDOVER.md"), "utf8"), "Traps"), "## 6. Traps\n\n1. **A trap.** Avoid it.");
  assert.equal(section("## 4. Traps\r\n\r\nx\r\n", "Traps"), "## 4. Traps\n\nx");
  assert.equal(section("## Log\n", "Traps"), null);
  assert.deepEqual(standingDocs({ root }).map((doc) => doc.name), ["HANDOVER.md Traps"]);

  const packed = slots(standingItems({ root, configDir }));
  assert.match(packed[0], /count as invoked or read: `HANDOVER.md Traps`/);
  assert.match(packed[0], /# `HANDOVER.md`, section Traps, loaded in full/);
  assert.doesNotMatch(packed[0], /old|later/);
});

test("a chat that started without the injection is told once, on its next prompt, to load them", () => {
  const root = folder("groundwork-project-");
  const configDir = folder("groundwork-config-");
  skill(join(configDir, "skills"), "short-answers", "short");
  skill(join(root, ".claude", "skills"), "ask-first", "ask");
  writeFileSync(join(root, "HANDOVER.md"), "## 4. Traps\n\n1. x\n");

  const told = catchUp({ root, configDir, session: "old-chat" });
  assert.match(told, /invoke each with the Skill tool, in one parallel batch: `short-answers`, `ask-first`/);
  assert.match(told, /read `HANDOVER.md`, section Traps/);
  assert.equal(catchUp({ root, configDir, session: "old-chat" }), "");

  const home = folder("groundwork-home-");
  cpSync(GLOBAL, join(home, ".groundwork", "global"), { recursive: true });
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir, HOME: home, USERPROFILE: home };
  const run = ([script, ...args], input) => spawnSync(process.execPath, [join(GLOBAL, "hooks", script), ...args], { encoding: "utf8", input: JSON.stringify(input), env }).stdout;
  const prompt = (session, event = "UserPromptSubmit") => run(["short-answers.mjs"], { cwd: root, session_id: session, hook_event_name: event });

  run(["standing-skills.mjs", "0"], { cwd: root, session_id: "new-chat" });
  assert.doesNotMatch(prompt("new-chat"), /started before/);
  assert.match(prompt("third-chat"), /^Short-answers rule[\s\S]*started before its standing skills were injected/);
  assert.doesNotMatch(prompt("third-chat"), /started before/);
  assert.doesNotMatch(prompt("fourth-chat", "SessionStart"), /started before/);
  assert.match(prompt("fourth-chat", "SessionStart"), /^Short-answers rule/);
});
