import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";
import {
  oauthCodeChallenge,
  oauthPublicOriginIsSecure,
  oauthStateSecretIsStrong,
} from "../src/oauth-auth.js";

const clientVerifier = "client-verifier-for-rally-oauth-login-1234567890";
const clientChallenge = oauthCodeChallenge(clientVerifier);

describe("WeChat and Google OAuth sessions", () => {
  let api;
  let baseUrl;
  let resolvedIdentities;

  beforeEach(async () => {
    resolvedIdentities = [];
    api = createApi({
      databasePath: ":memory:",
      clock: () => new Date("2026-08-29T13:00:00.000Z"),
      publicAppOrigin: "https://rally.example",
      publicApiOrigin: "https://api.rally.example",
      oauthStateSecret: "oauth-state-secret-for-integration-tests",
      androidAppLinkReady: true,
      oauthProviders: {
        google: {
          clientId: "google-client-id",
          clientSecret: "google-client-secret",
        },
        wechat: {
          clientId: "wechat-app-id",
          clientSecret: "wechat-app-secret",
        },
      },
      oauthIdentityResolver: async ({ provider, code, redirectUri }) => {
        resolvedIdentities.push({ provider, code, redirectUri });
        return provider === "google"
          ? {
              subject: "google-subject-123",
              email: "builder@example.com",
              emailVerified: true,
              displayName: "Google Builder",
            }
          : {
              subject: "wechat-union-id-456",
              email: null,
              emailVerified: false,
              displayName: "微信队友",
            };
      },
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  test("reports configured providers without exposing credentials", async () => {
    const response = await fetch(`${baseUrl}/api/auth/oauth/providers`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      providers: {
        google: { enabled: true, android_enabled: true },
        wechat: { enabled: true, android_enabled: false },
      },
    });
    assert.equal(JSON.stringify(body).includes("secret"), false);
  });

  test("requires clean HTTPS origins before enabling a provider", () => {
    assert.equal(oauthPublicOriginIsSecure("https://rally.example"), true);
    assert.equal(oauthPublicOriginIsSecure("https://rally.example/"), true);
    assert.equal(oauthPublicOriginIsSecure("http://rally.example"), false);
    assert.equal(oauthPublicOriginIsSecure("https://rally.example/callback"), false);
    assert.equal(oauthPublicOriginIsSecure("https://user:secret@rally.example"), false);
    assert.equal(oauthPublicOriginIsSecure(" https://rally.example "), false);
    assert.equal(oauthStateSecretIsStrong("short-secret"), false);
    assert.equal(oauthStateSecretIsStrong(" 12345678901234567890123456789012 "), false);
    assert.equal(oauthStateSecretIsStrong("12345678901234567890123456789012"), true);
  });

  test("Google OAuth creates a hidden first-time identity and exchanges a one-time ticket", async () => {
    const start = await fetch(
      `${baseUrl}/api/auth/oauth/google/start?return_to=${encodeURIComponent("https://rally.example/?variant=A&live=1")}&code_challenge=${clientChallenge}`,
      { redirect: "manual" },
    );
    const authorizationUrl = new URL(start.headers.get("location"));

    assert.equal(start.status, 302);
    assert.equal(authorizationUrl.origin, "https://accounts.google.com");
    assert.equal(authorizationUrl.searchParams.get("client_id"), "google-client-id");
    assert.equal(authorizationUrl.searchParams.get("scope"), "openid email profile");
    assert.equal(authorizationUrl.searchParams.get("redirect_uri"), "https://api.rally.example/api/auth/oauth/google/callback");
    assert.ok(authorizationUrl.searchParams.get("state"));

    const callback = await fetch(
      `${baseUrl}/api/auth/oauth/google/callback?code=provider-code&state=${encodeURIComponent(authorizationUrl.searchParams.get("state"))}`,
      { redirect: "manual" },
    );
    const returnUrl = new URL(callback.headers.get("location"));
    const ticket = returnUrl.searchParams.get("oauth_ticket");

    assert.equal(callback.status, 302);
    assert.equal(returnUrl.origin, "https://rally.example");
    assert.equal(returnUrl.searchParams.get("variant"), "A");
    assert.equal(returnUrl.searchParams.get("live"), "1");
    assert.equal(returnUrl.searchParams.get("oauth_provider"), "google");
    assert.match(ticket, /^[A-Za-z0-9_-]{40,}$/);
    assert.deepEqual(resolvedIdentities, [{
      provider: "google",
      code: "provider-code",
      redirectUri: "https://api.rally.example/api/auth/oauth/google/callback",
    }]);

    const sessionResponse = await fetch(`${baseUrl}/api/auth/oauth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket, verifier: clientVerifier }),
    });
    const session = await sessionResponse.json();

    assert.equal(sessionResponse.status, 201);
    assert.equal(session.token_type, "Bearer");
    assert.equal(session.is_new_user, true);
    assert.equal(session.provider, "google");
    assert.equal(session.user.display_name, "Google Builder");

    const meResponse = await fetch(`${baseUrl}/api/me`, {
      headers: { authorization: `Bearer ${session.access_token}` },
    });
    const me = await meResponse.json();
    assert.equal(meResponse.status, 200);
    assert.equal(me.user.display_name, "Google Builder");
    assert.equal(me.profiles[0].visibility.state, "HIDDEN");

    const replay = await fetch(`${baseUrl}/api/auth/oauth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket, verifier: clientVerifier }),
    });
    assert.equal(replay.status, 400);
    assert.equal((await replay.json()).error.code, "INVALID_OAUTH_TICKET");
  });

  test("WeChat start uses the mobile user-info authorization scope", async () => {
    const start = await fetch(
      `${baseUrl}/api/auth/oauth/wechat/start?return_to=${encodeURIComponent("https://rally.example/auth/android")}&code_challenge=${clientChallenge}`,
      { redirect: "manual" },
    );
    const authorizationUrl = new URL(start.headers.get("location"));

    assert.equal(start.status, 302);
    assert.equal(authorizationUrl.origin, "https://open.weixin.qq.com");
    assert.equal(authorizationUrl.searchParams.get("appid"), "wechat-app-id");
    assert.equal(authorizationUrl.searchParams.get("scope"), "snsapi_userinfo");
    assert.equal(authorizationUrl.hash, "#wechat_redirect");
  });

  test("rejects a callback whose signed state was changed", async () => {
    const start = await fetch(
      `${baseUrl}/api/auth/oauth/google/start?return_to=${encodeURIComponent("https://rally.example/?live=1")}&code_challenge=${clientChallenge}`,
      { redirect: "manual" },
    );
    const authorizationUrl = new URL(start.headers.get("location"));
    const state = authorizationUrl.searchParams.get("state");
    const callback = await fetch(
      `${baseUrl}/api/auth/oauth/google/callback?code=provider-code&state=${encodeURIComponent(`${state}changed`)}`,
      { redirect: "manual" },
    );

    assert.equal(callback.status, 400);
    assert.equal((await callback.json()).error.code, "INVALID_OAUTH_STATE");
    assert.deepEqual(resolvedIdentities, []);
  });

  test("a stolen ticket cannot be exchanged without the initiating client verifier", async () => {
    const start = await fetch(
      `${baseUrl}/api/auth/oauth/google/start?return_to=${encodeURIComponent("https://rally.example/?live=1")}&code_challenge=${clientChallenge}`,
      { redirect: "manual" },
    );
    const state = new URL(start.headers.get("location")).searchParams.get("state");
    const callback = await fetch(
      `${baseUrl}/api/auth/oauth/google/callback?code=provider-code&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    const ticket = new URL(callback.headers.get("location")).searchParams.get("oauth_ticket");

    const rejected = await fetch(`${baseUrl}/api/auth/oauth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ticket,
        verifier: "different-client-verifier-123456789012345678901234",
      }),
    });
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).error.code, "INVALID_OAUTH_TICKET");

    const accepted = await fetch(`${baseUrl}/api/auth/oauth/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket, verifier: clientVerifier }),
    });
    assert.equal(accepted.status, 201);
  });

  test("distinguishes user cancellation from provider failure", async () => {
    const start = await fetch(
      `${baseUrl}/api/auth/oauth/google/start?return_to=${encodeURIComponent("https://rally.example/?live=1")}&code_challenge=${clientChallenge}`,
      { redirect: "manual" },
    );
    const state = new URL(start.headers.get("location")).searchParams.get("state");
    const cancelled = await fetch(
      `${baseUrl}/api/auth/oauth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    assert.equal(
      new URL(cancelled.headers.get("location")).searchParams.get("oauth_error"),
      "cancelled",
    );

    const failed = await fetch(
      `${baseUrl}/api/auth/oauth/google/callback?error=temporarily_unavailable&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
    );
    assert.equal(
      new URL(failed.headers.get("location")).searchParams.get("oauth_error"),
      "provider_failed",
    );
  });
});
