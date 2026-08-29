import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import { AnalyticsRequestError, createAnalyticsService } from "./analytics.js";
import { createProductModule } from "./product-module.js";

import {
  acceptConnectionRequest,
  appendEventLog,
  blockConnectionRequest,
  cancelConnectionRequest,
  countRecentConnectionRequests,
  createAuthSession,
  createOAuthLoginTicket,
  createOtpChallenge,
  deleteOtpChallenge,
  createConnectionRequest,
  expireConnectionRequests,
  findActiveConnectionRequest,
  findConnectionBetween,
  findConnectionById,
  findConnectionRequestById,
  findEventEndsAt,
  findLatestConnectionRequest,
  findLatestOtpChallengeAt,
  findOtpChallenge,
  findPublicCardProfile,
  findSessionUserId,
  findUserIdentity,
  findOrCreateOAuthUser,
  findOrCreateOtpUser,
  isParticipantVisible,
  isConnectionBlocked,
  listConnectionRequests,
  openDatabase,
  rejectConnectionRequest,
  recordOtpFailure,
  readOtpPhoneWindow,
  readOtpIpWindow,
  revokeAuthSession,
  consumeOAuthLoginTicket,
  consumeOtpChallenge,
  userExists,
} from "./database.js";
import {
  createOtpChallengeId,
  createOtpCode,
  hashOtpCode,
  maskChinaMobile,
  normalizeChinaMobile,
  otpCodeHashesEqual,
} from "./otp-auth.js";
import {
  appendOAuthResult,
  buildOAuthAuthorizationUrl,
  createOAuthState,
  exchangeOAuthCode,
  normalizeOAuthReturnTo,
  oauthCodeChallenge,
  oauthCallbackUri,
  oauthPublicOriginIsSecure,
  oauthProviderIsConfigured,
  oauthStateSecretIsStrong,
  OAUTH_PROVIDERS,
  verifyOAuthState,
} from "./oauth-auth.js";

