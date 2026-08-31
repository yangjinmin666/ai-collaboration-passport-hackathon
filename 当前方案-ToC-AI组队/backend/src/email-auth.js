import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length < 3
    || email.length > 254
    || /[\u0000-\u0020\u007f]/.test(email)
    || !/^[^@]+@[^@]+\.[^@]+$/u.test(email)
  ) return null;
  const [local, domain] = email.split("@");
  if (!local || local.length > 64 || !domain || domain.length > 253) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return null;
  return email;
}

export function maskEmail(email) {
  const [local, domain] = email.split("@");
  const visible = local.length === 1
    ? local
    : local.length === 2
      ? `${local[0]}*`
      : `${local[0]}***${local.at(-1)}`;
  return `${visible}@${domain}`;
}

export function createEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createEmailChallengeId() {
  return `email_${randomUUID()}`;
}

export function hashEmailCode({ secret, challengeId, code }) {
  return createHmac("sha256", secret)
    .update(`email:${challengeId}:${code}`)
    .digest("hex");
}

export function emailCodeHashesEqual(first, second) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");
  return firstBuffer.length === secondBuffer.length
    && timingSafeEqual(firstBuffer, secondBuffer);
}
