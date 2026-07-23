#!/usr/bin/env -S node --experimental-strip-types
import { commandExists, parseArgs, run, writeJson } from "./lib/common.ts";

type Repo = {
  nameWithOwner: string;
  description?: string;
  isArchived?: boolean;
  isPrivate?: boolean;
  pushedAt?: string;
  updatedAt?: string;
  defaultBranchRef?: { name?: string };
  primaryLanguage?: { name?: string };
  repositoryTopics?: { nodes?: { topic?: { name?: string } }[] };
};

function usage(): void {
  console.log(`Usage: scan-repositories.ts [--owner USER] [--limit 100] [--json PATH] [--include-archived]

Uses the authenticated gh CLI session to shortlist dormant repositories without cloning them.`);
}

function daysSince(dateString?: string): number {
  if (!dateString) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 86_400_000);
}

function productEvidence(repo: Repo): "Strong" | "Moderate" | "Weak" {
  const topics = repo.repositoryTopics?.nodes?.map((node) => node.topic?.name).filter(Boolean) ?? [];
  const hasDescription = Boolean(repo.description && repo.description.trim().length > 20);
  const hasLanguage = Boolean(repo.primaryLanguage?.name);
  if (hasDescription && topics.length >= 2 && hasLanguage) return "Strong";
  if ((hasDescription && hasLanguage) || topics.length >= 1) return "Moderate";
  return "Weak";
}

function scoringReasons(repo: Repo): string[] {
  const dormantDays = daysSince(repo.pushedAt);
  const topics = repo.repositoryTopics?.nodes?.map((node) => node.topic?.name).filter(Boolean) ?? [];
  const reasons: string[] = [];

  if (dormantDays >= 365) reasons.push("dormant for at least one year");
  else if (dormantDays >= 180) reasons.push("dormant for at least six months");
  else if (dormantDays >= 90) reasons.push("dormant for at least three months");
  if (repo.description && repo.description.trim().length > 20) reasons.push("description suggests product intent");
  if (topics.length >= 2) reasons.push(`topic evidence: ${topics.slice(0, 4).join(", ")}`);
  if (repo.primaryLanguage?.name) reasons.push(`working-code hint: ${repo.primaryLanguage.name}`);
  if (repo.isPrivate) reasons.push("private repository likely owned context");
  if (repo.isArchived) reasons.push("archived repository lowers recovery urgency");
  return reasons;
}

function rank(repo: Repo): number {
  const dormantDays = daysSince(repo.pushedAt);
  let score = 0;
  if (dormantDays >= 365) score += 35;
  else if (dormantDays >= 180) score += 25;
  else if (dormantDays >= 90) score += 15;
  if (productEvidence(repo) === "Strong") score += 30;
  if (productEvidence(repo) === "Moderate") score += 15;
  if (repo.primaryLanguage?.name) score += 10;
  if (repo.isPrivate) score += 5;
  if (repo.isArchived) score -= 25;
  return score;
}

function category(repo: ReturnType<typeof repoSummary>): string {
  if (repo.score >= 70 && repo.lastMeaningfulWorkDaysAgo <= 730) return "Most Promising Comeback";
  if (repo.productEvidence === "Strong" && /cli|library|tool|sdk|api/i.test(repo.existingUniqueAsset)) return "Best Salvage Candidate";
  if (repo.lastMeaningfulWorkDaysAgo <= 240 && repo.primaryLanguage !== "Unknown") return "Fastest Weekend Ship";
  if (repo.score <= 20 || repo.lastMeaningfulWorkDaysAgo > 1460) return "Likely Archive";
  return "Hidden Gem";
}

function repoSummary(repo: Repo) {
  return {
    nameWithOwner: repo.nameWithOwner,
    lastMeaningfulWorkDaysAgo: daysSince(repo.pushedAt),
    pushedAt: repo.pushedAt,
    productEvidence: productEvidence(repo),
    workingCode: "Unknown",
    unmergedWork: "Unknown until deep analysis",
    existingUniqueAsset: repo.description ? repo.description : "Unknown",
    primaryLanguage: repo.primaryLanguage?.name ?? "Unknown",
    reasons: scoringReasons(repo),
    score: rank(repo),
  };
}

const { flags } = parseArgs();
if (flags.help) {
  usage();
  process.exit(0);
}

if (!commandExists("gh")) {
  throw new Error("gh CLI is required for account scanning.");
}

const owner = typeof flags.owner === "string"
  ? flags.owner
  : run("gh", ["api", "user", "--jq", ".login"], { timeoutMs: 20_000 }).stdout.trim();
if (!owner) throw new Error("Could not determine authenticated GitHub user. Run `gh auth status`.");

const limit = typeof flags.limit === "string" ? Number(flags.limit) : 100;
const fields = [
  "nameWithOwner",
  "description",
  "isArchived",
  "isPrivate",
  "pushedAt",
  "updatedAt",
  "defaultBranchRef",
  "primaryLanguage",
  "repositoryTopics",
];

const result = run("gh", ["repo", "list", owner, "--limit", String(limit), "--json", fields.join(",")], { timeoutMs: 60_000 });
if (result.status !== 0) throw new Error(result.stderr || result.stdout);

const repos = JSON.parse(result.stdout) as Repo[];
const includeArchived = Boolean(flags["include-archived"]);
const candidates = repos
  .filter((repo) => includeArchived || !repo.isArchived)
  .map(repoSummary)
  .map((repo) => ({ ...repo, category: category(repo) }))
  .filter((repo) => repo.lastMeaningfulWorkDaysAgo >= 90)
  .sort((a, b) => b.score - a.score);

console.log(`Analyzed ${repos.length} repositories.\n`);
console.log("Strongest candidates:\n");
candidates.slice(0, 10).forEach((repo, index) => {
  console.log(`${index + 1}. ${repo.nameWithOwner}`);
  console.log(`   Last meaningful work: ${repo.lastMeaningfulWorkDaysAgo} days ago`);
  console.log(`   Product evidence: ${repo.productEvidence}`);
  console.log(`   Working code: ${repo.workingCode}`);
  console.log(`   Unmerged work: ${repo.unmergedWork}`);
  console.log(`   Existing unique asset: ${repo.existingUniqueAsset}`);
  console.log(`   Category: ${repo.category}`);
  console.log(`   Why shortlisted: ${repo.reasons.length ? repo.reasons.join("; ") : "No strong deterministic reason"}`);
  console.log("");
});

const categoryOrder = ["Most Promising Comeback", "Fastest Weekend Ship", "Best Salvage Candidate", "Hidden Gem", "Likely Archive"];
console.log("Visibility categories:\n");
for (const name of categoryOrder) {
  const match = candidates.find((repo) => repo.category === name);
  if (match) console.log(`- ${name}: ${match.nameWithOwner}`);
}

if (typeof flags.json === "string") {
  writeJson(flags.json, { generated_at: new Date().toISOString(), owner, analyzed: repos.length, candidates });
}
