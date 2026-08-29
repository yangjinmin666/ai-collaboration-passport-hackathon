import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ApiError,
  RallyApiClient,
  RallyTelemetryClient,
} from "../../prototype/mobile-demo/api-client.js";

function jsonResponse(status, body) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("mobile Rally API client", () => {
  test("adds telemetry context to product requests and reports only the terminal result", async () => {
    const observations = [];
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      getTelemetryHeaders: () => ({
        "x-rally-anonymous-id": "anonymous-id",
        "x-rally-session-id": "session-id",
      }),
      observeRequest: (observation) => observations.push(observation),
      fetchImpl: async (_url, options) => {
        assert.equal(options.headers["x-rally-anonymous-id"], "anonymous-id");
        assert.equal(options.headers["x-rally-session-id"], "session-id");
        return jsonResponse(200, { people: [] });
      },
    });

    await client.get("/api/events/hackathon-2026/discover");
    assert.deepEqual(observations, [{
      ok: true,
      method: "GET",
      path: "/api/events/hackathon-2026/discover",
      status: 200,
      payload: { people: [] },
    }]);
  });

  test("uses the current Bearer session and reports an expired session distinctly", async () => {
    const requests = [];
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      getAccessToken: () => "session-token",
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return jsonResponse(401, {
          error: { code: "AUTH_REQUIRED", message: "A valid session is required." },
        });
      },
    });

    await assert.rejects(
      client.get("/api/me"),
      (error) => error instanceof ApiError
        && error.status === 401
        && error.code === "AUTH_REQUIRED"
        && error.isAuthenticationError,
    );
    assert.equal(requests[0].url, "https://rally.example/api/me");
    assert.equal(requests[0].options.headers.authorization, "Bearer session-token");
  });

  test("retries a temporary GET failure but never retries a write", async () => {
    let getAttempts = 0;
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      retryDelaysMs: [0, 0],
      fetchImpl: async (_url, options) => {
        if (options.method === "GET") {
          getAttempts += 1;
          return getAttempts < 3
            ? jsonResponse(503, { error: { code: "UNAVAILABLE", message: "Try later" } })
            : jsonResponse(200, { ok: true });
        }
        return jsonResponse(503, { error: { code: "UNAVAILABLE", message: "Try later" } });
      },
    });

    assert.deepEqual(await client.get("/health"), { ok: true });
    assert.equal(getAttempts, 3);
    await assert.rejects(client.post("/api/write", {}), ApiError);
  });

  test("coalesces concurrent writes to the same resource", async () => {
    let releases;
    let calls = 0;
    const pending = new Promise((resolve) => { releases = resolve; });
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      fetchImpl: async () => {
        calls += 1;
        await pending;
        return jsonResponse(200, { saved: true });
      },
    });

    const first = client.runExclusive("visibility", () => client.patch("/visibility", { state: "VISIBLE" }));
    const second = client.runExclusive("visibility", () => client.patch("/visibility", { state: "PAUSED" }));
    assert.equal(first, second);
    releases();
    assert.deepEqual(await second, { saved: true });
    assert.equal(calls, 1);
  });

  test("preserves AbortError so callers can treat cancellation as intentional", async () => {
    const client = new RallyApiClient({
      baseUrl: "https://rally.example",
      fetchImpl: async () => {
        throw new DOMException("The operation was aborted", "AbortError");
      },
    });

    await assert.rejects(
      client.get("/api/me"),
      (error) => error.name === "AbortError",
    );
  });
});

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

