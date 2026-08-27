import type { CommandResult, RepoFacts, RiskCategory } from "./types.js";

export function renderReport(facts: RepoFacts, verified: readonly CommandResult[]): string {
  const status = chooseStatus(facts, verified);
  const mainRisk = facts.riskCategories.length > 0
    ? describeMainRisk(facts.riskCategories)
    : "No high-signal risky file category detected from changed paths.";
  const confidence = verified.length > 0 && verified.every((result) => result.exitCode === 0 && !result.timedOut)
    ? "Medium: local checks ran successfully, but deployment/runtime state was not verified."
    : "Low: this report is based on repository inspection and recommended checks.";

  return `# Production Readiness Report

## Summary
- Status: ${status}
- Main risk: ${mainRisk}
- Confidence: ${confidence}

## Repository
- Root: ${facts.root}
- Branch: ${facts.branch}
- Base: ${facts.baseRef}
- Comparison: ${formatComparison(facts)}
- Working tree: ${facts.statusLines.length === 0 ? "Clean" : "Has local changes"}

## What Changed
- Files changed: ${facts.changedFiles.length === 0 ? "None detected" : String(facts.changedFiles.length)}
${bulletList(facts.changedFiles)}
- Risk categories: ${facts.riskCategories.length === 0 ? "None detected" : facts.riskCategories.join(", ")}

## Project Shape
- Languages: ${facts.languages.length === 0 ? "Not detected" : facts.languages.join(", ")}
- Package managers: ${facts.packageManagers.join(", ")}
- CI files: ${facts.ciFiles.length === 0 ? "None detected" : String(facts.ciFiles.length)}
${bulletList(facts.ciFiles)}
- Docker/deployment files: ${facts.deploymentFiles.length === 0 ? "None detected" : String(facts.deploymentFiles.length)}
${bulletList(facts.deploymentFiles)}
- Environment/config surfaces: ${facts.envFiles.length === 0 ? "None detected" : String(facts.envFiles.length)}
${bulletList(facts.envFiles)}
- Migration files: ${facts.migrationFiles.length === 0 ? "None detected" : String(facts.migrationFiles.length)}
${bulletList(facts.migrationFiles)}

## Verified
${verified.length === 0 ? "- No project commands were run. Use `readiness audit --run` to run discovered checks." : verified.map(formatCommandResult).join("\n")}

## Not Verified
${notVerifiedItems(facts, verified).map((item) => `- ${item}`).join("\n")}

## Deployment Notes
- Runtime/config touched: ${hasAny(facts.riskCategories, ["deployment", "secrets"]) ? "Yes, review deployment and configuration changes before release." : "No deployment/config change detected from changed paths."}
- Migration needed: ${facts.riskCategories.includes("migrations") ? "Likely. Confirm migration order, rollback strategy, and production data impact." : "No migration change detected from changed paths."}
- Rollback concern: ${rollbackConcern(facts.riskCategories)}

## Recommended Next Steps
${recommendedSteps(facts, verified).map((step, index) => `${index + 1}. ${step}`).join("\n")}
`;
}

function chooseStatus(facts: RepoFacts, verified: readonly CommandResult[]): "Not ready" | "Ready with caveats" | "Ready" {
  if (verified.some((result) => result.exitCode !== 0 || result.timedOut)) {
    return "Not ready";
  }

  if (verified.length === 0 || facts.statusLines.length > 0 || facts.riskCategories.length > 0) {
    return "Ready with caveats";
  }

  return "Ready";
}

function describeMainRisk(categories: readonly RiskCategory[]): string {
  const priority: readonly RiskCategory[] = ["secrets", "migrations", "auth", "billing", "webhooks", "deployment", "database", "routing"];
  const category = priority.find((item) => categories.includes(item)) ?? categories[0];
  return category === undefined ? "No main risk identified." : `Changes touch ${category}.`;
}

function formatComparison(facts: RepoFacts): string {
  const { comparison } = facts;
  if (comparison.mode === "base-ref" && comparison.effectiveBaseRef !== undefined) {
    return `Compared with merge base ${comparison.effectiveBaseRef.slice(0, 12)} from ${comparison.requestedBaseRef}.`;
  }

  return comparison.note ?? `Used ${comparison.mode}.`;
}

function hasAny(values: readonly RiskCategory[], candidates: readonly RiskCategory[]): boolean {
  return candidates.some((candidate) => values.includes(candidate));
}

function rollbackConcern(categories: readonly RiskCategory[]): string {
  if (categories.includes("migrations")) return "Database changes may not roll back cleanly.";
  if (categories.includes("deployment")) return "Deployment configuration changed; confirm previous release can be restored.";
  if (categories.includes("dependencies")) return "Dependency changes may require lockfile and runtime compatibility checks.";
  return "No obvious rollback concern detected from changed paths.";
}

function notVerifiedItems(facts: RepoFacts, verified: readonly CommandResult[]): readonly string[] {
  const verifiedCommands = new Set(verified.map((result) => result.command));
  const items = facts.commands
    .filter((command) => !verifiedCommands.has(command.command))
    .map((command) => `${command.command}: discovered in ${command.source}, but not run.`);

  if (facts.ciFiles.length > 0) {
    items.push("CI status: local inspection found workflow files, but remote CI result was not checked.");
  }

  if (facts.deploymentFiles.length > 0) {
    items.push("Deployment provider/runtime: deployment files exist, but live provider state was not checked.");
  }

  if (facts.envFiles.length > 0) {
    items.push("Environment values: config surfaces were listed only by filename; secret values were not read or printed.");
  }

  return items.length > 0 ? items : ["No additional local checks were discovered."];
}

function recommendedSteps(facts: RepoFacts, verified: readonly CommandResult[]): readonly string[] {
  const steps: string[] = [];
  const failed = verified.filter((result) => result.exitCode !== 0 || result.timedOut);

  if (failed.length > 0) {
    steps.push("Fix failing or timed-out verification commands before release.");
  }

  for (const command of facts.commands) {
    if (!verified.some((result) => result.command === command.command)) {
      steps.push(`Run \`${command.command}\`.`);
    }
  }

  if (facts.riskCategories.includes("migrations")) {
    steps.push("Review migration safety, backup expectations, and rollback limits.");
  }

  if (facts.riskCategories.includes("auth") || facts.riskCategories.includes("billing") || facts.riskCategories.includes("webhooks")) {
    steps.push("Exercise the changed critical path with realistic credentials or a trusted sandbox.");
  }

  if (facts.statusLines.length > 0) {
    steps.push("Decide which local changes belong in the release candidate.");
  }

  return steps.length > 0 ? steps : ["Record release evidence and proceed with the normal deployment checklist."];
}

function bulletList(items: readonly string[]): string {
  if (items.length === 0) return "";
  return items.map((item) => `  - ${item}`).join("\n");
}

function formatCommandResult(result: CommandResult): string {
  const duration = `${(result.durationMs / 1000).toFixed(1)}s`;
  const status = result.timedOut ? "timed out" : result.exitCode === 0 ? "passed" : `failed with exit code ${String(result.exitCode)}`;
  return `- Command: \`${result.command}\`\n  Result: ${status} (${duration})`;
}
