import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { listRepoFiles } from "./fs.js";
import { runGit } from "./shell.js";
import type { ProjectCommand, RepoFacts, RiskCategory, ScriptKind } from "./types.js";

const SCRIPT_NAMES = {
  test: ["test"],
  lint: ["lint"],
  typecheck: ["typecheck", "types"],
  build: ["build"],
  check: ["check", "ci"]
} as const satisfies Record<ScriptKind, readonly string[]>;

export async function collectRepoFacts(root: string, baseRef: string): Promise<RepoFacts> {
  const repoRoot = await getRepoRoot(root);
  const files = await listRepoFiles(repoRoot);
  const changedFiles = await getChangedFiles(repoRoot, baseRef);

  return {
    root: repoRoot,
    branch: await getBranch(repoRoot),
    statusLines: await getStatus(repoRoot),
    baseRef,
    changedFiles,
    packageManagers: detectPackageManagers(files),
    languages: detectLanguages(files),
    commands: await detectCommands(repoRoot, files),
    ciFiles: files.filter(isCiFile),
    deploymentFiles: files.filter(isDeploymentFile),
    envFiles: files.filter(isEnvSurface),
    migrationFiles: files.filter(isMigrationFile),
    riskCategories: detectRiskCategories(changedFiles)
  };
}

async function getRepoRoot(cwd: string): Promise<string> {
  const result = await runGit(["rev-parse", "--show-toplevel"], cwd);
  if (result.exitCode !== 0) {
    throw new Error("prodcheck must be run inside a git repository.");
  }

  return result.stdout.trim();
}

async function getBranch(root: string): Promise<string> {
  const result = await runGit(["branch", "--show-current"], root);
  return result.stdout.trim() || "detached HEAD";
}

async function getStatus(root: string): Promise<readonly string[]> {
  const result = await runGit(["status", "--short"], root);
  return lines(result.stdout);
}

async function getChangedFiles(root: string, baseRef: string): Promise<readonly string[]> {
  const hasHead = await runGit(["rev-parse", "--verify", "HEAD"], root);
  if (hasHead.exitCode !== 0) {
    const tracked = await runGit(["ls-files"], root);
    const untracked = await runGit(["ls-files", "--others", "--exclude-standard"], root);
    return unique([...lines(tracked.stdout), ...lines(untracked.stdout)]);
  }

  const mergeBase = await runGit(["merge-base", "HEAD", baseRef], root);
  const diffBase = mergeBase.exitCode === 0 ? mergeBase.stdout.trim() : baseRef;
  const result = await runGit(["diff", "--name-only", `${diffBase}...HEAD`], root);

  if (result.exitCode === 0 && result.stdout.trim().length > 0) {
    return lines(result.stdout);
  }

  const stagedAndUnstaged = await runGit(["diff", "--name-only", "HEAD"], root);
  const staged = await runGit(["diff", "--name-only", "--cached"], root);
  const untracked = await runGit(["ls-files", "--others", "--exclude-standard"], root);

  return unique([...lines(stagedAndUnstaged.stdout), ...lines(staged.stdout), ...lines(untracked.stdout)]);
}

function detectPackageManagers(files: readonly string[]): readonly string[] {
  const managers: string[] = [];
  if (files.includes("package-lock.json")) managers.push("npm");
  if (files.includes("pnpm-lock.yaml")) managers.push("pnpm");
  if (files.includes("yarn.lock")) managers.push("yarn");
  if (files.includes("bun.lockb") || files.includes("bun.lock")) managers.push("bun");
  if (files.includes("poetry.lock")) managers.push("poetry");
  if (files.includes("uv.lock")) managers.push("uv");
  if (files.includes("Pipfile.lock")) managers.push("pipenv");
  return managers.length > 0 ? managers : ["not detected"];
}

function detectLanguages(files: readonly string[]): readonly string[] {
  const languages = new Set<string>();
  for (const file of files) {
    if (file.endsWith(".ts") || file.endsWith(".tsx")) languages.add("TypeScript");
    if (file.endsWith(".js") || file.endsWith(".jsx") || file.endsWith(".mjs") || file.endsWith(".cjs")) languages.add("JavaScript");
    if (file.endsWith(".py")) languages.add("Python");
    if (file.endsWith(".go")) languages.add("Go");
    if (file.endsWith(".rs")) languages.add("Rust");
    if (file.endsWith(".rb")) languages.add("Ruby");
  }
  return [...languages].sort();
}

