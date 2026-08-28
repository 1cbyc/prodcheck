import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileExists } from "./fs.js";
import type { ConfigRiskRule, ProdcheckConfig, ProjectCommand, RiskCategory, ScriptKind, Severity } from "./types.js";

const CONFIG_NAMES = ["prodcheck.config.json", ".prodcheck.json"] as const;
const SCRIPT_KINDS = new Set<ScriptKind>(["test", "lint", "typecheck", "build", "check"]);
const RISK_CATEGORIES = new Set<RiskCategory>([
  "auth",
  "billing",
  "webhooks",
  "migrations",
  "deployment",
  "secrets",
  "routing",
  "dependencies",
  "database",
  "ci",
  "frontend",
  "backend"
]);
const SEVERITIES = new Set<Severity>(["critical", "high", "medium", "low"]);

export async function loadConfig(root: string, configPath: string | undefined): Promise<ProdcheckConfig> {
  const path = configPath === undefined ? await findConfig(root) : resolve(root, configPath);
  if (path === undefined) return {};

  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  return parseConfig(parsed, path);
}

async function findConfig(root: string): Promise<string | undefined> {
  for (const name of CONFIG_NAMES) {
    const path = join(root, name);
    if (await fileExists(path)) return path;
  }

  return undefined;
}

function parseConfig(value: unknown, path: string): ProdcheckConfig {
  if (!isRecord(value)) {
    throw new Error(`${path} must contain a JSON object.`);
  }

  const config: {
    base?: string;
    output?: string;
    jsonOutput?: string;
    prCommentOutput?: string;
    github?: boolean;
    runKinds?: readonly ScriptKind[];
    smokeUrls?: readonly string[];
    commands?: readonly ProjectCommand[];
    riskRules?: readonly ConfigRiskRule[];
  } = {};
  if (typeof value.base === "string") config.base = value.base;
  if (typeof value.output === "string") config.output = value.output;
  if (typeof value.jsonOutput === "string") config.jsonOutput = value.jsonOutput;
  if (typeof value.prCommentOutput === "string") config.prCommentOutput = value.prCommentOutput;
  if (typeof value.github === "boolean") config.github = value.github;
  if (Array.isArray(value.runKinds)) config.runKinds = parseRunKinds(value.runKinds, path);
  if (Array.isArray(value.smokeUrls)) config.smokeUrls = parseStringArray(value.smokeUrls, "smokeUrls", path);
  if (Array.isArray(value.commands)) config.commands = parseCommands(value.commands, path);
  if (Array.isArray(value.riskRules)) config.riskRules = parseRiskRules(value.riskRules, path);

  return config;
}

function parseRunKinds(values: readonly unknown[], path: string): readonly ScriptKind[] {
  return values.map((value) => {
    if (typeof value !== "string" || !SCRIPT_KINDS.has(value as ScriptKind)) {
      throw new Error(`${path}: runKinds must contain only test, lint, typecheck, build, or check.`);
    }
    return value as ScriptKind;
  });
}

function parseStringArray(values: readonly unknown[], field: string, path: string): readonly string[] {
  return values.map((value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${path}: ${field} must contain non-empty strings.`);
    }
    return value;
  });
}

function parseCommands(values: readonly unknown[], path: string): readonly ProjectCommand[] {
  return values.map((value) => {
    if (!isRecord(value) || typeof value.kind !== "string" || !SCRIPT_KINDS.has(value.kind as ScriptKind) || typeof value.command !== "string") {
      throw new Error(`${path}: commands must include kind and command.`);
    }

    return {
      kind: value.kind as ScriptKind,
      command: value.command,
      source: typeof value.source === "string" ? value.source : "prodcheck config"
    };
  });
}

function parseRiskRules(values: readonly unknown[], path: string): readonly ConfigRiskRule[] {
  return values.map((value) => {
    if (!isRecord(value)
      || typeof value.category !== "string"
      || !RISK_CATEGORIES.has(value.category as RiskCategory)
      || typeof value.severity !== "string"
      || !SEVERITIES.has(value.severity as Severity)
      || typeof value.title !== "string"
      || typeof value.why !== "string"
      || typeof value.pattern !== "string") {
      throw new Error(`${path}: riskRules must include category, severity, title, why, and pattern.`);
    }

    return {
      category: value.category as RiskCategory,
      severity: value.severity as Severity,
      title: value.title,
      why: value.why,
      pattern: value.pattern
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
