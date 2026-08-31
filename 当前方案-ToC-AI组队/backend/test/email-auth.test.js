import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";
import { createExperienceInviteToken } from "../src/experience-invite.js";

describe("email one-time-code authentication", () => {
  const emailSecret = "integration-test-email-secret";
  const inviteSecret = "experience-invite-secret-with-at-least-32-characters";
  let api;
  let baseUrl;
  let now;
  let deliveryError;
  let sentMessages;

  beforeEach(async () => {
    now = new Date("2026-09-01T03:00:00.000Z");
    deliveryError = null;
    sentMessages = [];
    api = createApi({
      databasePath: ":memory:",
      clock: () => new Date(now),
      emailSecret,
      emailSender: async (message) => {
        if (deliveryError) throw deliveryError;
        sentMessages.push(message);
      },
      experienceInviteSecret: inviteSecret,
      analyticsAdminToken: "email-test-analytics-admin-token-123456789",
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function post(path, body, token = null) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { response, body: await response.json() };
  }

  test("a visitor can request a code without the code leaking in the response", async () => {
    const { response, body } = await post("/api/auth/email/challenges", {
      email: " Hello@Example.COM ",
    });

    assert.equal(response.status, 201);
    assert.match(body.challenge_id, /^email_/);
    assert.equal(body.masked_email, "h***o@example.com");
    assert.equal(body.retry_after_seconds, 60);
    assert.equal(JSON.stringify(body).includes(sentMessages[0].code), false);
    assert.deepEqual(sentMessages, [{
      email: "hello@example.com",
      code: sentMessages[0].code,
      expiresInMinutes: 10,
    }]);
    assert.match(sentMessages[0].code, /^\d{6}$/);
  });

  test("a verified email creates a hidden user and a revocable session", async () => {
    const requested = await post("/api/auth/email/challenges", {
      email: "new.person@example.com",
    });
    const { response, body } = await post("/api/auth/email/sessions", {
      challenge_id: requested.body.challenge_id,
      code: sentMessages[0].code,
    });

    assert.equal(response.status, 201);
    assert.equal(body.is_new_user, true);
    assert.equal(body.token_type, "Bearer");
    assert.match(body.access_token, /^[A-Za-z0-9_-]{40,}$/);

    const me = await fetch(`${baseUrl}/api/me`, {
      headers: { authorization: `Bearer ${body.access_token}` },
    });
    const meBody = await me.json();
    assert.equal(me.status, 200);
    assert.equal(meBody.user.id, body.user.id);
    assert.equal(meBody.profiles[0].visibility.state, "HIDDEN");

    const analytics = await fetch(
      `${baseUrl}/api/admin/analytics/summary?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": "email-test-analytics-admin-token-123456789" } },
    );
    const summary = await analytics.json();
    const counts = Object.fromEntries(
      summary.event_counts.map((item) => [item.event_name, item.total]),
    );
    assert.equal(counts.login_otp_requested, 1);
    assert.equal(counts.login_otp_verified, 1);
    assert.equal(summary.sources.some((item) => item.source === "email_login"), true);
  });

  test("an experience participant can bind email and restore the same account on another device", async () => {
    const invite = createExperienceInviteToken({
      secret: inviteSecret,
      campaignId: "email-binding-test",
      eventId: "hackathon-2026",
      maxUses: 2,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    });
    const experience = await post("/api/auth/experience-sessions", {
      token: invite,
      client_id: "client_abcdefghijklmnopqrstuvwxyz123456",
    });
    const experienceToken = experience.body.access_token;
    const userId = experience.body.user.id;

    const binding = await post("/api/me/email/challenges", {
      email: "owner@example.com",
    }, experienceToken);
    assert.equal(binding.response.status, 201);
    const verified = await fetch(`${baseUrl}/api/me/email`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${experienceToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        challenge_id: binding.body.challenge_id,
        code: sentMessages[0].code,
      }),
    });
    assert.equal(verified.status, 200);
    assert.deepEqual(await verified.json(), {
      email: "owner@example.com",
      masked_email: "o***r@example.com",
    });

    const methods = await fetch(`${baseUrl}/api/me/auth-methods`, {
      headers: { authorization: `Bearer ${experienceToken}` },
    });
    assert.deepEqual(await methods.json(), {
      email: { bound: true, masked_email: "o***r@example.com" },
      phone: { bound: false, masked_phone: null },
    });

    now = new Date(now.getTime() + 61_000);
    sentMessages = [];
    const login = await post("/api/auth/email/challenges", {
      email: "OWNER@example.com",
    });
    const restored = await post("/api/auth/email/sessions", {
      challenge_id: login.body.challenge_id,
      code: sentMessages[0].code,
    });
    assert.equal(restored.response.status, 201);
    assert.equal(restored.body.is_new_user, false);
    assert.equal(restored.body.user.id, userId);
  });

  test("one account cannot bind an email already owned by another account", async () => {
    const firstRequest = await post("/api/auth/email/challenges", {
      email: "claimed@example.com",
    });
    const firstLogin = await post("/api/auth/email/sessions", {
      challenge_id: firstRequest.body.challenge_id,
      code: sentMessages[0].code,
    });

    now = new Date(now.getTime() + 61_000);
    sentMessages = [];
    const demoLogin = await post("/api/auth/demo-sessions", { user_id: "user-zhou" });
    assert.equal(demoLogin.response.status, 403);

    const invite = createExperienceInviteToken({
      secret: inviteSecret,
      campaignId: "second-account",
      eventId: "hackathon-2026",
      maxUses: 1,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    });
    const second = await post("/api/auth/experience-sessions", {
      token: invite,
      client_id: "client_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    const binding = await post("/api/me/email/challenges", {
      email: "claimed@example.com",
    }, second.body.access_token);
    const conflict = await fetch(`${baseUrl}/api/me/email`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${second.body.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        challenge_id: binding.body.challenge_id,
        code: sentMessages[0].code,
      }),
    });
    assert.equal(firstLogin.response.status, 201);
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, "EMAIL_ALREADY_BOUND");
  });

  test("delivery failure does not leave the email in cooldown", async () => {
    deliveryError = new Error("provider unavailable");
    const failed = await post("/api/auth/email/challenges", {
      email: "retry@example.com",
    });
    assert.equal(failed.response.status, 502);
    assert.equal(failed.body.error.code, "EMAIL_DELIVERY_FAILED");

    deliveryError = null;
    const retried = await post("/api/auth/email/challenges", {
      email: "retry@example.com",
    });
    assert.equal(retried.response.status, 201);
    assert.equal(sentMessages.length, 1);
  });
});
