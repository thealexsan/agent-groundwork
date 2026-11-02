#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(here, "template");
const OPS_CI = join(here, "ops", "ci");
const OPS_DEPLOY = join(here, "ops", "deploy");
const PLANS = join(here, "plans", "all");
const PLANS_DEPLOY = join(here, "plans", "deploy");
const RULES = join(here, "rules");
const PEOPLE = join(here, "people");
const VERSION = JSON.parse(readFileSync(join(here, "package.json"), "utf8")).version;
const WHO_IS_ASKING = ".claude/skills/who-is-asking/SKILL.md";
const EXECUTABLE = [".githooks/", ".claude/hooks/", "scripts/", ".github/scripts/"];
const SCRATCH = ".agent/";
const LIBRARY_ONLY = ".claude/skills/release";
const MERGED_BY_HAND = ["CLAUDE.md", "AGENTS.md", ".claude/settings.json", ".claude/standing-rules.md", ".agents/rules/00-standing-rules.md", WHO_IS_ASKING];
const RECORDED = ["description", "checks", "scopes"];
const MACHINERY = [".claude/hooks/", ".githooks/", ".claude/skills/", "scripts/new-worktree.mjs"];
const VENDORED_NAMES = ["vendor", "third_party", "third-party"];
const LICENCES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"];
const SKILL_FOLDERS = [".agents/skills", ".claude/skills"];
const INDEXED = {
  ".claude/rules/go.md": { what: "how Go is written here: layout, SQL, identity, errors, jobs, the gates", when: "before writing Go or SQL" },
  ".claude/rules/ui.md": { what: "what every screen must do: one primary action, every state, phones first, words", when: "before building or changing a screen" },
  ".claude/rules/nextjs.md": { what: "the Next.js App Router as installed: its docs first, the server and client line, data, access, every route's states", when: "before writing a page, layout, server action or route handler" },
  ".claude/rules/page-weight.md": { what: "the JavaScript budget of each page and what keeps it light", when: "before adding a dependency or client code to a page" },
  "DEPLOY.md": { what: "what runs in production, where, and how to get it back", when: "before anything that touches a server" },
  "SECURITY_PLAN.md": { what: "what is scanned, by which tool and how often, and where a finding goes", when: "before adding a scanner or closing a finding" },
  "SCALING.md": { what: "what the system is today, and the measured trigger each scaling step waits for", when: "before proposing infrastructure — nothing in its §4 is built before its trigger" },
  "deploy/README.md": { what: "the deploy pipeline: its Actions settings, the box, nginx, and what to do after a failed deploy", when: "before changing the deploy workflow or the box" },
  "SEO_PLAN.md": { what: "the public site's discoverability plan and the questions it needs answered first", when: "before changing a public page's metadata or content" },
};

const USAGE = `groundwork — install the agent working method into a project

  node install.mjs <project-directory> [options]

  --name <text>          project name                       (default: the directory's name)
  --description <text>   one sentence saying what it is
  --main <branch>        the protected branch               (default: main)
  --prefix <WORD>        prefix of the override variables   (default: the name, upper-cased)
  --checks <command>     the gate run before every commit   (default: a reminder to set one)
  --scopes <a,b,c>       commit scopes                      (default: repo)
  --extensions <a,b,c>   code extensions checked for comments (default: ts,tsx,js,jsx,mjs,cjs,go,py)
  --domain <host>        the production address             (default: example.com)
  --deploys              a merge to the main branch deploys to production
  --ops                  adds CI and security workflows; with --deploys also the deploy
                         workflow, release scripts, pm2 and nginx files
  --plans                adds SECURITY_PLAN.md, SCALING.md, SEO_PLAN.md; with --deploys
                         also DEPLOY.md
  --rules <list>         extra path rules, comma-separated: go, nextjs, ui, page-weight
  --business <name>      a person who is not a programmer shares the assistant: adds the
                         who-is-asking skill, which answers them in screens, people and rules
  --engineer <name>      with --business, the engineer's name   (default: the engineer)
  --library              the project is a library: adds the release skill
  --force                overwrite files that already exist
  --update               refresh the hooks, git hooks, skills and worktree script of a project
                         installed before, with the settings in its .claude/agent.json
`;

