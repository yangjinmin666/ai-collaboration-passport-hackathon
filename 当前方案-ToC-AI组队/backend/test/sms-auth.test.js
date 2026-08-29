import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("SMS one-time-code sessions", () => {
  let api;
  let baseUrl;
  let deliveryError;
  let now;
  let sentMessages;

  beforeEach(async () => {
    now = new Date("2026-08-29T13:00:00.000Z");
    deliveryError = null;
    sentMessages = [];
    api = createApi({
      databasePath: ":memory:",
      clock: () => new Date(now),
      otpSecret: "integration-test-otp-secret",
      otpSender: async (message) => {
        if (deliveryError) throw deliveryError;
        sentMessages.push(message);
      },
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  test("a visitor can request a six-digit code without the code leaking in the response", async () => {
    const response = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "138 0013 8000", display_name: "小雨" }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.masked_phone, "138****8000");
    assert.equal(body.retry_after_seconds, 60);
    assert.match(body.challenge_id, /^otp_/);
    assert.match(body.expires_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(JSON.stringify(body).includes(sentMessages[0]?.code), false);
    assert.deepEqual(sentMessages, [{ phone: "+8613800138000", code: sentMessages[0].code }]);
    assert.match(sentMessages[0].code, /^\d{6}$/);
  });

  test("a correct code creates the first-time visitor and issues a Bearer session", async () => {
    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "13800138000", display_name: "小雨" }),
    });
    const challenge = await challengeResponse.json();

    const response = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challenge_id: challenge.challenge_id,
        code: sentMessages[0].code,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.token_type, "Bearer");
    assert.match(body.access_token, /^[A-Za-z0-9_-]{40,}$/);
    assert.equal(body.is_new_user, true);
    assert.deepEqual(body.user, {
      id: body.user.id,
      display_name: "小雨",
      avatar: body.user.avatar,
    });

    const meResponse = await fetch(`${baseUrl}/api/me`, {
      headers: { authorization: `Bearer ${body.access_token}` },
    });
    const me = await meResponse.json();
    assert.equal(meResponse.status, 200);
    assert.equal(me.user.display_name, "小雨");
    assert.deepEqual(me.profiles, [{
      event_id: "hackathon-2026",
      role: "待完善协作资料",
      status: "未组队",
      skills: [],
      interests: [],
      availability: "待补充",
      collaboration_preferences: [],
      collaboration_need: "",
      evidence: [],
      visibility: {
        state: "HIDDEN",
        public_fields: [],
        expires_at: "2099-12-31T23:59:59.999Z",
      },
    }]);
  });

  test("five incorrect attempts lock the challenge", async () => {
    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "13900139000", display_name: "阿辰" }),
    });
    const challenge = await challengeResponse.json();

    const incorrectCode = sentMessages[0].code === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rejected = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge_id: challenge.challenge_id, code: incorrectCode }),
      });
      assert.equal(rejected.status, 400);
      assert.equal((await rejected.json()).error.code, "INVALID_OTP");
    }

    const locked = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challenge_id: challenge.challenge_id,
        code: sentMessages[0].code,
      }),
    });
    assert.equal(locked.status, 400);
    assert.equal((await locked.json()).error.code, "INVALID_OTP");
  });

  test("a phone cannot request another code during the 60-second cooldown", async () => {
    const requestCode = () => fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "13700137000", display_name: "小禾" }),
    });
    assert.equal((await requestCode()).status, 201);
    now = new Date(now.getTime() + 30_000);

    const response = await requestCode();
    const body = await response.json();

    assert.equal(response.status, 429);
    assert.equal(body.error.code, "OTP_RATE_LIMITED");
    assert.equal(response.headers.get("retry-after"), "30");
    assert.equal(sentMessages.length, 1);
  });

  test("a phone can receive at most five codes per hour", async () => {
    const requestCode = () => fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "13600136000", display_name: "阿岚" }),
    });
    for (let sent = 0; sent < 5; sent += 1) {
      assert.equal((await requestCode()).status, 201);
      now = new Date(now.getTime() + 61_000);
    }

    const response = await requestCode();

    assert.equal(response.status, 429);
    assert.equal((await response.json()).error.code, "OTP_RATE_LIMITED");
    assert.equal(sentMessages.length, 5);
  });

  test("one client address can request at most twenty codes per hour", async () => {
    const requestCode = (index) => fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-real-ip": "203.0.113.8",
      },
      body: JSON.stringify({
        phone: String(13000000000 + index),
        display_name: `体验者 ${index}`,
      }),
    });
    for (let sent = 0; sent < 20; sent += 1) {
      assert.equal((await requestCode(sent)).status, 201);
    }

    const response = await requestCode(20);

    assert.equal(response.status, 429);
    assert.equal((await response.json()).error.code, "OTP_RATE_LIMITED");
    assert.equal(sentMessages.length, 20);
  });

  test("a delivery failure does not leave the visitor in cooldown", async () => {
    const requestCode = () => fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "13500135000", display_name: "小满" }),
    });
    deliveryError = new Error("Tencent API unavailable");

    const failed = await requestCode();
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).error.code, "OTP_DELIVERY_FAILED");

    deliveryError = null;
    const retried = await requestCode();
    assert.equal(retried.status, 201);
    assert.equal(sentMessages.length, 1);
  });

  test("an existing phone returns its account without accepting an unauthenticated rename", async () => {
    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "13800000001", display_name: "冒名改名" }),
    });
    const challenge = await challengeResponse.json();
    const response = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challenge_id: challenge.challenge_id,
        code: sentMessages[0].code,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.is_new_user, false);
    assert.deepEqual(body.user, {
      id: "user-zhou",
      display_name: "周闻",
      avatar: "memoji-5",
    });
  });

  test("a challenge cannot be reused after it issues a session", async () => {
    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "13400134000", display_name: "阿树" }),
    });
    const challenge = await challengeResponse.json();
    const sessionRequest = () => fetch(`${baseUrl}/api/auth/otp/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challenge_id: challenge.challenge_id,
        code: sentMessages[0].code,
      }),
    });

    assert.equal((await sessionRequest()).status, 201);
    const replay = await sessionRequest();
    assert.equal(replay.status, 400);
    assert.equal((await replay.json()).error.code, "INVALID_OTP");
  });

  test("a challenge expires after five minutes", async () => {
    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "13200132000", display_name: "小岛" }),
    });
    const challenge = await challengeResponse.json();
    now = new Date(now.getTime() + 5 * 60 * 1000);

    const response = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challenge_id: challenge.challenge_id,
        code: sentMessages[0].code,
      }),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_OTP");
  });
});
