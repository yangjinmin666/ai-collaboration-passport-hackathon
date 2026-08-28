import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("event membership, personal activity, and demo reset", () => {
  let api;
  let baseUrl;

  const headers = (userId) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
  });

  beforeEach(async () => {
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      demoAccessKey: "reset-test-key",
      clock: () => new Date("2026-08-29T09:00:00.000Z"),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  test("a preloaded account joins once, sees its own audit trail, and reset restores fixtures", async () => {
    const eventsBefore = await fetch(`${baseUrl}/api/events`, {
      headers: headers("user-mia"),
    });
    assert.equal(eventsBefore.status, 200);
    assert.equal((await eventsBefore.json()).events[0].joined, false);

    const joined = await fetch(`${baseUrl}/api/events/hackathon-2026/join`, {
      method: "POST",
      headers: headers("user-mia"),
      body: JSON.stringify({
        role: "品牌与路演设计师",
        status: "未组队",
        skills: ["品牌", "叙事", "Demo Day"],
        interests: ["AI 硬件", "公共表达"],
        availability: "今天 14:00–24:00，可投入 6 小时",
        collaboration_preferences: ["结对协作", "快速原型"],
        collaboration_need: "寻找技术团队",
        evidence: ["完成过 4 次产品发布叙事"],
      }),
    });
    const joinedBody = await joined.json();
    assert.equal(joined.status, 201);
    assert.equal(joinedBody.visibility.state, "HIDDEN");

    const replay = await fetch(`${baseUrl}/api/events/hackathon-2026/join`, {
      method: "POST",
      headers: headers("user-mia"),
      body: JSON.stringify({
        role: "品牌与路演设计师",
        status: "未组队",
        skills: ["品牌", "叙事", "Demo Day"],
        interests: ["AI 硬件"],
        availability: "今天可投入 6 小时",
        collaboration_preferences: ["结对协作"],
        collaboration_need: "寻找技术团队",
        evidence: [],
      }),
    });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).idempotent_replay, true);

    const activity = await fetch(
      `${baseUrl}/api/me/activity?event_id=hackathon-2026`,
      { headers: headers("user-mia") },
    );
    const activityBody = await activity.json();
    assert.equal(activity.status, 200);
    assert.equal(activityBody.activity[0].event_type, "event_joined");
    assert.equal(activityBody.activity.every((item) => item.actor_id === "user-mia"), true);

    const unauthorizedReset = await fetch(`${baseUrl}/api/demo/reset`, { method: "POST" });
    assert.equal(unauthorizedReset.status, 403);
    const reset = await fetch(`${baseUrl}/api/demo/reset`, {
      method: "POST",
      headers: { "x-demo-access-key": "reset-test-key" },
    });
    assert.equal(reset.status, 200);
    assert.equal((await reset.json()).reset, true);

    const eventsAfter = await fetch(`${baseUrl}/api/events`, {
      headers: headers("user-mia"),
    });
    assert.equal((await eventsAfter.json()).events[0].joined, false);

    const linCard = await fetch(
      `${baseUrl}/c/cp_B3kP8sT6yH2nV9qL?event=hackathon-2026&src=nfc`,
    );
    assert.equal(linCard.status, 200);
  });

  test("new product routes reject malformed paths and oversized JSON without a server error", async () => {
    const malformed = await fetch(`${baseUrl}/api/events/%E0%A4%A/join`, {
      method: "POST",
      headers: headers("user-mia"),
      body: "{}",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, "INVALID_PATH_PARAMETER");

    const oversized = await fetch(`${baseUrl}/api/events/hackathon-2026/profile`, {
      method: "PATCH",
      headers: headers("user-zhou"),
      body: JSON.stringify({ role: "x".repeat(70 * 1024) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error.code, "PAYLOAD_TOO_LARGE");
  });
});