async function detectCommands(root: string, files: readonly string[]): Promise<readonly ProjectCommand[]> {
  const commands: ProjectCommand[] = [];

  if (files.includes("package.json")) {
    const packageJson = await readJson(join(root, "package.json"));
    const scripts = readScripts(packageJson);
    const manager = detectPackageManagers(files)[0] ?? "npm";
    const runner = manager === "pnpm" ? "pnpm" : manager === "yarn" ? "yarn" : manager === "bun" ? "bun" : "npm run";

    for (const [kind, names] of Object.entries(SCRIPT_NAMES) as Array<[ScriptKind, readonly string[]]>) {
      const scriptName = names.find((name) => Object.hasOwn(scripts, name));
      if (scriptName !== undefined) {
        commands.push({
          kind,
          command: runner === "npm run" ? `npm run ${scriptName}` : `${runner} ${scriptName}`,
          source: "package.json"
        });
      }
    }
  }

  if (files.includes("Makefile")) {
    const makefile = await readFile(join(root, "Makefile"), "utf8");
    for (const kind of Object.keys(SCRIPT_NAMES) as ScriptKind[]) {
      if (new RegExp(`^${kind}:`, "m").test(makefile)) {
        commands.push({ kind, command: `make ${kind}`, source: "Makefile" });
      }
    }
  }

  if (files.includes("pyproject.toml")) {
    commands.push({ kind: "test", command: "python -m pytest", source: "pyproject.toml" });
  } else if (files.includes("requirements.txt")) {
    commands.push({ kind: "test", command: "python -m pytest", source: "requirements.txt" });
  }

  return dedupeCommands(commands);
}

function isCiFile(file: string): boolean {
  return file.startsWith(".github/workflows/") || file.startsWith(".gitlab-ci") || file === "circle.yml" || file.startsWith(".circleci/");
}

function isDeploymentFile(file: string): boolean {
  return /(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml|fly\.toml|render\.ya?ml|vercel\.json|netlify\.toml|wrangler\.toml|Procfile|k8s|helm|terraform|infra)/i.test(file);
}

function isEnvSurface(file: string): boolean {
  return /(^|\/)\.env($|\.|\/)|env\.example$|\.env\.example$|(^|\/)(app|runtime|service|settings|secrets)\.config\.(json|ya?ml|toml)$/i.test(file);
}

function isMigrationFile(file: string): boolean {
  return /(^|\/)(migrations?|schema|prisma|alembic|db\/migrate)(\/|$)/i.test(file);
}

function detectRiskCategories(files: readonly string[]): readonly RiskCategory[] {
  const categories = new Set<RiskCategory>();
  const rules: ReadonlyArray<readonly [RiskCategory, RegExp]> = [
    ["auth", /auth|login|session|oauth|jwt|permission|rbac/i],
    ["billing", /billing|checkout|subscription|invoice|payment|stripe|polar/i],
    ["webhooks", /webhook|callback/i],
    ["migrations", /migration|alembic|prisma|schema\.sql|db\/migrate/i],
    ["deployment", /Dockerfile|docker-compose|deploy|infra|terraform|k8s|helm|vercel|render|fly\.toml|wrangler/i],
    ["secrets", /\.env|secret|token|credential|private[_-]?key/i],
    ["routing", /routes?|router|middleware|app\/.*page|pages\/|api\//i],
    ["dependencies", /package-lock|pnpm-lock|yarn\.lock|bun\.lock|requirements|poetry\.lock|go\.sum|Cargo\.lock/i],
    ["database", /database|db\/|models?|repository|sql/i],
    ["ci", /\.github\/workflows|gitlab-ci|circleci/i],
    ["frontend", /src\/.*\.(tsx|jsx)|app\/.*\.(tsx|jsx)|pages\/.*\.(tsx|jsx)|components\/.*\.(tsx|jsx)/i],
    ["backend", /server|api\/|controllers?|services?|workers?|jobs?/i]
  ];

  for (const file of files) {
    for (const [category, pattern] of rules) {
      if (pattern.test(file)) categories.add(category);
    }
  }

  return [...categories].sort();
}

function readScripts(value: unknown): Record<string, string> {
  if (!isRecord(value) || !isRecord(value.scripts)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function lines(value: string): readonly string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function dedupeCommands(commands: readonly ProjectCommand[]): readonly ProjectCommand[] {
  const seen = new Set<string>();
  return commands.filter((command) => {
    const key = `${command.kind}:${command.command}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