describe("mobile first-party telemetry client", () => {
  test("queues only allowlisted properties and removes a delivered event", async () => {
    const localStorageImpl = new MemoryStorage();
    const sessionStorageImpl = new MemoryStorage();
    const uuids = [
      "10000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000002",
      "30000000-0000-4000-8000-000000000003",
    ];
    const requests = [];
    const telemetry = new RallyTelemetryClient({
      baseUrl: "https://rally.example",
      appVersion: "android-0.1.0",
      clientType: "android_webview",
      localStorageImpl,
      sessionStorageImpl,
      cryptoImpl: { randomUUID: () => uuids.shift() },
      clock: () => new Date("2026-08-29T13:00:00.000Z"),
      getAccessToken: () => "session-token",
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return jsonResponse(202, { accepted: 1, duplicates: 0 });
      },
    });

    const eventId = telemetry.track("discovery_viewed", {
      result_count_bucket: "1-5",
      filter_count: 0,
      list_request_id: "40000000-0000-4000-8000-000000000004",
    }, {
      source: "online_recommendation",
      objectType: "discovery_list",
      objectId: "40000000-0000-4000-8000-000000000004",
    });
    await telemetry.flush();

    assert.equal(eventId, "30000000-0000-4000-8000-000000000003");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.headers.authorization, "Bearer session-token");
    assert.equal(
      requests[0].options.headers["x-rally-session-id"],
      "20000000-0000-4000-8000-000000000002",
    );
    const payload = JSON.parse(requests[0].options.body);
    assert.equal(payload.events[0].queued_at, undefined);
    assert.deepEqual(payload.events[0].properties, {
      result_count_bucket: "1-5",
      filter_count: 0,
      list_request_id: "40000000-0000-4000-8000-000000000004",
    });
    assert.deepEqual(JSON.parse(localStorageImpl.getItem("rally_analytics_queue_v1")), []);
  });

  test("retains a failed delivery without retrying in a tight loop", async () => {
    const localStorageImpl = new MemoryStorage();
    let uuidCounter = 0;
    let fetchRequests = 0;
    const telemetry = new RallyTelemetryClient({
      baseUrl: "https://rally.example",
      localStorageImpl,
      sessionStorageImpl: new MemoryStorage(),
      cryptoImpl: { randomUUID: () => `${String(++uuidCounter).padStart(8, "0")}-0000-4000-8000-000000000000` },
      fetchImpl: async () => {
        fetchRequests += 1;
        return jsonResponse(503, { error: { code: "UNAVAILABLE" } });
      },
    });

    telemetry.track("room_viewed", {
      project_id: "project-1",
      member_count: 2,
      pack_status: "none",
    }, { source: "project_room", objectType: "project", objectId: "project-1" });
    await telemetry.flush();

    assert.equal(fetchRequests, 1);
    assert.equal(JSON.parse(localStorageImpl.getItem("rally_analytics_queue_v1")).length, 1);
  });

  test("starts a new telemetry session after 30 minutes of inactivity", async () => {
    const localStorageImpl = new MemoryStorage();
    const sessionStorageImpl = new MemoryStorage();
    const uuids = [
      "81000000-0000-4000-8000-000000000001",
      "82000000-0000-4000-8000-000000000002",
      "83000000-0000-4000-8000-000000000003",
      "84000000-0000-4000-8000-000000000004",
      "85000000-0000-4000-8000-000000000005",
    ];
    let currentTime = "2026-08-29T13:00:00.000Z";
    const sessions = [];
    const telemetry = new RallyTelemetryClient({
      baseUrl: "https://rally.example",
      localStorageImpl,
      sessionStorageImpl,
      cryptoImpl: { randomUUID: () => uuids.shift() },
      clock: () => new Date(currentTime),
      fetchImpl: async (_url, options) => {
        sessions.push(JSON.parse(options.body).events[0].session_id);
        return jsonResponse(202, { accepted: 1, duplicates: 0 });
      },
    });
    telemetry.track("room_viewed", {
      project_id: "project-1",
      member_count: 2,
      pack_status: "none",
    }, { source: "project_room", objectType: "project", objectId: "project-1" });
    await telemetry.flush();

    currentTime = "2026-08-29T13:30:01.000Z";
    telemetry.track("room_viewed", {
      project_id: "project-2",
      member_count: 3,
      pack_status: "PROPOSED",
    }, { source: "project_room", objectType: "project", objectId: "project-2" });
    await telemetry.flush();

    assert.deepEqual(sessions, [
      "82000000-0000-4000-8000-000000000002",
      "84000000-0000-4000-8000-000000000004",
    ]);
    assert.equal(telemetry.anonymousId, "81000000-0000-4000-8000-000000000001");
  });
});
