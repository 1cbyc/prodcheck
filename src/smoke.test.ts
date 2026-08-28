import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { runSmokeChecks } from "./smoke.js";

test("smoke checks report passing HTTP URLs", async () => {
  const server = createServer((_, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(typeof address === "object" && address !== null);

  try {
    const results = await runSmokeChecks([`http://127.0.0.1:${String(address.port)}`]);
    assert.equal(results[0]?.ok, true);
    assert.equal(results[0]?.status, 200);
  } finally {
    server.close();
  }
});
