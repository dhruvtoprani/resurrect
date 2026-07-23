# Evidence Hierarchy

Use this hierarchy whenever writing AUTOPSY, ORIGINAL_INTENT, FEASIBILITY_DELTA, EXECUTION_PLAN, or CONTEXT.

## Reliability Ranking

1. Running behavior and tests.
2. Source code.
3. Git and pull-request history.
4. Issues and planning documents.
5. README claims.
6. Agent inference.

## Citation Format

Prefer concrete citations:

- Source file: `src/app.ts:42`
- Git commit: `abc1234 "message" 2024-01-10`
- Branch: `feature/render-history`
- Pull request: `PR #12`
- Issue: `Issue #7`
- Build probe: `.resurrect/build-probe.json`
- External research: `Source title, URL, retrieved YYYY-MM-DD`

## Required Distinctions

- Label factual evidence as `Evidence`.
- Label interpretation as `Inference`.
- Label missing context as `Unknown`.
- Label owner-supplied answers as `Owner input`.

Do not convert evidence into percentages. Use separate dimensions such as product clarity, core-loop implementation, technical recoverability, distinctive assets, present-day relevance, and weekend shipability.

## Minimum Evidence Set

Before writing a verdict, collect or explicitly mark unavailable:

- README and docs.
- Package manifests and lockfiles.
- Git branches and recent commit history.
- TODO/FIXME/HACK/placeholders.
- Tests and CI.
- Deployment files.
- Environment examples.
- Issues and pull requests when GitHub access is available.
- Build probe result.
