#!/usr/bin/env -S node --experimental-strip-types
import { run } from "./lib/common.ts";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDemoRepository } from "./lib/fixture.ts";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function nodeScript(root: string, script: string, args: string[] = []): ReturnType<typeof run> {
  return run("node", ["--experimental-strip-types", join(import.meta.dirname, script), ...args], { cwd: root, timeoutMs: 180_000 });
}

const root = createDemoRepository("resurrect-fixture-");
try {
  const intake = nodeScript(root, "resurrect.ts", [root]);
  assert(intake.status === 0, intake.stderr || intake.stdout);
  assert(intake.stdout.includes("Answer these before deep analysis"), "intake did not ask clarifying questions");
  assert(!intake.stdout.includes("Wrote .resurrect"), "intake should not run deep analysis");

  const analyze = nodeScript(root, "resurrect.ts", [root, "--confirmed"]);
  assert(analyze.status === 0, analyze.stderr || analyze.stdout);
  for (const file of [
    ".resurrect/EVIDENCE.json",
    ".resurrect/INTENT_SIGNALS.json",
    ".resurrect/AUTOPSY_CLASSIFICATION.json",
    ".resurrect/CITATIONS.md",
    ".resurrect/PR_SUMMARY.md",
    ".resurrect/SHARE.md",
    ".resurrect/badges/verdict.svg",
    ".resurrect/badges/milestone-zero.svg",
    ".resurrect/ORIGINAL_INTENT.md",
    ".resurrect/AUTOPSY.md",
    ".resurrect/tasks/003-build-vertical-slice.md",
    "RESURRECTION.md",
  ]) {
    assert(readFileSync(join(root, file), "utf8").length > 0, `${file} was not generated`);
  }

  const prSummary = nodeScript(root, "resurrect.ts", ["pr-summary"]);
  assert(prSummary.status === 0, prSummary.stderr || prSummary.stdout);
  assert(prSummary.stdout.includes("Resurrection Summary"), "pr-summary did not print a PR summary");

  const blocked = nodeScript(root, "resurrect.ts", ["execute"]);
  assert(blocked.status !== 0, "execute should block before approval");
  assert(blocked.stderr.includes("Execution is blocked"), "execute block message was not clear");

  const contractPath = join(root, ".resurrect", "RESURRECTION_CONTRACT.md");
  const approvedContract = readFileSync(contractPath, "utf8").replace("approved: false", "approved: true");
  writeFileSync(contractPath, approvedContract, "utf8");

  const execute = nodeScript(root, "resurrect.ts", ["execute"]);
  assert(execute.status === 0, execute.stderr || execute.stdout);
  assert(execute.stdout.includes("Execution branch created"), "execute did not create branch");
  assert(readFileSync(join(root, ".resurrect", "EXECUTION_SESSION.md"), "utf8").includes("Execution Session"), "execution session missing");
  assert(readFileSync(join(root, "RESURRECTION.md"), "utf8").includes("Resurrection Report"), "public resurrection report missing");
  const branch = run("git", ["branch", "--show-current"], { cwd: root }).stdout.trim();
  assert(branch.startsWith("resurrect/"), `unexpected branch: ${branch}`);

  console.log("All resurrect fixture tests passed.");
} finally {
  if (process.env.RESURRECT_KEEP_TEST_REPO !== "1") {
    rmSync(root, { recursive: true, force: true });
  } else {
    console.log(`Kept fixture repo: ${root}`);
  }
}
