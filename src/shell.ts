import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ShellOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export async function runGit(args: readonly string[], cwd: string): Promise<ShellOutput> {
  try {
    const { stdout, stderr } = await execFileAsync("git", [...args], {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    if (isExecError(error)) {
      return {
        stdout: String(error.stdout ?? ""),
        stderr: String(error.stderr ?? error.message),
        exitCode: typeof error.code === "number" ? error.code : 1
      };
    }

    throw error;
  }
}

function isExecError(error: unknown): error is Error & {
  readonly stdout?: unknown;
  readonly stderr?: unknown;
  readonly code?: unknown;
} {
  return error instanceof Error;
}
