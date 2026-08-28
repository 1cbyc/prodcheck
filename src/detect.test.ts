import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { collectRepoFacts } from "./detect.js";

const execFileAsync = promisify(execFile);

test("deployment detection ignores content that only mentions infrastructure", async () => {
  const root = await createGitRepo();
  await mkdir(join(root, "content", "blog"), { recursive: true });
  await writeFile(join(root, "content", "blog", "infrastructure-as-code.md"), "# Infrastructure\n", "utf8");
  await writeFile(join(root, "vercel.json"), "{}\n", "utf8");

  const facts = await collectRepoFacts(root, "main");

  assert.deepEqual(facts.deploymentFiles, ["vercel.json"]);
});

test("cli can write markdown and json reports", async () => {
  const root = await createGitRepo();
  await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }, null, 2), "utf8");

  const markdownPath = join(root, "readiness-report.md");
  const jsonPath = join(root, "readiness-report.json");
  await execFileAsync("node", [
    join(process.cwd(), "dist", "cli.js"),
    "audit",
    "--output",
    markdownPath,
    "--json-output",
    jsonPath
  ], { cwd: root });

  const markdown = await readFile(markdownPath, "utf8");
  const json = JSON.parse(await readFile(jsonPath, "utf8")) as unknown;

  assert.match(markdown, /# Production Readiness Report/);
  assert.ok(isRecord(json));
  assert.ok(isRecord(json.summary));
  assert.equal(json.summary.status, "ready_with_caveats");
});

test("repo-root config is used when auditing from a subdirectory", async () => {
  const root = await createGitRepo();
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "prodcheck.config.json"), JSON.stringify({
    riskRules: [{
      category: "backend",
      severity: "high",
      title: "Worker changed",
      why: "Workers process production jobs.",
      pattern: "^src/worker"
    }]
  }), "utf8");
  await writeFile(join(root, "src", "worker.ts"), "export {}\n", "utf8");

  const facts = await collectRepoFacts(join(root, "src"), "main");

  assert.equal(facts.config.riskRules?.[0]?.title, "Worker changed");
  assert.ok(facts.riskFindings.some((finding) => finding.title === "Worker changed"));
});

async function createGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "prodcheck-test-"));
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["branch", "-m", "main"], { cwd: root });
  return root;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
