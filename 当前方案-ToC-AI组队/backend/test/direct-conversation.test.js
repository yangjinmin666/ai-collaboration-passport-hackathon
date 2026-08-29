import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("direct conversation", () => {
  let api;
  let baseUrl;
  let currentTime;

  beforeEach(async () => {
    currentTime = new Date("2026-08-29T09:00:00.000Z");
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => new Date(currentTime),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  const headers = (userId) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
  });

  async function createConnection() {
    const created = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
      }),
    });
    const request = (await created.json()).request;
    const accepted = await fetch(`${baseUrl}/api/connections/requests/${request.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    return { request, connection: (await accepted.json()).connection };
  }

  test("connected participants exchange messages and persist independent read cursors", async () => {
    const { connection } = await createConnection();

    const sent = await fetch(`${baseUrl}/api/connections/${connection.id}/messages`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        text: "我们先聊清楚想服务哪类参展者？",
        client_message_id: "client-zhou-message-0001",
      }),
    });
    const sentBody = await sent.json();

    assert.equal(sent.status, 201);
    assert.equal(sentBody.message.sender_id, "user-zhou");
    assert.equal(sentBody.message.text, "我们先聊清楚想服务哪类参展者？");
    assert.equal(sentBody.idempotent_replay, false);

    const replay = await fetch(`${baseUrl}/api/connections/${connection.id}/messages`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        text: "我们先聊清楚想服务哪类参展者？",
        client_message_id: "client-zhou-message-0001",
      }),
    });
    const replayBody = await replay.json();
    assert.equal(replay.status, 200);
    assert.equal(replayBody.message.id, sentBody.message.id);
    assert.equal(replayBody.idempotent_replay, true);

    const linInbox = await fetch(
      `${baseUrl}/api/connections/${connection.id}/conversation`,
      { headers: headers("user-lin") },
    );
    const linInboxBody = await linInbox.json();

    assert.equal(linInbox.status, 200);
    assert.deepEqual(linInboxBody.conversation.counterpart, {
      id: "user-zhou",
      display_name: "周闻",
      avatar: "memoji-5",
      role: "AI / 后端构建者",
    });
    assert.equal(linInboxBody.conversation.context.event_name, "2026 AI Hardware Hackathon");
    assert.equal(linInboxBody.conversation.unread_count, 1);
    assert.equal(linInboxBody.conversation.messages.length, 1);
    assert.equal(linInboxBody.conversation.messages[0].id, sentBody.message.id);

    const markedRead = await fetch(
      `${baseUrl}/api/connections/${connection.id}/conversation`,
      {
        method: "PATCH",
        headers: headers("user-lin"),
        body: JSON.stringify({ last_read_message_id: sentBody.message.id }),
      },
    );
    assert.equal(markedRead.status, 200);
    assert.equal((await markedRead.json()).conversation.unread_count, 0);

    currentTime = new Date("2026-08-29T09:01:00.000Z");
    const replied = await fetch(`${baseUrl}/api/connections/${connection.id}/messages`, {
      method: "POST",
      headers: headers("user-lin"),
      body: JSON.stringify({
        text: "可以，我更想服务第一次参加黑客松的人。",
        client_message_id: "client-lin-message-0001",
      }),
    });
    assert.equal(replied.status, 201);

    const zhouInbox = await fetch(
      `${baseUrl}/api/connections/${connection.id}/conversation`,
      { headers: headers("user-zhou") },
    );
    const zhouInboxBody = await zhouInbox.json();
    assert.equal(zhouInboxBody.conversation.unread_count, 1);
    assert.equal(zhouInboxBody.conversation.messages.length, 2);
  });

  test("outsiders and blocked relationships cannot use the direct conversation", async () => {
    const { request, connection } = await createConnection();

    const outsiderRead = await fetch(
      `${baseUrl}/api/connections/${connection.id}/conversation`,
      { headers: headers("user-su") },
    );
    assert.equal(outsiderRead.status, 403);
    assert.equal((await outsiderRead.json()).error.code, "CONNECTION_FORBIDDEN");

    const outsiderSend = await fetch(`${baseUrl}/api/connections/${connection.id}/messages`, {
      method: "POST",
      headers: headers("user-su"),
      body: JSON.stringify({ text: "不应发送成功" }),
    });
    assert.equal(outsiderSend.status, 403);

    const blocked = await fetch(`${baseUrl}/api/connections/requests/${request.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "block", reason_code: "USER_REQUEST" }),
    });
    assert.equal(blocked.status, 200);

    const inactive = await fetch(
      `${baseUrl}/api/connections/${connection.id}/conversation`,
      { headers: headers("user-zhou") },
    );
    assert.equal(inactive.status, 409);
    assert.equal((await inactive.json()).error.code, "CONNECTION_INACTIVE");

    const blockedSend = await fetch(`${baseUrl}/api/connections/${connection.id}/messages`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({ text: "拉黑后不应发送成功" }),
    });
    assert.equal(blockedSend.status, 409);
    assert.equal((await blockedSend.json()).error.code, "CONNECTION_INACTIVE");
  });

  test("message pagination distinguishes an exact page from additional history", async () => {
    const { connection } = await createConnection();

    for (let index = 1; index <= 100; index += 1) {
      const sent = await fetch(`${baseUrl}/api/connections/${connection.id}/messages`, {
        method: "POST",
        headers: headers("user-zhou"),
        body: JSON.stringify({
          text: `消息 ${index}`,
          client_message_id: `client-pagination-${String(index).padStart(4, "0")}`,
        }),
      });
      assert.equal(sent.status, 201);
    }

    const exactPage = await fetch(
      `${baseUrl}/api/connections/${connection.id}/conversation`,
      { headers: headers("user-lin") },
    );
    const exactConversation = (await exactPage.json()).conversation;
    assert.equal(exactConversation.messages.length, 100);
    assert.equal(exactConversation.has_more, false);

    const overflow = await fetch(`${baseUrl}/api/connections/${connection.id}/messages`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        text: "消息 101",
        client_message_id: "client-pagination-0101",
      }),
    });
    assert.equal(overflow.status, 201);

    const additionalHistory = await fetch(
      `${baseUrl}/api/connections/${connection.id}/conversation`,
      { headers: headers("user-lin") },
    );
    const pagedConversation = (await additionalHistory.json()).conversation;
    assert.equal(pagedConversation.messages.length, 100);
    assert.equal(pagedConversation.messages[0].text, "消息 2");
    assert.equal(pagedConversation.messages.at(-1).text, "消息 101");
    assert.equal(pagedConversation.has_more, true);
  });
});
