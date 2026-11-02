#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { freshState, windowsAtOrAbove } from "./usage-state.mjs";

const HANDBRAKE_AT = 90;
const REFRESH_AFTER_MS = 60 * 1000;
const READ_ONLY_TOOLS = new Set(["Read", "Glob", "Grep", "ToolSearch"]);
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const HANDOVER_PATH = /(\/\.agent\/|\/HANDOVER\.md$|\/NEXT_STEPS\.md$|\/memory\/|handoff)/i;
const READ_ONLY_GIT = /^\s*git\s+(status|diff|log|show|branch|stash\s+list)\b[^;&|<>`$]*$/;

if (process.env.CLAUDE_HANDBRAKE_OFF === "1") process.exit(0);

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}

const state = await freshState(REFRESH_AFTER_MS);
const hits = windowsAtOrAbove(state.usage, HANDBRAKE_AT);

if (hits.length === 0) process.exit(0);

const why = `HANDBRAKE: ${hits.join("; ")}.`;
const orders =
  "Stop the task now. Do not start or continue any other work. " +
  "Write the handover with the Write or Edit tool into .agent/progress.md of the project " +
  "(or the project's own handover file): what is done and committed, what is half done and uncommitted " +
  "(branch, worktree, files), what was verified, and the exact next step. Then end the turn with one line " +
  "telling the user the handbrake stopped the chat, the reset time, and a short handoff message for the next chat.";

if (input.hook_event_name === "UserPromptSubmit") {
  process.stdout.write(
    JSON.stringify({
      systemMessage: `${why} Writing the handover and stopping.`,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `${why} ${orders} Do not do what this message asks.`,
      },
    })
  );
  process.exit(0);
}

const tool = input.tool_name ?? "";
const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? "";
const command = input.tool_input?.command ?? "";

const allowed =
  READ_ONLY_TOOLS.has(tool) ||
  (WRITE_TOOLS.has(tool) && HANDOVER_PATH.test(path)) ||
  (tool === "Bash" && READ_ONLY_GIT.test(command));

if (allowed) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `${why} ${orders}`,
    },
  })
);
