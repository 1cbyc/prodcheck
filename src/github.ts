import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runGit } from "./shell.js";
import type { GitHubFacts, GitHubRun } from "./types.js";

const execFileAsync = promisify(execFile);

export async function collectGitHubFacts(root: string): Promise<GitHubFacts> {
  const ghVersion = await runGh(["--version"], root);
  if (ghVersion.exitCode !== 0) {
    return {
      enabled: true,
      available: false,
      note: "GitHub readback requested, but the gh CLI is unavailable or not authenticated."
    };
  }

  const repository = await getRepository(root);
  if (repository === undefined) {
    return {
      enabled: true,
      available: true,
      note: "GitHub readback requested, but no GitHub origin remote was detected."
    };
  }

  const currentSha = (await runGit(["rev-parse", "HEAD"], root)).stdout.trim();
  const branch = (await runGit(["branch", "--show-current"], root)).stdout.trim();
  const runResult = await runGh([
    "run",
    "list",
    "--repo",
    repository,
    "--branch",
    branch,
    "--limit",
    "1",
    "--json",
    "databaseId,name,status,conclusion,event,headBranch,url"
  ], root);

  const facts: GitHubFacts = {
    enabled: true,
    available: true,
    repository,
    currentSha
  };

  const latestRun = parseLatestRun(runResult.stdout);
  if (latestRun !== undefined) {
    return { ...facts, latestRun };
  }

  if (runResult.exitCode !== 0) {
    return { ...facts, note: runResult.stderr || "Could not read GitHub Actions runs." };
  }

  return facts;
}

async function getRepository(root: string): Promise<string | undefined> {
  const remote = await runGit(["remote", "get-url", "origin"], root);
  if (remote.exitCode !== 0) return undefined;

  const value = remote.stdout.trim();
  const httpsMatch = value.match(/^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (httpsMatch?.[1] !== undefined) return httpsMatch[1];

  const sshMatch = value.match(/^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/);
  return sshMatch?.[1];
}

interface GhOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

async function runGh(args: readonly string[], cwd: string): Promise<GhOutput> {
  try {
    const { stdout, stderr } = await execFileAsync("gh", [...args], {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const maybe = error as Error & { readonly stdout?: unknown; readonly stderr?: unknown; readonly code?: unknown };
      return {
        stdout: String(maybe.stdout ?? ""),
        stderr: String(maybe.stderr ?? maybe.message),
        exitCode: typeof maybe.code === "number" ? maybe.code : 1
      };
    }

    throw error;
  }
}

function parseLatestRun(value: string): GitHubRun | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    const [first] = parsed;
    if (!isGitHubRun(first)) return undefined;
    return first;
  } catch {
    return undefined;
  }
}

function isGitHubRun(value: unknown): value is GitHubRun {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.databaseId === "number"
    && typeof record.name === "string"
    && typeof record.status === "string"
    && typeof record.conclusion === "string"
    && typeof record.event === "string"
    && typeof record.headBranch === "string"
    && typeof record.url === "string";
}
