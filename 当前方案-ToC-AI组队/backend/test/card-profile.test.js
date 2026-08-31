import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("NFC card public profile", () => {
  let api;
  let baseUrl;

  before(async () => {
    api = createApi({ databasePath: ":memory:" });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await api.stop();
  });

  test("health check reports the API is ready", async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "rally-api",
      sms_login: "disabled",
      sms_delivery: "disabled",
      analytics: "ready",
    });
  });

  test("an active NFC card exposes only its owner's authorized public profile", async () => {
    const response = await fetch(
      `${baseUrl}/api/cards/cp_B3kP8sT6yH2nV9qL/profile?event_id=hackathon-2026&source=nfc`,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, "nfc");
    assert.deepEqual(body.event, {
      id: "hackathon-2026",
      name: "2026 AI Hardware Hackathon",
    });
    assert.deepEqual(body.profile, {
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
      evidence: ["做过 3 个 ESP32 端侧项目"],
    });
    assert.equal("email" in body.profile, false);
    assert.equal("phone" in body.profile, false);
  });

  test("the URL encoded on an NFC card resolves through the public /c route", async () => {
    const response = await fetch(
      `${baseUrl}/c/cp_B3kP8sT6yH2nV9qL?event=hackathon-2026&src=nfc`,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, "nfc");
    assert.equal(body.profile.user_id, "user-lin");
  });

  test("a visibility grant exposes only the profile fields its owner authorized", async () => {
    const response = await fetch(
      `${baseUrl}/c/cp_7mJ4Qv9N2xK8Rt5W?event=hackathon-2026&src=qr`,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.profile, {
      user_id: "user-zhou",
      display_name: "周闻",
      avatar: "memoji-5",
      role: "AI / 后端构建者",
      status: "团队缺人",
      skills: ["Agent", "API", "端侧 AI"],
      interests: ["端侧 AI", "现场协作"],
      availability: "今天 18:00–24:00，可持续投入 6 小时",
      collaboration_preferences: ["快速原型", "结对协作"],
    });
  });

  test("a paused profile is indistinguishable from a missing or inactive card", async () => {
    const response = await fetch(
      `${baseUrl}/api/cards/cp_F6wR1cZ8mN4jX2pD/profile?event_id=hackathon-2026&source=qr`,
    );
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      error: {
        code: "CARD_NOT_AVAILABLE",
        message: "This collaboration card is not available.",
      },
    });
  });

  test("a malformed encoded card token is rejected as a client error", async () => {
    const response = await fetch(
      `${baseUrl}/c/%?event=hackathon-2026&src=nfc`,
    );

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_PATH_PARAMETER");
  });

  test("the public card route names its event query requirement without legacy wording", async () => {
    const response = await fetch(`${baseUrl}/c/cp_B3kP8sT6yH2nV9qL?src=nfc`);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: "EVENT_REQUIRED",
        message: "An event query parameter is required.",
      },
    });
  });
});
