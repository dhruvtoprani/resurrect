# Security

`resurrect` analyzes local repositories and can run build probes. Treat unknown repositories as untrusted code.

## Reporting

Open a private security advisory on GitHub if available, or contact the maintainer directly.

## Safety Defaults

- Build probes do not install dependencies unless requested.
- Install probes use `--ignore-scripts` unless lifecycle scripts are explicitly allowed.
- Likely tokens and secrets are redacted from captured command output.
- Execution requires approval through the Resurrection Contract or an explicit flag.
- The tool never pushes by itself.

## Responsible Use

Review generated evidence before sharing it. `.resurrect/` can include file paths, issue titles, branch names, and other repository metadata.
