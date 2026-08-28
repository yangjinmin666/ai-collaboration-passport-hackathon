import { createServer } from "node:http";

import { createProductModule } from "./product-module.js";

import {
  acceptConnectionRequest,
  appendEventLog,
  blockConnectionRequest,
  cancelConnectionRequest,
  countRecentConnectionRequests,
  createAuthSession,
  createConnectionRequest,
  expireConnectionRequests,
  findActiveConnectionRequest,
  findConnectionBetween,
  findConnectionById,
  findConnectionRequestById,
  findEventEndsAt,
  findLatestConnectionRequest,
  findPublicCardProfile,
  findSessionUserId,
  findUserIdentity,
  isParticipantVisible,
  isConnectionBlocked,
  listConnectionRequests,
  openDatabase,
  rejectConnectionRequest,
  revokeAuthSession,
  userExists,
} from "./database.js";

const SOURCES = new Set(["nfc", "qr", "link"]);
const CONNECTION_REQUEST_STATUSES = new Set([
  "REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "BLOCKED",
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
    "access-control-allow-headers": "authorization, content-type, x-demo-access-key, x-demo-user-id, x-touch-device-key",
    "access-control-allow-methods": "DELETE, GET, POST, PUT, PATCH, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function sendError(response, status, code, message, extraHeaders) {
  sendJson(response, status, { error: { code, message } }, extraHeaders);
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
    return { ok: false };
  }
}

function readBearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") return null;
  return authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1] ?? null;
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
}) {
  const database = openDatabase(databasePath);
  const productModule = createProductModule(database, {
    clock,
    presenceTtlMs,
    platformMetadataFetcher,
    demoAccessKey,
    eventPolicyOverrides,
  });
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
      const suppliedAccessKey = request.headers["x-touch-device-key"];
      if (
        typeof touchDeviceAccessKey !== "string"
        || typeof suppliedAccessKey !== "string"
        || suppliedAccessKey !== touchDeviceAccessKey
      ) {
        sendError(
          response,
          403,
          "TOUCH_DEVICE_FORBIDDEN",
          "A trusted touch-device access key is required.",
        );
        return;
      }
      const parsedBody = await readJsonBody(request, response);
      if (!parsedBody.ok) return;
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
        sendError(response, 409, "CONNECTION_BLOCKED", "This participant pair cannot connect.");
        return;
      }
      const existingConnection = findConnectionBetween(database, {
        firstUserId: firstCard.ownerId,
        secondUserId: secondCard.ownerId,
        eventId: payload.event_id,
      });
      if (existingConnection) {
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

    const productResult = await productModule.handle({
      request,
      url,
      actorId: resolveActorId(
        database,
        request,
        clock().toISOString(),
        allowInsecureDemoAuth,
      ),
    });
    if (productResult) {
      sendJson(response, productResult.status, productResult.body, productResult.headers);
      return;
    }

    sendError(response, 404, "NOT_FOUND", "Route not found.");
  };
  const server = createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error("Unhandled API error", error);
      if (!response.headersSent) {
        sendError(response, 500, "INTERNAL_ERROR", "The server could not complete the request.");
      } else if (!response.writableEnded) {
        response.end();
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
