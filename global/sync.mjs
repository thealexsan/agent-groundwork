#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { PARTS_START, catalogTable, readCache, refreshCache, withCatalog } from "./catalog.mjs";
import { STANDING_SLOTS } from "./hooks/standing-skills.mjs";

const GLOBAL = dirname(fileURLToPath(import.meta.url));
const START = "<!-- groundwork:our-stack:start -->";
const END = "<!-- groundwork:our-stack:end -->";
const HOOK = "hooks/our-stack.mjs";
const STANDING_HOOK = "hooks/standing-skills.mjs";

export const AGENTS = [
  { name: "Claude Code", home: ".claude", rules: ".claude/CLAUDE.md", skills: ".claude/skills" },
  { name: "Codex", home: ".codex", rules: ".codex/AGENTS.md", skills: ".codex/skills" },
  { name: "Gemini CLI and Antigravity", home: ".gemini", rules: ".gemini/GEMINI.md" },
  { name: "GitHub Copilot CLI", home: ".copilot", rules: ".copilot/copilot-instructions.md" },
  { name: "Windsurf", home: ".codeium/windsurf", rules: ".codeium/windsurf/memories/global_rules.md" },
  { name: "opencode", home: ".config/opencode", rules: ".config/opencode/AGENTS.md" },
  { name: "Qwen Code", home: ".qwen", rules: ".qwen/QWEN.md" },
];
export const PARTS_CACHE = join(".agents", "our-stack-parts.json");
export const SHARED_ACCOUNT_ENTRIES = ["settings.json", "CLAUDE.md", "hooks", "skills", "agents"];

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function present(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export function withBlock(text, rule) {
  const block = `${START}\n${rule.trim()}\n${END}`;
  if (text === null || text.trim() === "") return `${block}\n`;
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (start >= 0 && end > start) return `${text.slice(0, start)}${block}${text.slice(end + END.length)}`;
  return `${text.replace(/\n*$/, "\n\n")}${block}\n`;
}

const WINDOWS = process.platform === "win32";

export function link(source, path) {
  if (!WINDOWS) return symlinkSync(relative(dirname(path), source), path);
  return symlinkSync(source, path, lstatSync(source).isDirectory() ? "junction" : "file");
}

function linksTo(path, source) {
  return lstatSync(path).isSymbolicLink() && realpathSync(path) === realpathSync(source);
}

function syncRules(home, rule, said) {
  for (const agent of AGENTS) {
    if (!existsSync(join(home, agent.home))) continue;
    const file = join(home, agent.rules);
    const target = present(file) && lstatSync(file).isSymbolicLink() ? realpathSync(file) : file;
    const before = read(target);
    const after = withBlock(before, rule);
    if (before === after) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, after);
    said.push(`rules written for ${agent.name} in ~/${agent.rules}`);
  }
}

function syncSkills(home, said) {
  for (const name of readdirSync(join(GLOBAL, "skills"))) {
    const source = join(GLOBAL, "skills", name);
    const shared = join(home, ".agents", "skills", name);
    const before = read(join(shared, "SKILL.md"));
    rmSync(shared, { recursive: true, force: true });
    mkdirSync(dirname(shared), { recursive: true });
    cpSync(source, shared, { recursive: true });
    const cache = readCache(join(home, PARTS_CACHE));
    const skill = join(shared, "SKILL.md");
    if (cache && read(skill)?.includes(PARTS_START)) writeFileSync(skill, withCatalog(read(skill), catalogTable(cache.parts)));
    if (before !== read(join(shared, "SKILL.md"))) said.push(`skill ${name} written in ~/.agents/skills`);

    for (const agent of AGENTS.filter((agent) => agent.skills && existsSync(join(home, agent.home)))) {
      const path = join(home, agent.skills, name);
      if (present(path)) {
        if (linksTo(path, shared)) continue;
        if (!lstatSync(path).isSymbolicLink()) {
          said.push(`~/${agent.skills}/${name} is a folder of its own, so it was left; remove it to use the shared skill`);
          continue;
        }
        rmSync(path);
      }
      mkdirSync(dirname(path), { recursive: true });
      link(shared, path);
      said.push(`skill ${name} linked for ${agent.name}`);
    }
  }
}

