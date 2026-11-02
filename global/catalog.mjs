#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GLOBAL = dirname(fileURLToPath(import.meta.url));
export const TOPIC = "our-part";
export const SKILL = join(GLOBAL, "skills", "our-stack", "SKILL.md");
export const PARTS_START = "<!-- groundwork:parts:start -->";
const PARTS_END = "<!-- groundwork:parts:end -->";
const KINDS = { Go: "Go", TypeScript: "JS", JavaScript: "JS" };
const KIND_ORDER = ["Go", "JS"];
const FETCH_TIMEOUT_MS = 8000;

const QUERY = `query($owner: String!) {
  repositoryOwner(login: $owner) {
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: { field: NAME, direction: ASC }) {
      nodes {
        name
        description
        isArchived
        primaryLanguage { name }
        latestRelease { tagName }
        refs(refPrefix: "refs/tags/", first: 1, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) { nodes { name } }
        repositoryTopics(first: 20) { nodes { topic { name } } }
      }
    }
  }
}`;

export function owner() {
  return process.env.GROUNDWORK_OWNER || runGh(["api", "user", "--jq", ".login"]).trim();
}

function runGh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: FETCH_TIMEOUT_MS });
}

export function partsFrom(response) {
  return response.data.repositoryOwner.repositories.nodes
    .filter((repository) => !repository.isArchived && repository.repositoryTopics.nodes.some((node) => node.topic.name === TOPIC))
    .map((repository) => ({
      name: repository.name,
      description: repository.description?.trim() || "",
      kind: KINDS[repository.primaryLanguage?.name] ?? repository.primaryLanguage?.name ?? "",
      version: repository.latestRelease?.tagName ?? repository.refs.nodes[0]?.name ?? "",
    }));
}

export function fetchParts(run = runGh) {
  return partsFrom(JSON.parse(run(["api", "graphql", "-f", `query=${QUERY}`, "-f", `owner=${owner()}`])));
}

function rank(kind) {
  const index = KIND_ORDER.indexOf(kind);
  return index === -1 ? KIND_ORDER.length : index;
}

export function catalogTable(parts) {
  const rows = [...parts]
    .sort((a, b) => rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name))
    .map((part) => `| \`${part.name}\` | ${part.description || "no description yet; read its README"} | ${part.kind || "?"} | ${part.version ? `\`${part.version}\`` : "no release"} |`);
  return ["| Part | What it does | Kind | Latest |", "|---|---|---|---|", ...rows].join("\n");
}

export function withCatalog(text, table) {
  const start = text.indexOf(PARTS_START);
  const end = text.indexOf(PARTS_END);
  if (start < 0 || end < start) throw new Error(`the skill has no ${PARTS_START} … ${PARTS_END} block to fill`);
  return `${text.slice(0, start)}${PARTS_START}\n${table}\n${PARTS_END}${text.slice(end + PARTS_END.length)}`;
}

export function readCache(file) {
  try {
    const cache = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(cache.parts) && cache.parts.length > 0 ? cache : null;
  } catch {
    return null;
  }
}

export function refreshCache(file, run = runGh) {
  const parts = fetchParts(run);
  if (parts.length === 0) throw new Error(`no repository of ${owner()} has the ${TOPIC} topic`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ fetchedAt: new Date().toISOString(), parts }, null, 2)}\n`);
  return parts;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cache = process.argv.indexOf("--cache");
  if (cache > 0) {
    refreshCache(process.argv[cache + 1]);
  } else {
    const parts = fetchParts();
    writeFileSync(SKILL, withCatalog(readFileSync(SKILL, "utf8"), catalogTable(parts)));
    console.log(`${parts.length} parts written to ${SKILL}`);
  }
}
