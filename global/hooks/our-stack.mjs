#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { homedir } from "node:os";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const GLOBAL = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY = join(GLOBAL, "..");
const PULL_EVERY_MS = 24 * 60 * 60 * 1000;

function pullDaily() {
  let last = 0;
  try {
    last = statSync(join(REPOSITORY, ".git", "FETCH_HEAD")).mtimeMs;
  } catch {
    last = 0;
  }
  if (Date.now() - last < PULL_EVERY_MS) return;
  try {
    const branch = execFileSync("git", ["-C", REPOSITORY, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (branch !== "main") return;
    execFileSync("git", ["-C", REPOSITORY, "pull", "--ff-only", "-q"], { stdio: "ignore", timeout: 4000 });
  } catch {
    return;
  }
}

function refreshPartsDaily(partsCache) {
  let fetched = 0;
  try {
    fetched = statSync(partsCache).mtimeMs;
  } catch {
    fetched = 0;
  }
  if (Date.now() - fetched < PULL_EVERY_MS) return;
  spawn(process.execPath, [join(GLOBAL, "catalog.mjs"), "--cache", partsCache], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

pullDaily();
let said = [];
try {
  const { sync, PARTS_CACHE } = await import(pathToFileURL(join(GLOBAL, "sync.mjs")).href);
  said = sync({ hook: false });
  refreshPartsDaily(join(homedir(), PARTS_CACHE));
} catch (error) {
  said = [`the our-stack sync failed: ${error.message}`];
}

const rule = readFileSync(join(GLOBAL, "rules", "our-stack.md"), "utf8").trim();
const lines = [rule];
if (said.length > 0) lines.push("", "Applied just now on this machine:", ...said.map((line) => `- ${line}`));

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: lines.join("\n") } }),
);
