#!/usr/bin/env -S node --experimental-strip-types
import { commandExists, ensureDir, inferNameWithOwner, parseArgs, run, writeJson } from "./lib/common.ts";

function usage(): void {
  console.log(`Usage: collect-github-evidence.ts [owner/repo] [--out .resurrect/EVIDENCE.github.json]

Collects GitHub metadata, branches, issues, pull requests, and releases through gh.`);
}

function ghJson(args: string[], timeoutMs = 60_000): unknown {
  const result = run("gh", args, { timeoutMs });
  if (result.status !== 0) {
    return { unavailable: true, command: ["gh", ...args].join(" "), error: result.stderr || result.stdout };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { unavailable: true, command: ["gh", ...args].join(" "), raw: result.stdout };
  }
}

const { positionals, flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

if (!commandExists("gh")) {
  throw new Error("gh CLI is required for GitHub evidence collection.");
}

const target = positionals[0] ?? inferNameWithOwner(process.cwd());
if (!target) throw new Error("Provide owner/repo or run inside a GitHub-backed repository.");

const out = typeof flags.out === "string" ? flags.out : ".resurrect/EVIDENCE.github.json";
ensureDir(".resurrect");

const repoFields = [
  "name",
  "nameWithOwner",
  "description",
  "homepageUrl",
  "isArchived",
  "isPrivate",
  "defaultBranchRef",
  "primaryLanguage",
  "repositoryTopics",
  "createdAt",
  "pushedAt",
  "updatedAt",
  "licenseInfo",
  "diskUsage",
];

const evidence = {
  generated_at: new Date().toISOString(),
  target,
  repository: ghJson(["repo", "view", target, "--json", repoFields.join(",")]),
  branches: ghJson(["api", `repos/${target}/branches`, "--paginate", "--slurp"]),
  issues: ghJson([
    "issue",
    "list",
    "--repo",
    target,
    "--state",
    "all",
    "--limit",
    "100",
    "--json",
    "number,title,state,author,createdAt,closedAt,updatedAt,labels",
  ]),
  pull_requests: ghJson([
    "pr",
    "list",
    "--repo",
    target,
    "--state",
    "all",
    "--limit",
    "100",
    "--json",
    "number,title,state,author,createdAt,closedAt,updatedAt,baseRefName,headRefName,isDraft,mergeCommit",
  ]),
  releases: ghJson(["release", "list", "--repo", target, "--limit", "50", "--json", "name,tagName,isDraft,isPrerelease,createdAt,publishedAt"]),
};

writeJson(out, evidence);
console.log(`Wrote ${out}`);
