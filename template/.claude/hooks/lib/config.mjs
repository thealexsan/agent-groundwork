import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULTS = {
  project: "this project",
  mainBranch: "main",
  overridePrefix: "AGENT",
  mainDeploys: false,
  comments: {
    paths: [],
    extensions: ["ts", "tsx", "js", "jsx", "mjs", "cjs", "go", "py", "rb", "sh"],
    ignore: [],
  },
  worktree: {
    copy: ["node_modules"],
    share: [".agent"],
  },
};

export function loadConfig(root) {
  let saved = {};
  try {
    saved = JSON.parse(readFileSync(join(root, ".claude", "agent.json"), "utf8"));
  } catch {
    saved = {};
  }

  return {
    ...DEFAULTS,
    ...saved,
    comments: { ...DEFAULTS.comments, ...(saved.comments || {}) },
    worktree: { ...DEFAULTS.worktree, ...(saved.worktree || {}) },
  };
}

export function override(config, name) {
  return `${config.overridePrefix}_ALLOW_${name}`;
}

export function standingRules(root) {
  try {
    return readFileSync(join(root, ".claude", "standing-rules.md"), "utf8").trim();
  } catch {
    return "";
  }
}
