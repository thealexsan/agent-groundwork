import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FETCH_TIMEOUT_MS = 4000;

export const WINDOWS = {
  five_hour: "5-hour session",
};

const configuredDir = process.env.CLAUDE_CONFIG_DIR;
const configDir = configuredDir || join(homedir(), ".claude");
const keychainService = configuredDir
  ? `Claude Code-credentials-${createHash("sha256").update(configuredDir).digest("hex").slice(0, 8)}`
  : "Claude Code-credentials";
const statePath = join(configDir, ".usage-limit-warning.json");

export function readState() {
  try {
    return { warned: {}, ...JSON.parse(readFileSync(statePath, "utf8")) };
  } catch {
    return { fetchedAt: 0, usage: null, warned: {} };
  }
}

export function writeState(state) {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state));
}

function accessToken() {
  const raw = execFileSync("security", ["find-generic-password", "-s", keychainService, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 3000,
  });
  return JSON.parse(raw).claudeAiOauth?.accessToken ?? null;
}

async function fetchUsage() {
  const token = accessToken();
  if (!token) return null;
  const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  return response.json();
}

export async function freshState(maxAgeMs) {
  const state = readState();
  if (state.usage && Date.now() - state.fetchedAt <= maxAgeMs) return state;
  try {
    const usage = await fetchUsage();
    if (usage) {
      state.usage = usage;
      state.fetchedAt = Date.now();
      writeState(state);
    }
  } catch {
    return state;
  }
  return state;
}

export function percentOf(window) {
  const value = window?.utilization ?? window?.used_percentage;
  return typeof value === "number" ? value : null;
}

export function resetHour(resetsAt) {
  const ms = typeof resetsAt === "number" ? resetsAt * 1000 : Date.parse(resetsAt ?? "");
  return Number.isNaN(ms) ? "unknown" : String(Math.round(ms / 3600000));
}

export function resetLabel(resetsAt) {
  if (!resetsAt) return "";
  const when = typeof resetsAt === "number" ? new Date(resetsAt * 1000) : new Date(resetsAt);
  if (Number.isNaN(when.getTime())) return "";
  const minutes = Math.max(0, Math.round((when.getTime() - Date.now()) / 60000));
  const inWords = minutes >= 120 ? `${Math.round(minutes / 60)}h` : `${minutes}m`;
  const at = when.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return ` — resets ${at} (in ${inWords})`;
}

export function windowsAtOrAbove(usage, threshold) {
  const hits = [];
  for (const [key, label] of Object.entries(WINDOWS)) {
    const window = usage?.[key];
    const percent = percentOf(window);
    if (percent !== null && percent >= threshold) {
      hits.push(`${label} limit at ${Math.round(percent)}%${resetLabel(window.resets_at)}`);
    }
  }
  return hits;
}
