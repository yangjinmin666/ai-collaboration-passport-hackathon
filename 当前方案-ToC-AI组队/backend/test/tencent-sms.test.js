import assert from "node:assert/strict";
import { test } from "node:test";

import { createTencentSmsSender } from "../src/tencent-sms.js";

test("the Tencent sender calls SendSms with the configured RALLY application and OTP template", async () => {
  let captured;
  const sender = createTencentSmsSender({
    secretId: "AKIDEXAMPLE",
    secretKey: "example-secret-key",
    sdkAppId: "1401184659",
    signName: "RALLY集结",
    templateId: "24681012",
    region: "ap-guangzhou",
  }, {
    clock: () => new Date("2026-08-29T13:00:00.000Z"),
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({
        Response: {
          RequestId: "request-1",
          SendStatusSet: [{ Code: "Ok", Message: "send success" }],
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  await sender({ phone: "+8613800138000", code: "123456" });

  assert.equal(captured.url, "https://sms.tencentcloudapi.com/");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers["X-TC-Action"], "SendSms");
  assert.equal(captured.options.headers["X-TC-Version"], "2021-01-11");
  assert.equal(captured.options.headers["X-TC-Region"], "ap-guangzhou");
  assert.equal(captured.options.headers["X-TC-Timestamp"], "1788008400");
  assert.match(
    captured.options.headers.Authorization,
    /^TC3-HMAC-SHA256 Credential=AKIDEXAMPLE\/2026-08-29\/sms\/tc3_request, SignedHeaders=content-type;host;x-tc-action, Signature=[0-9a-f]{64}$/,
  );
  assert.deepEqual(JSON.parse(captured.options.body), {
    PhoneNumberSet: ["+8613800138000"],
    SmsSdkAppId: "1401184659",
    SignName: "RALLY集结",
    TemplateId: "24681012",
    TemplateParamSet: ["123456", "5"],
  });
});