const SOURCES = new Set(["nfc", "qr", "link"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONNECTION_REQUEST_STATUSES = new Set([
  "REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "BLOCKED",
]);
const analyticsConnectionSource = (source) => (
  source === "link" ? "online_recommendation" : source
);
const PRODUCT_GUARDRAIL_CODES = new Map([
  ["ALREADY_PROJECT_MEMBER", "duplicate_membership"],
  ["INVITATION_EXPIRED", "expired_invitation"],
  ["INVITATION_FORBIDDEN", "unauthorized_team_action"],
  ["PROJECT_FORBIDDEN", "unauthorized_project_access"],
  ["ROLE_NEED_FILLED", "role_capacity_protected"],
  ["TASK_FORBIDDEN", "unauthorized_task_action"],
  ["TASK_OWNER_ONLY", "task_owner_confirmation_required"],
  ["TEAM_NOT_READY", "team_confirmation_required"],
  ["VISIBILITY_REQUIRED", "visibility_required"],
]);
const CONNECTION_REQUEST_RESOLVERS = {
  block: {
    resolve: blockConnectionRequest,
    expectedStatus: "BLOCKED",
    errorMessage: "This connection request can no longer be blocked.",
  },
  cancel: {
    resolve: cancelConnectionRequest,
    expectedStatus: "CANCELLED",
    errorMessage: "This connection request can no longer be cancelled.",
  },
  reject: {
    resolve: rejectConnectionRequest,
    expectedStatus: "REJECTED",
    errorMessage: "This connection request can no longer be rejected.",
  },
};

function matchCardRoute(url) {
  const publicMatch = url.pathname.match(/^\/c\/([^/]+)$/);
  if (publicMatch) {
    return {
      encodedToken: publicMatch[1],
      eventId: url.searchParams.get("event"),
      source: url.searchParams.get("src") ?? "link",
    };
  }

  const apiMatch = url.pathname.match(/^\/api\/cards\/([^/]+)\/profile$/);
  if (!apiMatch) return null;
  return {
    encodedToken: apiMatch[1],
    eventId: url.searchParams.get("event_id"),
    source: url.searchParams.get("source") ?? "link",
  };
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "access-control-allow-headers": [
      "authorization",
      "content-type",
      "x-analytics-admin-token",
      "x-demo-access-key",
      "x-demo-user-id",
      "x-rally-anonymous-id",
      "x-rally-app-version",
      "x-rally-client-type",
      "x-rally-session-id",
      "x-touch-device-key",
    ].join(", "),
    "access-control-allow-methods": "DELETE, GET, POST, PUT, PATCH, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function sendCsv(response, filename, body) {
  response.writeHead(200, {
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-disposition": `attachment; filename="${filename}"`,
    "content-type": "text/csv; charset=utf-8",
  });
  response.end(body);
}

function sendError(response, status, code, message, extraHeaders) {
  sendJson(response, status, { error: { code, message } }, extraHeaders);
}

function sendRedirect(response, location) {
  response.writeHead(302, {
    "cache-control": "no-store",
    location,
    "referrer-policy": "no-referrer",
  });
  response.end();
}

function readPathParameter(response, encodedValue) {
  try {
    return decodeURIComponent(encodedValue);
  } catch {
    sendError(
      response,
      400,
      "INVALID_PATH_PARAMETER",
      "The URL contains an invalid encoded path parameter.",
    );
    return null;
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readJsonBody(request, response) {
  try {
    return { ok: true, value: await readJson(request) };
  } catch (error) {
    const isLarge = error.message === "PAYLOAD_TOO_LARGE";
    sendError(
      response,
      isLarge ? 413 : 400,
      isLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
      isLarge ? "Request payload is too large." : "Request body must be valid JSON.",
    );
    return { ok: false, errorCode: isLarge ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON" };
  }
}

function analyticsCountBucket(payload) {
  const count = Array.isArray(payload?.events) ? payload.events.length : 1;
  if (count <= 1) return "1";
  if (count <= 5) return "2-5";
  if (count <= 20) return "6-20";
  return "21+";
}

function readBearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") return null;
  return authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1] ?? null;
}

function readClientIp(request) {
  const nginxAddress = request.headers["x-real-ip"];
  if (
    typeof nginxAddress === "string"
    && nginxAddress.length <= 64
    && !/[\s,]/.test(nginxAddress)
  ) return nginxAddress;
  return request.socket.remoteAddress ?? "unknown";
}

function resolveActorId(database, request, now, allowInsecureDemoAuth) {
  if (request.headers.authorization !== undefined) {
    const token = readBearerToken(request);
    return token ? findSessionUserId(database, { token, now }) : null;
  }
  if (!allowInsecureDemoAuth) return null;
  const demoUserId = request.headers["x-demo-user-id"];
  if (typeof demoUserId !== "string" || !userExists(database, demoUserId)) {
    return null;
  }
  return demoUserId;
}

export function createApi({
  databasePath,
  clock = () => new Date(),
  demoAccessKey = null,
  touchDeviceAccessKey = null,
  allowInsecureDemoAuth = false,
  sessionTtlMs = 12 * 60 * 60 * 1000,
  requestTtlMs = 24 * 60 * 60 * 1000,
  presenceTtlMs = 2 * 60 * 1000,
  platformMetadataFetcher,
  eventPolicyOverrides,
  otpSecret = null,
  otpSender = null,
  otpEventId = "hackathon-2026",
  otpCodeGenerator = createOtpCode,
  publicAppOrigin = null,
  publicApiOrigin = null,
  oauthStateSecret = null,
  oauthProviders = {},
  androidAppLinkReady = false,
  oauthIdentityResolver = exchangeOAuthCode,
  analyticsAdminToken = null,
  analyticsAppVersion = "development",
  analyticsDebugEnabled = false,
}) {
  const smsLoginReady = typeof otpSecret === "string"
    && otpSecret.length > 0
    && typeof otpSender === "function";
  const database = openDatabase(databasePath);
  const analytics = createAnalyticsService(database, {
    clock,
    adminToken: analyticsAdminToken,
    appVersion: analyticsAppVersion,
  });
  const productModule = createProductModule(database, {
    clock,
    presenceTtlMs,
    platformMetadataFetcher,
    demoAccessKey,
    eventPolicyOverrides,
  });
  const enabledOAuthProviders = Object.fromEntries(
    OAUTH_PROVIDERS.map((provider) => [
      provider,
      Boolean(
        oauthStateSecretIsStrong(oauthStateSecret)
        && oauthPublicOriginIsSecure(publicAppOrigin)
        && oauthPublicOriginIsSecure(publicApiOrigin)
        && oauthProviderIsConfigured(oauthProviders[provider]),
      ),
    ]),
  );
  const trackBackendAnalytics = (event) => {
    try {
      analytics.recordBackendEvent(event);
    } catch (error) {
      console.error("Analytics event could not be recorded", error);
    }
  };
  const trackOtpFailure = (request, eventName, failureCode, {
    challengeId = null,
    attemptBucket = null,
    retryable = true,
  } = {}) => {
    const properties = eventName === "login_otp_request_failed"
      ? { failure_code: failureCode, retryable }
      : {
          ...(challengeId ? { challenge_id: challengeId } : {}),
          failure_code: failureCode,
          ...(attemptBucket ? { attempt_bucket: attemptBucket } : {}),
        };
    trackBackendAnalytics({
      eventName,
      exhibitionId: otpEventId,
      source: "sms_login",
      objectType: challengeId ? "otp_challenge" : null,
      objectId: challengeId,
      properties,
      request,
      occurredAt: clock().toISOString(),
    });
  };
  const trackGuardrail = (request, {
    userId = null,
    exhibitionId = otpEventId,
    guardrailCode,
    objectType = "request",
    objectId = null,
    source = "system",
  }) => trackBackendAnalytics({
    eventName: "guardrail_blocked",
    exhibitionId,
    userId,
    source,
    objectType,
    objectId,
    properties: {
      guardrail_code: guardrailCode,
      object_type: objectType,
      source,
    },
    request,
    occurredAt: clock().toISOString(),
  });
  const trackTouchFailure = (request, failureCode, {
    exhibitionId = otpEventId,
    handshakeId = randomUUID(),
  } = {}) => {
    const analyticsExhibitionId = database.prepare(`
      SELECT event_id
      FROM events
      WHERE event_id IN (?, ?)
      ORDER BY CASE WHEN event_id = ? THEN 0 ELSE 1 END
      LIMIT 1
    `).get(exhibitionId, otpEventId, exhibitionId)?.event_id;
    if (!analyticsExhibitionId) return;
    trackBackendAnalytics({
      eventName: "touch_handshake_failed",
      exhibitionId: analyticsExhibitionId,
      source: "physical_mutual",
      objectType: "touch_handshake",
      objectId: handshakeId,
      properties: { handshake_id: handshakeId, failure_code: failureCode },
      request,
      occurredAt: clock().toISOString(),
      dedupeKey: `touch_handshake_failed:${handshakeId}:${failureCode}`,
    });
  };
  const handleRequest = async (request, response) => {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, null);
      return;
    }

    const url = new URL(request.url, "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        status: "ok",
        service: "rally-api",
        sms_login: smsLoginReady ? "ready" : "disabled",
        analytics: "ready",
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/analytics/events") {
      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) {
        console.warn("Analytics batch rejected", JSON.stringify({
          event: "analytics_batch_rejected",
          failure_code: parsedBody.errorCode,
          event_count_bucket: "unknown",
        }));
        return;
      }
      try {
        const result = analytics.ingestClientEvents(parsedBody.value, {
          actorId: resolveActorId(
            database,
            request,
            clock().toISOString(),
            allowInsecureDemoAuth,
          ),
          request,
        });
        sendJson(response, 202, result);
      } catch (error) {
        if (error instanceof AnalyticsRequestError) {
          console.warn("Analytics batch rejected", JSON.stringify({
            event: "analytics_batch_rejected",
            failure_code: error.code,
            event_count_bucket: analyticsCountBucket(parsedBody.value),
          }));
          sendError(response, error.status, error.code, error.message);
          return;
        }
        throw error;
      }
      return;
    }

    const analyticsUserMatch = url.pathname.match(/^\/api\/admin\/analytics\/users\/([^/]+)$/);
    if (request.method === "DELETE" && analyticsUserMatch) {
      if (!analytics.adminAuthorized(request.headers["x-analytics-admin-token"])) {
        sendError(response, 401, "ANALYTICS_ADMIN_REQUIRED", "A valid analytics admin token is required.");
        return;
      }
      const userId = readPathParameter(response, analyticsUserMatch[1]);
      if (userId === null) return;
      if (!userId || userId.length > 128) {
        sendError(response, 400, "INVALID_ANALYTICS_USER", "A valid internal user ID is required.");
        return;
      }
      const exhibitionId = url.searchParams.get("exhibition_id") || otpEventId;
      if (!database.prepare("SELECT 1 FROM events WHERE event_id = ?").get(exhibitionId)) {
        sendError(response, 404, "EXHIBITION_NOT_FOUND", "Exhibition not found.");
        return;
      }
      sendJson(response, 200, {
        exhibition_id: exhibitionId,
        user_id: userId,
        deleted_events: analytics.deleteUserEvents(exhibitionId, userId),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/analytics/events") {
      if (!analyticsDebugEnabled) {
        sendError(response, 404, "NOT_FOUND", "Route not found.");
        return;
      }
      if (!analytics.adminAuthorized(request.headers["x-analytics-admin-token"])) {
        sendError(response, 401, "ANALYTICS_ADMIN_REQUIRED", "A valid analytics admin token is required.");
        return;
      }
      const exhibitionId = url.searchParams.get("exhibition_id") || otpEventId;
      if (!database.prepare("SELECT 1 FROM events WHERE event_id = ?").get(exhibitionId)) {
        sendError(response, 404, "EXHIBITION_NOT_FOUND", "Exhibition not found.");
        return;
      }
      const rawLimit = url.searchParams.get("limit") || "100";
      const limit = Number.parseInt(rawLimit, 10);
      if (!/^\d+$/.test(rawLimit) || limit < 1 || limit > 100) {
        sendError(response, 400, "INVALID_ANALYTICS_LIMIT", "limit must be between 1 and 100.");
        return;
      }
      sendJson(response, 200, {
        exhibition_id: exhibitionId,
        events: analytics.recentEvents(exhibitionId, limit),
      });
      return;
    }

    if (
      request.method === "GET"
      && new Set([
        "/api/admin/analytics/summary",
        "/api/admin/analytics/export",
      ]).has(url.pathname)
    ) {
      if (!analytics.adminAuthorized(request.headers["x-analytics-admin-token"])) {
        sendError(response, 401, "ANALYTICS_ADMIN_REQUIRED", "A valid analytics admin token is required.");
        return;
      }
      const exhibitionId = url.searchParams.get("exhibition_id") || otpEventId;
      if (!database.prepare("SELECT 1 FROM events WHERE event_id = ?").get(exhibitionId)) {
        sendError(response, 404, "EXHIBITION_NOT_FOUND", "Exhibition not found.");
        return;
      }
      if (url.pathname.endsWith("/summary")) {
        sendJson(response, 200, analytics.summary(exhibitionId));
      } else {
        sendCsv(
          response,
          `rally-analytics-${exhibitionId}.csv`,
          analytics.exportCsv(exhibitionId),
        );
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/oauth/providers") {
      sendJson(response, 200, {
        providers: Object.fromEntries(
          OAUTH_PROVIDERS.map((provider) => [provider, {
            enabled: enabledOAuthProviders[provider],
            android_enabled: provider === "google"
              && enabledOAuthProviders[provider]
              && androidAppLinkReady === true,
          }]),
        ),
      });
      return;
    }

    const oauthStartMatch = url.pathname.match(/^\/api\/auth\/oauth\/(google|wechat)\/start$/);
    if (request.method === "GET" && oauthStartMatch) {
      const provider = oauthStartMatch[1];
      if (!enabledOAuthProviders[provider]) {
        sendError(response, 503, "OAUTH_UNAVAILABLE", `${provider} login is not configured.`);
        return;
      }
      const returnTo = normalizeOAuthReturnTo(url.searchParams.get("return_to"), publicAppOrigin);
      const codeChallenge = url.searchParams.get("code_challenge");
      if (!returnTo) {
        sendError(response, 400, "INVALID_OAUTH_RETURN", "The OAuth return URL is not allowed.");
        return;
      }
      if (typeof codeChallenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
        sendError(response, 400, "INVALID_OAUTH_CHALLENGE", "A valid OAuth client challenge is required.");
        return;
      }
      const redirectUri = oauthCallbackUri(publicApiOrigin, provider);
      const state = createOAuthState({
        secret: oauthStateSecret,
        provider,
        returnTo,
        codeChallenge,
        now: clock(),
      });
      sendRedirect(response, buildOAuthAuthorizationUrl({
        provider,
        config: oauthProviders[provider],
        redirectUri,
        state,
      }));
      return;
    }

    const oauthCallbackMatch = url.pathname.match(/^\/api\/auth\/oauth\/(google|wechat)\/callback$/);
    if (request.method === "GET" && oauthCallbackMatch) {
      const provider = oauthCallbackMatch[1];
      if (!enabledOAuthProviders[provider]) {
        sendError(response, 503, "OAUTH_UNAVAILABLE", `${provider} login is not configured.`);
        return;
      }
      const nowDate = clock();
      const verifiedState = verifyOAuthState({
        secret: oauthStateSecret,
        state: url.searchParams.get("state"),
        provider,
        now: nowDate,
      });
      if (!verifiedState) {
        sendError(response, 400, "INVALID_OAUTH_STATE", "The OAuth state is invalid or expired.");
        return;
      }
      if (url.searchParams.has("error")) {
        const oauthError = url.searchParams.get("error") === "access_denied"
          ? "cancelled"
          : "provider_failed";
        sendRedirect(response, appendOAuthResult(verifiedState.returnTo, {
          provider,
          error: oauthError,
        }));
        return;
      }
      const code = url.searchParams.get("code");
      if (provider === "wechat" && code === "authdeny") {
        sendRedirect(response, appendOAuthResult(verifiedState.returnTo, {
          provider,
          error: "cancelled",
        }));
        return;
      }
      if (typeof code !== "string" || !code || code.length > 2048) {
        sendError(response, 400, "INVALID_OAUTH_CODE", "The OAuth authorization code is missing.");
        return;
      }
      const redirectUri = oauthCallbackUri(publicApiOrigin, provider);
      let identity;
      try {
        identity = await oauthIdentityResolver({
          provider,
          code,
          redirectUri,
          config: oauthProviders[provider],
        });
      } catch {
        sendRedirect(response, appendOAuthResult(verifiedState.returnTo, {
          provider,
          error: "provider_failed",
        }));
        return;
      }
      if (
        !identity
        || typeof identity.subject !== "string"
        || !identity.subject
        || identity.subject.length > 255
        || (identity.email !== null && identity.email !== undefined
          && (typeof identity.email !== "string" || identity.email.length > 320))
        || (identity.displayName !== null && identity.displayName !== undefined
          && (typeof identity.displayName !== "string" || identity.displayName.length > 200))
      ) {
        sendRedirect(response, appendOAuthResult(verifiedState.returnTo, {
          provider,
          error: "identity_invalid",
        }));
        return;
      }
      const now = nowDate.toISOString();
      const { userId, isNewUser } = findOrCreateOAuthUser(database, {
        provider,
        subject: identity.subject,
        email: identity.email ?? null,
        emailVerified: identity.emailVerified === true,
        displayName: identity.displayName ?? null,
        eventId: otpEventId,
        now,
      });
      const ticket = createOAuthLoginTicket(database, {
        userId,
        provider,
        codeChallenge: verifiedState.codeChallenge,
        isNewUser,
        now,
        expiresAt: new Date(nowDate.getTime() + 2 * 60 * 1000).toISOString(),
      });
      sendRedirect(response, appendOAuthResult(verifiedState.returnTo, { provider, ticket }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/oauth/sessions") {
      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) return;
      const ticket = parsedBody.value?.ticket;
      const verifier = parsedBody.value?.verifier;
      if (
        typeof ticket !== "string"
        || !/^[A-Za-z0-9_-]{40,128}$/.test(ticket)
        || typeof verifier !== "string"
        || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)
      ) {
        sendError(response, 400, "INVALID_OAUTH_TICKET", "The OAuth login ticket is invalid or expired.");
        return;
      }
      const nowDate = clock();
      const now = nowDate.toISOString();
      const exchange = consumeOAuthLoginTicket(database, {
        ticket,
        codeChallenge: oauthCodeChallenge(verifier),
        now,
      });
      if (!exchange) {
        sendError(response, 400, "INVALID_OAUTH_TICKET", "The OAuth login ticket is invalid or expired.");
        return;
      }
      const expiresAt = new Date(nowDate.getTime() + sessionTtlMs).toISOString();
      const session = createAuthSession(database, {
        userId: exchange.userId,
        now,
        expiresAt,
      });
      sendJson(response, 201, {
        access_token: session.token,
        token_type: "Bearer",
        expires_at: session.expiresAt,
        is_new_user: exchange.isNewUser,
        provider: exchange.provider,
        user: findUserIdentity(database, exchange.userId),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/otp/challenges") {
      if (!smsLoginReady) {
        trackOtpFailure(request, "login_otp_request_failed", "unavailable");
        sendError(response, 503, "OTP_UNAVAILABLE", "SMS login is temporarily unavailable.");
        return;
      }
      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) {
        trackOtpFailure(request, "login_otp_request_failed", "invalid_request", {
          retryable: false,
        });
        return;
      }
      const phone = normalizeChinaMobile(parsedBody.value?.phone);
      const displayName = typeof parsedBody.value?.display_name === "string"
        ? parsedBody.value.display_name.trim()
        : "";
      if (!phone || displayName.length > 40) {
        trackOtpFailure(request, "login_otp_request_failed", "invalid_request", {
          retryable: false,
        });
        sendError(
          response,
          400,
          "INVALID_OTP_REQUEST",
          "A valid mainland China mobile number is required.",
        );
        return;
      }
      const nowDate = clock();
      const now = nowDate.toISOString();
      const oneHourAgo = new Date(nowDate.getTime() - 60 * 60 * 1000).toISOString();
      const requestIp = readClientIp(request);
      const ipWindow = readOtpIpWindow(database, { requestIp, since: oneHourAgo });
      if (ipWindow.count >= 20) {
        const retryAfterSeconds = Math.max(1, Math.ceil(
          (new Date(ipWindow.oldestCreatedAt).getTime() + 60 * 60 * 1000 - nowDate.getTime()) / 1000,
        ));
        trackOtpFailure(request, "login_otp_request_failed", "rate_limited");
        sendError(
          response,
          429,
          "OTP_RATE_LIMITED",
          "Too many verification codes were requested. Please try again later.",
          { "retry-after": String(retryAfterSeconds) },
        );
        return;
      }
      const phoneWindow = readOtpPhoneWindow(database, {
        phone,
        since: oneHourAgo,
      });
      if (phoneWindow.count >= 5) {
        const retryAfterSeconds = Math.max(1, Math.ceil(
          (new Date(phoneWindow.oldestCreatedAt).getTime() + 60 * 60 * 1000 - nowDate.getTime()) / 1000,
        ));
        trackOtpFailure(request, "login_otp_request_failed", "rate_limited");
        sendError(
          response,
          429,
          "OTP_RATE_LIMITED",
          "Too many verification codes were requested. Please try again later.",
          { "retry-after": String(retryAfterSeconds) },
        );
        return;
      }
      const latestChallengeAt = findLatestOtpChallengeAt(database, phone);
      if (latestChallengeAt) {
        const elapsedMs = nowDate.getTime() - new Date(latestChallengeAt).getTime();
        if (elapsedMs < 60_000) {
          const retryAfterSeconds = Math.ceil((60_000 - elapsedMs) / 1000);
          trackOtpFailure(request, "login_otp_request_failed", "rate_limited");
          sendError(
            response,
            429,
            "OTP_RATE_LIMITED",
            "Please wait before requesting another verification code.",
            { "retry-after": String(retryAfterSeconds) },
          );
          return;
        }
      }
      const expiresAt = new Date(nowDate.getTime() + 5 * 60 * 1000).toISOString();
      const challengeId = createOtpChallengeId();
      const code = otpCodeGenerator();
      createOtpChallenge(database, {
        challengeId,
        phone,
        displayName,
        codeHash: hashOtpCode({ secret: otpSecret, challengeId, code }),
        requestIp,
        now,
        expiresAt,
      });
      try {
        await otpSender({ phone, code });
      } catch {
        deleteOtpChallenge(database, challengeId);
        trackOtpFailure(request, "login_otp_request_failed", "provider_error");
        sendError(
          response,
          502,
          "OTP_DELIVERY_FAILED",
          "The verification code could not be delivered. Please try again.",
        );
        return;
      }
      trackBackendAnalytics({
        eventName: "login_otp_requested",
        exhibitionId: otpEventId,
        source: "sms_login",
        objectType: "otp_challenge",
        objectId: challengeId,
        properties: { challenge_id: challengeId, provider: "tencent_cloud" },
        request,
        occurredAt: now,
        dedupeKey: `login_otp_requested:${challengeId}`,
      });
      sendJson(response, 201, {
        challenge_id: challengeId,
        masked_phone: maskChinaMobile(phone),
        expires_at: expiresAt,
        retry_after_seconds: 60,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/otp/sessions") {
      if (typeof otpSecret !== "string" || !otpSecret) {
        trackOtpFailure(request, "login_otp_verification_failed", "unavailable");
        sendError(response, 503, "OTP_UNAVAILABLE", "SMS login is temporarily unavailable.");
        return;
      }
      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) {
        trackOtpFailure(request, "login_otp_verification_failed", "invalid_request", {
          retryable: false,
        });
        return;
      }
      const challengeId = parsedBody.value?.challenge_id;
      const code = parsedBody.value?.code;
      if (
        typeof challengeId !== "string"
        || !/^otp_[0-9a-f-]+$/.test(challengeId)
        || typeof code !== "string"
        || !/^\d{6}$/.test(code)
      ) {
        trackOtpFailure(request, "login_otp_verification_failed", "invalid_code", {
          challengeId: typeof challengeId === "string" ? challengeId : null,
          retryable: false,
        });
        sendError(response, 400, "INVALID_OTP", "The verification code is invalid or expired.");
        return;
      }
      const nowDate = clock();
      const now = nowDate.toISOString();
      const challenge = findOtpChallenge(database, challengeId);
      const suppliedHash = hashOtpCode({ secret: otpSecret, challengeId, code });
      if (
        challenge
        && !challenge.consumedAt
        && challenge.expiresAt > now
        && challenge.attemptsRemaining > 0
        && !otpCodeHashesEqual(challenge.codeHash, suppliedHash)
      ) {
        recordOtpFailure(database, { challengeId, now });
        trackOtpFailure(
          request,
          "login_otp_verification_failed",
          challenge.attemptsRemaining <= 1 ? "locked" : "invalid_code",
          {
            challengeId,
            attemptBucket: challenge.attemptsRemaining >= 4 ? "1-2" : "3-5",
            retryable: challenge.attemptsRemaining > 1,
          },
        );
        sendError(response, 400, "INVALID_OTP", "The verification code is invalid or expired.");
        return;
      }
      if (
        !challenge
        || challenge.consumedAt
        || challenge.expiresAt <= now
        || challenge.attemptsRemaining <= 0
        || !otpCodeHashesEqual(challenge.codeHash, suppliedHash)
      ) {
        const failureCode = !challenge || challenge.consumedAt
          ? "invalid_code"
          : challenge.expiresAt <= now
            ? "expired"
            : challenge.attemptsRemaining <= 0
              ? "locked"
              : "invalid_code";
        trackOtpFailure(request, "login_otp_verification_failed", failureCode, {
          challengeId,
          retryable: false,
        });
        sendError(response, 400, "INVALID_OTP", "The verification code is invalid or expired.");
        return;
      }
      const expiresAt = new Date(nowDate.getTime() + sessionTtlMs).toISOString();
      let userId;
      let isNewUser;
      let session;
      database.exec("BEGIN IMMEDIATE");
      try {
        if (!consumeOtpChallenge(database, { challengeId, now })) {
          database.exec("ROLLBACK");
          trackOtpFailure(request, "login_otp_verification_failed", "expired", {
            challengeId,
            retryable: false,
          });
          sendError(response, 400, "INVALID_OTP", "The verification code is invalid or expired.");
          return;
        }
        ({ userId, isNewUser } = findOrCreateOtpUser(database, {
          phone: challenge.phone,
          displayName: challenge.displayName,
          eventId: otpEventId,
          now,
        }));
        session = createAuthSession(database, { userId, now, expiresAt });
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      trackBackendAnalytics({
        eventName: "login_otp_verified",
        exhibitionId: otpEventId,
        userId,
        source: "sms_login",
        objectType: "otp_challenge",
        objectId: challengeId,
        properties: { challenge_id: challengeId, new_user: isNewUser },
        request,
        occurredAt: now,
        dedupeKey: `login_otp_verified:${challengeId}`,
      });
      sendJson(response, 201, {
        access_token: session.token,
        token_type: "Bearer",
        expires_at: session.expiresAt,
        is_new_user: isNewUser,
        user: findUserIdentity(database, userId),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/demo-sessions") {
      const suppliedAccessKey = request.headers["x-demo-access-key"];
      if (
        typeof demoAccessKey !== "string"
        || typeof suppliedAccessKey !== "string"
        || suppliedAccessKey !== demoAccessKey
      ) {
        sendError(
          response,
          403,
          "DEMO_ACCESS_DENIED",
          "A valid demo access key is required.",
        );
        return;
      }

      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) return;
      const userId = parsedBody.value?.user_id;
      const user = typeof userId === "string"
        ? findUserIdentity(database, userId)
        : null;
      if (!user) {
        sendError(response, 404, "DEMO_USER_NOT_FOUND", "Demo user not found.");
        return;
      }

      const nowDate = clock();
      const expiresAt = new Date(nowDate.getTime() + sessionTtlMs).toISOString();
      const session = createAuthSession(database, {
        userId,
        now: nowDate.toISOString(),
        expiresAt,
      });
      sendJson(response, 201, {
        access_token: session.token,
        token_type: "Bearer",
        expires_at: session.expiresAt,
        user,
      });
      return;
    }

    if (request.method === "DELETE" && url.pathname === "/api/auth/session") {
      const token = readBearerToken(request);
      const now = clock().toISOString();
      if (!token || !revokeAuthSession(database, { token, now })) {
        sendError(response, 401, "AUTH_REQUIRED", "A valid session is required.");
        return;
      }
      sendJson(response, 204, null);
      return;
    }

    const cardRoute = matchCardRoute(url);
    if (request.method === "GET" && cardRoute) {
      const { encodedToken, eventId, source } = cardRoute;
      const opaqueToken = readPathParameter(response, encodedToken);
      if (opaqueToken === null) return;
      if (!eventId) {
        sendError(
          response,
          400,
          "EVENT_REQUIRED",
          "An event query parameter is required.",
        );
        return;
      }
      if (!SOURCES.has(source)) {
        sendError(response, 400, "INVALID_SOURCE", "source must be nfc, qr, or link.");
        return;
      }

      const now = clock().toISOString();
      const profile = findPublicCardProfile(database, {
        opaqueToken,
        eventId,
        now,
      });
      if (!profile) {
        sendError(
          response,
          404,
          "CARD_NOT_AVAILABLE",
          "This collaboration card is not available.",
        );
        return;
      }

      appendEventLog(database, {
        eventId,
        type: "card_landing_opened",
        objectType: "nfc_asset",
        objectId: profile.cardId,
        source,
        payload: { owner_id: profile.ownerId, event_id: eventId },
        createdAt: now,
      });
      sendJson(response, 200, {
        source,
        event: profile.event,
        profile: profile.profile,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/connections/physical-mutual") {
      const handshakeId = randomUUID();
      const suppliedAccessKey = request.headers["x-touch-device-key"];
      if (
        typeof touchDeviceAccessKey !== "string"
        || typeof suppliedAccessKey !== "string"
        || suppliedAccessKey !== touchDeviceAccessKey
      ) {
        trackTouchFailure(request, "permission_denied", { handshakeId });
        sendError(
          response,
          403,
          "TOUCH_DEVICE_FORBIDDEN",
          "A trusted touch-device access key is required.",
        );
        return;
      }
      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) {
        trackTouchFailure(request, "invalid", { handshakeId });
        return;
      }
      const payload = parsedBody.value;
      if (
        payload === null
        || typeof payload !== "object"
        || Array.isArray(payload)
        || typeof payload.event_id !== "string"
        || typeof payload.card_a_token !== "string"
        || typeof payload.card_b_token !== "string"
        || payload.card_a_token === payload.card_b_token
      ) {
        trackTouchFailure(request, "invalid", {
          exhibitionId: typeof payload?.event_id === "string" ? payload.event_id : otpEventId,
          handshakeId,
        });
        sendError(
          response,
          400,
          "INVALID_TOUCH",
          "event_id and two different active card tokens are required.",
        );
        return;
      }
      const now = clock().toISOString();
      const firstCard = findPublicCardProfile(database, {
        opaqueToken: payload.card_a_token,
        eventId: payload.event_id,
        now,
      });
      const secondCard = findPublicCardProfile(database, {
        opaqueToken: payload.card_b_token,
        eventId: payload.event_id,
        now,
      });
      if (!firstCard || !secondCard || firstCard.ownerId === secondCard.ownerId) {
        trackTouchFailure(request, "invalid", {
          exhibitionId: payload.event_id,
          handshakeId,
        });
        sendError(
          response,
          409,
          "TOUCH_CARDS_NOT_AVAILABLE",
          "Both cards must be active, visible, bound to different users, and in the same event.",
        );
        return;
      }
      if (isConnectionBlocked(database, {
        firstUserId: firstCard.ownerId,
        secondUserId: secondCard.ownerId,
        eventId: payload.event_id,
      })) {
        trackTouchFailure(request, "permission_denied", {
          exhibitionId: payload.event_id,
          handshakeId,
        });
        trackGuardrail(request, {
          exhibitionId: payload.event_id,
          guardrailCode: "blocked_pair_connection",
          objectType: "user_pair",
          source: "physical_mutual",
        });
        sendError(response, 409, "CONNECTION_BLOCKED", "This participant pair cannot connect.");
        return;
      }
      const existingConnection = findConnectionBetween(database, {
        firstUserId: firstCard.ownerId,
        secondUserId: secondCard.ownerId,
        eventId: payload.event_id,
      });
      if (existingConnection) {
        trackTouchFailure(request, "duplicate", {
          exhibitionId: payload.event_id,
          handshakeId,
        });
        appendEventLog(database, {
          eventId: payload.event_id,
          type: "physical_mutual_touch_attributed",
          objectType: "connection",
          objectId: existingConnection.id,
          source: "physical_mutual",
          payload: { card_ids: [firstCard.cardId, secondCard.cardId] },
          createdAt: now,
        });
        sendJson(response, 200, {
          connection: existingConnection,
          attribution: { source: "physical_mutual", card_ids: [firstCard.cardId, secondCard.cardId] },
          idempotent_replay: true,
        });
        return;
      }
      const expiresAt = findEventEndsAt(database, payload.event_id);
      const connectionRequest = createConnectionRequest(database, {
        requesterId: firstCard.ownerId,
        recipientId: secondCard.ownerId,
        eventId: payload.event_id,
        source: "nfc",
        message: "Trusted device confirmed a physical mutual touch.",
        expiresAt,
        now,
      });
      const accepted = acceptConnectionRequest(database, {
        requestId: connectionRequest.id,
        actorId: secondCard.ownerId,
        now,
        consentMode: "physical_mutual",
      });
      appendEventLog(database, {
        eventId: payload.event_id,
        type: "physical_mutual_connection_created",
        objectType: "connection",
        objectId: accepted.connection.id,
        source: "physical_mutual",
        payload: {
          request_id: connectionRequest.id,
          card_ids: [firstCard.cardId, secondCard.cardId],
        },
        createdAt: now,
      });
      sendJson(response, 201, {
        request: accepted.request,
        connection: accepted.connection,
        attribution: { source: "physical_mutual", card_ids: [firstCard.cardId, secondCard.cardId] },
        idempotent_replay: false,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/connections/requests") {
      const requesterId = resolveActorId(
        database,
        request,
        clock().toISOString(),
        allowInsecureDemoAuth,
      );
      if (!requesterId) {
        sendError(response, 401, "AUTH_REQUIRED", "A valid demo user is required.");
        return;
      }

      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) return;
      const payload = parsedBody.value;

      if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
        sendError(
          response,
          400,
          "INVALID_REQUEST",
          "recipient_id, event_id, and a valid source are required.",
        );
        return;
      }
      const {
        recipient_id: recipientId,
        event_id: eventId,
        source,
        message: rawMessage,
        candidate_id: candidateId,
        list_request_id: listRequestId,
      } = payload;
      if (!recipientId || !eventId || !SOURCES.has(source)) {
        sendError(
          response,
          400,
          "INVALID_REQUEST",
          "recipient_id, event_id, and a valid source are required.",
        );
        return;
      }
      const hasAnalyticsAttribution = candidateId !== undefined || listRequestId !== undefined;
      if (hasAnalyticsAttribution && (
        candidateId !== recipientId
        || typeof listRequestId !== "string"
        || !UUID_PATTERN.test(listRequestId)
      )) {
        sendError(
          response,
          400,
          "INVALID_CONNECTION_ATTRIBUTION",
          "Connection attribution must match the selected candidate and discovery request.",
        );
        return;
      }
      if (
        rawMessage !== undefined
        && (typeof rawMessage !== "string" || rawMessage.length > 240)
      ) {
        sendError(
          response,
          400,
          "INVALID_MESSAGE",
          "message must be a string of at most 240 characters.",
        );
        return;
      }
      if (requesterId === recipientId) {
        sendError(response, 409, "SELF_CONNECTION", "You cannot connect with yourself.");
        return;
      }

      if (isConnectionBlocked(database, {
        firstUserId: requesterId,
        secondUserId: recipientId,
        eventId,
      })) {
        trackGuardrail(request, {
          userId: requesterId,
          exhibitionId: eventId,
          guardrailCode: "blocked_pair_connection",
          objectType: "user_pair",
          objectId: [requesterId, recipientId].sort().join(":"),
          source: analyticsConnectionSource(source),
        });
        sendError(
          response,
          409,
          "CONNECTION_BLOCKED",
          "A connection request is not available for this participant pair.",
        );
        return;
      }

      const connected = findConnectionBetween(database, {
        firstUserId: requesterId,
        secondUserId: recipientId,
        eventId,
      });
      if (connected) {
        sendJson(response, 200, {
          connection: connected,
          idempotent_replay: true,
        });
        return;
      }

      const now = clock().toISOString();
      if (!isParticipantVisible(database, { userId: recipientId, eventId, now })) {
        sendError(
          response,
          409,
          "RECIPIENT_NOT_AVAILABLE",
          "This participant is no longer available for connection requests.",
        );
        return;
      }

      expireConnectionRequests(database, { eventId, now });

      const existing = findActiveConnectionRequest(database, {
        requesterId,
        recipientId,
        eventId,
      });
      if (existing) {
        sendJson(response, 200, { request: existing, idempotent_replay: true });
        return;
      }

      const latestRejection = findLatestConnectionRequest(database, {
        requesterId,
        recipientId,
        eventId,
        status: "REJECTED",
      });
      if (latestRejection) {
        const cooldownEndsAt = new Date(latestRejection.updated_at).getTime()
          + 5 * 60 * 1000;
        const cooldownRemainingMs = cooldownEndsAt - new Date(now).getTime();
        if (cooldownRemainingMs > 0) {
          const retryAfterSeconds = Math.ceil(cooldownRemainingMs / 1000);
          sendError(
            response,
            429,
            "REQUEST_COOLDOWN",
            "This participant declined recently. Try again after the cooldown.",
            { "retry-after": String(retryAfterSeconds) },
          );
          return;
        }
      }

      const rateWindowStart = new Date(
        new Date(now).getTime() - 60 * 1000,
      ).toISOString();
      const recentRequestCount = countRecentConnectionRequests(database, {
        requesterId,
        eventId,
        since: rateWindowStart,
      });
      if (recentRequestCount >= 5) {
        sendError(
          response,
          429,
          "REQUEST_RATE_LIMITED",
          "Too many connection requests. Try again in one minute.",
          { "retry-after": "60" },
        );
        return;
      }

      const connectionRequest = createConnectionRequest(database, {
        requesterId,
        recipientId,
        eventId,
        source,
        message: rawMessage?.trim() || null,
        expiresAt: new Date(Math.min(
          new Date(now).getTime() + requestTtlMs,
          new Date(findEventEndsAt(database, eventId)).getTime(),
        )).toISOString(),
        now,
        analyticsAttribution: hasAnalyticsAttribution ? {
          analytics_session_id: analytics.requestContext(request).sessionId,
          candidate_id: candidateId,
          list_request_id: listRequestId,
        } : null,
      });
      sendJson(response, 201, {
        request: connectionRequest,
        idempotent_replay: false,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/connections/requests") {
      const now = clock().toISOString();
      const actorId = resolveActorId(database, request, now, allowInsecureDemoAuth);
      if (!actorId) {
        sendError(response, 401, "AUTH_REQUIRED", "A valid session is required.");
        return;
      }
      const eventId = url.searchParams.get("event_id");
      const direction = url.searchParams.get("direction") ?? "incoming";
      const status = url.searchParams.get("status");
      if (!eventId) {
        sendError(response, 400, "EVENT_REQUIRED", "event_id is required.");
        return;
      }
      if (!new Set(["incoming", "outgoing"]).has(direction)) {
        sendError(
          response,
          400,
          "INVALID_DIRECTION",
          "direction must be incoming or outgoing.",
        );
        return;
      }
      if (status && !CONNECTION_REQUEST_STATUSES.has(status)) {
        sendError(response, 400, "INVALID_STATUS", "status is invalid.");
        return;
      }

      expireConnectionRequests(database, { eventId, now });

      const requests = listConnectionRequests(database, {
        userId: actorId,
        eventId,
        direction,
        status,
      });
      sendJson(response, 200, {
        requests,
        sync: {
          server_time: now,
          poll_after_ms: 2500,
        },
      });
      return;
    }

    const connectionRequestMatch = url.pathname.match(
      /^\/api\/connections\/requests\/([^/]+)$/,
    );
    if (request.method === "PATCH" && connectionRequestMatch) {
      const actorId = resolveActorId(
        database,
        request,
        clock().toISOString(),
        allowInsecureDemoAuth,
      );
      if (!actorId) {
        sendError(response, 401, "AUTH_REQUIRED", "A valid demo user is required.");
        return;
      }

      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) return;
      const payload = parsedBody.value;
      if (
        payload === null
        || typeof payload !== "object"
        || Array.isArray(payload)
        || !new Set(["accept", "reject", "cancel", "block"]).has(payload.action)
      ) {
        sendError(
          response,
          400,
          "INVALID_ACTION",
          "action must be accept, reject, cancel, or block.",
        );
        return;
      }
      if (
        payload.action === "block"
        && payload.reason_code !== undefined
        && (
          typeof payload.reason_code !== "string"
          || payload.reason_code.length > 64
        )
      ) {
        sendError(
          response,
          400,
          "INVALID_REASON_CODE",
          "reason_code must be a string of at most 64 characters.",
        );
        return;
      }

      const requestId = readPathParameter(response, connectionRequestMatch[1]);
      if (requestId === null) return;
      const now = clock().toISOString();
      const eventId = findConnectionRequestById(database, requestId)?.event_id;
      if (eventId) expireConnectionRequests(database, { eventId, now });
      const connectionRequest = findConnectionRequestById(database, requestId);
      if (!connectionRequest) {
        sendError(response, 404, "REQUEST_NOT_FOUND", "Connection request not found.");
        return;
      }
      if (
        payload.action === "accept"
        && connectionRequest.status === "EXPIRED"
      ) {
        sendError(
          response,
          409,
          "REQUEST_EXPIRED",
          "This connection request has expired.",
        );
        return;
      }
      if (
        payload.action === "cancel"
        && connectionRequest.requester_id !== actorId
      ) {
        sendError(
          response,
          403,
          "REQUESTER_ONLY",
          "Only the requester can cancel this connection request.",
        );
        return;
      }
      if (
        new Set(["accept", "reject"]).has(payload.action)
        && connectionRequest.recipient_id !== actorId
      ) {
        sendError(
          response,
          403,
          "RECIPIENT_ONLY",
          "Only the request recipient can accept or reject this connection.",
        );
        return;
      }
      if (
        payload.action === "block"
        && ![
          connectionRequest.requester_id,
          connectionRequest.recipient_id,
        ].includes(actorId)
      ) {
        sendError(
          response,
          403,
          "PARTICIPANT_ONLY",
          "Only request participants can block this relationship.",
        );
        return;
      }

      const resolver = CONNECTION_REQUEST_RESOLVERS[payload.action];
      if (resolver) {
        const result = resolver.resolve(database, {
          requestId,
          actorId,
          reasonCode: payload.reason_code ?? "not_specified",
          now,
        });
        if (result.request.status !== resolver.expectedStatus) {
          sendError(
            response,
            409,
            "REQUEST_NOT_PENDING",
            resolver.errorMessage,
          );
          return;
        }
        sendJson(response, 200, {
          request: result.request,
          connection: result.connection ?? null,
          idempotent_replay: result.idempotentReplay,
        });
        return;
      }

      const result = acceptConnectionRequest(database, { requestId, actorId, now });
      if (result.blocked) {
        trackGuardrail(request, {
          userId: actorId,
          exhibitionId: connectionRequest.event_id,
          guardrailCode: "blocked_pair_connection",
          objectType: "connection_request",
          objectId: requestId,
          source: connectionRequest.source === "link"
            ? "online_recommendation"
            : connectionRequest.source,
        });
        sendError(
          response,
          409,
          "CONNECTION_BLOCKED",
          "This participant pair can no longer establish a connection.",
        );
        return;
      }
      if (!result.connection) {
        sendError(
          response,
          409,
          "REQUEST_NOT_PENDING",
          "This connection request can no longer be accepted.",
        );
        return;
      }
      sendJson(response, 200, {
        request: result.request,
        connection: result.connection,
        idempotent_replay: result.idempotentReplay,
      });
      return;
    }

    const connectionMatch = url.pathname.match(/^\/api\/connections\/([^/]+)$/);
    if (request.method === "GET" && connectionMatch) {
      const actorId = resolveActorId(
        database,
        request,
        clock().toISOString(),
        allowInsecureDemoAuth,
      );
      if (!actorId) {
        sendError(response, 401, "AUTH_REQUIRED", "A valid demo user is required.");
        return;
      }
      const connectionId = readPathParameter(response, connectionMatch[1]);
      if (connectionId === null) return;
      const connection = findConnectionById(database, connectionId);
      if (!connection) {
        sendError(response, 404, "CONNECTION_NOT_FOUND", "Connection not found.");
        return;
      }
      if (!connection.members.includes(actorId)) {
        sendError(
          response,
          403,
          "CONNECTION_FORBIDDEN",
          "Only connection participants can view this relationship.",
        );
        return;
      }
      sendJson(response, 200, { connection });
      return;
    }

    const productActorId = resolveActorId(
      database,
      request,
      clock().toISOString(),
      allowInsecureDemoAuth,
    );
    const productResult = await productModule.handle({
      request,
      url,
      actorId: productActorId,
    });
    if (productResult) {
      const guardrailCode = PRODUCT_GUARDRAIL_CODES.get(productResult.body?.error?.code);
      if (guardrailCode) {
        trackGuardrail(request, {
          userId: productActorId,
          guardrailCode,
          objectType: "api_route",
          objectId: url.pathname.slice(0, 128),
          source: url.pathname.includes("/room") || url.pathname.includes("/projects")
            ? "project_room"
            : "system",
        });
      }
      if (
        request.method === "POST"
        && url.pathname === "/api/demo/reset"
        && productResult.status >= 200
        && productResult.status < 300
      ) {
        analytics.reset();
      }
      sendJson(response, productResult.status, productResult.body, productResult.headers);
      return;
    }

    sendError(response, 404, "NOT_FOUND", "Route not found.");
  };
  const server = createServer((request, response) => {
    handleRequest(request, response)
      .catch((error) => {
        console.error("Unhandled API error", error);
        if (!response.headersSent) {
          sendError(response, 500, "INTERNAL_ERROR", "The server could not complete the request.");
        } else if (!response.writableEnded) {
          response.end();
        }
      })
      .finally(() => {
        try {
          analytics.syncBusinessEvents();
        } catch (error) {
          console.error("Business analytics events could not be synchronized", error);
        }
      });
  });

  return {
    async start(port = 8787, host = "127.0.0.1") {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      return server.address();
    },
    async stop() {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
      database.close();
    },
  };
}
