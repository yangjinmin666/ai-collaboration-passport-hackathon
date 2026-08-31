import assert from "node:assert/strict";
import { test } from "node:test";

import { createResendEmailSender } from "../src/resend-email.js";

test("the Resend sender keeps its API key server-side and sends the COSPAN code", async () => {
  let request;
  const sender = createResendEmailSender({
    apiKey: "re_private_test_key",
    from: "COSPAN 合拍 <login@example.com>",
  }, {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await sender({
    email: "person@example.net",
    code: "246810",
    expiresInMinutes: 10,
  });

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers.authorization, "Bearer re_private_test_key");
  assert.deepEqual(JSON.parse(request.options.body), {
    from: "COSPAN 合拍 <login@example.com>",
    to: ["person@example.net"],
    subject: "COSPAN 合拍登录验证码",
    text: "你的 COSPAN 合拍验证码是 246810。10 分钟内有效，请勿转发。",
    html: '<div style="font-family:system-ui,-apple-system,sans-serif;color:#17212d;line-height:1.6"><p>你的 COSPAN 合拍验证码是：</p><p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:16px 0">246810</p><p>10 分钟内有效，请勿转发。</p></div>',
  });
});
