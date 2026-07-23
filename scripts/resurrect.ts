#!/usr/bin/env -S node --experimental-strip-types
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import {
  commandExists,
  getCurrentBranch,
  getDefaultBranch,
  git,
  inferNameWithOwner,
  inferRepoRoot,
  packageManager,
  parseArgs,
  pathExists,
  readJson,
  run,
  summarizeText,
  today,
} from "./lib/common.ts";
import { createDemoRepository } from "./lib/fixture.ts";

process.on("uncaughtException", (error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(1);
});

type Target = {
  kind: "local" | "github" | "unknown";
  input: string;
  root?: string;
  nameWithOwner?: string;
};

function usage(): void {
  console.log(`Usage:
  resurrect scan [--owner USER] [--limit 100]
  resurrect demo [--keep]
  resurrect [project-name|path|owner/repo] [--confirmed]
  resurrect analyze [project-name|path|owner/repo] [--confirmed]
  resurrect execute [--approved] [--branch resurrect/YYYY-MM-DD-name] [--allow-dirty]
  resurrect pr-summary

Default project mode is intake-first. It asks clarifying questions before deep analysis.`);
}

function isGitRepo(path: string): boolean {
  return git(["rev-parse", "--show-toplevel"], path, 10_000).status === 0;
}

function repoRoot(path: string): string | undefined {
  const result = git(["rev-parse", "--show-toplevel"], path, 10_000);
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function resolveTarget(input: string | undefined): Target {
  if (!input || input === ".") {
    const root = repoRoot(process.cwd());
    return root ? { kind: "local", input: input ?? ".", root, nameWithOwner: inferNameWithOwner(root) ?? undefined } : { kind: "unknown", input: input ?? "." };
  }

  if (/^[^/\s]+\/[^/\s]+$/.test(input) && !existsSync(input)) {
    return { kind: "github", input, nameWithOwner: input };
  }

  const candidates = [
    isAbsolute(input) ? input : resolve(process.cwd(), input),
    resolve(process.cwd(), "..", input),
    resolve(process.cwd(), "projects", input),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && isGitRepo(candidate)) {
      const root = repoRoot(candidate);
      return { kind: "local", input, root, nameWithOwner: root ? inferNameWithOwner(root) ?? undefined : undefined };
    }
  }

  return { kind: "unknown", input };
}

function readFirstExisting(root: string, names: string[]): string | undefined {
  for (const name of names) {
    const path = join(root, name);
    if (pathExists(path)) return readFileSync(path, "utf8");
  }
  return undefined;
}

function readPackageHint(root: string): string {
  const packageJsonPath = join(root, "package.json");
  if (!pathExists(packageJsonPath)) return "No package.json detected";
  const packageJson = readJson(packageJsonPath) as any;
  const scripts = Object.keys(packageJson.scripts ?? {});
  return `${packageJson.name ?? basename(root)}; manager ${packageManager(root)}; scripts ${scripts.length ? scripts.join(", ") : "none"}`;
}

function printIntake(target: Target): void {
  console.log("Resurrection intake\n");

  if (target.kind === "local" && target.root) {
    const readme = readFirstExisting(target.root, ["README.md", "readme.md", "README.mdx"]);
    const title = readme?.split("\n").find((line) => line.trim()) ?? "No README title detected";
    console.log(`Target: ${target.root}`);
    console.log(`GitHub: ${target.nameWithOwner ?? "unknown"}`);
    console.log(`Current branch: ${getCurrentBranch(target.root)}`);
    console.log(`Default branch: ${getDefaultBranch(target.root)}`);
    console.log(`Remote: ${git(["config", "--get", "remote.origin.url"], target.root, 10_000).stdout.trim() || "none"}`);
    console.log(`README: ${summarizeText(title, 120)}`);
    console.log(`Package: ${readPackageHint(target.root)}`);
  } else if (target.kind === "github") {
    console.log(`Target: ${target.nameWithOwner}`);
    if (commandExists("gh")) {
      const result = run("gh", ["repo", "view", target.nameWithOwner!, "--json", "description,pushedAt,primaryLanguage", "--jq", "{description,pushedAt,language:.primaryLanguage.name}"], { timeoutMs: 20_000 });
      if (result.status === 0) console.log(`GitHub hint: ${summarizeText(result.stdout, 240)}`);
      else console.log("GitHub hint: unavailable; run `gh auth status` if this should be accessible.");
    }
  } else {
    console.log(`Target: ${target.input}`);
    console.log("Status: Could not resolve a local git repository or owner/repo target.");
  }

  console.log(`
Answer these before deep analysis:

1. What outcome do you want: ship the original idea, salvage one asset, modernize the stack, or decide whether to archive?
2. What do you remember as the reason you stopped, if anything?
3. What time budget should constrain Milestone Zero?

After answering, run again with --confirmed or tell the agent to proceed with those answers.`);
}

