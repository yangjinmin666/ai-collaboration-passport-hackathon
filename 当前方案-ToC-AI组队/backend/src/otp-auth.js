import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

export function normalizeChinaMobile(value) {
  if (typeof value !== "string") return null;
  let digits = value.replace(/[\s()-]/g, "");
  if (digits.startsWith("+86")) digits = digits.slice(3);
  else if (digits.startsWith("86") && digits.length === 13) digits = digits.slice(2);
  if (!/^1[3-9]\d{9}$/.test(digits)) return null;
  return `+86${digits}`;
}

export function maskChinaMobile(phone) {
  return `${phone.slice(3, 6)}****${phone.slice(-4)}`;
}

export function createOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createOtpChallengeId() {
  return `otp_${randomUUID()}`;
}

export function hashOtpCode({ secret, challengeId, code }) {
  return createHmac("sha256", secret)
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

export function otpCodeHashesEqual(first, second) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const firstBuffer = Buffer.from(first, "hex");
  const secondBuffer = Buffer.from(second, "hex");
  return firstBuffer.length === secondBuffer.length
    && timingSafeEqual(firstBuffer, secondBuffer);
}
