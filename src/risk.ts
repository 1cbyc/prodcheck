import type { ConfigRiskRule, RiskCategory, RiskFinding, Severity } from "./types.js";

interface RiskRule {
  readonly category: RiskCategory;
  readonly severity: Severity;
  readonly title: string;
  readonly why: string;
  readonly pattern: RegExp;
}

const RISK_RULES: readonly RiskRule[] = [
  {
    category: "secrets",
    severity: "critical",
    title: "Secret or credential surface changed",
    why: "Secret handling changes can leak credentials or break production configuration.",
    pattern: /(^|\/)\.env|secret|token|credential|private[_-]?key/i
  },
  {
    category: "migrations",
    severity: "high",
    title: "Database migration changed",
    why: "Migration changes can be hard to roll back and may affect live data.",
    pattern: /(^|\/)(migrations?|alembic|db\/migrate)(\/|$)|schema\.sql|prisma\/migrations/i
  },
  {
    category: "auth",
    severity: "high",
    title: "Authentication or authorization path changed",
    why: "Auth changes can lock users out, grant excess access, or break sessions.",
    pattern: /auth|login|session|oauth|jwt|permission|rbac/i
  },
  {
    category: "billing",
    severity: "high",
    title: "Billing or payment path changed",
    why: "Billing changes can create revenue, entitlement, or reconciliation problems.",
    pattern: /billing|checkout|subscription|invoice|payment|stripe|polar/i
  },
  {
    category: "webhooks",
    severity: "high",
    title: "Webhook handling changed",
    why: "Webhook changes need idempotency, signature verification, retry, and replay checks.",
    pattern: /webhook|callback/i
  },
  {
    category: "deployment",
    severity: "high",
    title: "Deployment configuration changed",
    why: "Deployment changes can alter runtime, routing, secrets, resources, or release behavior.",
    pattern: /(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml|fly\.toml|render\.ya?ml|vercel\.json|netlify\.toml|wrangler\.toml|Procfile)$|^(deploy|deployment|infra|infrastructure|terraform|k8s|kubernetes|helm|charts)(\/|$)|(^|\/)\.github\/workflows\/.*(deploy|release|publish).*\.ya?ml$/i
  },
  {
    category: "database",
    severity: "medium",
    title: "Database access path changed",
    why: "Database changes can affect persistence, consistency, query load, and rollback behavior.",
    pattern: /database|db\/|models?|repository|sql/i
  },
  {
    category: "routing",
    severity: "medium",
    title: "Routing or API surface changed",
    why: "Routing changes can break public paths, middleware behavior, or API clients.",
    pattern: /routes?|router|middleware|app\/.*page|pages\/|api\//i
  },
  {
    category: "dependencies",
    severity: "medium",
    title: "Dependency manifest or lockfile changed",
    why: "Dependency changes can alter runtime behavior, builds, security posture, or package resolution.",
    pattern: /package-lock|pnpm-lock|yarn\.lock|bun\.lock|requirements|poetry\.lock|go\.sum|Cargo\.lock/i
  },
  {
    category: "ci",
    severity: "medium",
    title: "CI workflow changed",
    why: "CI changes can weaken or break the checks that protect the release path.",
    pattern: /\.github\/workflows|gitlab-ci|circleci/i
  },
  {
    category: "frontend",
    severity: "low",
    title: "Frontend code changed",
    why: "Frontend changes need browser/runtime validation beyond static checks.",
    pattern: /src\/.*\.(tsx|jsx)|app\/.*\.(tsx|jsx)|pages\/.*\.(tsx|jsx)|components\/.*\.(tsx|jsx)/i
  },
  {
    category: "backend",
    severity: "low",
    title: "Backend service code changed",
    why: "Backend changes can affect APIs, workers, jobs, or operational behavior.",
    pattern: /server|api\/|controllers?|services?|workers?|jobs?/i
  }
];

export function findRiskFindings(files: readonly string[], configRules: readonly ConfigRiskRule[] = []): readonly RiskFinding[] {
  const findings: RiskFinding[] = [];
  const rules: readonly RiskRule[] = [
    ...RISK_RULES,
    ...configRules.map((rule) => ({
      ...rule,
      pattern: new RegExp(rule.pattern, "i")
    }))
  ];

  for (const rule of rules) {
    const matchedFiles = files.filter((file) => rule.pattern.test(file));
    if (matchedFiles.length > 0) {
      findings.push({
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        why: rule.why,
        matchedFiles
      });
    }
  }

  return findings;
}
