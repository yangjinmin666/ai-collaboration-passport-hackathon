import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("connection request inbox", () => {
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

  test("both participants can poll their side of a request with counterpart context", async () => {
    const created = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
        message: "想聊聊 ESP32 与端侧 AI 的组合",
      }),
    });
    const createdRequest = (await created.json()).request;

    const incoming = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=incoming`,
      { headers: { "x-demo-user-id": "user-lin" } },
    );
    const incomingBody = await incoming.json();

    assert.equal(incoming.status, 200);
    assert.equal(incomingBody.requests.length, 1);
    assert.deepEqual(
      {
        id: incomingBody.requests[0].id,
        direction: incomingBody.requests[0].direction,
        status: incomingBody.requests[0].status,
        source: incomingBody.requests[0].source,
        message: incomingBody.requests[0].message,
        connection_id: incomingBody.requests[0].connection_id,
        counterpart: incomingBody.requests[0].counterpart,
      },
      {
        id: createdRequest.id,
        direction: "incoming",
        status: "REQUESTED",
        source: "nfc",
        message: "想聊聊 ESP32 与端侧 AI 的组合",
        connection_id: null,
        counterpart: {
          id: "user-zhou",
          display_name: "周闻",
          avatar: "memoji-5",
          role: "AI / 后端构建者",
          status: "团队缺人",
        },
      },
    );
    assert.equal(incomingBody.sync.poll_after_ms, 2500);
    assert.match(incomingBody.sync.server_time, /^\d{4}-\d{2}-\d{2}T/);

    const outgoing = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    const outgoingBody = await outgoing.json();

    assert.equal(outgoing.status, 200);
    assert.equal(outgoingBody.requests[0].id, createdRequest.id);
    assert.equal(outgoingBody.requests[0].direction, "outgoing");
    assert.equal(outgoingBody.requests[0].counterpart.id, "user-lin");
  });
});
