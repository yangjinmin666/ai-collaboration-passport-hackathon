import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";
import { createExperienceInviteToken } from "../src/experience-invite.js";

describe("experience-group invite sessions", () => {
  const inviteSecret = "experience-invite-secret-with-at-least-32-characters";
  const now = new Date("2026-09-01T01:00:00.000Z");
  let api;
  let baseUrl;

  beforeEach(async () => {
    api = createApi({
      databasePath: ":memory:",
      clock: () => now,
      experienceInviteSecret: inviteSecret,
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  function inviteToken({ campaignId = "group-alpha", maxUses = 2, expiresAt } = {}) {
    return createExperienceInviteToken({
      secret: inviteSecret,
      campaignId,
      eventId: "hackathon-2026",
      maxUses,
      expiresAt: expiresAt ?? new Date(now.getTime() + 60 * 60 * 1000),
    });
  }

  async function redeem({ token = inviteToken(), clientId = "client_abcdefghijklmnopqrstuvwxyz123456" } = {}) {
    const response = await fetch(`${baseUrl}/api/auth/experience-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, client_id: clientId }),
    });
    return { response, body: await response.json() };
  }

  test("a signed group link creates a real hidden user and Bearer session", async () => {
    const { response, body } = await redeem();

    assert.equal(response.status, 201);
    assert.equal(body.is_new_user, true);
    assert.equal(body.token_type, "Bearer");
    assert.match(body.access_token, /^[A-Za-z0-9_-]{40,}$/);
    assert.equal(body.user.display_name, "COSPAN 新朋友");

    const me = await fetch(`${baseUrl}/api/me`, {
      headers: { authorization: `Bearer ${body.access_token}` },
    });
    const meBody = await me.json();
    assert.equal(me.status, 200);
    assert.equal(meBody.user.id, body.user.id);
    assert.equal(meBody.profiles[0].visibility.state, "HIDDEN");
    assert.deepEqual(meBody.profiles[0].visibility.public_fields, []);
  });

  test("the same link and device resume the same account without consuming another seat", async () => {
    const token = inviteToken({ maxUses: 1 });
    const first = await redeem({ token });
    const replay = await redeem({ token });

    assert.equal(first.response.status, 201);
    assert.equal(replay.response.status, 201);
    assert.equal(replay.body.is_new_user, false);
    assert.equal(replay.body.user.id, first.body.user.id);
  });

  test("different devices cannot exceed the signed invite capacity", async () => {
    const token = inviteToken({ maxUses: 1 });
    const first = await redeem({ token, clientId: "client_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
    const full = await redeem({ token, clientId: "client_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });

    assert.equal(first.response.status, 201);
    assert.equal(full.response.status, 409);
    assert.equal(full.body.error.code, "EXPERIENCE_INVITE_FULL");
  });

  test("expired or changed links are rejected without creating an account", async () => {
    const expired = inviteToken({ expiresAt: new Date(now.getTime() - 1000) });
    const changed = `${inviteToken().slice(0, -1)}x`;

    const expiredResult = await redeem({ token: expired });
    const changedResult = await redeem({ token: changed });

    assert.equal(expiredResult.response.status, 400);
    assert.equal(expiredResult.body.error.code, "INVALID_EXPERIENCE_INVITE");
    assert.equal(changedResult.response.status, 400);
    assert.equal(changedResult.body.error.code, "INVALID_EXPERIENCE_INVITE");
  });
});
