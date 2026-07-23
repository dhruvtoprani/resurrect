#!/usr/bin/env -S node --experimental-strip-types
import { writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  ensureDir,
  git,
  inferRepoRoot,
  listFilesRecursive,
  packageManager,
  parseArgs,
  pathExists,
  readJson,
  readText,
  relativePath,
  summarizeText,
  writeJson,
} from "./lib/common.ts";

type Signal = {
  source: string;
  reliability: "source code" | "git history" | "planning document" | "README claim" | "agent-facing inference";
  text: string;
};

function usage(): void {
  console.log(`Usage: infer-intent.ts

Reads local repository evidence and writes .resurrect/INTENT_SIGNALS.json plus a draft ORIGINAL_INTENT.md.`);
}

function firstReadme(root: string): { path: string; text: string } | null {
  for (const name of ["README.md", "README.mdx", "readme.md"]) {
    const path = join(root, name);
    if (pathExists(path)) return { path: name, text: readText(path, 200_000) };
  }
  return null;
}

function packageSignals(root: string): Signal[] {
  const packageJsonPath = join(root, "package.json");
  if (!pathExists(packageJsonPath)) return [];
  const packageJson = readJson(packageJsonPath) as any;
  const scripts = Object.keys(packageJson.scripts ?? {});
  const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies }).slice(0, 30);
  return [
    {
      source: "package.json",
      reliability: "source code",
      text: `package ${packageJson.name ?? basename(root)} using ${packageManager(root)} with scripts: ${scripts.length ? scripts.join(", ") : "none"}`,
    },
    {
      source: "package.json",
      reliability: "source code",
      text: `dependency hints: ${dependencies.length ? dependencies.join(", ") : "none"}`,
    },
  ];
}

function routeAndEntrySignals(root: string): Signal[] {
  const files = listFilesRecursive(root, { maxFiles: 3000, maxBytes: 250_000 });
  const interesting = files
    .map((file) => relativePath(root, file))
    .filter((file) => /(^app\/|^pages\/|^src\/routes?\/|^src\/app|main\.|index\.|cli\.|server\.|api\/|commands?\/)/i.test(file))
    .slice(0, 40);
  if (!interesting.length) return [];
  return [{
    source: "repository tree",
    reliability: "source code",
    text: `entrypoint and route hints: ${interesting.join(", ")}`,
  }];
}

function gitSignals(root: string): Signal[] {
  const early = git(["log", "--reverse", "--max-count=18", "--date=short", "--pretty=format:%h %ad %s"], root, 20_000).stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const branches = git(["branch", "--all", "--format=%(refname:short)"], root, 20_000).stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/HEAD/.test(line))
    .slice(0, 30);
  const signals: Signal[] = [];
  if (early.length) signals.push({ source: "early commits", reliability: "git history", text: early.join(" | ") });
  if (branches.length) signals.push({ source: "branches", reliability: "git history", text: branches.join(", ") });
  return signals;
}

function planningSignals(root: string): Signal[] {
  const files = listFilesRecursive(root, { maxFiles: 3000, maxBytes: 300_000 });
  const planningFiles = files
    .map((file) => relativePath(root, file))
    .filter((file) => /(roadmap|plan|prd|spec|todo|notes|vision|docs?\/)/i.test(file))
    .slice(0, 25);
  if (!planningFiles.length) return [];
  return [{ source: "planning files", reliability: "planning document", text: planningFiles.join(", ") }];
}

function inferHypothesis(signals: Signal[]): string {
  const readmeSignal = signals.find((signal) => signal.source.startsWith("README"));
  const packageSignal = signals.find((signal) => signal.source === "package.json");
  const routeSignal = signals.find((signal) => signal.source === "repository tree");
  const base = readmeSignal?.text ?? packageSignal?.text ?? routeSignal?.text ?? "No clear product statement found.";
  const cleaned = base
    .replace(/^#+\s*/, "")
    .replace(/^([A-Za-z0-9_-]+)\s+\1\b/i, "$1")
    .replace(/[.。]\s*$/, "");
  return `Likely product direction: ${cleaned}.`;
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

const root = inferRepoRoot(process.cwd());
const resurrectDir = join(root, ".resurrect");
ensureDir(resurrectDir);

const signals: Signal[] = [];
const readme = firstReadme(root);
if (readme) {
  const lines = readme.text.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 8);
  signals.push({ source: readme.path, reliability: "README claim", text: summarizeText(lines.join(" "), 500) });
}
signals.push(...packageSignals(root));
signals.push(...routeAndEntrySignals(root));
signals.push(...gitSignals(root));
signals.push(...planningSignals(root));

const output = {
  generated_at: new Date().toISOString(),
  hypothesis: inferHypothesis(signals),
  confidence: signals.length >= 5 ? "Moderate" : signals.length >= 2 ? "Low" : "Unknown",
  signals,
  open_questions: [
    "Is this the product you wanted?",
    "Which signal best matches the original core loop?",
    "Which later additions should be removed from scope?",
  ],
};

writeJson(join(resurrectDir, "INTENT_SIGNALS.json"), output);
writeFileSync(join(resurrectDir, "ORIGINAL_INTENT.md"), `# Original Intent

## Intent Hypothesis

${output.hypothesis}

## Confidence

${output.confidence}

## Evidence Signals

${signals.map((signal) => `- ${signal.reliability}: ${signal.source} - ${signal.text}`).join("\n") || "- Unknown"}

## Owner Questions

1. Is this the product you wanted?
2. What caused you to stop?
3. How much time will you invest now?

## Boundaries

Treat this file as a starting hypothesis. Replace weak inferences with owner input and stronger repository evidence.
`, "utf8");

console.log("Wrote .resurrect/INTENT_SIGNALS.json and .resurrect/ORIGINAL_INTENT.md");
