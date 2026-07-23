#!/usr/bin/env -S node --experimental-strip-types
import { ensureDir, inferRepoRoot, listFilesRecursive, packageManager, parseArgs, pathExists, readJson, readText, relativePath, summarizeText, writeJson } from "./lib/common.ts";
import { join } from "node:path";

function usage(): void {
  console.log(`Usage: detect-unfinished-work.ts [--out .resurrect/EVIDENCE.unfinished.json]

Scans source, docs, config, and manifests for unfinished work signals.`);
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

const root = inferRepoRoot(process.cwd());
const out = typeof flags.out === "string" ? flags.out : ".resurrect/EVIDENCE.unfinished.json";
ensureDir(".resurrect");

const markerPattern = /\b(TODO|FIXME|HACK|XXX|WIP|stub|placeholder|not implemented|coming soon|temporary)\b/i;
const files = listFilesRecursive(root, { maxFiles: 12_000, maxBytes: 1_500_000 });
const markers: unknown[] = [];
const docs: string[] = [];
const ci: string[] = [];
const deploy: string[] = [];
const envExamples: unknown[] = [];
const schemas: string[] = [];
const tests: string[] = [];
const demoAssets: string[] = [];

for (const file of files) {
  const rel = relativePath(root, file);
  const lower = rel.toLowerCase();
  if (/readme|docs?|roadmap|plan|spec|prd|notes/.test(lower)) docs.push(rel);
  if (/^\.github\/workflows\/|circleci|travis|buildkite|jenkins|gitlab-ci/.test(lower)) ci.push(rel);
  if (/vercel|netlify|render|fly\.toml|dockerfile|docker-compose|railway|heroku|cloudflare|wrangler/.test(lower)) deploy.push(rel);
  if (/(\.env\.example|\.env\.sample|example\.env)$/.test(lower)) {
    const keys = readText(file, 100_000)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0]);
    envExamples.push({ file: rel, keys });
  }
  if (/schema|migration|prisma|drizzle|supabase|database/.test(lower)) schemas.push(rel);
  if (/(__tests__|\.test\.|\.spec\.|tests?\/)/.test(lower)) tests.push(rel);
  if (/\.(png|jpe?g|gif|webp|mp4|mov|svg)$/i.test(lower) && /(demo|screenshot|asset|public|static)/.test(lower)) demoAssets.push(rel);

  if (!/\.(ts|tsx|js|jsx|py|rb|go|rs|java|kt|swift|php|cs|md|mdx|txt|json|yaml|yml|toml|css|scss|html)$/i.test(rel)) {
    continue;
  }

  const text = readText(file, 300_000);
  text.split("\n").forEach((line, index) => {
    if (markerPattern.test(line)) {
      markers.push({ file: rel, line: index + 1, text: summarizeText(line, 220) });
    }
  });
}

const packageJsonPath = join(root, "package.json");
const packageJson = pathExists(packageJsonPath) ? readJson(packageJsonPath) : null;

const evidence = {
  generated_at: new Date().toISOString(),
  package_manager: packageManager(root),
  package_json: packageJson
    ? {
        name: (packageJson as any).name,
        version: (packageJson as any).version,
        scripts: (packageJson as any).scripts ?? {},
        dependencies_count: Object.keys((packageJson as any).dependencies ?? {}).length,
        dev_dependencies_count: Object.keys((packageJson as any).devDependencies ?? {}).length,
      }
    : null,
  unfinished_markers: markers,
  docs,
  ci,
  deployment_config: deploy,
  env_examples: envExamples,
  schemas,
  tests,
  demo_assets: demoAssets,
};

writeJson(out, evidence);
console.log(`Wrote ${out}`);
