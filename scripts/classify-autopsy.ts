#!/usr/bin/env -S node --experimental-strip-types
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, inferRepoRoot, parseArgs, pathExists, readJson, writeJson } from "./lib/common.ts";

type Classification = {
  label: string;
  severity: "high" | "medium" | "low";
  evidence: string[];
  recovery: string;
};

function usage(): void {
  console.log(`Usage: classify-autopsy.ts

Reads .resurrect build and unfinished-work evidence, then writes AUTOPSY_CLASSIFICATION.json and AUTOPSY.md.`);
}

function readOptional(path: string): any | null {
  return pathExists(path) ? readJson(path) : null;
}

function classify(buildProbe: any, unfinished: any, gitEvidence: any): Classification[] {
  const labels: Classification[] = [];
  const firstFailure = buildProbe?.first_blocking_failure ? JSON.stringify(buildProbe.first_blocking_failure).toLowerCase() : "";
  const allBuild = JSON.stringify(buildProbe ?? {}).toLowerCase();
  const markers = unfinished?.unfinished_markers ?? [];
  const deployment = unfinished?.deployment_config ?? [];
  const envExamples = unfinished?.env_examples ?? [];
  const branches = gitEvidence?.branches ?? [];

  if (buildProbe?.status === "failed" || firstFailure.includes("node_modules") || firstFailure.includes("install")) {
    labels.push({
      label: "dependency-rot-or-missing-install",
      severity: "high",
      evidence: [buildProbe?.first_blocking_failure ? JSON.stringify(buildProbe.first_blocking_failure) : "Build probe failed or could not run"],
      recovery: "Restore the package manager path first, then rerun build and tests before changing product code.",
    });
  }

  if (/database_url|api[_-]?key|secret|token|auth|oauth|stripe|supabase|firebase/.test(allBuild) || envExamples.length > 0) {
    labels.push({
      label: "missing-external-service-or-secret",
      severity: "medium",
      evidence: [`env examples: ${envExamples.length}`, `build hint: ${firstFailure.slice(0, 240)}`],
      recovery: "Create a local/mock configuration or narrow Milestone Zero around a service-free path.",
    });
  }

  if (markers.length >= 8) {
    labels.push({
      label: "unfinished-implementation-cluster",
      severity: "medium",
      evidence: markers.slice(0, 5).map((marker: any) => `${marker.file}:${marker.line} ${marker.text}`),
      recovery: "Cluster TODO/FIXME markers by core loop versus later scope before editing.",
    });
  }

  if (branches.length >= 4) {
    labels.push({
      label: "abandoned-branch-work",
      severity: "medium",
      evidence: branches.slice(0, 8),
      recovery: "Inspect non-default branches for the last coherent feature direction before rebuilding.",
    });
  }

  if (deployment.length > 0 && buildProbe?.status === "failed") {
    labels.push({
      label: "stale-deployment-surface",
      severity: "low",
      evidence: deployment.slice(0, 8),
      recovery: "Defer deployment migration until the local vertical slice works.",
    });
  }

  if (!labels.length) {
    labels.push({
      label: "no-deterministic-stall-cause",
      severity: "low",
      evidence: ["Build and unfinished-work evidence did not reveal a clear cause."],
      recovery: "Use owner input and git history to identify whether the blocker was product scope, motivation, or external timing.",
    });
  }

  return labels;
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

const root = inferRepoRoot(process.cwd());
const resurrectDir = join(root, ".resurrect");
ensureDir(resurrectDir);

const buildProbe = readOptional(join(resurrectDir, "build-probe.json"));
const unfinished = readOptional(join(resurrectDir, "EVIDENCE.unfinished.json"));
const gitEvidence = readOptional(join(resurrectDir, "EVIDENCE.git.json"));
const classifications = classify(buildProbe, unfinished, gitEvidence);

const output = {
  generated_at: new Date().toISOString(),
  build_status: buildProbe?.status ?? "unknown",
  first_blocking_failure: buildProbe?.first_blocking_failure ?? null,
  classifications,
  likely_recovery_order: classifications.map((item) => item.recovery),
};

writeJson(join(resurrectDir, "AUTOPSY_CLASSIFICATION.json"), output);
writeFileSync(join(resurrectDir, "AUTOPSY.md"), `# Autopsy

## Build Status

${output.build_status}

## First Blocking Failure

${output.first_blocking_failure ? JSON.stringify(output.first_blocking_failure, null, 2) : "Unknown"}

## Stall Classifications

${classifications.map((item) => `### ${item.label}

Severity: ${item.severity}

Evidence:
${item.evidence.map((evidence) => `- ${evidence}`).join("\n")}

Recovery:
${item.recovery}
`).join("\n")}

## Likely Recovery Order

${output.likely_recovery_order.map((item, index) => `${index + 1}. ${item}`).join("\n")}
`, "utf8");

console.log("Wrote .resurrect/AUTOPSY_CLASSIFICATION.json and .resurrect/AUTOPSY.md");
