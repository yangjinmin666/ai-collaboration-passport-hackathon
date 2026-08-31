const RESEND_ENDPOINT = "https://api.resend.com/emails";

function requiredString(config, name) {
  const value = config?.[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`Resend email configuration is missing ${name}.`);
  }
  return value.trim();
}

export function createResendEmailSender(config, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
} = {}) {
  const apiKey = requiredString(config, "apiKey");
  const from = requiredString(config, "from");

  return async function sendEmailCode({ email, code, expiresInMinutes }) {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "COSPAN 合拍登录验证码",
        text: `你的 COSPAN 合拍验证码是 ${code}。${expiresInMinutes} 分钟内有效，请勿转发。`,
        html: `<div style="font-family:system-ui,-apple-system,sans-serif;color:#17212d;line-height:1.6"><p>你的 COSPAN 合拍验证码是：</p><p style="font-size:30px;font-weight:800;letter-spacing:6px;margin:16px 0">${code}</p><p>${expiresInMinutes} 分钟内有效，请勿转发。</p></div>`,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || typeof result?.id !== "string") {
      const codeName = result?.name || result?.message || `HTTP_${response.status}`;
      throw new Error(`Resend email delivery failed: ${codeName}`);
    }
  };
}
