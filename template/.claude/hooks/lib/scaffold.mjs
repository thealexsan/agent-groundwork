import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, realpathSync, statSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config.mjs";

export function linkType(source) {
  if (process.platform !== "win32") return undefined;
  return statSync(source).isDirectory() ? "junction" : "file";
}

export function scaffold(primary, target) {
  const done = [];
  const { worktree } = loadConfig(primary);

  for (const path of worktree.share) {
    if (!existsSync(join(primary, path)) || existsSync(join(target, path))) continue;
    mkdirSync(dirname(join(target, path)), { recursive: true });
    symlinkSync(join(primary, path), join(target, path), linkType(join(primary, path)));
    done.push(`${path} symlinked to the primary checkout`);
  }

  for (const path of worktree.copy) {
    const from = join(primary, path);
    const to = join(target, path);
    if (!existsSync(from) || existsSync(to)) continue;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    done.push(`${path} copied`);
  }

  try {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: target, stdio: "ignore" });
    done.push("core.hooksPath set");
  } catch {
    done.push("core.hooksPath could not be set");
  }

  return done;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [primary, target] = process.argv.slice(2);
  if (!primary || !target) {
    console.error("usage: scaffold.mjs <primary-checkout> <worktree>");
    process.exit(1);
  }
  for (const line of scaffold(primary, target)) console.log(`  ${line}`);
}
