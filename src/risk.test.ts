import test from "node:test";
import assert from "node:assert/strict";
import { findRiskFindings } from "./risk.js";

test("risk findings include severity, reason, and matched files", () => {
  const findings = findRiskFindings([
    "src/auth/session.ts",
    "migrations/001_add_accounts.sql",
    "content/blog/infrastructure-as-code.md"
  ]);

  assert.ok(findings.some((finding) => finding.category === "migrations"));
  assert.ok(findings.some((finding) => finding.category === "auth"));
  assert.ok(!findings.some((finding) => finding.category === "deployment"));
  assert.equal(findings[0]?.severity, "high");
  assert.match(findings[0]?.why ?? "", /live data/);
  assert.deepEqual(findings.find((finding) => finding.category === "auth")?.matchedFiles, ["src/auth/session.ts"]);
});
