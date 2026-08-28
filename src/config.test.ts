import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./config.js";

test("loads prodcheck config with custom commands and risk rules", async () => {
  const root = await mkdtemp(join(tmpdir(), "prodcheck-config-"));
  await writeFile(join(root, "prodcheck.config.json"), JSON.stringify({
    base: "origin/main",
    github: true,
    runKinds: ["typecheck"],
    smokeUrls: ["http://localhost:3000"],
    commands: [{ kind: "check", command: "npm run verify" }],
    riskRules: [{
      category: "backend",
      severity: "high",
      title: "Worker changed",
      why: "Workers process production jobs.",
      pattern: "^workers/"
    }]
  }), "utf8");

  const config = await loadConfig(root, undefined);

  assert.equal(config.base, "origin/main");
  assert.equal(config.github, true);
  assert.deepEqual(config.runKinds, ["typecheck"]);
  assert.equal(config.commands?.[0]?.source, "prodcheck config");
  assert.equal(config.riskRules?.[0]?.title, "Worker changed");
});
