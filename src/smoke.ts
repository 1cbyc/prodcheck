import type { SmokeResult } from "./types.js";

export async function runSmokeChecks(urls: readonly string[]): Promise<readonly SmokeResult[]> {
  const results: SmokeResult[] = [];

  for (const url of urls) {
    results.push(await checkUrl(url));
  }

  return results;
}

async function checkUrl(url: string): Promise<SmokeResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, { redirect: "follow" });
    return {
      url,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt
    };
  } catch (error: unknown) {
    return {
      url,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
