import { spawn } from "node:child_process";
import type { CommandResult, ProjectCommand } from "./types.js";

export async function runProjectCommands(
  commands: readonly ProjectCommand[],
  cwd: string,
  maxCommandSeconds: number
): Promise<readonly CommandResult[]> {
  const results: CommandResult[] = [];

  for (const command of commands) {
    results.push(await runCommand(command.command, cwd, maxCommandSeconds));
  }

  return results;
}

function runCommand(command: string, cwd: string, maxCommandSeconds: number): Promise<CommandResult> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: "ignore"
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, maxCommandSeconds * 1000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        command,
        exitCode: code,
        durationMs: Date.now() - startedAt,
        timedOut
      });
    });
  });
}
