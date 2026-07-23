#!/usr/bin/env -S node --experimental-strip-types
import { ensureDir, getCurrentBranch, getDefaultBranch, git, inferNameWithOwner, inferRepoRoot, parseArgs, writeJson } from "./lib/common.ts";

function usage(): void {
  console.log(`Usage: inspect-git-history.ts [--out .resurrect/EVIDENCE.git.json]

Collects local git evidence without changing branches.`);
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

const root = inferRepoRoot(process.cwd());
const out = typeof flags.out === "string" ? flags.out : ".resurrect/EVIDENCE.git.json";
ensureDir(".resurrect");

const evidence = {
  generated_at: new Date().toISOString(),
  repository: {
    root,
    name_with_owner: inferNameWithOwner(root),
    default_branch: getDefaultBranch(root),
    current_branch: getCurrentBranch(root),
  },
  status: git(["status", "--short"], root).stdout.trim().split("\n").filter(Boolean),
  remotes: git(["remote", "-v"], root).stdout.trim().split("\n").filter(Boolean),
  branches: git(["branch", "--all", "--verbose", "--no-abbrev"], root).stdout.trim().split("\n").filter(Boolean),
  recent_commits: git([
    "log",
    "--all",
    "--max-count=120",
    "--date=short",
    "--pretty=format:%h%x09%ad%x09%D%x09%s",
  ], root).stdout.trim().split("\n").filter(Boolean),
  deleted_files: git([
    "log",
    "--all",
    "--diff-filter=D",
    "--summary",
    "--pretty=format:commit %h %ad %s",
    "--date=short",
    "--max-count=80",
  ], root).stdout.trim().split("\n").filter(Boolean),
  files_changed_by_branch: git([
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
    "refs/remotes",
  ], root).stdout.trim().split("\n").filter(Boolean).slice(0, 80).map((branch) => ({
    branch,
    recent_files: git(["log", branch, "--max-count=20", "--name-only", "--pretty=format:"], root).stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 80),
  })),
};

writeJson(out, evidence);
console.log(`Wrote ${out}`);
