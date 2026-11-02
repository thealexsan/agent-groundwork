#!/usr/bin/env node
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WARN_TOKENS = Number(process.env.CHAT_LENGTH_WARN_TOKENS ?? 200_000);
const URGE_TOKENS = Number(process.env.CHAT_LENGTH_URGE_TOKENS ?? 400_000);
const REPEAT_URGE_EVERY_PROMPTS = 5;
const TAIL_BYTES = 3_000_000;

function readTail(path) {
  const size = statSync(path).size;
  const length = Math.min(size, TAIL_BYTES);
  const buffer = Buffer.alloc(length);
  const fd = openSync(path, "r");
  readSync(fd, buffer, 0, length, size - length);
  closeSync(fd);
  return buffer.toString("utf8");
}

function contextTokens(transcriptPath) {
  const lines = readTail(transcriptPath).split("\n").reverse();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const usage = entry?.message?.usage;
      if (entry.type === "assistant" && usage) {
        return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
      }
    } catch {
      continue;
    }
  }
  return null;
}

function levelFor(tokens) {
  if (tokens >= URGE_TOKENS) return 2;
  if (tokens >= WARN_TOKENS) return 1;
  return 0;
}

function main(raw) {
  const input = JSON.parse(raw);
  const sessionId = String(input.session_id ?? "");
  const transcriptPath = input.transcript_path;

  if (!/^[A-Za-z0-9_-]+$/.test(sessionId) || typeof transcriptPath !== "string" || !existsSync(transcriptPath)) return;

  const tokens = contextTokens(transcriptPath);
  if (tokens === null) return;

  const level = levelFor(tokens);
  const statePath = join(tmpdir(), `claude-chat-length-${sessionId}.json`);
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { level: 0, promptsSinceWarning: 0 };

  const rising = level > state.level;
  const repeatUrge = level === 2 && state.promptsSinceWarning + 1 >= REPEAT_URGE_EVERY_PROMPTS;

  if (level === 0 || (!rising && !repeatUrge)) {
    writeFileSync(statePath, JSON.stringify({ level: Math.min(level, state.level), promptsSinceWarning: state.promptsSinceWarning + 1 }));
    return;
  }

  writeFileSync(statePath, JSON.stringify({ level, promptsSinceWarning: 0 }));

  const thousands = Math.round(tokens / 1000);
  const message =
    level === 2
      ? `This chat is very long (about ${thousands}k tokens of context). Open a new chat now — answers get slower, costlier and less precise from here.`
      : `This chat is getting long (about ${thousands}k tokens of context). Consider opening a new chat soon.`;

  process.stdout.write(
    JSON.stringify({
      systemMessage: message,
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: `The conversation is long: about ${thousands}k tokens of context. In your reply, tell the user in one short line that this chat is getting long and they should open a new chat, and offer to write a handoff message for the next agent. Then do what they asked.`,
      },
    }),
  );
}

let raw = "";
const guard = setTimeout(() => process.exit(0), 5000);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  clearTimeout(guard);
  try {
    main(raw);
  } catch {
    process.exit(0);
  }
});
