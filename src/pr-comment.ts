import { buildCheckPacks } from "./check-packs.js";
import { buildSummary } from "./report.js";
import type { CommandResult, RepoFacts, SmokeResult } from "./types.js";

export function renderPrComment(
  facts: RepoFacts,
  verified: readonly CommandResult[],
  smokeResults: readonly SmokeResult[]
): string {
  const summary = buildSummary(facts, verified, smokeResults);
  const packs = buildCheckPacks(facts);

  return `## Production Readiness

**Status:** ${formatStatus(summary.status)}

**Main risk:** ${summary.mainRisk}

**Confidence:** ${summary.confidence}

### Changed Files
${facts.changedFiles.length === 0 ? "- None detected" : facts.changedFiles.map((file) => `- \`${file}\``).join("\n")}

### Risk Findings
${facts.riskFindings.length === 0 ? "- None detected" : facts.riskFindings.map((finding) => `- **${finding.severity}:** ${finding.title} (${finding.matchedFiles.map((file) => `\`${file}\``).join(", ")})`).join("\n")}

### Verified
${verified.length === 0 && smokeResults.length === 0 ? "- No local commands or smoke checks were run." : [
    ...verified.map((result) => `- \`${result.command}\`: ${result.timedOut ? "timed out" : result.exitCode === 0 ? "passed" : `failed (${String(result.exitCode)})`}`),
    ...smokeResults.map((result) => `- \`${result.url}\`: ${result.ok ? "passed" : "failed"}${result.status === null ? "" : ` (${String(result.status)})`}`)
  ].join("\n")}

### Check Packs
${packs.length === 0 ? "- No domain-specific pack was triggered." : packs.map((pack) => `- **${pack.title}:** ${pack.items.join(" ")}`).join("\n")}
`;
}

function formatStatus(status: "not_ready" | "ready_with_caveats" | "ready"): string {
  if (status === "not_ready") return "Not ready";
  if (status === "ready_with_caveats") return "Ready with caveats";
  return "Ready";
}
