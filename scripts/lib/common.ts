import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

export type CommandResult = {
  command: string;
  args: string[];
  cwd: string;
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type ParsedArgs = {
  positionals: string[];
  flags: Record<string, string | boolean>;
};

export function parseArgs(argv = process.argv.slice(2)): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const withoutPrefix = arg.slice(2);
    const eqIndex = withoutPrefix.indexOf("=");
    if (eqIndex !== -1) {
      flags[withoutPrefix.slice(0, eqIndex)] = withoutPrefix.slice(eqIndex + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[withoutPrefix] = next;
      index += 1;
    } else {
      flags[withoutPrefix] = true;
    }
  }

  return { positionals, flags };
}

export function run(
  command: string,
  args: string[] = [],
  options: { cwd?: string; timeoutMs?: number } = {},
): CommandResult {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 60_000,
    env: { ...process.env, NO_COLOR: "1" },
  });

  return {
    command,
    args,
    cwd,
    status: result.status,
    stdout: redactSecrets(result.stdout ?? ""),
    stderr: redactSecrets(result.stderr ?? result.error?.message ?? ""),
    timedOut: Boolean(result.error && result.error.name === "Error" && /timed out/i.test(result.error.message)),
  };
}

export function commandExists(command: string): boolean {
  return run("which", [command], { timeoutMs: 5_000 }).status === 0;
}

export function git(args: string[], cwd = process.cwd(), timeoutMs = 60_000): CommandResult {
  return run("git", args, { cwd, timeoutMs });
}

export function inferRepoRoot(cwd = process.cwd()): string {
  const result = git(["rev-parse", "--show-toplevel"], cwd, 10_000);
  if (result.status !== 0) {
    throw new Error(`Not inside a git repository: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

export function getDefaultBranch(cwd = process.cwd()): string {
  const originHead = git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], cwd, 10_000);
  if (originHead.status === 0 && originHead.stdout.trim()) {
    return originHead.stdout.trim().replace(/^origin\//, "");
  }

  for (const branch of ["main", "master"]) {
    if (git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], cwd, 10_000).status === 0) {
      return branch;
    }
  }

  return "unknown";
}

export function getCurrentBranch(cwd = process.cwd()): string {
  const result = git(["branch", "--show-current"], cwd, 10_000);
  return result.status === 0 ? result.stdout.trim() || "detached" : "unknown";
}

export function inferNameWithOwner(cwd = process.cwd()): string | null {
  const remote = git(["config", "--get", "remote.origin.url"], cwd, 10_000);
  if (remote.status !== 0 || !remote.stdout.trim()) return null;
  const value = remote.stdout.trim();
  const match = value.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeJson(path: string, value: unknown): void {
  ensureDir(resolve(path, ".."));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function pathExists(path: string): boolean {
  return existsSync(path);
}

export function readText(path: string, maxBytes = 1_000_000): string {
  const buffer = readFileSync(path);
  return buffer.subarray(0, maxBytes).toString("utf8");
}

export function listFilesRecursive(
  root: string,
  options: { maxFiles?: number; maxBytes?: number; exclude?: string[] } = {},
): string[] {
  const files: string[] = [];
  const excluded = new Set([
    ".git",
    ".resurrect",
    "node_modules",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
    ...options.exclude ?? [],
  ]);
  const maxFiles = options.maxFiles ?? 10_000;
  const maxBytes = options.maxBytes ?? 2_000_000;

  function walk(directory: string): void {
    if (files.length >= maxFiles) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const size = statSync(absolute).size;
      if (size <= maxBytes) files.push(absolute);
    }
  }

  walk(root);
  return files;
}

export function relativePath(root: string, path: string): string {
  return relative(root, path).split("\\").join("/");
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function redactSecrets(input: string): string {
  return input
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|PASS|PRIVATE)[A-Z0-9_]*\s*=\s*)[^\s]+/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]")
    .replace(/(gh[pousr]_[A-Za-z0-9_]+)/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/(sk-[A-Za-z0-9_-]+)/g, "[REDACTED_API_KEY]");
}

export function summarizeText(value: string, maxLength = 240): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact;
}

export function packageManager(root: string): string {
  if (pathExists(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (pathExists(join(root, "yarn.lock"))) return "yarn";
  if (pathExists(join(root, "bun.lockb")) || pathExists(join(root, "bun.lock"))) return "bun";
  if (pathExists(join(root, "package-lock.json"))) return "npm";
  if (pathExists(join(root, "package.json"))) return "npm";
  return "unknown";
}

export function repoLabel(root: string): string {
  return inferNameWithOwner(root) ?? basename(root);
}
