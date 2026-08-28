import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("connection request lifecycle", () => {
  let api;
  let baseUrl;
  let currentTime;

  beforeEach(async () => {
    currentTime = new Date("2026-08-28T10:00:00.000Z");
    api = createApi({
      databasePath: ":memory:",
      clock: () => new Date(currentTime),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function createRequest() {
    return fetch(`${baseUrl}/api/connections/requests`, {
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
  }

  async function patchRequest(requestId, actorId, action) {
    return fetch(`${baseUrl}/api/connections/requests/${requestId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": actorId,
      },
      body: JSON.stringify({ action }),
    });
  }

  test("a rejected requester waits five minutes before creating a replacement request", async () => {
    const created = await createRequest();
    const request = (await created.json()).request;
    const rejected = await patchRequest(request.id, "user-lin", "reject");
    assert.equal(rejected.status, 200);

    const immediateRetry = await createRequest();
    assert.equal(immediateRetry.status, 429);
    assert.equal(immediateRetry.headers.get("retry-after"), "300");
    assert.equal((await immediateRetry.json()).error.code, "REQUEST_COOLDOWN");

    currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000 + 1);
    const afterCooldown = await createRequest();
    assert.equal(afterCooldown.status, 201);
  });

  test("a later accepted request never attaches its Connection to an older rejected request", async () => {
    const first = await createRequest();
    const firstRequest = (await first.json()).request;
    await patchRequest(firstRequest.id, "user-lin", "reject");

    currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000 + 1);
    const second = await createRequest();
    const secondRequest = (await second.json()).request;
    const accepted = await patchRequest(secondRequest.id, "user-lin", "accept");
    assert.equal(accepted.status, 200);

    const rejectedList = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing&status=REJECTED`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    const rejectedBody = await rejectedList.json();
    assert.equal(rejectedBody.requests[0].id, firstRequest.id);
    assert.equal(rejectedBody.requests[0].connection_id, null);

    const acceptedList = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing&status=ACCEPTED`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    const acceptedBody = await acceptedList.json();
    assert.equal(acceptedBody.requests[0].id, secondRequest.id);
    assert.match(acceptedBody.requests[0].connection_id, /^con_/);
  });

  test("a timed-out request becomes expired and can no longer create a Connection", async () => {
    await api.stop();
    api = createApi({
      databasePath: ":memory:",
      clock: () => new Date(currentTime),
      requestTtlMs: 1000,
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;

    const created = await createRequest();
    const request = (await created.json()).request;
    assert.match(request.expires_at, /^\d{4}-\d{2}-\d{2}T/);

    currentTime = new Date(currentTime.getTime() + 1001);
    const acceptance = await patchRequest(request.id, "user-lin", "accept");
    assert.equal(acceptance.status, 409);
    assert.equal((await acceptance.json()).error.code, "REQUEST_EXPIRED");

    const inbox = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=incoming`,
      { headers: { "x-demo-user-id": "user-lin" } },
    );
    const inboxBody = await inbox.json();
    assert.equal(inboxBody.requests[0].status, "EXPIRED");
    assert.equal(inboxBody.requests[0].connection_id, null);
  });
});
