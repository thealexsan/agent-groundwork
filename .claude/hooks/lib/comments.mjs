import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config.mjs";
import { git, repoRoot } from "./worktree.mjs";

const SLASH_COMMENT = /^\+\s*(\/\/|\/\*|\*[ /]|\{\/\*)/;
const HASH_COMMENT = /^\+\s*#(?!!)/;
const PHP_HASH_COMMENT = /^\+\s*#(?!\[)/;
const HASH_LANGUAGES = ["py", "rb", "sh", "yml", "yaml"];
const COMMENT_ALLOWED =
  /eslint-disable|@ts-expect-error|@ts-nocheck|prettier-ignore|\/\/go:|\/\/lint:ignore |# type: ignore|# noqa|# rubocop:|@phpstan-ignore|phpcs:(ignore|disable|enable)|# shellcheck (disable|source)=/;

const GENERATED = /^\/\/ Code generated .* DO NOT EDIT\.$/m;

function isComment(file, line) {
  const extension = file.split(".").pop();
  if (extension === "php") return SLASH_COMMENT.test(line) || PHP_HASH_COMMENT.test(line);
  return HASH_LANGUAGES.includes(extension) ? HASH_COMMENT.test(line) : SLASH_COMMENT.test(line);
}

function checked(config, file) {
  const { paths, extensions, ignore } = config.comments;
  if (!extensions.includes(file.split(".").pop())) return false;
  if (ignore.some((prefix) => file.startsWith(prefix))) return false;
  return paths.length === 0 || paths.some((prefix) => file.startsWith(prefix));
}

export function commentViolations(cwd, config = loadConfig(cwd)) {
  const diff = git(["diff", "--cached", "-U0"], cwd);
  if (!diff) return [];
  const violations = [];
  const generated = new Map();
  const isGenerated = (path) => {
    if (!generated.has(path)) generated.set(path, GENERATED.test(git(["show", `:${path}`], cwd)));
    return generated.get(path);
  };
  let file = "";
  for (const line of diff.split("\n")) {
    const header = line.match(/^\+\+\+ b\/(.+)$/);
    if (header) {
      file = header[1];
      continue;
    }
    if (!file || line.startsWith("+++")) continue;
    if (!line.startsWith("+") || !checked(config, file)) continue;
    if (!isComment(file, line) || COMMENT_ALLOWED.test(line) || isGenerated(file)) continue;
    violations.push(`${file}: ${line.slice(1).trim()}`);
  }
  return violations;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = repoRoot(process.cwd());
  for (const violation of commentViolations(root)) console.log(`    ${violation}`);
}
