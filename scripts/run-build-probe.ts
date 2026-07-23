#!/usr/bin/env -S node --experimental-strip-types
import { ensureDir, inferRepoRoot, packageManager, parseArgs, pathExists, readJson, run, writeJson } from "./lib/common.ts";
import { join } from "node:path";

function usage(): void {
  console.log(`Usage: run-build-probe.ts [--install] [--allow-lifecycle-scripts] [--timeout-ms 120000] [--out .resurrect/build-probe.json]

Defaults to no dependency install. If --install is used, lifecycle scripts are blocked unless explicitly allowed.`);
}

function packageScripts(root: string): Record<string, string> {
  const packageJsonPath = join(root, "package.json");
  if (!pathExists(packageJsonPath)) return {};
  return ((readJson(packageJsonPath) as any).scripts ?? {}) as Record<string, string>;
}

function hasDeclaredDependencies(root: string): boolean {
  const packageJsonPath = join(root, "package.json");
  if (!pathExists(packageJsonPath)) return false;
  const packageJson = readJson(packageJsonPath) as any;
  return Object.keys(packageJson.dependencies ?? {}).length > 0
    || Object.keys(packageJson.devDependencies ?? {}).length > 0
    || Object.keys(packageJson.optionalDependencies ?? {}).length > 0
    || Object.keys(packageJson.peerDependencies ?? {}).length > 0;
}

function installCommand(manager: string, root: string, allowLifecycleScripts: boolean): string[] | null {
  const ignoreScripts = allowLifecycleScripts ? [] : ["--ignore-scripts"];
  if (manager === "npm" && pathExists(join(root, "package-lock.json"))) return ["npm", "ci", ...ignoreScripts];
  if (manager === "npm") return ["npm", "install", ...ignoreScripts];
  if (manager === "pnpm") return ["pnpm", "install", "--frozen-lockfile", ...ignoreScripts];
  if (manager === "yarn") return ["yarn", "install", "--frozen-lockfile", ...ignoreScripts];
  if (manager === "bun") return ["bun", "install"];
  return null;
}

function runScriptCommand(manager: string, scriptName: string): string[] {
  if (manager === "pnpm") return ["pnpm", "run", scriptName];
  if (manager === "yarn") return ["yarn", scriptName];
  if (manager === "bun") return ["bun", "run", scriptName];
  return ["npm", "run", scriptName];
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

const root = inferRepoRoot(process.cwd());
const out = typeof flags.out === "string" ? flags.out : ".resurrect/build-probe.json";
const timeoutMs = typeof flags["timeout-ms"] === "string" ? Number(flags["timeout-ms"]) : 120_000;
const shouldInstall = Boolean(flags.install);
const allowLifecycleScripts = Boolean(flags["allow-lifecycle-scripts"]);
const manager = packageManager(root);
const scripts = packageScripts(root);
const lifecycleScripts = Object.fromEntries(
  ["preinstall", "install", "postinstall", "prepare"].filter((name) => scripts[name]).map((name) => [name, scripts[name]]),
);
const steps: unknown[] = [];
ensureDir(".resurrect");

if (manager === "unknown") {
  steps.push({ name: "detect-package-manager", status: "failed", message: "No JavaScript/TypeScript package manifest found." });
} else {
  steps.push({ name: "detect-package-manager", status: "passed", manager });
}

if (shouldInstall) {
  const command = installCommand(manager, root, allowLifecycleScripts);
  if (Object.keys(lifecycleScripts).length > 0 && !allowLifecycleScripts) {
    steps.push({
      name: "lifecycle-script-review",
      status: "warning",
      message: "Lifecycle scripts were detected and will not run because install uses --ignore-scripts. Re-run with --allow-lifecycle-scripts only after showing these scripts to the user.",
      lifecycle_scripts: lifecycleScripts,
      safe_command: command,
    });
  }
  if (command) {
    const [cmd, ...args] = command;
    const result = run(cmd, args, { cwd: root, timeoutMs });
    steps.push({ name: "install", status: result.status === 0 ? "passed" : "failed", result });
  }
} else {
  steps.push({ name: "install", status: "skipped", message: "Use --install to attempt dependency installation." });
}

const dependenciesAreAvailable = pathExists(join(root, "node_modules")) || !hasDeclaredDependencies(root);
for (const scriptName of ["typecheck", "lint", "build", "test"]) {
  if (!scripts[scriptName]) {
    steps.push({ name: scriptName, status: "skipped", message: `No ${scriptName} script in package.json.` });
    continue;
  }
  if (!dependenciesAreAvailable && !shouldInstall) {
    steps.push({ name: scriptName, status: "blocked", message: "node_modules is missing and --install was not used." });
    continue;
  }
  const [cmd, ...args] = runScriptCommand(manager, scriptName);
  const result = run(cmd, args, { cwd: root, timeoutMs });
  steps.push({ name: scriptName, status: result.status === 0 ? "passed" : "failed", result });
  if (result.status !== 0) break;
}

const firstBlockingFailure = steps.find((step: any) => step.status === "failed" || step.status === "blocked") ?? null;
const evidence = {
  generated_at: new Date().toISOString(),
  root,
  manager,
  lifecycle_scripts: lifecycleScripts,
  status: firstBlockingFailure ? "failed" : "passed",
  first_blocking_failure: firstBlockingFailure,
  steps,
};

writeJson(out, evidence);
console.log(`Wrote ${out}`);
