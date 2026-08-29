import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const WECHAT_AUTHORIZATION_URL = "https://open.weixin.qq.com/connect/oauth2/authorize";
const WECHAT_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token";
const WECHAT_USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo";

export const OAUTH_PROVIDERS = Object.freeze(["google", "wechat"]);

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signStatePayload(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesEqual(first, second) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

export function oauthProviderIsConfigured(config) {
  return Boolean(
    config
    && typeof config.clientId === "string"
    && config.clientId.trim()
    && typeof config.clientSecret === "string"
    && config.clientSecret.trim(),
  );
}

export function oauthPublicOriginIsSecure(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && (url.pathname === "/" || url.pathname === "")
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

export function oauthStateSecretIsStrong(value) {
  return typeof value === "string"
    && value === value.trim()
    && Buffer.byteLength(value, "utf8") >= 32;
}

export function oauthCodeChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function normalizeOAuthReturnTo(value, publicAppOrigin) {
  if (typeof publicAppOrigin !== "string" || !publicAppOrigin) return null;
  try {
    const allowedOrigin = new URL(publicAppOrigin).origin;
    const candidate = new URL(value || publicAppOrigin, publicAppOrigin);
    if (candidate.origin !== allowedOrigin || !["http:", "https:"].includes(candidate.protocol)) {
      return null;
    }
    candidate.hash = "";
    candidate.searchParams.delete("oauth_ticket");
    candidate.searchParams.delete("oauth_provider");
    candidate.searchParams.delete("oauth_error");
    return candidate.href;
  } catch {
    return null;
  }
}

export function createOAuthState({
  secret,
  provider,
  returnTo,
  codeChallenge,
  now,
  ttlMs = 10 * 60 * 1000,
}) {
  const payload = encodeJson({
    provider,
    return_to: returnTo,
    code_challenge: codeChallenge,
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    nonce: randomBytes(18).toString("base64url"),
  });
  return `${payload}.${signStatePayload(secret, payload)}`;
}

export function verifyOAuthState({ secret, state, provider, now }) {
  if (typeof state !== "string" || state.length > 4096) return null;
  const [payload, signature, ...extra] = state.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  if (!signaturesEqual(signature, signStatePayload(secret, payload))) return null;
  try {
    const decoded = decodeJson(payload);
    if (
      decoded?.provider !== provider
      || typeof decoded.return_to !== "string"
      || typeof decoded.code_challenge !== "string"
      || !/^[A-Za-z0-9_-]{43}$/.test(decoded.code_challenge)
      || typeof decoded.expires_at !== "string"
      || decoded.expires_at <= now.toISOString()
    ) return null;
    return {
      returnTo: decoded.return_to,
      codeChallenge: decoded.code_challenge,
    };
  } catch {
    return null;
  }
}

export function oauthCallbackUri(publicApiOrigin, provider) {
  return `${String(publicApiOrigin).replace(/\/$/, "")}/api/auth/oauth/${provider}/callback`;
}

export function buildOAuthAuthorizationUrl({ provider, config, redirectUri, state }) {
  if (provider === "google") {
    const url = new URL(config.authorizationUrl || GOOGLE_AUTHORIZATION_URL);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return url.href;
  }
  if (provider === "wechat") {
    const url = new URL(config.authorizationUrl || WECHAT_AUTHORIZATION_URL);
    url.searchParams.set("appid", config.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "snsapi_userinfo");
    url.searchParams.set("state", state);
    url.hash = "wechat_redirect";
    return url.href;
  }
  throw new Error("UNSUPPORTED_OAUTH_PROVIDER");
}

async function readProviderJson(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.error || payload.errcode) {
    throw new Error("OAUTH_PROVIDER_REJECTED");
  }
  return payload;
}

async function exchangeGoogleCode({ code, redirectUri, config, fetchImpl }) {
  const tokenResponse = await fetchImpl(config.tokenUrl || GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = await readProviderJson(tokenResponse);
  if (typeof token.access_token !== "string" || !token.access_token) {
    throw new Error("OAUTH_PROVIDER_REJECTED");
  }
  const profileResponse = await fetchImpl(config.userInfoUrl || GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  const profile = await readProviderJson(profileResponse);
  if (typeof profile.sub !== "string" || !profile.sub) throw new Error("OAUTH_IDENTITY_INVALID");
  return {
    subject: profile.sub,
    email: typeof profile.email === "string" ? profile.email : null,
    emailVerified: profile.email_verified === true || profile.email_verified === "true",
    displayName: typeof profile.name === "string" ? profile.name : null,
  };
}

async function exchangeWechatCode({ code, redirectUri: _redirectUri, config, fetchImpl }) {
  const tokenUrl = new URL(config.tokenUrl || WECHAT_TOKEN_URL);
  tokenUrl.searchParams.set("appid", config.clientId);
  tokenUrl.searchParams.set("secret", config.clientSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  const token = await readProviderJson(await fetchImpl(tokenUrl));
  if (typeof token.access_token !== "string" || typeof token.openid !== "string") {
    throw new Error("OAUTH_PROVIDER_REJECTED");
  }
  const profileUrl = new URL(config.userInfoUrl || WECHAT_USERINFO_URL);
  profileUrl.searchParams.set("access_token", token.access_token);
  profileUrl.searchParams.set("openid", token.openid);
  profileUrl.searchParams.set("lang", "zh_CN");
  const profile = await readProviderJson(await fetchImpl(profileUrl));
  const subject = typeof profile.openid === "string" && profile.openid
    ? profile.openid
    : token.openid;
  if (typeof subject !== "string" || !subject) throw new Error("OAUTH_IDENTITY_INVALID");
  return {
    subject,
    email: null,
    emailVerified: false,
    displayName: typeof profile.nickname === "string" ? profile.nickname : null,
  };
}

export async function exchangeOAuthCode({
  provider,
  code,
  redirectUri,
  config,
  fetchImpl = globalThis.fetch,
}) {
  if (provider === "google") {
    return exchangeGoogleCode({ code, redirectUri, config, fetchImpl });
  }
  if (provider === "wechat") {
    return exchangeWechatCode({ code, redirectUri, config, fetchImpl });
  }
  throw new Error("UNSUPPORTED_OAUTH_PROVIDER");
}

export function appendOAuthResult(returnTo, { provider, ticket = null, error = null }) {
  const url = new URL(returnTo);
  url.searchParams.set("oauth_provider", provider);
  if (ticket) url.searchParams.set("oauth_ticket", ticket);
  if (error) url.searchParams.set("oauth_error", error);
  return url.href;
}
