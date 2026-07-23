# Output Schemas

## EVIDENCE.json

```json
{
  "generated_at": "ISO-8601 timestamp",
  "repository": {
    "root": "path",
    "name_with_owner": "owner/repo or unknown",
    "default_branch": "main"
  },
  "github": {},
  "git": {},
  "unfinished_work": {},
  "build_probe": {},
  "intent_signals": {},
  "autopsy_classification": {},
  "evidence_reliability": [
    "running behavior and tests",
    "source code",
    "git and pull-request history",
    "issues and planning documents",
    "README claims",
    "agent inference"
  ]
}
```

## INTENT_SIGNALS.json

```json
{
  "generated_at": "ISO-8601 timestamp",
  "hypothesis": "draft intent hypothesis",
  "confidence": "Moderate | Low | Unknown",
  "signals": [
    {
      "source": "README.md",
      "reliability": "README claim",
      "text": "signal text"
    }
  ],
  "open_questions": []
}
```

## AUTOPSY_CLASSIFICATION.json

```json
{
  "generated_at": "ISO-8601 timestamp",
  "build_status": "passed | failed | unknown",
  "first_blocking_failure": null,
  "classifications": [
    {
      "label": "dependency-rot-or-missing-install",
      "severity": "high | medium | low",
      "evidence": [],
      "recovery": ""
    }
  ],
  "likely_recovery_order": []
}
```

## CITATIONS.json

```json
{
  "generated_at": "ISO-8601 timestamp",
  "citations": [
    {
      "id": "R001",
      "type": "source code",
      "source": "src/index.ts:12",
      "claim": "TODO indicates unfinished parser"
    }
  ]
}
```

## Public Artifacts

`generate-public-assets.ts` writes:

- `RESURRECTION.md`: public story for repository visitors and PR reviewers.
- `.resurrect/PR_SUMMARY.md`: copy-pasteable pull request body.
- `.resurrect/SHARE.md`: short launch or social snippet.
- `.resurrect/badges/verdict.svg`
- `.resurrect/badges/milestone-zero.svg`
- `.resurrect/badges/branch.svg`

`RESURRECTION.md` should contain:

- Before.
- Decision.
- After.
- Proof.
- Intent Hypothesis.
- What Changed.
- Next Step.

## Resurrection Contract

```yaml
product:
  user: ""
  outcome: ""

preserve: []
remove: []

milestone_zero:
  description: ""

definition_of_done: []

time_budget: ""
verdict: "Revive | Rebuild | Salvage | Archive"
branch: "resurrect/YYYY-MM-DD-direction"
owner_approval:
  approved: false
  approved_by: ""
  approved_at: null
```

## Task Files

Each task file must include:

- Objective.
- Why it matters.
- Relevant files.
- Implementation boundaries.
- Acceptance checks.
- Dependencies.
- Stop conditions.

## Context File

`CONTEXT.md` must be optimized for a future coding-agent session:

- Product direction.
- Architecture.
- Decisions.
- Constraints.
- Completed work.
- Current next step.
- Verification status.
- Unresolved blockers.
