import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("SMS login readiness", () => {
  let api;
  let baseUrl;

  before(async () => {
    api = createApi({
      databasePath: ":memory:",
      otpSecret: "integration-test-otp-secret",
      otpSender: async () => {},
      otpDeliveryMode: "tencent_cloud",
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await api.stop();
  });

  test("health reports SMS login ready only when verification can be sent", async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "rally-api",
      sms_login: "ready",
      sms_delivery: "tencent_cloud",
      email_login: "disabled",
      email_delivery: "disabled",
      analytics: "ready",
    });
  });

  test("health and challenge responses disclose fixed demo mode without leaking its code", async () => {
    const fixedApi = createApi({
      databasePath: ":memory:",
      otpSecret: "integration-test-otp-secret",
      otpSender: async () => {},
      otpDeliveryMode: "fixed_demo",
      otpCodeGenerator: () => "123456",
    });
    const address = await fixedApi.start(0);
    const fixedBaseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const health = await (await fetch(`${fixedBaseUrl}/health`)).json();
      assert.equal(health.sms_login, "ready");
      assert.equal(health.sms_delivery, "fixed_demo");

      const response = await fetch(`${fixedBaseUrl}/api/auth/otp/challenges`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "13800138000" }),
      });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.delivery_mode, "fixed_demo");
      assert.equal(JSON.stringify(body).includes("123456"), false);
    } finally {
      await fixedApi.stop();
    }
  });
});
