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

export type Severity = "critical" | "high" | "medium" | "low";

export type ReadinessStatus = "not_ready" | "ready_with_caveats" | "ready";

export interface CliOptions {
  readonly base: string;
  readonly output: string;
  readonly jsonOutput?: string;
  readonly run: boolean;
  readonly runKinds: readonly ScriptKind[];
  readonly github: boolean;
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
  readonly comparison: ComparisonFacts;
  readonly changedFiles: readonly string[];
  readonly packageManagers: readonly string[];
  readonly languages: readonly string[];
  readonly commands: readonly ProjectCommand[];
  readonly ciFiles: readonly string[];
  readonly deploymentFiles: readonly string[];
  readonly envFiles: readonly string[];
  readonly migrationFiles: readonly string[];
  readonly riskCategories: readonly RiskCategory[];
  readonly riskFindings: readonly RiskFinding[];
  readonly github?: GitHubFacts;
}

export type ComparisonMode = "base-ref" | "working-tree" | "unborn-branch";

export interface ComparisonFacts {
  readonly mode: ComparisonMode;
  readonly requestedBaseRef: string;
  readonly effectiveBaseRef?: string;
  readonly note?: string;
}

export interface RiskFinding {
  readonly category: RiskCategory;
  readonly severity: Severity;
  readonly title: string;
  readonly why: string;
  readonly matchedFiles: readonly string[];
}

export interface GitHubFacts {
  readonly enabled: boolean;
  readonly available: boolean;
  readonly repository?: string;
  readonly currentSha?: string;
  readonly latestRun?: GitHubRun;
  readonly note?: string;
}

export interface GitHubRun {
  readonly databaseId: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion: string;
  readonly event: string;
  readonly headBranch: string;
  readonly url: string;
}

export interface ReportSummary {
  readonly status: ReadinessStatus;
  readonly mainRisk: string;
  readonly confidence: string;
}
