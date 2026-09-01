import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";
import { exchangeWechatMiniProgramCode } from "../src/wechat-mini-auth.js";

async function startApi(options = {}) {
  const api = createApi({
    databasePath: ":memory:",
    clock: () => new Date("2026-09-01T01:30:00.000Z"),
    wechatMiniProgram: {
      appId: "wx-cospan-mini-app-id",
      appSecret: "wechat-mini-app-secret",
    },
    wechatMiniIdentityResolver: async ({ code, config }) => {
      assert.equal(config.appId, "wx-cospan-mini-app-id");
      assert.equal(config.appSecret, "wechat-mini-app-secret");
      if (code === "provider-failure") throw new Error("provider unavailable");
      return {
        subject: "appid:wx-cospan-mini-app-id:openid:openid-builder-123",
      };
    },
    ...options,
  });
  const address = await api.start(0);
  return { api, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("WeChat Mini Program sessions", () => {
  let api;

  afterEach(async () => {
    await api?.stop();
  });

  test("keeps the app-scoped OpenID subject stable if UnionID appears later", async () => {
    let unionIdAvailable = false;
    const fetchImpl = async (_url, options) => {
      assert.equal(options.signal instanceof AbortSignal, true);
      return {
        ok: true,
        json: async () => ({
          openid: "openid-builder-123",
          ...(unionIdAvailable ? { unionid: "union-builder-456" } : {}),
        }),
      };
    };
    const exchange = () => exchangeWechatMiniProgramCode({
      code: "wx-login-code",
      config: { appId: "wx-cospan-mini-app-id", appSecret: "server-secret" },
      fetchImpl,
    });

    const first = await exchange();
    unionIdAvailable = true;
    const second = await exchange();

    assert.equal(first.subject, "appid:wx-cospan-mini-app-id:openid:openid-builder-123");
    assert.equal(second.subject, first.subject);
    assert.equal(second.unionIdSubject, "unionid:union-builder-456");
  });

  test("exchanges a wx.login code for a COSPAN session without exposing provider secrets", async () => {
    const started = await startApi();
    api = started.api;

    const response = await fetch(`${started.baseUrl}/api/auth/wechat-mini/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "wx-login-code-123" }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.token_type, "Bearer");
    assert.match(body.access_token, /^[A-Za-z0-9_-]{40,}$/);
    assert.equal(body.provider, "wechat_mini_program");
    assert.equal(body.is_new_user, true);
    assert.equal(body.user.display_name, "COSPAN 新朋友");
    assert.equal(JSON.stringify(body).includes("session_key"), false);
    assert.equal(JSON.stringify(body).includes("wechat-mini-app-secret"), false);

    const me = await fetch(`${started.baseUrl}/api/me`, {
      headers: { authorization: `Bearer ${body.access_token}` },
    });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.id, body.user.id);
  });

  test("restores the same COSPAN account for the same Mini Program identity", async () => {
    const started = await startApi();
    api = started.api;

    const login = async () => {
      const response = await fetch(`${started.baseUrl}/api/auth/wechat-mini/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "fresh-wx-login-code" }),
      });
      return { response, body: await response.json() };
    };
    const first = await login();
    const second = await login();

    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);
    assert.equal(first.body.is_new_user, true);
    assert.equal(second.body.is_new_user, false);
    assert.equal(second.body.user.id, first.body.user.id);
  });

  test("rejects malformed codes before calling WeChat", async () => {
    let resolverCalls = 0;
    const started = await startApi({
      wechatMiniIdentityResolver: async () => {
        resolverCalls += 1;
        return { subject: "should-not-run" };
      },
    });
    api = started.api;

    const response = await fetch(`${started.baseUrl}/api/auth/wechat-mini/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "" }),
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_WECHAT_MINI_CODE");
    assert.equal(resolverCalls, 0);
  });

  test("reports unavailable configuration and normalizes provider failures", async () => {
    let started = await startApi({ wechatMiniProgram: {} });
    api = started.api;
    let response = await fetch(`${started.baseUrl}/api/auth/wechat-mini/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "wx-login-code-123" }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "WECHAT_MINI_LOGIN_UNAVAILABLE");
    await api.stop();
    api = null;

    started = await startApi();
    api = started.api;
    response = await fetch(`${started.baseUrl}/api/auth/wechat-mini/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "provider-failure" }),
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, "WECHAT_MINI_LOGIN_FAILED");
  });
});
