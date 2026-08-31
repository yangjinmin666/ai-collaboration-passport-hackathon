import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const CAMPAIGN_ID_PATTERN = /^[A-Za-z0-9_-]{3,64}$/;
const CLIENT_ID_PATTERN = /^client_[A-Za-z0-9_-]{32,128}$/;
const EVENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function experienceInviteSecretIsStrong(secret) {
  return typeof secret === "string" && secret.length >= 32;
}

export function experienceClientIdIsValid(clientId) {
  return typeof clientId === "string" && CLIENT_ID_PATTERN.test(clientId);
}

export function hashExperienceClientId(clientId) {
  if (!experienceClientIdIsValid(clientId)) return null;
  return createHash("sha256").update(clientId).digest("hex");
}

function normalizedExpirySeconds(value) {
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.floor(date.getTime() / 1000);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

export function createExperienceInviteToken({
  secret,
  campaignId,
  eventId,
  maxUses,
  expiresAt,
}) {
  const expiry = normalizedExpirySeconds(expiresAt);
  if (
    !experienceInviteSecretIsStrong(secret)
    || !CAMPAIGN_ID_PATTERN.test(campaignId ?? "")
    || !EVENT_ID_PATTERN.test(eventId ?? "")
    || !Number.isInteger(maxUses)
    || maxUses < 1
    || maxUses > 500
    || expiry === null
  ) {
    throw new TypeError("Experience invite settings are invalid.");
  }

  const encodedPayload = Buffer.from(JSON.stringify({
    v: 1,
    campaign_id: campaignId,
    event_id: eventId,
    max_uses: maxUses,
    expires_at: expiry,
  })).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyExperienceInviteToken({ secret, token, now = new Date() }) {
  if (
    !experienceInviteSecretIsStrong(secret)
    || typeof token !== "string"
    || token.length > 2048
    || !TOKEN_PATTERN.test(token)
  ) return null;

  const [encodedPayload, suppliedSignature] = token.split(".");
  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();
  let suppliedSignatureBytes;
  try {
    suppliedSignatureBytes = Buffer.from(suppliedSignature, "base64url");
  } catch {
    return null;
  }
  if (
    suppliedSignatureBytes.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignatureBytes, expectedSignature)
  ) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const nowSeconds = Math.floor(new Date(now).getTime() / 1000);
  if (
    payload?.v !== 1
    || !CAMPAIGN_ID_PATTERN.test(payload.campaign_id ?? "")
    || !EVENT_ID_PATTERN.test(payload.event_id ?? "")
    || !Number.isInteger(payload.max_uses)
    || payload.max_uses < 1
    || payload.max_uses > 500
    || !Number.isSafeInteger(payload.expires_at)
    || !Number.isSafeInteger(nowSeconds)
    || payload.expires_at <= nowSeconds
  ) return null;

  return {
    campaignId: payload.campaign_id,
    eventId: payload.event_id,
    maxUses: payload.max_uses,
    expiresAt: new Date(payload.expires_at * 1000).toISOString(),
  };
}
