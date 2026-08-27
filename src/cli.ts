#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectRepoFacts } from "./detect.js";
import { renderReport } from "./report.js";
import { runProjectCommands } from "./runner.js";
import type { CliOptions } from "./types.js";

async function main(argv: readonly string[]): Promise<void> {
  const [command, subcommand, ...rest] = argv;
  const args = command === "audit" ? argv.slice(1) : rest;

  if (command !== "audit" && ((command !== "readiness" && command !== "prodcheck") || subcommand !== "audit")) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const options = parseOptions(args);
  const facts = await collectRepoFacts(process.cwd(), options.base);
  const verified = options.run
    ? await runProjectCommands(facts.commands, facts.root, options.maxCommandSeconds)
    : [];
  const report = renderReport(facts, verified);
  const outputPath = resolve(process.cwd(), options.output);

  await writeFile(outputPath, report, "utf8");
  console.log(`Wrote ${outputPath}`);

  if (!options.run && facts.commands.length > 0) {
    console.log("Discovered commands were not run. Re-run with --run to verify them.");
  }
}

function parseOptions(args: readonly string[]): CliOptions {
  let base = "main";
  let output = "readiness-report.md";
  let run = false;
  let maxCommandSeconds = 90;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--run") {
      run = true;
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

  return { base, output, run, maxCommandSeconds };
}

function readOptionValue(args: readonly string[], index: number, optionName: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function printHelp(): void {
  console.log(`Usage:
  readiness audit [--base main] [--output readiness-report.md] [--run] [--max-command-seconds 90]

Commands:
  readiness audit    Inspect the current git repository and write a readiness report.
`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
