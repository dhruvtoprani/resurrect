import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { run } from "./common.ts";

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function gitOk(root: string, args: string[]): void {
  const result = run("git", args, { cwd: root, timeoutMs: 30_000 });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
}

export function createDemoRepository(prefix = "resurrect-demo-"): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  write(join(root, "README.md"), `# RepoVision

RepoVision turns a GitHub repository into a shareable visual timeline for developers.

The original weekend milestone was a local CLI that renders one public repository.
`);
  write(join(root, "package.json"), JSON.stringify({
    name: "repovision",
    scripts: {
      build: "node src/index.js",
      test: "node src/index.js",
    },
    dependencies: {},
  }, null, 2));
  write(join(root, "src/index.js"), `// TODO: replace mock repository parser
console.log("repovision ok");
`);
  write(join(root, "src/routes/render.js"), `export function renderTimeline() {
  return "timeline";
}
`);
  write(join(root, "src/render-history.js"), "export const historyRenderer = true;\n");
  write(join(root, "docs/roadmap.md"), `# Roadmap

- GitHub import
- 3D history view
- Share page
`);
  write(join(root, ".env.example"), "GITHUB_TOKEN=\nDATABASE_URL=\n");

  gitOk(root, ["init"]);
  gitOk(root, ["config", "user.name", "Resurrect Demo"]);
  gitOk(root, ["config", "user.email", "resurrect@example.com"]);
  gitOk(root, ["add", "."]);
  gitOk(root, ["commit", "-m", "initial product direction"]);
  gitOk(root, ["switch", "-c", "feature/render-history"]);
  write(join(root, "src/preview.js"), "export const preview = 'visual timeline';\n");
  gitOk(root, ["add", "."]);
  gitOk(root, ["commit", "-m", "add render history prototype"]);
  gitOk(root, ["switch", "main"]);

  return root;
}
