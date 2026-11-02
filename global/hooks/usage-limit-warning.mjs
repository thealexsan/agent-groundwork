#!/usr/bin/env node
import { WINDOWS, freshState, percentOf, resetHour, resetLabel, writeState } from "./usage-state.mjs";

const THRESHOLDS = [80, 90, 95];
const REFRESH_AFTER_MS = 3 * 60 * 1000;

const state = await freshState(REFRESH_AFTER_MS);

if (!state.usage) process.exit(0);

const alerts = [];

for (const [key, label] of Object.entries(WINDOWS)) {
  const window = state.usage[key];
  const percent = percentOf(window);
  if (percent === null) continue;

  const crossed = THRESHOLDS.filter((t) => percent >= t).pop();
  if (crossed === undefined) continue;

  const windowId = `${key}|${resetHour(window.resets_at)}`;
  if ((state.warned[windowId] ?? 0) >= crossed) continue;

  state.warned[windowId] = crossed;
  alerts.push(`${label} limit at ${Math.round(percent)}%${resetLabel(window.resets_at)}`);
}

for (const windowId of Object.keys(state.warned)) {
  const [key, hour] = windowId.split("|");
  const current = state.usage[key];
  if (current && resetHour(current.resets_at) !== hour) delete state.warned[windowId];
}

writeState(state);

if (alerts.length === 0) process.exit(0);

const message = `Claude usage warning: ${alerts.join("; ")}.`;

process.stdout.write(
  JSON.stringify({
    systemMessage: message,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext:
        `${message} Tell the user this in one line at the top of your reply, with the reset time, ` +
        "before anything else.",
    },
  })
);
