# Verdict Rubric

Choose exactly one primary verdict.

## Revive

Use when the existing architecture and product direction remain useful.

Signals:

- Core loop is present or close.
- Existing code has distinctive value.
- Build failures are repairable.
- Original product is still relevant.
- Milestone Zero can be reached without replacing most of the system.

## Rebuild

Use when the idea remains useful but keeping most implementation is more expensive than starting over.

Signals:

- Original blocker is gone, but old architecture encodes obsolete assumptions.
- Dependencies, runtime, or framework choices impose broad migration cost.
- Product clarity is strong but code reuse is weak.
- A clean vertical slice would be faster than repair.

## Salvage

Use when the complete product should die, but one component should live as a smaller product, library, API, dataset, CLI, demo, or open-source tool.

Signals:

- One subsystem is distinctive or nearly working.
- The full app is over-scoped or irrelevant.
- A narrower audience can use the asset.
- Milestone Zero should isolate the useful component.

## Archive

Use when no sufficiently valuable outcome justifies further work.

Signals:

- No clear user, outcome, or distinctive asset.
- Platform or competitor changes absorbed the product.
- Build recovery would exceed the user's time budget.
- Legal, licensing, data, or external dependency blockers dominate.

## Required Dimensions

Score qualitatively with `Strong`, `Moderate`, `Weak`, `Unknown`, or `Not applicable`:

- Product clarity.
- Core-loop implementation.
- Technical recoverability.
- Distinctive assets.
- Present-day relevance.
- Weekend shipability.

Do not claim a repository is a numeric percent complete.
