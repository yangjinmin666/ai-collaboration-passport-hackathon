import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

const ANALYTICS_ADMIN_TOKEN = "touch-analytics-admin-token-000000000000000000000000";

describe("connection confirmation", () => {
  let api;
  let baseUrl;

  beforeEach(async () => {
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      touchDeviceAccessKey: "touch-secret",
      analyticsAdminToken: ANALYTICS_ADMIN_TOKEN,
    });
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
    assert.equal(acceptedBody.connection.consent_mode, "recipient_confirmed");
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

  test("a trusted two-card touch creates one physical-mutual connection", async () => {
    const touch = async () => {
      const response = await fetch(`${baseUrl}/api/connections/physical-mutual`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-touch-device-key": "touch-secret",
        },
        body: JSON.stringify({
          event_id: "hackathon-2026",
          card_a_token: "cp_7mJ4Qv9N2xK8Rt5W",
          card_b_token: "cp_B3kP8sT6yH2nV9qL",
        }),
      });
      return { response, body: await response.json() };
    };

    const first = await touch();
    assert.equal(first.response.status, 201);
    assert.deepEqual(first.body.connection.members, ["user-lin", "user-zhou"]);
    assert.equal(first.body.attribution.source, "physical_mutual");
    assert.equal(first.body.connection.consent_mode, "physical_mutual");
    assert.equal(first.body.request.status, "ACCEPTED");

    const replay = await touch();
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.connection.id, first.body.connection.id);
    assert.equal(replay.body.idempotent_replay, true);

    const untrusted = await fetch(`${baseUrl}/api/connections/physical-mutual`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(untrusted.status, 403);

    const summaryResponse = await fetch(
      `${baseUrl}/api/admin/analytics/summary?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": ANALYTICS_ADMIN_TOKEN } },
    );
    const summary = await summaryResponse.json();
    const counts = Object.fromEntries(
      summary.event_counts.map((event) => [event.event_name, event.total]),
    );
    assert.equal(counts.touch_handshake_completed, 1);
    assert.equal(counts.touch_handshake_failed, 2);
    assert.equal(
      summary.sources.some((row) => (
        row.event_name === "connection_requested" && row.source === "nfc"
      )),
      false,
    );
    assert.equal(
      summary.sources.some((row) => (
        row.event_name === "connection_requested" && row.source === "physical_mutual"
      )),
      true,
    );
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