function options(argv) {
  const parsed = { flags: new Set(), values: {}, positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      parsed.positional.push(argument);
    } else if (["--deploys", "--library", "--ops", "--plans", "--force", "--update", "--help"].includes(argument)) {
      parsed.flags.add(argument.slice(2));
    } else {
      parsed.values[argument.slice(2)] = argv[index + 1] ?? "";
      index += 1;
    }
  }
  return parsed;
}

function files(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

function list(text) {
  return text.split(",").map((part) => part.trim()).filter(Boolean);
}

export function vendored(target, extensions) {
  let tracked;
  try {
    tracked = execFileSync("git", ["ls-files"], { cwd: target, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 });
  } catch {
    return [];
  }
  const paths = tracked.split("\n").filter(Boolean);
  const roots = new Set();
  for (const path of paths) {
    const folders = path.split("/").slice(0, -1);
    if (folders.length > 0 && LICENCES.includes(basename(path))) roots.add(folders.join("/"));
    const named = folders.findIndex((folder) => VENDORED_NAMES.includes(folder));
    if (named >= 0) roots.add(folders.slice(0, named + 1).join("/"));
    const skills = SKILL_FOLDERS.find((folder) => path.startsWith(`${folder}/`));
    if (skills) roots.add(skills);
  }
  const code = paths.filter((path) => extensions.includes(path.split(".").pop()));
  return [...roots]
    .filter((root) => ![...roots].some((other) => root.startsWith(`${other}/`)))
    .filter((root) => code.some((path) => path.startsWith(`${root}/`)))
    .map((root) => `${root}/`)
    .sort();
}

function installedSettings(target) {
  let saved;
  try {
    saved = JSON.parse(readFileSync(join(target, ".claude", "agent.json"), "utf8"));
  } catch {
    throw new Error(`No readable .claude/agent.json in ${target}: install first, without --update`);
  }
  const settings = { name: saved.project, main: saved.mainBranch, prefix: saved.overridePrefix };
  if (Array.isArray(saved.comments?.extensions)) settings.extensions = saved.comments.extensions.join(",");
  if (typeof saved.description === "string") settings.description = saved.description;
  if (typeof saved.checks === "string") settings.checks = saved.checks;
  if (Array.isArray(saved.scopes)) settings.scopes = saved.scopes.join(",");
  if (typeof saved.people?.business === "string") settings.business = saved.people.business;
  if (typeof saved.people?.engineer === "string") settings.engineer = saved.people.engineer;
  return { saved, settings: Object.fromEntries(Object.entries(settings).filter(([, value]) => value)), deploys: saved.mainDeploys === true };
}

function ownedPaths(target) {
  try {
    const owned = JSON.parse(readFileSync(join(target, ".claude", "agent.json"), "utf8")).owned;
    return Array.isArray(owned) ? owned : [];
  } catch {
    return [];
  }
}

function fingerprint(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function newlyRecorded(saved, given) {
  const recorded = { description: given.description, checks: given.checks, scopes: given.scopes && list(given.scopes) };
  const added = Object.fromEntries(RECORDED.filter((setting) => saved[setting] == null && recorded[setting]).map((setting) => [setting, recorded[setting]]));
  if (saved.people == null && given.business) added.people = { business: given.business.trim(), engineer: given.engineer?.trim() || null };
  return added;
}

function removeDropped(target, previous, current) {
  const removed = [];
  const changedHere = [];
  for (const [path, print] of Object.entries(previous)) {
    const destination = join(target, path);
    if (current.includes(path) || !existsSync(destination)) continue;
    if (fingerprint(readFileSync(destination, "utf8")) === print) {
      rmSync(destination);
      removed.push(path);
    } else {
      changedHere.push(path);
    }
  }
  return { removed, changedHere };
}

function people(given) {
  const business = given.business?.trim();
  const engineer = given.engineer?.trim();
  if (!business) {
    if (engineer) throw new Error("--engineer names the engineer beside --business; give --business too");
    return { PEOPLE_JSON: "null", WHO_IS_ASKING_STANDING: "", WHO_IS_ASKING_SECTION: "", WHO_IS_ASKING_RULE: "", WHO_IS_ASKING_BULLET: "", ENGINEER_MARKERS: "" };
  }
  const engineerName = engineer || "the engineer";
  return {
    BUSINESS: business,
    ENGINEER: engineerName,
    PEOPLE_JSON: JSON.stringify({ business, engineer: engineer || null }),
    ENGINEER_MARKERS: engineer ? `| "I am ${engineer}" · "This is ${engineer}" | **Engineer mode** |` : "",
    WHO_IS_ASKING_STANDING: [
      "**Who is asking — `who-is-asking`.** The first line of the message decides the whole reply.",
      `"I am ${business}", "This is ${business}", or a message opening with "business logic" or "flow"`,
      "→ business mode: screens, people and rules only. No repository, endpoint, API, migration, commit,",
      "branch, component, test, file path or code block; the engineering consequences go to `.agent/`,",
      `not the reply. ${engineer ? `"This is ${engineer}" or no marker` : "No marker"} → engineer mode.`,
      "",
    ].join("\n"),
    WHO_IS_ASKING_SECTION: [
      "## Knowing who is asking is mandatory",
      "",
      "**Load the `who-is-asking` skill at the start of every session, before replying to anything.**",
      "",
      `Two people share this assistant: ${engineerName}, who builds the product, and ${business}, who`,
      "runs the business and is not a programmer. The first line of the message says which one is",
      `speaking. "I am ${business}" or an opening "business logic" or "flow" is business mode: screens,`,
      "people and rules, with the engineering written to `.agent/` instead of the reply. Anything else is",
      "engineer mode. `ask-first` governs in both.",
      "",
    ].join("\n"),
    WHO_IS_ASKING_RULE: [
      "",
      `5. **Know who is asking** — \`.claude/skills/who-is-asking/SKILL.md\`. ${business} is not a`,
      `   programmer: a message from ${business}, or one opening with "business logic" or "flow", gets`,
      "   screens, people and rules, never code or engineering words.",
    ].join("\n"),
    WHO_IS_ASKING_BULLET: `- Know who is asking: ${business} gets screens, people and rules, never code.`,
  };
}

export function install(target, given = {}, flags = new Set()) {
  const update = flags.has("update");
  const installed = update ? installedSettings(target) : { settings: {}, deploys: false };
  given = { ...installed.settings, ...given };
  const deploys = flags.has("deploys") || installed.deploys;
  const library = flags.has("library") || (update && existsSync(join(target, LIBRARY_ONLY)));
  const name = given.name || basename(target);
  const extensions = list(given.extensions || "ts,tsx,js,jsx,mjs,cjs,go,py");
  const vendoredFolders = vendored(target, extensions);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const values = {
    PROJECT: name,
    SLUG: slug,
    SNAKE: slug.replace(/-/g, "_"),
    DOMAIN: given.domain || "example.com",
    DESCRIPTION: given.description || `${name}. Replace this sentence with what the project is and who it is for.`,
    MAIN: given.main || "main",
    PREFIX: (given.prefix || name).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
    DESCRIPTION_JSON: JSON.stringify(given.description || null),
    CHECKS_JSON: JSON.stringify(given.checks || null),
    SCOPES_JSON: JSON.stringify(given.scopes ? list(given.scopes) : null),
    CHECKS: given.checks || "echo 'set the gate for this project in CLAUDE.md, AGENTS.md and .claude/standing-rules.md' && exit 1",
    SCOPES: list(given.scopes || "repo").map((scope) => `\`${scope}\``).join(" · "),
    EXTENSIONS_JSON: JSON.stringify(extensions),
    IGNORE_JSON: JSON.stringify(vendoredFolders),
    DEPLOYS: deploys ? "true" : "false",
    ...people(given),
  };

  const written = [];
  const kept = [];
  const beside = [];
  const unchanged = [];
  const skipped = [];
  const skippedOwned = [];

  const fill = (text) =>
    text
      .replace(/^[ \t]*\{\{([A-Z_]+)\}\}\n/gm, (whole, key) => (values[key] === "" ? "" : whole))
      .replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => values[key] ?? whole);
  const roots = [TEMPLATE];
  if (flags.has("ops")) roots.push(OPS_CI);
  if (flags.has("ops") && deploys) roots.push(OPS_DEPLOY);
  if (flags.has("plans")) roots.push(PLANS);
  if (flags.has("plans") && deploys) roots.push(PLANS_DEPLOY);
  if (given.business) roots.push(PEOPLE);
  const rules = list(given.rules || "");
  const available = readdirSync(RULES).filter((entry) => !entry.startsWith("."));
  const unknown = rules.filter((rule) => !available.includes(rule));
  if (unknown.length > 0) throw new Error(`Unknown --rules ${unknown.join(", ")}; there are ${available.join(", ")}`);
  roots.push(...rules.map((rule) => join(RULES, rule)));

  const entries = roots
    .flatMap((root) => files(root).map((source) => ({ source, path: fill(relative(root, source).split(sep).join("/")) })))
    .filter(({ path }) => library || !path.startsWith(LIBRARY_ONLY));

  const indexed = Object.keys(INDEXED)
    .filter((path) => entries.some((entry) => entry.path === path) || existsSync(join(target, path)))
    .sort();
  values.WHERE_INDEX = indexed.map((path) => `- \`${path}\` — ${INDEXED[path].what}.`).join("\n");
  values.READ_INDEX = indexed.map((path) => `| \`${path}\` | ${INDEXED[path].when} |`).join("\n");

  const owned = ownedPaths(target);
  const ownedHere = (path) => owned.some((entry) => path === entry || (entry.endsWith("/") && path.startsWith(entry)));
  const mergedByHand = (path) => MERGED_BY_HAND.includes(path) || ownedHere(path);
  const offeredBefore = installed.saved?.offered ?? {};
  const offered = {};

  for (const { source, path } of entries) {
    const destination = join(target, path);
    const template = readFileSync(source, "utf8");
    const content = fill(template);
    const current = existsSync(destination) ? readFileSync(destination, "utf8") : null;
    if (current === null && ownedHere(path)) {
      skippedOwned.push(path);
      continue;
    }
    if (current === content) {
      unchanged.push(path);
      continue;
    }
    const refreshed = update && MACHINERY.some((prefix) => path.startsWith(prefix)) && !mergedByHand(path);
    const missing = RECORDED.filter((setting) => template.includes(`{{${setting.toUpperCase()}}}`) && !given[setting]);
    if (update && current !== null && missing.length > 0 && (refreshed || mergedByHand(path))) {
      skipped.push({ path, missing });
      continue;
    }
    if (current !== null && !flags.has("force") && !refreshed) {
      kept.push(path);
      if (mergedByHand(path)) offered[path] = fingerprint(content);
      if (mergedByHand(path) && offeredBefore[path] !== offered[path]) {
        const merge = path.replace(/(\.[a-z]+)$/, ".groundwork$1");
        writeFileSync(join(target, merge), content);
        beside.push({ path, merge });
      }
      continue;
    }

    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
    if (EXECUTABLE.some((prefix) => path.startsWith(prefix))) chmodSync(destination, 0o755);
    written.push(path);
  }

  const machinery = entries.map(({ path }) => path).filter((path) => MACHINERY.some((prefix) => path.startsWith(prefix)) && !ownedHere(path));
  const manifest = Object.fromEntries(
    machinery.filter((path) => existsSync(join(target, path))).map((path) => [path, fingerprint(readFileSync(join(target, path), "utf8"))]),
  );
  const dropped = update ? removeDropped(target, Object.fromEntries(Object.entries(installed.saved.installed ?? {}).filter(([path]) => !ownedHere(path))), machinery) : { removed: [], changedHere: [] };
  const added = update ? newlyRecorded(installed.saved, given) : {};
  const recorded = Object.keys(added);
  if (update || written.includes(".claude/agent.json")) {
    const config = join(target, ".claude", "agent.json");
    const saved = JSON.parse(readFileSync(config, "utf8"));
    writeFileSync(config, `${JSON.stringify({ ...saved, ...added, groundwork: VERSION, installed: manifest, offered }, null, 2)}\n`);
  }

  const ignore = join(target, ".gitignore");
  const ignored = existsSync(ignore) ? readFileSync(ignore, "utf8") : "";
  if (!ignored.split("\n").includes(SCRATCH)) {
    writeFileSync(ignore, `${ignored}${ignored === "" || ignored.endsWith("\n") ? "" : "\n"}${SCRATCH}\n`);
  }

  let hooked = false;
  if (existsSync(join(target, ".git"))) {
    try {
      execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: target, stdio: "ignore" });
      hooked = true;
    } catch {
      hooked = false;
    }
  }

  return { written, kept, beside, unchanged, skipped, skippedOwned, recorded, ...dropped, hooked, values, vendored: vendoredFolders };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { flags, values, positional } = options(process.argv.slice(2));
  if (flags.has("help") || positional.length !== 1) {
    process.stdout.write(USAGE);
    process.exit(flags.has("help") ? 0 : 1);
  }

  const target = resolve(positional[0]);
  if (!existsSync(target)) {
    console.error(`No such directory: ${target}`);
    process.exit(1);
  }

  let result;
  try {
    result = install(target, values, flags);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(`${result.written.length} files written into ${target}`);
  if (flags.has("update")) for (const path of result.written) console.log(`  ${path}`);
  if (result.removed.length > 0) {
    console.log("Removed, as this version no longer ships them:");
    for (const path of result.removed) console.log(`  ${path}`);
  }
  if (result.changedHere.length > 0) {
    console.log("No longer shipped but changed in this project, so left in place — delete them if nothing uses them:");
    for (const path of result.changedHere) console.log(`  ${path}`);
  }
  if (result.recorded.length > 0) console.log(`Recorded in .claude/agent.json for the next update: ${result.recorded.join(", ")}`);
  if (result.skipped.length > 0) {
    console.log("Not refreshed, as they need settings .claude/agent.json does not hold yet — pass them once:");
    for (const { path, missing } of result.skipped) console.log(`  ${path} (${missing.map((setting) => `--${setting}`).join(", ")})`);
  }
  if (result.skippedOwned.length > 0) {
    console.log("Not written, as .claude/agent.json lists them under owned:");
    for (const path of result.skippedOwned) console.log(`  ${path}`);
  }
  if (result.kept.length > 0) {
    console.log(`${result.kept.length} already existed and were kept (use --force to replace):`);
    for (const path of result.kept) console.log(`  ${path}`);
  }
  if (result.vendored.length > 0 && result.written.includes(".claude/agent.json")) {
    console.log("Not checked for comments, as they look like code this project did not write (comments.ignore in .claude/agent.json):");
    for (const path of result.vendored) console.log(`  ${path}`);
  }
  if (result.beside.length > 0) {
    console.log("The template's rules are beside the kept files. Merge each in, then delete it:");
    for (const { path, merge } of result.beside) console.log(`  ${merge} → ${path}`);
  }
  console.log(result.hooked ? "git hooks are on (core.hooksPath = .githooks)" : "not a git repository yet: run `git config core.hooksPath .githooks` after `git init`");
  console.log(`override variables start with ${result.values.PREFIX}_ALLOW_`);
}
