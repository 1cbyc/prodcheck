export type RiskCategory =
  | "auth"
  | "billing"
  | "webhooks"
  | "migrations"
  | "deployment"
  | "secrets"
  | "routing"
  | "dependencies"
  | "database"
  | "ci"
  | "frontend"
  | "backend";

export type ScriptKind = "test" | "lint" | "typecheck" | "build" | "check";

export interface CliOptions {
  readonly base: string;
  readonly output: string;
  readonly run: boolean;
  readonly maxCommandSeconds: number;
}

export interface ProjectCommand {
  readonly kind: ScriptKind;
  readonly command: string;
  readonly source: string;
}

export interface CommandResult {
  readonly command: string;
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

export interface RepoFacts {
  readonly root: string;
  readonly branch: string;
  readonly statusLines: readonly string[];
  readonly baseRef: string;
  readonly changedFiles: readonly string[];
  readonly packageManagers: readonly string[];
  readonly languages: readonly string[];
  readonly commands: readonly ProjectCommand[];
  readonly ciFiles: readonly string[];
  readonly deploymentFiles: readonly string[];
  readonly envFiles: readonly string[];
  readonly migrationFiles: readonly string[];
  readonly riskCategories: readonly RiskCategory[];
}
