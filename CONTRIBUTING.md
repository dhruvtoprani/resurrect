# Contributing

`resurrect` should stay evidence-first, local-first, and safe by default.

## Development

```bash
npm test
```

Add or update fixture coverage when changing:

- intake behavior
- build probing
- intent inference
- autopsy classification
- execution approval
- generated public artifacts

## Design Rules

- Do not add hosted services to the core workflow.
- Do not push, delete branches, or run dependency lifecycle scripts without explicit approval.
- Do not replace qualitative verdicts with fake completion percentages.
- Keep generated artifacts readable by both humans and coding agents.

## Pull Requests

Include:

- what changed
- why it matters
- validation performed
- any safety implications
