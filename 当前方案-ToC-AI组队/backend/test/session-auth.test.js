import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("preloaded demo sessions", () => {
  let api;
  let baseUrl;

  beforeEach(async () => {
    api = createApi({
      databasePath: ":memory:",
      demoAccessKey: "integration-test-key",
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  test("a protected preloaded account issues a Bearer session accepted by authenticated APIs", async () => {
    const login = await fetch(`${baseUrl}/api/auth/demo-sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-access-key": "integration-test-key",
      },
      body: JSON.stringify({ user_id: "user-lin" }),
    });
    const loginBody = await login.json();

    assert.equal(login.status, 201);
    assert.deepEqual(loginBody.user, {
      id: "user-lin",
      display_name: "林澈",
      avatar: "memoji-4",
    });
    assert.equal(loginBody.token_type, "Bearer");
    assert.match(loginBody.access_token, /^[A-Za-z0-9_-]{40,}$/);
    assert.match(loginBody.expires_at, /^\d{4}-\d{2}-\d{2}T/);

    const request = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${loginBody.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipient_id: "user-zhou",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    const requestBody = await request.json();

    assert.equal(request.status, 201);
    assert.equal(requestBody.request.requester_id, "user-lin");
  });

  test("the demo login endpoint rejects callers without the out-of-band access key", async () => {
    const response = await fetch(`${baseUrl}/api/auth/demo-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: "user-lin" }),
    });

    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "DEMO_ACCESS_DENIED");
  });

  test("logging out revokes the Bearer session for subsequent API calls", async () => {
    const login = await fetch(`${baseUrl}/api/auth/demo-sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-access-key": "integration-test-key",
      },
      body: JSON.stringify({ user_id: "user-lin" }),
    });
    const { access_token: accessToken } = await login.json();

    const logout = await fetch(`${baseUrl}/api/auth/session`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(logout.status, 204);

    const afterLogout = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipient_id: "user-zhou",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    assert.equal(afterLogout.status, 401);
  });
});
