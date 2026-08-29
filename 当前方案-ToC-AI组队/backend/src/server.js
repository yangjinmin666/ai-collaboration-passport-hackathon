import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createApi } from "./app.js";
import { createTencentSmsSender } from "./tencent-sms.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const databasePath = process.env.DATABASE_PATH ?? resolve("data", "demo.sqlite");
const demoAccessKey = process.env.DEMO_ACCESS_KEY ?? null;
const touchDeviceAccessKey = process.env.TOUCH_DEVICE_ACCESS_KEY ?? null;
const allowInsecureDemoAuth = process.env.ALLOW_INSECURE_DEMO_AUTH === "1";
const activeEventId = process.env.ACTIVE_EVENT_ID ?? "hackathon-2026";
const otpSecret = process.env.AUTH_OTP_SECRET ?? null;
const tencentSmsConfig = {
  secretId: process.env.TENCENT_SMS_SECRET_ID,
  secretKey: process.env.TENCENT_SMS_SECRET_KEY,
  sdkAppId: process.env.TENCENT_SMS_SDK_APP_ID,
  signName: process.env.TENCENT_SMS_SIGN_NAME,
  templateId: process.env.TENCENT_SMS_TEMPLATE_ID,
  region: process.env.TENCENT_SMS_REGION,
};
const missingSmsSettings = [
  ["AUTH_OTP_SECRET", otpSecret],
  ["TENCENT_SMS_SECRET_ID", tencentSmsConfig.secretId],
  ["TENCENT_SMS_SECRET_KEY", tencentSmsConfig.secretKey],
  ["TENCENT_SMS_SDK_APP_ID", tencentSmsConfig.sdkAppId],
  ["TENCENT_SMS_SIGN_NAME", tencentSmsConfig.signName],
  ["TENCENT_SMS_TEMPLATE_ID", tencentSmsConfig.templateId],
  ["TENCENT_SMS_REGION", tencentSmsConfig.region],
].filter(([, value]) => typeof value !== "string" || !value.trim()).map(([name]) => name);
const fixedTestOtpCode = process.env.AUTH_OTP_TEST_CODE;
const localOtpTestMode = process.env.NODE_ENV === "test"
  && allowInsecureDemoAuth
  && new Set(["127.0.0.1", "::1", "localhost"]).has(host)
  && typeof fixedTestOtpCode === "string"
  && /^\d{6}$/.test(fixedTestOtpCode);
const otpSender = localOtpTestMode
  ? async () => {}
  : missingSmsSettings.length === 0
    ? createTencentSmsSender(tencentSmsConfig)
    : null;
const eventPolicyOverrides = {
  [activeEventId]: {
    sos_enabled: process.env.SOS_ENABLED !== "0",
    external_aid_enabled: process.env.EXTERNAL_AID_ENABLED !== "0",
    paid_aid_enabled: process.env.PAID_AID_ENABLED !== "0",
  },
};

if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true });
}

const api = createApi({
  databasePath,
  demoAccessKey,
  touchDeviceAccessKey,
  allowInsecureDemoAuth,
  eventPolicyOverrides,
  otpSecret,
  otpSender,
  otpEventId: activeEventId,
  ...(localOtpTestMode ? { otpCodeGenerator: () => fixedTestOtpCode } : {}),
});
const address = await api.start(port, host);
console.log(`RALLY API listening on http://${host}:${address.port}`);
console.log(`SQLite database: ${databasePath}`);
if (!demoAccessKey) {
  console.warn("Demo session login is disabled because DEMO_ACCESS_KEY is not set.");
}
if (!touchDeviceAccessKey) {
  console.warn("Physical mutual touch is disabled because TOUCH_DEVICE_ACCESS_KEY is not set.");
}
if (!localOtpTestMode && missingSmsSettings.length > 0) {
  console.warn(`SMS login is disabled; missing settings: ${missingSmsSettings.join(", ")}.`);
}
if (allowInsecureDemoAuth) {
  console.warn("Insecure x-demo-user-id authentication is enabled. Use only on a trusted local demo network.");
}

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await api.stop();
  process.exitCode = 0;
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
