---
name: resurrect
description: Recover dormant, abandoned, or unfinished software repositories into evidence-backed product decisions and safe comeback branches. Use when the user invokes $resurrect or /resurrect, runs resurrect with a project name, asks to revive an old repo, scan their GitHub account for unfinished projects, reconstruct original intent, diagnose why a project stalled, compare what changed since then, produce a Resurrection Contract, or execute a bounded Milestone Zero in a repository.
---

# Resurrect

Turn an abandoned repository into a clear verdict and, with approval, a working resurrection branch. Evidence comes before inference; execution proves the decision.

## Commands

- `resurrect scan`: shortlist dormant repositories owned by the authenticated GitHub user.
- `resurrect demo`: run a 60-second local demo against a bundled synthetic abandoned repository.
- `resurrect <project-name>`: resolve the target and perform an intake gate before deep analysis.
- `resurrect <project-name> --confirmed`: run the local evidence collection and artifact scaffold after intake answers are available.
- `resurrect` from inside a repository: perform an intake gate for the current repository.
- `resurrect execute`: after explicit user approval, create a resurrection branch and attempt Milestone Zero.
- `resurrect pr-summary`: print a PR-ready summary from the latest `.resurrect/` evidence.

Use the scripts in `scripts/` for deterministic collection and artifact scaffolding. Run them with Node 22+:

```bash
node --experimental-strip-types scripts/resurrect.ts my-old-project
node --experimental-strip-types scripts/resurrect.ts demo
node --experimental-strip-types scripts/scan-repositories.ts
node --experimental-strip-types scripts/collect-github-evidence.ts owner/repo
node --experimental-strip-types scripts/inspect-git-history.ts
node --experimental-strip-types scripts/detect-unfinished-work.ts
node --experimental-strip-types scripts/run-build-probe.ts
node --experimental-strip-types scripts/write-artifacts.ts
node --experimental-strip-types scripts/infer-intent.ts
node --experimental-strip-types scripts/classify-autopsy.ts
node --experimental-strip-types scripts/build-citations.ts
node --experimental-strip-types scripts/generate-public-assets.ts
```

## Intake Gate

When the user names a project directly, do not immediately run the full workflow. First resolve the target and ask no more than three clarifying questions:

1. What outcome do you want from this resurrection: ship the original idea, salvage one asset, modernize the stack, or decide whether to archive?
2. What do you remember as the reason you stopped, if anything?
3. What time budget should constrain Milestone Zero?

Before asking, gather only cheap targeting context: local path, GitHub `owner/repo`, current branch, default branch, remote URL, README title, and package/runtime hints. Do not install dependencies, run tests, research the market, create branches, or edit files until the owner answers or explicitly says to proceed.

After the owner answers, restate the intended direction in one short paragraph and proceed with evidence collection. If the user says "just decide" or gives no memory, continue, but mark missing answers as `Unknown` rather than inventing them.

## Workflow

1. **Pass the intake gate**: resolve the project and ask the three clarifying questions before spending heavy tool or reasoning budget.
2. **Collect evidence**: repository tree, README/docs, package manifests, git history, deleted files, non-default branches, PRs, issues, TODO/FIXME/HACK comments, tests, CI, deploy config, env examples, schemas, screenshots, and demo assets.
3. **Probe the build**: determine whether dependencies install, the project compiles, tests run, and the app launches. Do not modify the default branch during diagnosis. Prefer read-only checks first.
4. **Infer intent signals**: run `infer-intent.ts` to create `INTENT_SIGNALS.json` and a draft `ORIGINAL_INTENT.md`; then improve it with owner input and citations.
5. **Classify the autopsy**: run `classify-autopsy.ts` to label likely stall causes such as dependency rot, missing services, unfinished clusters, abandoned branches, or stale deployment.
6. **Build citation IDs**: run `build-citations.ts` so findings can cite stable IDs from `CITATIONS.md`.
7. **Generate public artifacts**: run `generate-public-assets.ts` to write `RESURRECTION.md`, PR summary, share snippet, and badges that make the result easy to review and share.
8. **Analyze the Feasibility Delta**: research only unresolved blockers and meaningful current changes. Cite every external claim with source and retrieval date.
9. **Choose one verdict**: `Revive`, `Rebuild`, `Salvage`, or `Archive`. Do not use unsupported completion percentages.
10. **Write the Resurrection Contract**: preserve/remove lists, Milestone Zero, definition of done, time budget, boundaries, and owner approval status.
11. **Execute only after approval**: create `resurrect/<date>-<direction>`, refresh the build probe, refresh public artifacts, write `EXECUTION_SESSION.md` and `READY_DIFF.md`, repair the environment, remove rejected scope, implement the vertical slice, verify, and record blockers.

## Evidence Rules

Rank evidence in this order:

1. Running behavior and tests.
2. Source code.
3. Git and pull-request history.
4. Issues and planning documents.
5. README claims.
6. Agent inference.

Every major conclusion must cite local or GitHub evidence. Read `references/evidence-hierarchy.md` before writing findings, `references/verdict-rubric.md` before choosing a verdict, `references/feasibility-research.md` before external research, and `references/output-schemas.md` before finalizing artifacts.

## Safety Rules

- Never modify the default branch.
- Never push without explicit approval.
- Never delete branches.
- Never expose secrets; redact values from environment files and logs.
- Never execute dependency lifecycle scripts unless they are shown to the user and explicitly allowed.
- Run recovery work in a new branch, temporary clone, or worktree.
- Require an explicit approval marker or equivalent owner confirmation before execute mode.
- Check licenses before recommending reuse of code the user does not own.
- Distinguish facts from inference in every artifact.

## Required Outputs

Create these outputs in the analyzed repository:

```text
repository-root/
├── RESURRECTION.md
└── .resurrect/
    ├── EVIDENCE.json
    ├── INTENT_SIGNALS.json
    ├── AUTOPSY_CLASSIFICATION.json
    ├── CITATIONS.md
    ├── CITATIONS.json
    ├── AUTOPSY.md
    ├── ORIGINAL_INTENT.md
    ├── FEASIBILITY_DELTA.md
    ├── RESURRECTION_CONTRACT.md
    ├── EXECUTION_PLAN.md
    ├── CONTEXT.md
    ├── PR_SUMMARY.md
    ├── SHARE.md
    ├── badges/
    │   ├── verdict.svg
    │   ├── milestone-zero.svg
    │   └── branch.svg
    └── tasks/
        ├── 001-restore-environment.md
        ├── 002-remove-dead-scope.md
        ├── 003-build-vertical-slice.md
        └── 004-verify-and-deploy.md
```

Use `scripts/write-artifacts.ts` to create the skeleton, then replace placeholders with evidence-backed reasoning. `CONTEXT.md` is for future coding-agent sessions and must include current next step.

`RESURRECTION.md` is the public, human-readable story intended for commits, PRs, README screenshots, and sharing. Keep it concise: Before, Decision, After, Proof, Intent Hypothesis, What Changed, Next Step.

## Execution Standard

Milestone Zero is not the whole product. It is the smallest vertical slice proving the project can live again. `resurrect execute` must refuse unapproved work, create a resurrection branch, carry `.resurrect/` context safely, refresh verification, and leave a ready-to-review branch session. The branch is successful when installation/build/test status is known, the contract is honored, at least one acceptance check is executable, and unresolved blockers are recorded.

## Validation

Run the fixture test before shipping changes to this skill:

```bash
node --experimental-strip-types scripts/test-resurrect.ts
```

The test creates a temporary abandoned repository fixture and verifies intake, confirmed analysis, intent/autopsy generation, approval blocking, and branch creation.
