import { createServer } from "node:http";

import {
  acceptConnectionRequest,
  appendEventLog,
  createConnectionRequest,
  findActiveConnectionRequest,
  findConnectionBetween,
  findConnectionById,
  findConnectionRequestById,
  findPublicCardProfile,
  isParticipantVisible,
  openDatabase,
  userExists,
} from "./database.js";

const SOURCES = new Set(["nfc", "qr", "link"]);

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

function sendJson(response, status, body) {
  response.writeHead(status, {
    "access-control-allow-headers": "content-type, x-demo-user-id",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
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

export function createApi({ databasePath, clock = () => new Date() }) {
  const database = openDatabase(databasePath);
  const handleRequest = async (request, response) => {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, null);
      return;
    }

    const url = new URL(request.url, "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        status: "ok",
        service: "collaboration-passport-api",
      });
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

    if (request.method === "POST" && url.pathname === "/api/connections/requests") {
      const requesterId = request.headers["x-demo-user-id"];
      if (typeof requesterId !== "string" || !userExists(database, requesterId)) {
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
      const { recipient_id: recipientId, event_id: eventId, source } = payload;
      if (!recipientId || !eventId || !SOURCES.has(source)) {
        sendError(
          response,
          400,
          "INVALID_REQUEST",
          "recipient_id, event_id, and a valid source are required.",
        );
        return;
      }
      if (requesterId === recipientId) {
        sendError(response, 409, "SELF_CONNECTION", "You cannot connect with yourself.");
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

      const existing = findActiveConnectionRequest(database, {
        requesterId,
        recipientId,
        eventId,
      });
      if (existing) {
        sendJson(response, 200, { request: existing, idempotent_replay: true });
        return;
      }

      const connectionRequest = createConnectionRequest(database, {
        requesterId,
        recipientId,
        eventId,
        source,
        now,
      });
      sendJson(response, 201, {
        request: connectionRequest,
        idempotent_replay: false,
      });
      return;
    }

    const connectionRequestMatch = url.pathname.match(
      /^\/api\/connections\/requests\/([^/]+)$/,
    );
    if (request.method === "PATCH" && connectionRequestMatch) {
      const actorId = request.headers["x-demo-user-id"];
      if (typeof actorId !== "string" || !userExists(database, actorId)) {
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
        || payload.action !== "accept"
      ) {
        sendError(response, 400, "INVALID_ACTION", "action must be accept.");
        return;
      }

      const requestId = readPathParameter(response, connectionRequestMatch[1]);
      if (requestId === null) return;
      const connectionRequest = findConnectionRequestById(database, requestId);
      if (!connectionRequest) {
        sendError(response, 404, "REQUEST_NOT_FOUND", "Connection request not found.");
        return;
      }
      if (connectionRequest.recipient_id !== actorId) {
        sendError(
          response,
          403,
          "RECIPIENT_ONLY",
          "Only the request recipient can accept this connection.",
        );
        return;
      }

      const now = clock().toISOString();
      const result = acceptConnectionRequest(database, { requestId, actorId, now });
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
      const actorId = request.headers["x-demo-user-id"];
      if (typeof actorId !== "string" || !userExists(database, actorId)) {
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
