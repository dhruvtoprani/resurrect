#!/usr/bin/env -S node --experimental-strip-types
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, inferRepoRoot, parseArgs, pathExists, readJson, writeJson } from "./lib/common.ts";

type Citation = {
  id: string;
  type: string;
  source: string;
  claim: string;
};

function usage(): void {
  console.log(`Usage: build-citations.ts

Builds .resurrect/CITATIONS.json and CITATIONS.md from collected evidence, intent signals, and autopsy labels.`);
}

function readOptional(path: string): any | null {
  return pathExists(path) ? readJson(path) : null;
}

function push(citations: Citation[], type: string, source: string, claim: string): void {
  citations.push({
    id: `R${String(citations.length + 1).padStart(3, "0")}`,
    type,
    source,
    claim,
  });
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

const root = inferRepoRoot(process.cwd());
const resurrectDir = join(root, ".resurrect");
ensureDir(resurrectDir);

const gitEvidence = readOptional(join(resurrectDir, "EVIDENCE.git.json"));
const unfinished = readOptional(join(resurrectDir, "EVIDENCE.unfinished.json"));
const buildProbe = readOptional(join(resurrectDir, "build-probe.json"));
const intent = readOptional(join(resurrectDir, "INTENT_SIGNALS.json"));
const autopsy = readOptional(join(resurrectDir, "AUTOPSY_CLASSIFICATION.json"));
const citations: Citation[] = [];

if (buildProbe) {
  push(citations, "running behavior and tests", ".resurrect/build-probe.json", `Build probe status: ${buildProbe.status ?? "unknown"}`);
  if (buildProbe.first_blocking_failure) {
    push(citations, "running behavior and tests", ".resurrect/build-probe.json", `First blocking failure: ${JSON.stringify(buildProbe.first_blocking_failure).slice(0, 220)}`);
  }
}

for (const signal of intent?.signals ?? []) {
  push(citations, signal.reliability ?? "agent-facing inference", signal.source ?? ".resurrect/INTENT_SIGNALS.json", signal.text ?? "Intent signal");
}

for (const marker of (unfinished?.unfinished_markers ?? []).slice(0, 20)) {
  push(citations, "source code", `${marker.file}:${marker.line}`, marker.text);
}

for (const branch of (gitEvidence?.branches ?? []).slice(0, 20)) {
  push(citations, "git history", ".resurrect/EVIDENCE.git.json", `Branch evidence: ${branch}`);
}

for (const classification of autopsy?.classifications ?? []) {
  push(citations, "agent-facing inference", ".resurrect/AUTOPSY_CLASSIFICATION.json", `${classification.label}: ${classification.recovery}`);
}

writeJson(join(resurrectDir, "CITATIONS.json"), {
  generated_at: new Date().toISOString(),
  citations,
});

const evidencePath = join(resurrectDir, "EVIDENCE.json");
if (pathExists(evidencePath)) {
  const evidence = readJson(evidencePath) as any;
  evidence.intent_signals = intent;
  evidence.autopsy_classification = autopsy;
  evidence.citations = { generated_at: new Date().toISOString(), citations };
  writeJson(evidencePath, evidence);
}

writeFileSync(join(resurrectDir, "CITATIONS.md"), `# Citations

Use these IDs when writing conclusions in AUTOPSY, ORIGINAL_INTENT, FEASIBILITY_DELTA, RESURRECTION_CONTRACT, EXECUTION_PLAN, and CONTEXT.

${citations.map((citation) => `## ${citation.id}

- Type: ${citation.type}
- Source: ${citation.source}
- Claim: ${citation.claim}
`).join("\n")}
`, "utf8");

console.log("Wrote .resurrect/CITATIONS.json and .resurrect/CITATIONS.md");