function runDeepLocal(target: Target): void {
  if (target.kind !== "local" || !target.root) {
    throw new Error("--confirmed currently requires a local git repository target.");
  }

  const scriptRoot = resolve(import.meta.dirname, "..");
  const scripts = [
    "inspect-git-history.ts",
    "detect-unfinished-work.ts",
    "run-build-probe.ts",
    "write-artifacts.ts",
    "infer-intent.ts",
    "classify-autopsy.ts",
    "build-citations.ts",
    "generate-public-assets.ts",
  ];

  for (const script of scripts) {
    const result = run("node", ["--experimental-strip-types", join(scriptRoot, "scripts", script)], { cwd: target.root, timeoutMs: 180_000 });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    if (result.status !== 0) {
      throw new Error(`${script} failed`);
    }
  }
}

function contractText(root: string): string {
  const contractPath = join(root, ".resurrect", "RESURRECTION_CONTRACT.md");
  if (!pathExists(contractPath)) {
    throw new Error("No .resurrect/RESURRECTION_CONTRACT.md found. Run intake and analysis first.");
  }
  return readFileSync(contractPath, "utf8");
}

function ensureExecuteApproved(root: string, flags: Record<string, string | boolean>): void {
  if (flags.approved) return;
  const contract = contractText(root);
  if (!/approved:\s*true/i.test(contract)) {
    throw new Error("Execution is blocked until owner_approval.approved is true or --approved is passed.");
  }
}

function branchFromContract(root: string): string {
  const contract = contractText(root);
  const match = contract.match(/branch:\s*["']?([^"'\n]+)["']?/i);
  const raw = match?.[1]?.trim();
  if (raw && raw !== "TBD" && !raw.endsWith("-direction")) return raw;
  return `resurrect/${today()}-milestone-zero`;
}

function branchExists(root: string, branch: string): boolean {
  return git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], root, 10_000).status === 0;
}

function hasOnlyResurrectChanges(status: string): boolean {
  if (!status.trim()) return true;
  return status
    .split("\n")
    .map((line) => line.slice(3).trim())
    .every((path) => path === ".resurrect" || path.startsWith(".resurrect/") || path === "RESURRECTION.md");
}

function runExecute(flags: Record<string, string | boolean>): void {
  const root = inferRepoRoot(process.cwd());
  ensureExecuteApproved(root, flags);

  const currentBranch = getCurrentBranch(root);
  const defaultBranch = getDefaultBranch(root);
  const status = git(["status", "--short"], root, 10_000).stdout.trim();
  const branch = typeof flags.branch === "string" ? flags.branch : branchFromContract(root);

  if (branchExists(root, branch)) {
    throw new Error(`Branch already exists: ${branch}`);
  }
  if (status && !flags["allow-dirty"] && !hasOnlyResurrectChanges(status)) {
    throw new Error("Working tree has non-.resurrect uncommitted changes. Review them, commit/stash them, or pass --allow-dirty to carry them onto the resurrection branch.");
  }
  if (currentBranch === "detached") {
    throw new Error("Cannot execute from a detached HEAD.");
  }
  if (defaultBranch === "unknown") {
    throw new Error("Could not determine default branch; refusing to create a resurrection branch blindly.");
  }

  const create = git(["switch", "-c", branch], root, 20_000);
  if (create.status !== 0) throw new Error(create.stderr || create.stdout);

  const probe = run("node", ["--experimental-strip-types", join(import.meta.dirname, "run-build-probe.ts")], { cwd: root, timeoutMs: 180_000 });
  process.stdout.write(probe.stdout);
  process.stderr.write(probe.stderr);

  for (const script of ["classify-autopsy.ts", "build-citations.ts"]) {
    const result = run("node", ["--experimental-strip-types", join(import.meta.dirname, script)], { cwd: root, timeoutMs: 60_000 });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    if (result.status !== 0) throw new Error(`${script} failed during execute`);
  }

  const sessionPath = join(root, ".resurrect", "EXECUTION_SESSION.md");
  writeFileSync(sessionPath, `# Execution Session

## Branch

${branch}

## Started From

- previous_branch: ${currentBranch}
- default_branch: ${defaultBranch}
- started_at: ${new Date().toISOString()}

## Approval

Execution approval was provided by ${flags.approved ? "--approved flag" : "owner_approval marker"}.

## Commands Run

- git switch -c ${branch}
- node --experimental-strip-types scripts/run-build-probe.ts

## Milestone Zero Task Loop

1. Complete .resurrect/tasks/001-restore-environment.md.
2. Complete .resurrect/tasks/002-remove-dead-scope.md only for contract-rejected scope.
3. Complete .resurrect/tasks/003-build-vertical-slice.md.
4. Complete .resurrect/tasks/004-verify-and-deploy.md.

## Current Status

${probe.status === 0 ? "Build probe refreshed successfully." : "Build probe failed; inspect .resurrect/build-probe.json."}
`, "utf8");

  const diff = git(["status", "--short"], root, 10_000).stdout.trim();
  writeFileSync(join(root, ".resurrect", "READY_DIFF.md"), `# Ready Diff

## Branch

${branch}

## Working Tree

\`\`\`text
${diff || "clean"}
\`\`\`

## Next Review Step

Implement or verify the Milestone Zero task files, then run the recorded acceptance checks.
`, "utf8");

  const publicAssets = run("node", ["--experimental-strip-types", join(import.meta.dirname, "generate-public-assets.ts")], { cwd: root, timeoutMs: 60_000 });
  process.stdout.write(publicAssets.stdout);
  process.stderr.write(publicAssets.stderr);

  console.log(`Execution branch created: ${branch}`);
  console.log("Wrote .resurrect/EXECUTION_SESSION.md and .resurrect/READY_DIFF.md");
}

