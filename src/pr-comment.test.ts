import test from "node:test";
import assert from "node:assert/strict";
import { renderPrComment } from "./pr-comment.js";
import type { RepoFacts } from "./types.js";

test("renders a compact PR comment", () => {
  const facts: RepoFacts = {
    root: "/tmp/repo",
    branch: "feature",
    statusLines: [],
    baseRef: "main",
    comparison: { mode: "base-ref", requestedBaseRef: "main", effectiveBaseRef: "abc123" },
    changedFiles: ["migrations/001.sql"],
    packageManagers: ["npm"],
    languages: ["TypeScript"],
    commands: [],
    config: {},
    ciFiles: [],
    deploymentFiles: [],
    envFiles: [],
    migrationFiles: ["migrations/001.sql"],
    riskCategories: ["migrations", "database"],
    riskFindings: [{
      category: "migrations",
      severity: "high",
      title: "Database migration changed",
      why: "Migration changes can be hard to roll back and may affect live data.",
      matchedFiles: ["migrations/001.sql"]
    }]
  };

  const comment = renderPrComment(facts, [], []);

  assert.match(comment, /Production Readiness/);
  assert.match(comment, /Migration safety pack/);
  assert.match(comment, /migrations\/001\.sql/);
});
