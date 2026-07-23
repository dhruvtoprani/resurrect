#!/usr/bin/env -S node --experimental-strip-types
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, getCurrentBranch, inferRepoRoot, parseArgs, pathExists, readJson, readText, repoLabel, summarizeText } from "./lib/common.ts";

type BadgeColor = "green" | "blue" | "orange" | "red" | "gray";

function usage(): void {
  console.log(`Usage: generate-public-assets.ts [--print-pr-summary]

Generates public-facing resurrection artifacts: RESURRECTION.md, PR_SUMMARY.md, SHARE.md, and SVG badges.`);
}

function readOptional(path: string): any | null {
  return pathExists(path) ? readJson(path) : null;
}

function readOptionalText(path: string): string | null {
  return pathExists(path) ? readText(path, 500_000) : null;
}

function contractValue(contract: string | null, key: string, fallback: string): string {
  if (!contract) return fallback;
  const match = contract.match(new RegExp(`${key}:\\s*["']?([^"'\\n]+)["']?`, "i"));
  return match?.[1]?.trim() || fallback;
}

function firstClassification(autopsy: any): string {
  return autopsy?.classifications?.[0]?.label ?? "unknown";
}

function milestoneStatus(buildProbe: any): string {
  if (buildProbe?.status === "passed") return "Passing";
  if (buildProbe?.status === "failed") return "Blocked";
  return "Unknown";
}

function badgeColor(value: string): BadgeColor {
  const normalized = value.toLowerCase();
  if (/pass|ready|revive/.test(normalized)) return "green";
  if (/salvage|rebuild|branch/.test(normalized)) return "blue";
  if (/block|unknown|tbd/.test(normalized)) return "orange";
  if (/archive|fail/.test(normalized)) return "red";
  return "gray";
}

function svgBadge(label: string, value: string, color: BadgeColor): string {
  const palette: Record<BadgeColor, string> = {
    green: "#1f883d",
    blue: "#0969da",
    orange: "#bf8700",
    red: "#cf222e",
    gray: "#6e7781",
  };
  const leftWidth = Math.max(62, label.length * 7 + 18);
  const rightWidth = Math.max(78, value.length * 7 + 18);
  const width = leftWidth + rightWidth;
  const labelX = Math.floor(leftWidth / 2);
  const valueX = leftWidth + Math.floor(rightWidth / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${palette[color]}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelX}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelX}" y="14">${label}</text>
    <text x="${valueX}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${valueX}" y="14">${value}</text>
  </g>
</svg>
`;
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

const root = inferRepoRoot(process.cwd());
const resurrectDir = join(root, ".resurrect");
ensureDir(resurrectDir);
mkdirSync(join(resurrectDir, "badges"), { recursive: true });

const evidence = readOptional(join(resurrectDir, "EVIDENCE.json"));
const intent = readOptional(join(resurrectDir, "INTENT_SIGNALS.json"));
const autopsy = readOptional(join(resurrectDir, "AUTOPSY_CLASSIFICATION.json"));
const buildProbe = readOptional(join(resurrectDir, "build-probe.json"));
const citations = readOptional(join(resurrectDir, "CITATIONS.json"));
const contract = readOptionalText(join(resurrectDir, "RESURRECTION_CONTRACT.md"));
const readyDiff = readOptionalText(join(resurrectDir, "READY_DIFF.md"));

const repo = repoLabel(root);
const verdict = contractValue(contract, "verdict", "TBD");
const branch = contractValue(contract, "branch", getCurrentBranch(root));
const status = milestoneStatus(buildProbe);
const blocker = firstClassification(autopsy);
const hypothesis = intent?.hypothesis ?? "Original intent is still being reconstructed.";
const citationCount = citations?.citations?.length ?? 0;
const currentBranch = getCurrentBranch(root);
const before = blocker === "unknown" ? "unclear stall cause" : blocker.replaceAll("-", " ");
const proof = buildProbe?.status === "passed" ? "build/test probe passes" : buildProbe?.first_blocking_failure ? "first blocker is documented" : "verification status is documented";

writeFileSync(join(resurrectDir, "badges", "verdict.svg"), svgBadge("verdict", verdict, badgeColor(verdict)), "utf8");
writeFileSync(join(resurrectDir, "badges", "milestone-zero.svg"), svgBadge("milestone zero", status, badgeColor(status)), "utf8");
writeFileSync(join(resurrectDir, "badges", "branch.svg"), svgBadge("branch", currentBranch.startsWith("resurrect/") ? "ready" : "planned", currentBranch.startsWith("resurrect/") ? "green" : "blue"), "utf8");

const resurrection = `# Resurrection Report: ${repo}

![Verdict](.resurrect/badges/verdict.svg)
![Milestone Zero](.resurrect/badges/milestone-zero.svg)
![Branch](.resurrect/badges/branch.svg)

## Before

${summarizeText(before, 220)}

## Decision

${verdict}

## After

${currentBranch.startsWith("resurrect/") ? `A resurrection branch exists: \`${currentBranch}\`.` : `A resurrection branch is planned: \`${branch}\`.`}

## Proof

${proof}. Evidence index contains ${citationCount} citation${citationCount === 1 ? "" : "s"}.

## Intent Hypothesis

${hypothesis}

## What Changed

- Evidence archive written to \`.resurrect/\`.
- Autopsy classification generated.
- Resurrection Contract created.
- Milestone Zero task files created.
${readyDiff ? "- Ready diff summary generated." : "- Ready diff will be generated after execute mode."}

## Next Step

Review \`.resurrect/RESURRECTION_CONTRACT.md\`, approve the owner marker, then run \`resurrect execute\`.
`;

const prSummary = `## Resurrection Summary

Before: ${summarizeText(before, 160)}

Decision: ${verdict}

After: ${currentBranch.startsWith("resurrect/") ? `working on \`${currentBranch}\`` : `planned branch \`${branch}\``}

Proof: ${proof}

## Evidence

- \`.resurrect/EVIDENCE.json\`
- \`.resurrect/CITATIONS.md\`
- \`.resurrect/AUTOPSY.md\`
- \`.resurrect/ORIGINAL_INTENT.md\`
- \`.resurrect/RESURRECTION_CONTRACT.md\`

## Verification

\`\`\`text
${buildProbe?.status ?? "unknown"}
\`\`\`

## Remaining Blockers

${autopsy?.classifications?.map((item: any) => `- ${item.label}: ${item.recovery}`).join("\n") ?? "- Unknown"}
`;

const share = `# Share Snippet

${repo}: ${verdict} resurrection candidate.

Before: ${summarizeText(before, 120)}
After: ${currentBranch.startsWith("resurrect/") ? currentBranch : branch}
Proof: ${proof}

Tagline: Your next product may already be half-built.
`;

writeFileSync(join(root, "RESURRECTION.md"), resurrection, "utf8");
writeFileSync(join(resurrectDir, "PR_SUMMARY.md"), prSummary, "utf8");
writeFileSync(join(resurrectDir, "SHARE.md"), share, "utf8");

if (flags["print-pr-summary"]) {
  console.log(prSummary);
} else {
  console.log("Wrote RESURRECTION.md, .resurrect/PR_SUMMARY.md, .resurrect/SHARE.md, and .resurrect/badges/*.svg");
}
