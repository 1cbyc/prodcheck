#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectRepoFacts } from "./detect.js";
import { collectGitHubFacts } from "./github.js";
import { renderPrComment } from "./pr-comment.js";
import { buildSummary, renderReport } from "./report.js";
import { runProjectCommands } from "./runner.js";
import { runSmokeChecks } from "./smoke.js";
import type { CliOptions, ProdcheckConfig, ScriptKind } from "./types.js";

async function main(argv: readonly string[]): Promise<void> {
  const [command, subcommand, ...rest] = argv;
  const args = command === "audit" ? argv.slice(1) : rest;

  if (isHelpRequest(command, subcommand, args, rest)) {
    printHelp();
    return;
  }

  if (command !== "audit" && ((command !== "readiness" && command !== "prodcheck") || subcommand !== "audit")) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const options = parseOptions(args);
  const initialFacts = await collectRepoFacts(process.cwd(), options.base, options.configPath);
  const effectiveOptions = applyConfigDefaults(options, initialFacts.config);
  const githubFacts = effectiveOptions.github ? await collectGitHubFacts(initialFacts.root) : undefined;
  const facts = githubFacts === undefined ? initialFacts : { ...initialFacts, github: githubFacts };
  const commandsToRun = effectiveOptions.runKinds.length > 0
    ? facts.commands.filter((command) => effectiveOptions.runKinds.includes(command.kind))
    : facts.commands;
  const verified = effectiveOptions.run
    ? await runProjectCommands(commandsToRun, facts.root, effectiveOptions.maxCommandSeconds)
    : [];
  const smokeResults = await runSmokeChecks(effectiveOptions.smokeUrls);
  const report = renderReport(facts, verified, smokeResults);
  const outputPath = resolve(process.cwd(), effectiveOptions.output);

  await writeFile(outputPath, report, "utf8");
  console.log(`Wrote ${outputPath}`);

  if (effectiveOptions.jsonOutput !== undefined) {
    const jsonOutputPath = resolve(process.cwd(), effectiveOptions.jsonOutput);
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: buildSummary(facts, verified, smokeResults),
      facts,
      verified,
      smokeResults
    };
    await writeFile(jsonOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Wrote ${jsonOutputPath}`);
  }

  if (effectiveOptions.prCommentOutput !== undefined) {
    const prCommentOutputPath = resolve(process.cwd(), effectiveOptions.prCommentOutput);
    await writeFile(prCommentOutputPath, renderPrComment(facts, verified, smokeResults), "utf8");
    console.log(`Wrote ${prCommentOutputPath}`);
  }

  if (!effectiveOptions.run && facts.commands.length > 0) {
    console.log("Discovered commands were not run. Re-run with --run to verify them.");
  }
}

function isHelpRequest(
  command: string | undefined,
  subcommand: string | undefined,
  args: readonly string[],
  rest: readonly string[]
): boolean {
  if (command === "--help" || command === "-h") return true;
  if (command === "audit") return args[0] === "--help" || args[0] === "-h";
  if (subcommand === "audit") return rest[0] === "--help" || rest[0] === "-h";
  return false;
}

function parseOptions(args: readonly string[]): CliOptions {
  let base = "main";
  let output = "readiness-report.md";
  let jsonOutput: string | undefined;
  let prCommentOutput: string | undefined;
  let configPath: string | undefined;
  let run = false;
  let github = false;
  let runKinds: readonly ScriptKind[] = [];
  let smokeUrls: readonly string[] = [];
  let maxCommandSeconds = 90;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--run") {
      run = true;
      continue;
    }

    if (arg === "--github") {
      github = true;
      continue;
    }

    if (arg === "--base") {
      base = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--output") {
      output = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--json-output") {
      jsonOutput = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--pr-comment-output") {
      prCommentOutput = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--config") {
      configPath = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--run-kind") {
      runKinds = parseRunKinds(readOptionValue(args, index, arg));
      run = true;
      index += 1;
      continue;
    }

    if (arg === "--smoke-url") {
      smokeUrls = [...smokeUrls, readOptionValue(args, index, arg)];
      index += 1;
      continue;
    }

    if (arg === "--max-command-seconds") {
      const value = Number(readOptionValue(args, index, arg));
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--max-command-seconds must be a positive integer.");
      }
      maxCommandSeconds = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg ?? ""}`);
  }

  return {
    base,
    output,
    ...(jsonOutput === undefined ? {} : { jsonOutput }),
    ...(prCommentOutput === undefined ? {} : { prCommentOutput }),
    ...(configPath === undefined ? {} : { configPath }),
    run,
    runKinds,
    github,
    smokeUrls,
    maxCommandSeconds
  };
}

function applyConfigDefaults(options: CliOptions, config: ProdcheckConfig): CliOptions {
  return {
    base: options.base === "main" ? config.base ?? options.base : options.base,
    output: options.output === "readiness-report.md" ? config.output ?? options.output : options.output,
    ...(options.jsonOutput === undefined && config.jsonOutput !== undefined ? { jsonOutput: config.jsonOutput } : {}),
    ...(options.jsonOutput !== undefined ? { jsonOutput: options.jsonOutput } : {}),
    ...(options.prCommentOutput === undefined && config.prCommentOutput !== undefined ? { prCommentOutput: config.prCommentOutput } : {}),
    ...(options.prCommentOutput !== undefined ? { prCommentOutput: options.prCommentOutput } : {}),
    ...(options.configPath === undefined ? {} : { configPath: options.configPath }),
    run: options.run,
    runKinds: options.runKinds.length === 0 ? config.runKinds ?? [] : options.runKinds,
    github: options.github || config.github === true,
    smokeUrls: options.smokeUrls.length === 0 ? config.smokeUrls ?? [] : options.smokeUrls,
    maxCommandSeconds: options.maxCommandSeconds
  };
}

function readOptionValue(args: readonly string[], index: number, optionName: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function parseRunKinds(value: string): readonly ScriptKind[] {
  const allowed = new Set<ScriptKind>(["test", "lint", "typecheck", "build", "check"]);
  const kinds = value.split(",").map((item) => item.trim()).filter(Boolean);

  for (const kind of kinds) {
    if (!allowed.has(kind as ScriptKind)) {
      throw new Error(`Unknown --run-kind value: ${kind}`);
    }
  }

  return kinds as readonly ScriptKind[];
}

function printHelp(): void {
  console.log(`Usage:
  readiness audit [--base main] [--output readiness-report.md] [--json-output report.json] [--pr-comment-output pr-comment.md] [--config prodcheck.config.json] [--run] [--run-kind test,typecheck] [--github] [--smoke-url http://localhost:3000] [--max-command-seconds 90]

Commands:
  readiness audit    Inspect the current git repository and write a readiness report.
`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
