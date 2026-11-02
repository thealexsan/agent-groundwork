#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const RULE =
  "Short-answers rule (skill short-answers): reply as short as possible. Yes/no question: one word. " +
  "Status question: one line. Done task: max 3 lines (changed, verified, left). No preamble, recap, " +
  "tables or closing offers. Detail only when asked. Code, commits, PRs and docs stay complete.\n";

let catchUp = "";
try {
  const standing = await import(pathToFileURL(join(homedir(), ".groundwork", "global", "hooks", "standing-skills.mjs")).href);
  const payload = await standing.hookInput();
  if (payload.hook_event_name === "UserPromptSubmit") catchUp = standing.catchUp(standing.context(payload));
} catch {
  catchUp = "";
}

process.stdout.write(catchUp ? `${RULE}\n${catchUp}\n` : RULE);
