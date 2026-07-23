#!/usr/bin/env -S node --experimental-strip-types
import { ensureDir, getDefaultBranch, inferNameWithOwner, inferRepoRoot, parseArgs, pathExists, readJson, repoLabel, today, writeJson } from "./lib/common.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

function usage(): void {
  console.log(`Usage: write-artifacts.ts [--verdict Revive|Rebuild|Salvage|Archive] [--direction short-name] [--time-budget "two days"]

Creates .resurrect artifacts from collected evidence. Replace TBD sections with agent reasoning and owner input.`);
}

function readOptional(path: string): unknown | null {
  return pathExists(path) ? readJson(path) : null;
}

function writeMarkdown(path: string, content: string): void {
  ensureDir(join(path, ".."));
  writeFileSync(path, content.trimStart(), "utf8");
}

function task(title: string, objective: string, why: string, files: string, boundaries: string, checks: string, dependencies: string, stop: string): string {
  return `# ${title}

## Objective

${objective}

## Why It Matters

${why}

## Relevant Files

${files}

## Implementation Boundaries

${boundaries}

## Acceptance Checks

${checks}

## Dependencies

${dependencies}

## Stop Conditions

${stop}
`;
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

const root = inferRepoRoot(process.cwd());
const resurrectDir = join(root, ".resurrect");
const tasksDir = join(resurrectDir, "tasks");
ensureDir(tasksDir);

const verdict = typeof flags.verdict === "string" ? flags.verdict : "TBD";
const direction = typeof flags.direction === "string" ? flags.direction : "direction";
const timeBudget = typeof flags["time-budget"] === "string" ? flags["time-budget"] : "TBD";
const branch = `resurrect/${today()}-${direction}`;
const nameWithOwner = inferNameWithOwner(root);

const evidence = {
  generated_at: new Date().toISOString(),
  repository: {
    root,
    label: repoLabel(root),
    name_with_owner: nameWithOwner ?? "unknown",
    default_branch: getDefaultBranch(root),
  },
  github: readOptional(join(resurrectDir, "EVIDENCE.github.json")),
  git: readOptional(join(resurrectDir, "EVIDENCE.git.json")),
  unfinished_work: readOptional(join(resurrectDir, "EVIDENCE.unfinished.json")),
  build_probe: readOptional(join(resurrectDir, "build-probe.json")),
  intent_signals: readOptional(join(resurrectDir, "INTENT_SIGNALS.json")),
  autopsy_classification: readOptional(join(resurrectDir, "AUTOPSY_CLASSIFICATION.json")),
  citations: readOptional(join(resurrectDir, "CITATIONS.json")),
  evidence_reliability: [
    "running behavior and tests",
    "source code",
    "git and pull-request history",
    "issues and planning documents",
    "README claims",
    "agent inference",
  ],
};

writeJson(join(resurrectDir, "EVIDENCE.json"), evidence);

writeMarkdown(join(resurrectDir, "AUTOPSY.md"), `# Autopsy

## Summary

TBD: Explain why progress appears to have stopped. Cite evidence before inference.

## Build Status

TBD: Summarize .resurrect/build-probe.json.

## First Blocking Failure

TBD

## Secondary Blockers

- TBD

## Likely Recovery Order

1. TBD

## Evidence

- .resurrect/EVIDENCE.json
`);

writeMarkdown(join(resurrectDir, "ORIGINAL_INTENT.md"), `# Original Intent

## Intent Hypothesis

I believe this project was intended to:

TBD

## Core Product

TBD

## Later Scope Additions

TBD

## Owner Questions

1. Is this the product you wanted?
2. What caused you to stop?
3. How much time will you invest now?

## Evidence

- TBD
`);

writeMarkdown(join(resurrectDir, "FEASIBILITY_DELTA.md"), `# Feasibility Delta

## Then

TBD

## Now

TBD

## Blocker Analysis

### Original Blocker: TBD

What changed:

TBD

Evidence:

- TBD

Impact:

TBD

Recommendation:

TBD

## Retrieval Date

${today()}
`);

writeMarkdown(join(resurrectDir, "RESURRECTION_CONTRACT.md"), `# Resurrection Contract

\`\`\`yaml
product:
  user: "TBD"
  outcome: "TBD"

preserve:
  - TBD

remove:
  - TBD

milestone_zero:
  description: "TBD"

definition_of_done:
  - clean installation status is known
  - build or test status is documented
  - one vertical-slice acceptance check is executable
  - unresolved blockers are recorded

time_budget: "${timeBudget}"
verdict: "${verdict}"
branch: "${branch}"

owner_approval:
  approved: false
  approved_by: ""
  approved_at: null
\`\`\`

## Approval

Do not execute until the owner approves this contract and the approval marker is updated or execute mode receives an explicit approval flag.
`);

writeMarkdown(join(resurrectDir, "EXECUTION_PLAN.md"), `# Execution Plan

## Verdict

${verdict}

## Branch

\`${branch}\`

## Milestone Zero

TBD

## Plan

1. Restore environment.
2. Remove rejected scope.
3. Build the vertical slice.
4. Verify and document deployment path.

## Boundaries

- Do not modify the default branch.
- Do not push without explicit approval.
- Do not delete branches.
- Do not expose secrets.
`);

writeMarkdown(join(resurrectDir, "CONTEXT.md"), `# Resurrection Context

## Repository

${repoLabel(root)}

## Product Direction

TBD

## Architecture

TBD

## Decisions

- Verdict: ${verdict}
- Branch: ${branch}

## Constraints

- Do not modify the default branch.
- Preserve evidence in .resurrect/.
- Milestone Zero must remain bounded.

## Completed Work

- Evidence scaffold generated.

## Verification Status

TBD

## Unresolved Blockers

- TBD

## Current Next Step

Fill the TBD sections with evidence-backed reasoning, ask the owner questions, and get contract approval before execution.
`);

writeMarkdown(join(tasksDir, "001-restore-environment.md"), task(
  "Restore Environment",
  "Make installation, build, and test status explicit and repair the earliest local blocker.",
  "No product decision can be trusted until the project's executable state is known.",
  "- package manifests\n- lockfiles\n- CI configuration\n- .resurrect/build-probe.json",
  "- Do not run lifecycle scripts unless approved.\n- Do not introduce a new framework unless the verdict is Rebuild.",
  "- Install/build/test status is recorded.\n- The first blocking failure is fixed or documented with a concrete next action.",
  "- Repository evidence collection.\n- Owner approval before code changes.",
  "- Required credentials or paid external services are unavailable.\n- Build recovery exceeds the approved time budget.",
));

writeMarkdown(join(tasksDir, "002-remove-dead-scope.md"), task(
  "Remove Dead Scope",
  "Delete, disable, or quarantine scope explicitly rejected by the Resurrection Contract.",
  "Resurrection fails when the branch drifts back into the abandoned oversized vision.",
  "- Files named in RESURRECTION_CONTRACT.md\n- Routes, services, schemas, and UI linked to rejected scope",
  "- Remove only contract-rejected scope.\n- Preserve reusable assets named in the contract.",
  "- Rejected scope is no longer part of the Milestone Zero path.\n- Remaining build or test failures are documented.",
  "- Approved Resurrection Contract.",
  "- Scope ownership is ambiguous.\n- Removal risks deleting a distinctive asset.",
));

writeMarkdown(join(tasksDir, "003-build-vertical-slice.md"), task(
  "Build Vertical Slice",
  "Implement the smallest working flow that proves the revived direction.",
  "The outcome is a working comeback branch, not a report.",
  "- Core-loop files identified in ORIGINAL_INTENT.md\n- Task-specific files discovered during implementation",
  "- Build only Milestone Zero.\n- Prefer existing architecture for Revive, isolate reusable component for Salvage, and keep Rebuild minimal.",
  "- A user-visible or CLI-visible vertical slice runs locally.\n- One acceptance check can be repeated by another agent.",
  "- Environment restoration.\n- Approved contract.",
  "- Milestone Zero requires unapproved external services.\n- Required implementation exceeds time budget.",
));

writeMarkdown(join(tasksDir, "004-verify-and-deploy.md"), task(
  "Verify and Deploy",
  "Run verification and document the path to a reviewable or deployable artifact.",
  "A resurrection branch must be ready for review, not merely edited.",
  "- Test files\n- CI config\n- deployment config\n- .resurrect/CONTEXT.md",
  "- Do not deploy publicly without approval.\n- Do not push without approval.",
  "- Verification commands and results are recorded.\n- Remaining blockers are listed in CONTEXT.md.",
  "- Vertical slice implementation.",
  "- Verification depends on missing secrets or unavailable external services.",
));

console.log(`Wrote .resurrect artifacts in ${resurrectDir}`);
