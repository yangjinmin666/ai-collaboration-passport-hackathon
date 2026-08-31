import { randomBytes } from "node:crypto";

import { createExperienceInviteToken } from "../src/experience-invite.js";

function requiredInteger(value, fallback, { minimum, maximum, name }) {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

const secret = process.env.EXPERIENCE_INVITE_SECRET;
const appOrigin = process.env.PUBLIC_APP_ORIGIN;
const eventId = process.env.ACTIVE_EVENT_ID ?? "hackathon-2026";
const maxUses = requiredInteger(process.env.EXPERIENCE_INVITE_MAX_USES, 50, {
  minimum: 1,
  maximum: 500,
  name: "EXPERIENCE_INVITE_MAX_USES",
});
const validHours = requiredInteger(process.env.EXPERIENCE_INVITE_VALID_HOURS, 168, {
  minimum: 1,
  maximum: 24 * 30,
  name: "EXPERIENCE_INVITE_VALID_HOURS",
});
const campaignId = process.env.EXPERIENCE_INVITE_CAMPAIGN_ID
  ?? `group-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex")}`;
const origin = new URL(appOrigin);
if (origin.protocol !== "https:" || origin.username || origin.password) {
  throw new Error("PUBLIC_APP_ORIGIN must be a clean HTTPS origin.");
}

const token = createExperienceInviteToken({
  secret,
  campaignId,
  eventId,
  maxUses,
  expiresAt: new Date(Date.now() + validHours * 60 * 60 * 1000),
});
const link = new URL(origin.href);
link.searchParams.set("experience_invite", token);
console.log(link.href);
