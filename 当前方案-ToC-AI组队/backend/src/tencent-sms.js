import { createHash, createHmac } from "node:crypto";

const HOST = "sms.tencentcloudapi.com";
const ENDPOINT = `https://${HOST}/`;
const SERVICE = "sms";
const ACTION = "SendSms";
const VERSION = "2021-01-11";
const ALGORITHM = "TC3-HMAC-SHA256";
const CONTENT_TYPE = "application/json; charset=utf-8";
const SIGNED_HEADERS = "content-type;host;x-tc-action";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function requiredString(config, name) {
  const value = config?.[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`Tencent SMS configuration is missing ${name}.`);
  }
  return value.trim();
}

function createAuthorization({ secretId, secretKey, payload, timestamp }) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const canonicalHeaders = [
    `content-type:${CONTENT_TYPE}`,
    `host:${HOST}`,
    `x-tc-action:${ACTION.toLowerCase()}`,
    "",
  ].join("\n");
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    SIGNED_HEADERS,
    sha256(payload),
  ].join("\n");
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    ALGORITHM,
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, SERVICE);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = hmac(secretSigning, stringToSign, "hex");
  return `${ALGORITHM} Credential=${secretId}/${credentialScope}, SignedHeaders=${SIGNED_HEADERS}, Signature=${signature}`;
}

export function createTencentSmsSender(config, {
  clock = () => new Date(),
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
} = {}) {
  const secretId = requiredString(config, "secretId");
  const secretKey = requiredString(config, "secretKey");
  const sdkAppId = requiredString(config, "sdkAppId");
  const signName = requiredString(config, "signName");
  const templateId = requiredString(config, "templateId");
  const region = requiredString(config, "region");

  return async function sendOtp({ phone, code }) {
    const payload = JSON.stringify({
      PhoneNumberSet: [phone],
      SmsSdkAppId: sdkAppId,
      SignName: signName,
      TemplateId: templateId,
      TemplateParamSet: [code, "5"],
    });
    const timestamp = Math.floor(clock().getTime() / 1000);
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": CONTENT_TYPE,
        Host: HOST,
        "X-TC-Action": ACTION,
        "X-TC-Version": VERSION,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Region": region,
        Authorization: createAuthorization({ secretId, secretKey, payload, timestamp }),
      },
      body: payload,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const result = await response.json().catch(() => null);
    const apiError = result?.Response?.Error;
    const sendStatus = result?.Response?.SendStatusSet?.[0];
    if (!response.ok || apiError || sendStatus?.Code !== "Ok") {
      const codeName = apiError?.Code || sendStatus?.Code || `HTTP_${response.status}`;
      throw new Error(`Tencent SMS SendSms failed: ${codeName}`);
    }
  };
}
