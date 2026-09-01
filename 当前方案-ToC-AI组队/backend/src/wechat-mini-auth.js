const WECHAT_CODE_TO_SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";

export const WECHAT_MINI_PROGRAM_PROVIDER = "wechat_mini_program";

export function wechatMiniProgramIsConfigured(config) {
  return [config?.appId, config?.appSecret].every(
    (value) => typeof value === "string" && value.trim() === value && value.length > 0,
  );
}

export async function exchangeWechatMiniProgramCode({
  code,
  config,
  fetchImpl = fetch,
  timeoutMs = 8_000,
}) {
  if (!wechatMiniProgramIsConfigured(config)) {
    throw new Error("WECHAT_MINI_PROGRAM_NOT_CONFIGURED");
  }
  const url = new URL(WECHAT_CODE_TO_SESSION_URL);
  url.searchParams.set("appid", config.appId);
  url.searchParams.set("secret", config.appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetchImpl(url, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error("WECHAT_MINI_PROGRAM_PROVIDER_FAILED");
  const payload = await response.json();
  if (
    payload?.errcode
    || typeof payload?.openid !== "string"
    || !payload.openid
    || payload.openid.length > 255
  ) {
    throw new Error("WECHAT_MINI_PROGRAM_IDENTITY_INVALID");
  }

  const unionIdSubject = typeof payload.unionid === "string" && payload.unionid
    ? `unionid:${payload.unionid}`
    : null;
  return {
    subject: `appid:${config.appId}:openid:${payload.openid}`,
    unionIdSubject,
  };
}
