import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ApiError,
  RallyApiClient,
} from "../../prototype/mobile-demo/api-client.js";

function jsonResponse(status, body) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("mobile Rally API client", () => {
  test("uses the current Bearer session and reports an expired session distinctly", async () => {
    const requests = [];
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      getAccessToken: () => "session-token",
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return jsonResponse(401, {
          error: { code: "AUTH_REQUIRED", message: "A valid session is required." },
        });
      },
    });

    await assert.rejects(
      client.get("/api/me"),
      (error) => error instanceof ApiError
        && error.status === 401
        && error.code === "AUTH_REQUIRED"
        && error.isAuthenticationError,
    );
    assert.equal(requests[0].url, "https://rally.example/api/me");
    assert.equal(requests[0].options.headers.authorization, "Bearer session-token");
  });

  test("retries a temporary GET failure but never retries a write", async () => {
    let getAttempts = 0;
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      retryDelaysMs: [0, 0],
      fetchImpl: async (_url, options) => {
        if (options.method === "GET") {
          getAttempts += 1;
          return getAttempts < 3
            ? jsonResponse(503, { error: { code: "UNAVAILABLE", message: "Try later" } })
            : jsonResponse(200, { ok: true });
        }
        return jsonResponse(503, { error: { code: "UNAVAILABLE", message: "Try later" } });
      },
    });

    assert.deepEqual(await client.get("/health"), { ok: true });
    assert.equal(getAttempts, 3);
    await assert.rejects(client.post("/api/write", {}), ApiError);
  });

  test("coalesces concurrent writes to the same resource", async () => {
    let releases;
    let calls = 0;
    const pending = new Promise((resolve) => { releases = resolve; });
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      fetchImpl: async () => {
        calls += 1;
        await pending;
        return jsonResponse(200, { saved: true });
      },
    });

    const first = client.runExclusive("visibility", () => client.patch("/visibility", { state: "VISIBLE" }));
    const second = client.runExclusive("visibility", () => client.patch("/visibility", { state: "PAUSED" }));
    assert.equal(first, second);
    releases();
    assert.deepEqual(await second, { saved: true });
    assert.equal(calls, 1);
  });

  test("preserves AbortError so callers can treat cancellation as intentional", async () => {
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      fetchImpl: async () => {
        throw new DOMException("The operation was aborted", "AbortError");
      },
    });

    await assert.rejects(
      client.get("/api/me"),
      (error) => error.name === "AbortError",
    );
  });
});
