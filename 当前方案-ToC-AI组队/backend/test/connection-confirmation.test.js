import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("connection confirmation", () => {
  let api;
  let baseUrl;

  beforeEach(async () => {
    api = createApi({ databasePath: ":memory:", allowInsecureDemoAuth: true });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function createRequest() {
    const response = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
      }),
    });
    return (await response.json()).request;
  }

  test("only the recipient can accept, creating one participant-visible connection", async () => {
    const request = await createRequest();

    const forbidden = await fetch(
      `${baseUrl}/api/connections/requests/${request.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-zhou",
        },
        body: JSON.stringify({ action: "accept" }),
      },
    );
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, "RECIPIENT_ONLY");

    const accepted = await fetch(
      `${baseUrl}/api/connections/requests/${request.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-lin",
        },
        body: JSON.stringify({ action: "accept" }),
      },
    );
    const acceptedBody = await accepted.json();

    assert.equal(accepted.status, 200);
    assert.equal(acceptedBody.request.status, "ACCEPTED");
    assert.deepEqual(acceptedBody.connection.members, ["user-lin", "user-zhou"]);
    assert.equal(acceptedBody.connection.event_id, "hackathon-2026");
    assert.equal(acceptedBody.connection.source, "nfc");
    assert.equal(acceptedBody.idempotent_replay, false);

    const repeated = await fetch(
      `${baseUrl}/api/connections/requests/${request.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-lin",
        },
        body: JSON.stringify({ action: "accept" }),
      },
    );
    const repeatedBody = await repeated.json();

    assert.equal(repeated.status, 200);
    assert.equal(repeatedBody.connection.id, acceptedBody.connection.id);
    assert.equal(repeatedBody.idempotent_replay, true);

    const visibleToMember = await fetch(
      `${baseUrl}/api/connections/${acceptedBody.connection.id}`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    assert.equal(visibleToMember.status, 200);
    assert.equal((await visibleToMember.json()).connection.id, acceptedBody.connection.id);

    const hiddenFromOutsider = await fetch(
      `${baseUrl}/api/connections/${acceptedBody.connection.id}`,
      { headers: { "x-demo-user-id": "user-su" } },
    );
    assert.equal(hiddenFromOutsider.status, 403);
    assert.equal((await hiddenFromOutsider.json()).error.code, "CONNECTION_FORBIDDEN");
  });

  test("repeating a request in either direction returns the pair's existing connection", async () => {
    const request = await createRequest();
    const accepted = await fetch(
      `${baseUrl}/api/connections/requests/${request.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-lin",
        },
        body: JSON.stringify({ action: "accept" }),
      },
    );
    const originalConnection = (await accepted.json()).connection;

    for (const [requesterId, recipientId] of [
      ["user-zhou", "user-lin"],
      ["user-lin", "user-zhou"],
    ]) {
      const replay = await fetch(`${baseUrl}/api/connections/requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": requesterId,
        },
        body: JSON.stringify({
          recipient_id: recipientId,
          event_id: "hackathon-2026",
          source: "nfc",
        }),
      });
      const replayBody = await replay.json();

      assert.equal(replay.status, 200);
      assert.equal(replayBody.connection.id, originalConnection.id);
      assert.equal(replayBody.idempotent_replay, true);
      assert.equal("request" in replayBody, false);
    }
  });

  test("an oversized acceptance payload has the same 413 contract as other JSON routes", async () => {
    const request = await createRequest();
    const response = await fetch(
      `${baseUrl}/api/connections/requests/${request.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-lin",
        },
        body: JSON.stringify({ action: "accept", padding: "x".repeat(70 * 1024) }),
      },
    );

    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, "PAYLOAD_TOO_LARGE");
  });

  test("reciprocal pending requests remain idempotent after either one creates the connection", async () => {
    const firstRequest = await createRequest();
    const reciprocalResponse = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-lin",
      },
      body: JSON.stringify({
        recipient_id: "user-zhou",
        event_id: "hackathon-2026",
        source: "qr",
      }),
    });
    const reciprocalRequest = (await reciprocalResponse.json()).request;

    const firstAccepted = await fetch(
      `${baseUrl}/api/connections/requests/${firstRequest.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-lin",
        },
        body: JSON.stringify({ action: "accept" }),
      },
    );
    const connection = (await firstAccepted.json()).connection;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reciprocalAccepted = await fetch(
        `${baseUrl}/api/connections/requests/${reciprocalRequest.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-demo-user-id": "user-zhou",
          },
          body: JSON.stringify({ action: "accept" }),
        },
      );
      const body = await reciprocalAccepted.json();

      assert.equal(reciprocalAccepted.status, 200);
      assert.equal(body.connection.id, connection.id);
      assert.equal(body.idempotent_replay, true);
    }
  });
});
