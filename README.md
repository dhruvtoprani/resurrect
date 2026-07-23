# resurrect

Your next product may already be half-built.

`resurrect` is an agent skill and local CLI for turning abandoned software repositories into evidence-backed product decisions and safe comeback branches. It does not stop at a report. It reconstructs intent, diagnoses why the project stalled, compares what changed, writes a Resurrection Contract, and prepares a branch for Milestone Zero.

```bash
npm install -g github:dhruvtoprani/resurrect
resurrect demo
```

```text
Before: missing external service or secret
Decision: Revive
After: resurrect/2026-07-23-milestone-zero
Proof: build/test probe passes
```

## Why This Exists

Every developer has old repositories with a working half, a broken half, and a forgotten reason they stopped. Asking an agent to "look through this and tell me how to finish it" often wastes tokens in the wrong direction.

`resurrect` forces a better workflow:

- ask clarifying questions before deep analysis
- rank repository evidence before inference
- probe the build before planning
- identify the Feasibility Delta: what is easier now than when the project died
- choose exactly one verdict: Revive, Rebuild, Salvage, or Archive
- require owner approval before execution
- create a resurrection branch and proof artifacts

## Install

Requires Node.js 22 or newer.

Install from GitHub:

```bash
npm install -g github:dhruvtoprani/resurrect
resurrect demo
```

The package is also prepared for npm as `@dhruvtoprani/resurrect`; publish it with `npm publish --access public` from an authenticated npm account.

For Codex, copy this repository as a skill folder named `resurrect` under your Codex skills directory. Then invoke it as `$resurrect`.

For Claude Code, expose the same folder as `/resurrect`.

## Quick Start

Scan your GitHub account for candidates:

```bash
resurrect scan
```

Start with a specific project:

```bash
resurrect path/to/old-project
```

The default path is intentionally intake-first. It asks:

1. What outcome do you want: ship the original idea, salvage one asset, modernize the stack, or decide whether to archive?
2. What do you remember as the reason you stopped?
3. What time budget should constrain Milestone Zero?

After answering:

```bash
resurrect path/to/old-project --confirmed
```

Approve the contract, then execute:

```bash
resurrect execute
```

## What It Produces

```text
repository-root/
├── RESURRECTION.md
└── .resurrect/
    ├── EVIDENCE.json
    ├── INTENT_SIGNALS.json
    ├── AUTOPSY_CLASSIFICATION.json
    ├── CITATIONS.md
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

`RESURRECTION.md` is the public story for humans. `.resurrect/` is the evidence archive for agents.

## Verdicts

- **Revive**: the product direction and architecture still make sense.
- **Rebuild**: the idea is good, but the old implementation should mostly go.
- **Salvage**: the full product should die, but one component deserves to live.
- **Archive**: no valuable outcome justifies more work.

The tool does not invent fake completion percentages. It scores separate dimensions like product clarity, technical recoverability, distinctive assets, present-day relevance, and weekend shipability.

## Safety Model

`resurrect` is local-first and deliberately conservative.

- Never modifies the default branch during diagnosis.
- Never pushes without approval.
- Never deletes branches.
- Redacts likely secrets from command output.
- Blocks execution until the Resurrection Contract is approved.
- Blocks dependency lifecycle scripts unless explicitly allowed.
- Keeps generated evidence in `.resurrect/`.

## Commands

```bash
resurrect demo
resurrect scan
resurrect <project>
resurrect <project> --confirmed
resurrect execute
resurrect pr-summary
```

## Development

```bash
npm test
```

The test suite creates a synthetic abandoned repository, verifies the intake gate, runs analysis, checks generated artifacts, confirms execution blocks before approval, approves the contract, creates a resurrection branch, and verifies public output.

## Agent Skill

The core skill lives in `SKILL.md`. Codex and Claude Code can use the same workflow:

- Codex trigger: `$resurrect`
- Claude Code trigger: `/resurrect`

The CLI scripts are deterministic helpers. The agent still owns judgment, product reasoning, external research, and Milestone Zero implementation.

## License

MIT
