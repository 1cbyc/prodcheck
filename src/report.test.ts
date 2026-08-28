import test from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "./report.js";
import type { RepoFacts } from "./types.js";

test("report separates verified and recommended checks", () => {
  const facts: RepoFacts = {
    root: "/tmp/example",
    branch: "feature/release",
    statusLines: ["M src/auth/session.ts"],
    baseRef: "main",
    comparison: {
      mode: "base-ref",
      requestedBaseRef: "main",
      effectiveBaseRef: "abc123def456"
    },
    changedFiles: ["src/auth/session.ts", "package-lock.json"],
    packageManagers: ["npm"],
    languages: ["TypeScript"],
    commands: [
      { kind: "typecheck", command: "npm run typecheck", source: "package.json" },
      { kind: "test", command: "npm test", source: "package.json" }
    ],
    config: {},
    ciFiles: [".github/workflows/ci.yml"],
    deploymentFiles: [],
    envFiles: [".env.example"],
    migrationFiles: [],
    riskCategories: ["auth", "dependencies"],
    riskFindings: [
      {
        category: "auth",
        severity: "high",
        title: "Authentication or authorization path changed",
        why: "Auth changes can lock users out, grant excess access, or break sessions.",
        matchedFiles: ["src/auth/session.ts"]
      },
      {
        category: "dependencies",
        severity: "medium",
        title: "Dependency manifest or lockfile changed",
        why: "Dependency changes can alter runtime behavior, builds, security posture, or package resolution.",
        matchedFiles: ["package-lock.json"]
      }
    ]
  };

  const report = renderReport(facts, [
    { command: "npm run typecheck", exitCode: 0, durationMs: 1200, timedOut: false }
  ]);

  assert.match(report, /Status: Ready with caveats/);
  assert.match(report, /Command: `npm run typecheck`/);
  assert.match(report, /npm test: discovered in package.json, but not run/);
  assert.doesNotMatch(report, /SECRET_VALUE/);
});
