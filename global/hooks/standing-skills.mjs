#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const STANDING_SLOTS = 8;
export const SLOT_LIMIT = 9000;
export const GLOBAL_STANDING = ["short-answers", "our-stack"];
export const PROJECT_STANDING = [
  "ask-first",
  "commit-discipline",
  "git-commit-push",
  "verify-before-done",
  "targeted-tests",
  "context-handoff",
  "no-code-comments",
  "no-inline-comments",
];
export const STANDING_DOCS = [{ file: "HANDOVER.md", heading: "Traps" }];
export const INJECTED = "Standing skills are loaded in full below";
const DELIVERED_DIR = ".standing-skills";
const DELIVERED_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function projectRoot(cwd) {
  try {
    return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return cwd;
  }
}

function withoutFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

function projectSetting(root, key, fallback) {
  try {
    const saved = JSON.parse(readFileSync(join(root, ".claude", "agent.json"), "utf8"))[key];
    return Array.isArray(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function section(text, heading) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const title = new RegExp(`^## (?:[\\d.]+\\s*)?${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const start = lines.findIndex((line) => title.test(line));
  if (start < 0) return null;
  const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
  return lines.slice(start, end < 0 ? lines.length : end).join("\n").trim();
}

export function standingSkills({ root, configDir }) {
  const found = [];
  const seen = new Set();
  for (const name of [...GLOBAL_STANDING, ...projectSetting(root, "standingSkills", PROJECT_STANDING)]) {
    if (seen.has(name)) continue;
    const text = read(join(root, ".claude", "skills", name, "SKILL.md")) ?? read(join(configDir, "skills", name, "SKILL.md"));
    if (text === null) continue;
    seen.add(name);
    found.push({ name, title: `Skill \`${name}\``, body: withoutFrontmatter(text) });
  }
  return found;
}

export function standingDocs({ root }) {
  const found = [];
  for (const { file, heading } of projectSetting(root, "standingDocs", STANDING_DOCS)) {
    const text = read(join(root, file));
    const body = text === null ? null : section(text, heading);
    if (body) found.push({ name: `${file} ${heading}`, title: `\`${file}\`, section ${heading}`, body });
  }
  return found;
}

function pieces(item, limit) {
  const heading = (part) => `# ${item.title}${part ? `, part ${part}` : ""}, loaded in full by the session-start hook\n\n`;
  const whole = `${heading(0)}${item.body}`;
  if (whole.length <= limit) return [whole];
  const room = limit - heading(99).length;
  const paragraphs = item.body.split("\n\n").flatMap((paragraph) => (paragraph.length <= room ? [paragraph] : paragraph.match(new RegExp(`[\\s\\S]{1,${room}}`, "g"))));
  const parts = [];
  for (const paragraph of paragraphs) {
    if (parts.length > 0 && parts.at(-1).length + paragraph.length + 2 <= room) parts[parts.length - 1] += `\n\n${paragraph}`;
    else parts.push(paragraph);
  }
  return parts.map((part, index) => `${heading(index + 1)}${part}`);
}

function pack(packed, blocks, limit) {
  const next = [...packed];
  for (const block of blocks) {
    if (next.length > 0 && next.at(-1).length + block.length + 2 <= limit) next[next.length - 1] = `${next.at(-1)}\n\n${block}`;
    else next.push(block);
  }
  return next;
}

export function slots(items, { count = STANDING_SLOTS, limit = SLOT_LIMIT } = {}) {
  let packed = [];
  const left = [];
  for (const item of items) {
    const next = pack(packed, pieces(item, limit), limit);
    if (next.length > count) left.push(item.name);
    else packed = next;
  }
  const names = items.filter((item) => !left.includes(item.name)).map((item) => `\`${item.name}\``);
  const header = [
    `${INJECTED} and count as invoked or read: ${names.join(", ")}.`,
    "Follow every one of them from the first reply; do not call the Skill tool for them again.",
  ];
  if (left.length > 0) header.push(`Too many to inject, so load these yourself before your first reply: ${left.map((name) => `\`${name}\``).join(", ")}.`);
  if (packed.length === 0) return left.length > 0 ? [header.join("\n")] : [];
  packed[0] = `${header.join("\n")}\n\n${packed[0]}`;
  return packed;
}

export function standingItems({ root, configDir }) {
  return [...standingSkills({ root, configDir }), ...standingDocs({ root })];
}

function deliveredPath(configDir, session) {
  return join(configDir, DELIVERED_DIR, String(session).replace(/[^\w-]/g, ""));
}

export function markDelivered(configDir, session, now = Date.now()) {
  if (!session) return;
  const directory = join(configDir, DELIVERED_DIR);
  mkdirSync(directory, { recursive: true });
  writeFileSync(deliveredPath(configDir, session), new Date(now).toISOString());
  for (const name of readdirSync(directory)) {
    try {
      if (now - statSync(join(directory, name)).mtimeMs > DELIVERED_KEEP_MS) rmSync(join(directory, name));
    } catch {
      continue;
    }
  }
}

export function delivered(configDir, session) {
  return read(deliveredPath(configDir, session)) !== null;
}

export function catchUp({ root, configDir, session }) {
  if (!session || delivered(configDir, session)) return "";
  const items = standingItems({ root, configDir });
  markDelivered(configDir, session);
  if (items.length === 0) return "";
  const skills = items.filter((item) => item.title.startsWith("Skill")).map((item) => `\`${item.name}\``);
  const docs = items.filter((item) => !item.title.startsWith("Skill")).map((item) => item.title);
  const lines = ["This chat started before its standing skills were injected, so load them now, before you answer this message:"];
  if (skills.length > 0) lines.push(`- invoke each with the Skill tool, in one parallel batch: ${skills.join(", ")};`);
  if (docs.length > 0) lines.push(`- read ${docs.join(" and ")}.`);
  lines.push("Say in one line that you loaded them, then answer.");
  return lines.join("\n");
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  let data = "";
  process.stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 1500);
  });
}

export async function hookInput() {
  try {
    return JSON.parse((await readStdin()) || "{}");
  } catch {
    return {};
  }
}

export function context(payload) {
  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return { root: projectRoot(cwd), configDir: process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), session: payload.session_id };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const slot = Number(process.argv[2] ?? 0);
  const where = context(await hookInput());
  const text = slots(standingItems(where))[slot];
  if (text) {
    if (slot === 0) markDelivered(where.configDir, where.session);
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }));
  }
}