function syncAccounts(home, said) {
  const primary = join(home, ".claude");
  for (const account of readdirSync(home).filter((entry) => /^\.claude_account[\w-]*$/.test(entry))) {
    const directory = join(home, account);
    if (!lstatSync(directory).isDirectory()) continue;
    for (const entry of SHARED_ACCOUNT_ENTRIES) {
      const source = join(primary, entry);
      const path = join(directory, entry);
      if (!existsSync(source)) continue;
      if (!present(path)) {
        try {
          link(source, path);
          said.push(`~/${account}/${entry} linked to ~/.claude/${entry}`);
        } catch (error) {
          if (error.code !== "EPERM") throw error;
          said.push(`~/${account}/${entry} could not be linked: Windows links a file only with Developer Mode on (Settings → System → For developers)`);
        }
      } else if (!lstatSync(path).isSymbolicLink()) {
        said.push(`~/${account}/${entry} is its own file, so ${account} does not share the global rules; move it aside and run the sync again`);
      }
    }
  }
}

export const SESSION_START_HOOKS = [
  { script: HOOK, args: [] },
  ...Array.from({ length: STANDING_SLOTS }, (_, slot) => ({ script: STANDING_HOOK, args: [String(slot)] })),
];

function syncHook(home, node, said) {
  const file = join(home, ".claude", "settings.json");
  if (!existsSync(join(home, ".claude"))) return;
  const settings = JSON.parse(read(file) ?? "{}");
  const starts = (settings.hooks ??= {}).SessionStart ??= [];
  let changed = false;
  for (const { script, args } of SESSION_START_HOOKS) {
    const wanted = { type: "command", command: node, args: [join(GLOBAL, script).split(sep).join("/"), ...args], timeout: 10 };
    const key = [script, ...args].join(" ");
    const ours = (hook) => `${hook.command} ${(hook.args ?? []).join(" ")}`.replaceAll("\\", "/").replace(/"/g, "").trim().endsWith(key);
    const group = starts.find((entry) => (entry.hooks ?? []).some(ours));
    if (group) {
      const index = group.hooks.findIndex(ours);
      if (JSON.stringify(group.hooks[index]) === JSON.stringify(wanted)) continue;
      group.hooks[index] = wanted;
    } else {
      starts.push({ hooks: [wanted] });
    }
    changed = true;
  }
  if (!changed) return;
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  said.push("session-start hooks registered in ~/.claude/settings.json");
}

export function nodeOnPath(path = process.env.PATH ?? "", platform = process.platform) {
  const binary = platform === "win32" ? "node.exe" : "node";
  const found = path.split(delimiter).filter(Boolean).map((directory) => join(directory, binary)).find((candidate) => existsSync(candidate));
  return found ?? process.execPath;
}

export function sync({ home = homedir(), node = nodeOnPath(), hook = true } = {}) {
  const said = [];
  const rule = readFileSync(join(GLOBAL, "rules", "our-stack.md"), "utf8");
  syncRules(home, rule, said);
  syncSkills(home, said);
  syncAccounts(home, said);
  if (hook) syncHook(home, node, said);
  return said;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const prefix = [];
  try {
    prefix.push(`${refreshCache(join(homedir(), PARTS_CACHE)).length} parts read from GitHub`);
  } catch (error) {
    prefix.push(`the parts catalog was not refreshed, so the last one stands: ${(error.stderr?.toString().trim() || error.message).split("\n")[0]}`);
  }
  const said = [...prefix, ...sync()];
  console.log(said.length > 0 ? said.map((line) => `- ${line}`).join("\n") : "Every agent already has the rules and the skill.");
}
