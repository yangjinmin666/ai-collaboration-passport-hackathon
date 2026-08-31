import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createApi } from "./app.js";
import { oauthPublicOriginIsSecure, oauthStateSecretIsStrong } from "./oauth-auth.js";
import { createTencentSmsSender } from "./tencent-sms.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "0.0.0.0";
const databasePath = process.env.DATABASE_PATH ?? resolve("data", "demo.sqlite");
const demoAccessKey = process.env.DEMO_ACCESS_KEY ?? null;
const touchDeviceAccessKey = process.env.TOUCH_DEVICE_ACCESS_KEY ?? null;
const allowInsecureDemoAuth = process.env.ALLOW_INSECURE_DEMO_AUTH === "1";
const activeEventId = process.env.ACTIVE_EVENT_ID ?? "hackathon-2026";
const otpSecret = process.env.AUTH_OTP_SECRET ?? null;
const analyticsAdminToken = process.env.ANALYTICS_ADMIN_TOKEN ?? null;
const analyticsAppVersion = process.env.RALLY_APP_VERSION ?? "development";
const analyticsDebugEnabled = process.env.ANALYTICS_DEBUG_ENABLED === "1";
const publicAppOrigin = process.env.PUBLIC_APP_ORIGIN ?? null;
const publicApiOrigin = process.env.PUBLIC_API_ORIGIN ?? null;
const oauthStateSecret = process.env.AUTH_OAUTH_STATE_SECRET ?? null;
const androidAppLinkReady = typeof process.env.ANDROID_APP_SHA256_CERT_FINGERPRINT === "string"
  && /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(
    process.env.ANDROID_APP_SHA256_CERT_FINGERPRINT,
  );
const oauthProviders = {
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  },
  wechat: {
    clientId: process.env.WECHAT_OAUTH_APP_ID,
    clientSecret: process.env.WECHAT_OAUTH_APP_SECRET,
  },
};
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
const fixedDemoOtpCode = process.env.AUTH_OTP_FIXED_DEMO_CODE;
const fixedDemoOtpMode = process.env.AUTH_OTP_FIXED_DEMO === "1"
  && new Set(["127.0.0.1", "::1", "localhost"]).has(host)
  && typeof fixedDemoOtpCode === "string"
  && /^\d{6}$/.test(fixedDemoOtpCode);
const fixedOtpMode = localOtpTestMode || fixedDemoOtpMode;
const otpSender = fixedOtpMode
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
  otpDeliveryMode: fixedDemoOtpMode
    ? "fixed_demo"
    : localOtpTestMode
      ? "test"
      : "tencent_cloud",
  otpEventId: activeEventId,
  analyticsAdminToken,
  analyticsAppVersion,
  analyticsDebugEnabled,
  publicAppOrigin,
  publicApiOrigin,
  oauthStateSecret,
  oauthProviders,
  androidAppLinkReady,
  ...(fixedOtpMode
    ? { otpCodeGenerator: () => (fixedDemoOtpMode ? fixedDemoOtpCode : fixedTestOtpCode) }
    : {}),
});
const address = await api.start(port, host);
console.log(`COSPAN API listening on http://${host}:${address.port}`);
console.log(`SQLite database: ${databasePath}`);
if (!demoAccessKey) {
  console.warn("Demo session login is disabled because DEMO_ACCESS_KEY is not set.");
}
if (!touchDeviceAccessKey) {
  console.warn("Physical mutual touch is disabled because TOUCH_DEVICE_ACCESS_KEY is not set.");
}
if (!fixedOtpMode && missingSmsSettings.length > 0) {
  console.warn(`SMS login is disabled; missing settings: ${missingSmsSettings.join(", ")}.`);
}
if (fixedDemoOtpMode) {
  console.warn("Fixed roadshow OTP mode is enabled; no SMS message will be sent.");
}
if (!analyticsAdminToken || analyticsAdminToken.length < 32) {
  console.warn("Analytics summary and CSV export are disabled because ANALYTICS_ADMIN_TOKEN is missing or too short.");
}
const oauthBaseReady = oauthPublicOriginIsSecure(publicAppOrigin)
  && oauthPublicOriginIsSecure(publicApiOrigin)
  && oauthStateSecretIsStrong(oauthStateSecret);
for (const [provider, config] of Object.entries(oauthProviders)) {
  const providerReady = [config.clientId, config.clientSecret]
    .every((value) => typeof value === "string" && value.trim());
  if (!oauthBaseReady || !providerReady) {
    console.warn(`${provider} OAuth login is disabled because its server settings are incomplete.`);
  }
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
