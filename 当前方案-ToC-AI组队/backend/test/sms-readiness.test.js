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
      analytics: "ready",
    });
  });
});
