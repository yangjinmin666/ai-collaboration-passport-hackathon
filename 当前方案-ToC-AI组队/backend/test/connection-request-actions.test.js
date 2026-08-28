import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("connection request actions", () => {
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

  async function actOnRequest({ requestId, actorId, action, reasonCode }) {
    const response = await fetch(
      `${baseUrl}/api/connections/requests/${requestId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": actorId,
        },
        body: JSON.stringify({ action, reason_code: reasonCode }),
      },
    );
    return { response, body: await response.json() };
  }

  test("the recipient can reject once and the requester sees the stable rejected state", async () => {
    const request = await createRequest();

    const rejected = await actOnRequest({
      requestId: request.id,
      actorId: "user-lin",
      action: "reject",
    });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.body.request.status, "REJECTED");
    assert.equal(rejected.body.connection, null);
    assert.equal(rejected.body.idempotent_replay, false);

    const repeated = await actOnRequest({
      requestId: request.id,
      actorId: "user-lin",
      action: "reject",
    });
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.body.request.status, "REJECTED");
    assert.equal(repeated.body.idempotent_replay, true);

    const outgoing = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    const outgoingBody = await outgoing.json();
    assert.equal(outgoingBody.requests[0].status, "REJECTED");
    assert.equal(outgoingBody.requests[0].connection_id, null);
  });

  test("only the requester can cancel and both sides poll the stable cancelled state", async () => {
    const request = await createRequest();

    const forbidden = await actOnRequest({
      requestId: request.id,
      actorId: "user-lin",
      action: "cancel",
    });
    assert.equal(forbidden.response.status, 403);
    assert.equal(forbidden.body.error.code, "REQUESTER_ONLY");

    const cancelled = await actOnRequest({
      requestId: request.id,
      actorId: "user-zhou",
      action: "cancel",
    });
    assert.equal(cancelled.response.status, 200);
    assert.equal(cancelled.body.request.status, "CANCELLED");
    assert.equal(cancelled.body.connection, null);
    assert.equal(cancelled.body.idempotent_replay, false);

    const repeated = await actOnRequest({
      requestId: request.id,
      actorId: "user-zhou",
      action: "cancel",
    });
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.body.request.status, "CANCELLED");
    assert.equal(repeated.body.idempotent_replay, true);

    const incoming = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=incoming`,
      { headers: { "x-demo-user-id": "user-lin" } },
    );
    const incomingBody = await incoming.json();
    assert.equal(incomingBody.requests[0].status, "CANCELLED");
  });

  test("blocking a pending requester closes the request and prevents either direction from retrying", async () => {
    const request = await createRequest();

    const blocked = await actOnRequest({
      requestId: request.id,
      actorId: "user-lin",
      action: "block",
    });
    assert.equal(blocked.response.status, 200);
    assert.equal(blocked.body.request.status, "BLOCKED");
    assert.equal(blocked.body.connection, null);

    for (const [requesterId, recipientId] of [
      ["user-zhou", "user-lin"],
      ["user-lin", "user-zhou"],
    ]) {
      const retry = await fetch(`${baseUrl}/api/connections/requests`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": requesterId,
        },
        body: JSON.stringify({
          recipient_id: recipientId,
          event_id: "hackathon-2026",
          source: "link",
        }),
      });
      assert.equal(retry.status, 409);
      assert.equal((await retry.json()).error.code, "CONNECTION_BLOCKED");
    }
  });

  test("blocking one of two reciprocal requests prevents the other from being accepted", async () => {
    const firstRequest = await createRequest();
    const reciprocal = await fetch(`${baseUrl}/api/connections/requests`, {
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
    const reciprocalRequest = (await reciprocal.json()).request;

    const blocked = await actOnRequest({
      requestId: firstRequest.id,
      actorId: "user-lin",
      action: "block",
    });
    assert.equal(blocked.response.status, 200);

    const reciprocalInbox = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=incoming`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    const reciprocalInboxBody = await reciprocalInbox.json();
    assert.equal(reciprocalInboxBody.requests[0].id, reciprocalRequest.id);
    assert.equal(reciprocalInboxBody.requests[0].status, "BLOCKED");

    const forbiddenAcceptance = await actOnRequest({
      requestId: reciprocalRequest.id,
      actorId: "user-zhou",
      action: "accept",
    });
    assert.equal(forbiddenAcceptance.response.status, 409);
    assert.equal(forbiddenAcceptance.body.error.code, "CONNECTION_BLOCKED");
  });

  test("blocking through an older request replays an existing pair-level block", async () => {
    const olderRequest = await createRequest();
    const rejected = await actOnRequest({
      requestId: olderRequest.id,
      actorId: "user-lin",
      action: "reject",
    });
    assert.equal(rejected.response.status, 200);

    const reciprocalResponse = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-lin",
      },
      body: JSON.stringify({
        recipient_id: "user-zhou",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    const reciprocalRequest = (await reciprocalResponse.json()).request;
    const firstBlock = await actOnRequest({
      requestId: reciprocalRequest.id,
      actorId: "user-lin",
      action: "block",
      reasonCode: "safety_concern",
    });
    assert.equal(firstBlock.body.idempotent_replay, false);

    const replayed = await actOnRequest({
      requestId: olderRequest.id,
      actorId: "user-lin",
      action: "block",
      reasonCode: "safety_concern",
    });
    assert.equal(replayed.response.status, 200);
    assert.equal(replayed.body.request.status, "BLOCKED");
    assert.equal(replayed.body.idempotent_replay, true);
  });

  test("blocking a reciprocal pending request keeps its existing Connection link", async () => {
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
    const accepted = await actOnRequest({
      requestId: firstRequest.id,
      actorId: "user-lin",
      action: "accept",
    });
    const connectionId = accepted.body.connection.id;

    const blocked = await actOnRequest({
      requestId: reciprocalRequest.id,
      actorId: "user-lin",
      action: "block",
    });
    assert.equal(blocked.response.status, 200);
    assert.equal(blocked.body.connection.id, connectionId);

    const outgoing = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing&status=BLOCKED`,
      { headers: { "x-demo-user-id": "user-lin" } },
    );
    const outgoingBody = await outgoing.json();
    assert.equal(outgoingBody.requests[0].id, reciprocalRequest.id);
    assert.equal(outgoingBody.requests[0].connection_id, connectionId);
  });

  test("either participant can block an accepted Connection and replay the action safely", async () => {
    const request = await createRequest();
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
    const accepted = await actOnRequest({
      requestId: request.id,
      actorId: "user-lin",
      action: "accept",
    });
    assert.equal(accepted.response.status, 200);
    const connectionId = accepted.body.connection.id;
    const reciprocalAccepted = await actOnRequest({
      requestId: reciprocalRequest.id,
      actorId: "user-zhou",
      action: "accept",
    });
    assert.equal(reciprocalAccepted.response.status, 200);
    assert.equal(reciprocalAccepted.body.connection.id, connectionId);

    const blocked = await actOnRequest({
      requestId: request.id,
      actorId: "user-zhou",
      action: "block",
      reasonCode: "safety_concern",
    });
    assert.equal(blocked.response.status, 200);
    assert.equal(blocked.body.request.status, "BLOCKED");
    assert.equal(blocked.body.connection.id, connectionId);
    assert.equal(blocked.body.connection.status, "BLOCKED");
    assert.equal(blocked.body.idempotent_replay, false);

    const repeated = await actOnRequest({
      requestId: request.id,
      actorId: "user-zhou",
      action: "block",
      reasonCode: "safety_concern",
    });
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.body.connection.id, connectionId);
    assert.equal(repeated.body.idempotent_replay, true);

    const readConnection = await fetch(
      `${baseUrl}/api/connections/${connectionId}`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    const readConnectionBody = await readConnection.json();
    assert.equal(readConnectionBody.connection.status, "BLOCKED");

    const outgoing = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing&status=BLOCKED`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    const outgoingBody = await outgoing.json();
    assert.equal(outgoingBody.requests[0].connection_id, connectionId);

    const reciprocalOutgoing = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing&status=BLOCKED`,
      { headers: { "x-demo-user-id": "user-lin" } },
    );
    const reciprocalOutgoingBody = await reciprocalOutgoing.json();
    assert.equal(reciprocalOutgoingBody.requests[0].id, reciprocalRequest.id);
    assert.equal(reciprocalOutgoingBody.requests[0].connection_id, connectionId);
  });
});
