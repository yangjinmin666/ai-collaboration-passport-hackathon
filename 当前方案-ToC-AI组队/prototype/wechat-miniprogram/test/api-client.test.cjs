const assert = require("node:assert/strict");
const { describe, test } = require("node:test");

const { createApiClient } = require("../miniprogram/utils/api.js");
const { loginWithWechat } = require("../miniprogram/utils/auth.js");

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key),
  };
}

describe("WeChat Mini Program API client", () => {
  test("sends authenticated requests to the configured COSPAN API", async () => {
    const calls = [];
    const storage = createStorage({ cospan_access_token: "session-token-123" });
    const api = createApiClient({
      baseUrl: "https://api.cospan.cn/",
      storage,
      request: async (options) => {
        calls.push(options);
        return { statusCode: 200, data: { people: [] }, header: {} };
      },
    });

    const result = await api.get("/api/events/hackathon-2026/discover", {
      project_id: "project 1",
    });

    assert.deepEqual(result, { people: [] });
    assert.equal(
      calls[0].url,
      "https://api.cospan.cn/api/events/hackathon-2026/discover?project_id=project+1",
    );
    assert.equal(calls[0].header.authorization, "Bearer session-token-123");
    assert.equal(calls[0].header["x-cospan-surface"], "mobile");
  });

  test("normalizes backend errors and clears an expired session", async () => {
    const storage = createStorage({ cospan_access_token: "expired-token" });
    let unauthorizedCalls = 0;
    const api = createApiClient({
      baseUrl: "https://api.cospan.cn",
      storage,
      onUnauthorized: () => { unauthorizedCalls += 1; },
      request: async () => ({
        statusCode: 401,
        data: { error: { code: "AUTH_REQUIRED", message: "Login required." } },
        header: {},
      }),
    });

    await assert.rejects(
      api.get("/api/me"),
      (error) => error.code === "AUTH_REQUIRED" && error.statusCode === 401,
    );
    assert.equal(storage.get("cospan_access_token"), undefined);
    assert.equal(unauthorizedCalls, 1);
  });

  test("exchanges wx.login code and persists only the COSPAN session", async () => {
    const storage = createStorage();
    const calls = [];
    const api = createApiClient({
      baseUrl: "https://api.cospan.cn",
      storage,
      request: async (options) => {
        calls.push(options);
        return {
          statusCode: 201,
          data: {
            access_token: "cospan-bearer-token",
            token_type: "Bearer",
            is_new_user: true,
            user: { id: "user-new", display_name: "COSPAN 新朋友" },
          },
          header: {},
        };
      },
    });
    const wxApi = {
      login: ({ success }) => success({ code: "wx-login-code" }),
    };

    const session = await loginWithWechat({ wxApi, api, storage });

    assert.equal(calls[0].url, "https://api.cospan.cn/api/auth/wechat-mini/sessions");
    assert.deepEqual(calls[0].data, { code: "wx-login-code" });
    assert.equal(calls[0].header.authorization, undefined);
    assert.equal(storage.get("cospan_access_token"), "cospan-bearer-token");
    assert.equal(storage.get("wechat_session_key"), undefined);
    assert.equal(session.is_new_user, true);
  });
});
