import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("connection request", () => {
  let api;
  let baseUrl;

  beforeEach(async () => {
    api = createApi({ databasePath: ":memory:" });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  test("an authenticated user creates one idempotent request to a visible participant", async () => {
    const payload = {
      recipient_id: "user-lin",
      event_id: "hackathon-2026",
      source: "nfc",
    };

    const first = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify(payload),
    });
    const firstBody = await first.json();

    assert.equal(first.status, 201);
    assert.deepEqual(
      {
        requester_id: firstBody.request.requester_id,
        recipient_id: firstBody.request.recipient_id,
        event_id: firstBody.request.event_id,
        source: firstBody.request.source,
        status: firstBody.request.status,
      },
      {
        requester_id: "user-zhou",
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
        status: "REQUESTED",
      },
    );
    assert.match(firstBody.request.id, /^req_/);
    assert.equal(firstBody.idempotent_replay, false);

    const duplicate = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify(payload),
    });
    const duplicateBody = await duplicate.json();

    assert.equal(duplicate.status, 200);
    assert.equal(duplicateBody.request.id, firstBody.request.id);
    assert.equal(duplicateBody.idempotent_replay, true);
  });

  test("the server rechecks recipient visibility before creating a request", async () => {
    const response = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        recipient_id: "user-su",
        event_id: "hackathon-2026",
        source: "qr",
      }),
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: {
        code: "RECIPIENT_NOT_AVAILABLE",
        message: "This participant is no longer available for connection requests.",
      },
    });
  });

  test("an anonymous visitor cannot create a connection request", async () => {
    const response = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });

    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, "AUTH_REQUIRED");
  });

  test("the valid JSON value null is rejected without leaving the HTTP request open", async () => {
    const response = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: "null",
      signal: AbortSignal.timeout(250),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_REQUEST");
  });

  test("a requester is rate limited after five newly created requests in one minute", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const created = await fetch(`${baseUrl}/api/connections/requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-zhou",
        },
        body: JSON.stringify({
          recipient_id: "user-lin",
          event_id: "hackathon-2026",
          source: "link",
        }),
      });
      const request = (await created.json()).request;
      assert.equal(created.status, 201);

      const cancelled = await fetch(
        `${baseUrl}/api/connections/requests/${request.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-demo-user-id": "user-zhou",
          },
          body: JSON.stringify({ action: "cancel" }),
        },
      );
      assert.equal(cancelled.status, 200);
    }

    const limited = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });

    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal((await limited.json()).error.code, "REQUEST_RATE_LIMITED");
  });
});