function ensureCanFindContractForExecute(): void {
  const contractPath = join(process.cwd(), ".resurrect", "RESURRECTION_CONTRACT.md");
  if (!pathExists(contractPath)) {
    throw new Error("No .resurrect/RESURRECTION_CONTRACT.md found. Run intake and analysis first.");
  }
}

function printPrSummary(): void {
  const root = inferRepoRoot(process.cwd());
  const result = run("node", ["--experimental-strip-types", join(import.meta.dirname, "generate-public-assets.ts"), "--print-pr-summary"], { cwd: root, timeoutMs: 60_000 });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

function runDemo(flags: Record<string, string | boolean>): void {
  const root = createDemoRepository();
  try {
    console.log(`Created demo repository: ${root}\n`);
    printIntake({ kind: "local", input: root, root });
    console.log("\nProceeding with confirmed demo analysis...\n");
    runDeepLocal({ kind: "local", input: root, root });

    const contractPath = join(root, ".resurrect", "RESURRECTION_CONTRACT.md");
    const approvedContract = readFileSync(contractPath, "utf8")
      .replace("verdict: \"TBD\"", "verdict: \"Revive\"")
      .replace("approved: false", "approved: true");
    writeFileSync(contractPath, approvedContract, "utf8");

    const execute = run("node", ["--experimental-strip-types", join(import.meta.dirname, "resurrect.ts"), "execute"], { cwd: root, timeoutMs: 180_000 });
    if (execute.status !== 0) throw new Error(execute.stderr || execute.stdout);
    const resurrection = readFileSync(join(root, "RESURRECTION.md"), "utf8");
    console.log("\nDemo resurrection report preview:\n");
    console.log(resurrection.split("\n").slice(0, 34).join("\n"));
    if (flags.keep) {
      console.log(`\nKept demo repository: ${root}`);
    }
  } finally {
    if (!flags.keep) rmSync(root, { recursive: true, force: true });
  }
}

const parsed = parseArgs();
const [commandOrProject, maybeProject] = parsed.positionals;

if (parsed.flags.help) {
  usage();
  process.exit(0);
}

if (commandOrProject === "scan") {
  const result = run("node", ["--experimental-strip-types", join(import.meta.dirname, "scan-repositories.ts"), ...process.argv.slice(3)], { timeoutMs: 120_000 });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

if (commandOrProject === "demo") {
  runDemo(parsed.flags);
  process.exit(0);
}

if (commandOrProject === "execute") {
  ensureCanFindContractForExecute();
  runExecute(parsed.flags);
  process.exit(0);
}

if (commandOrProject === "pr-summary") {
  printPrSummary();
}

const projectInput = commandOrProject === "analyze" ? maybeProject : commandOrProject;
const target = resolveTarget(projectInput);

if (parsed.flags.confirmed) {
  runDeepLocal(target);
} else {
  printIntake(target);
}
