import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("activity-scoped live presence", () => {
  let api;
  let baseUrl;
  let now;

  const headers = (userId) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
  });

  beforeEach(async () => {
    now = new Date("2026-08-29T04:00:00.000Z");
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => now,
      presenceTtlMs: 2 * 60 * 1000,
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function publish(userId, latitude, longitude) {
    return fetch(`${baseUrl}/api/events/hackathon-2026/presence`, {
      method: "PUT",
      headers: headers(userId),
      body: JSON.stringify({ latitude, longitude, accuracy_m: 18 }),
    });
  }

  test("nearby discovery uses short-lived coordinates without exposing them", async () => {
    assert.equal((await publish("user-zhou", 31.23040, 121.47370)).status, 200);
    assert.equal((await publish("user-lin", 31.23055, 121.47382)).status, 200);
    assert.equal((await publish("user-su", 31.23043, 121.47372)).status, 409);

    const response = await fetch(
      `${baseUrl}/api/events/hackathon-2026/nearby`,
      { headers: headers("user-zhou") },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.nearby.length, 1);
    assert.deepEqual(body.nearby[0], {
      user_id: "user-lin",
      display_name: "林澈",
      avatar: "memoji-4",
      role: "硬件构建者",
      status: "未组队",
      skills: ["嵌入式", "IoT", "结构打样"],
      interests: ["端侧 AI", "智能硬件"],
      availability: "今天全天，可持续投入 8 小时",
      collaboration_preferences: ["快速原型", "现场联调"],
      collaboration_need: "寻找 AI / 后端搭档",
      distance: { band: "under_50m", label: "50 米内" },
      last_seen_at: "2026-08-29T04:00:00.000Z",
    });
    assert.equal(JSON.stringify(body).includes("latitude"), false);
    assert.equal(JSON.stringify(body).includes("longitude"), false);

    const stopped = await fetch(`${baseUrl}/api/events/hackathon-2026/presence`, {
      method: "DELETE",
      headers: headers("user-lin"),
    });
    assert.equal(stopped.status, 204);
    const afterStop = await fetch(
      `${baseUrl}/api/events/hackathon-2026/nearby`,
      { headers: headers("user-zhou") },
    );
    assert.deepEqual(await afterStop.json(), {
      nearby: [],
      presence_required: false,
      poll_after_ms: 15000,
    });
    assert.equal((await publish("user-lin", 31.23055, 121.47382)).status, 200);

    now = new Date("2026-08-29T04:02:00.001Z");
    const stale = await fetch(
      `${baseUrl}/api/events/hackathon-2026/nearby`,
      { headers: headers("user-zhou") },
    );
    assert.deepEqual(await stale.json(), {
      nearby: [],
      presence_required: true,
      poll_after_ms: 15000,
    });
  });

  test("nearby respects field grants and pausing removes the old heartbeat", async () => {
    assert.equal((await publish("user-zhou", 31.23040, 121.47370)).status, 200);
    assert.equal((await publish("user-lin", 31.23055, 121.47382)).status, 200);

    const narrowed = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({
        state: "VISIBLE",
        expires_at: "2026-08-29T23:00:00.000Z",
        public_fields: ["display_name"],
      }),
    });
    assert.equal(narrowed.status, 200);
    const narrowedNearby = await fetch(`${baseUrl}/api/events/hackathon-2026/nearby`, {
      headers: headers("user-zhou"),
    });
    const narrowedPerson = (await narrowedNearby.json()).nearby[0];
    assert.equal(narrowedPerson.display_name, "林澈");
    for (const privateField of [
      "avatar",
      "role",
      "status",
      "skills",
      "interests",
      "availability",
      "collaboration_preferences",
      "collaboration_need",
    ]) {
      assert.equal(privateField in narrowedPerson, false);
    }

    const paused = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ state: "PAUSED" }),
    });
    assert.equal(paused.status, 200);
    const resumed = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ state: "VISIBLE", expires_at: "2026-08-29T23:00:00.000Z" }),
    });
    assert.equal(resumed.status, 200);
    const afterResume = await fetch(`${baseUrl}/api/events/hackathon-2026/nearby`, {
      headers: headers("user-zhou"),
    });
    assert.deepEqual((await afterResume.json()).nearby, []);

    assert.equal((await publish("user-lin", 31.23055, 121.47382)).status, 200);
    const requested = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    const requestId = (await requested.json()).request.id;
    const blocked = await fetch(`${baseUrl}/api/connections/requests/${requestId}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "block" }),
    });
    assert.equal(blocked.status, 200);
    const afterBlock = await fetch(`${baseUrl}/api/events/hackathon-2026/nearby`, {
      headers: headers("user-zhou"),
    });
    assert.deepEqual((await afterBlock.json()).nearby, []);
  });

  test("nearby access stops as soon as the requester's visibility expires", async () => {
    const visibility = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        state: "VISIBLE",
        expires_at: "2026-08-29T04:01:00.000Z",
      }),
    });
    assert.equal(visibility.status, 200);
    assert.equal((await publish("user-zhou", 31.23040, 121.47370)).status, 200);
    now = new Date("2026-08-29T04:01:00.001Z");
    const nearby = await fetch(`${baseUrl}/api/events/hackathon-2026/nearby`, {
      headers: headers("user-zhou"),
    });
    assert.equal(nearby.status, 403);
    assert.equal((await nearby.json()).error.code, "VISIBILITY_REQUIRED");
  });
});
