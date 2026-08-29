import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";
import { createAnalyticsService } from "../src/analytics.js";
import { openDatabase } from "../src/database.js";

const ADMIN_TOKEN = "analytics-admin-token-for-tests-000000000000000000000000";
const ANONYMOUS_ID = "10000000-0000-4000-8000-000000000001";
const SESSION_ID = "20000000-0000-4000-8000-000000000002";
const LIST_REQUEST_ID = "30000000-0000-4000-8000-000000000003";
const CLIENT_EVENT_ID = "40000000-0000-4000-8000-000000000004";

function telemetryHeaders(extra = {}) {
  return {
    "content-type": "application/json",
    "x-rally-anonymous-id": ANONYMOUS_ID,
    "x-rally-session-id": SESSION_ID,
    "x-rally-client-type": "android_webview",
    "x-rally-app-version": "android-0.1.0",
    ...extra,
  };
}

function clientEvent(overrides = {}) {
  return {
    analytics_event_id: CLIENT_EVENT_ID,
    event_name: "discovery_viewed",
    anonymous_id: ANONYMOUS_ID,
    exhibition_id: "hackathon-2026",
    session_id: SESSION_ID,
    source: "online_recommendation",
    client_type: "android_webview",
    app_version: "android-0.1.0",
    object_type: "discovery_list",
    object_id: LIST_REQUEST_ID,
    properties: {
      result_count_bucket: "1-5",
      filter_count: 0,
      list_request_id: LIST_REQUEST_ID,
    },
    occurred_at: "2026-08-29T13:00:00.000Z",
    ...overrides,
  };
}

describe("first-party analytics", () => {
  let api;
  let baseUrl;
  let code;
  let now;

  beforeEach(async () => {
    code = null;
    now = "2026-08-29T13:00:00.000Z";
    api = createApi({
      databasePath: ":memory:",
      clock: () => new Date(now),
      otpSecret: "analytics-test-otp-secret",
      otpSender: async (message) => { code = message.code; },
      analyticsAdminToken: ADMIN_TOKEN,
      analyticsAppVersion: "backend-test",
      analyticsDebugEnabled: true,
      demoAccessKey: "analytics-demo-reset-key",
      allowInsecureDemoAuth: true,
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function analyticsSummary() {
    const response = await fetch(
      `${baseUrl}/api/admin/analytics/summary?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": ADMIN_TOKEN } },
    );
    assert.equal(response.status, 200);
    return response.json();
  }

  test("records the real SMS funnel and accepts an allowlisted client event", async () => {
    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify({ phone: "13800138000" }),
    });
    const challenge = await challengeResponse.json();
    assert.equal(challengeResponse.status, 201);

    const sessionResponse = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
    });
    const session = await sessionResponse.json();
    assert.equal(sessionResponse.status, 201);

    const accepted = await fetch(`${baseUrl}/api/analytics/events`, {
      method: "POST",
      headers: telemetryHeaders({ authorization: `Bearer ${session.access_token}` }),
      body: JSON.stringify({ events: [clientEvent()] }),
    });
    assert.equal(accepted.status, 202);
    assert.deepEqual(await accepted.json(), { accepted: 1, duplicates: 0 });

    const duplicate = await fetch(`${baseUrl}/api/analytics/events`, {
      method: "POST",
      headers: telemetryHeaders({ authorization: `Bearer ${session.access_token}` }),
      body: JSON.stringify({ events: [clientEvent()] }),
    });
    assert.deepEqual(await duplicate.json(), { accepted: 0, duplicates: 1 });

    const summary = await analyticsSummary();
    const counts = Object.fromEntries(
      summary.event_counts.map((item) => [item.event_name, item.total]),
    );
    assert.equal(counts.login_otp_requested, 1);
    assert.equal(counts.login_otp_verified, 1);
    assert.equal(counts.event_joined, 1);
    assert.equal(counts.discovery_viewed, 1);
    assert.equal(summary.data_quality.total_events >= 4, true);
    assert.deepEqual(
      summary.funnels.find((item) => item.id === "login").steps.map((step) => ({
        event_name: step.event_name,
        unique_actors: step.unique_actors,
        conversion_from_previous: step.conversion_from_previous,
      })),
      [
        { event_name: "login_otp_requested", unique_actors: 1, conversion_from_previous: null },
        { event_name: "login_otp_verified", unique_actors: 1, conversion_from_previous: 1 },
        { event_name: "event_joined", unique_actors: 1, conversion_from_previous: 1 },
      ],
    );
    const recentResponse = await fetch(
      `${baseUrl}/api/admin/analytics/events?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": ADMIN_TOKEN } },
    );
    const joinedEvent = (await recentResponse.json()).events
      .find((event) => event.event_name === "event_joined");
    assert.equal(joinedEvent.properties.new_user, true);
  });

  test("does not combine different anonymous identities into one login funnel", async () => {
    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify({ phone: "13700137000" }),
    });
    const challenge = await challengeResponse.json();
    assert.equal(challengeResponse.status, 201);

    const otherAnonymousId = "10000000-0000-4000-8000-000000000099";
    const sessionResponse = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
      method: "POST",
      headers: telemetryHeaders({ "x-rally-anonymous-id": otherAnonymousId }),
      body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
    });
    assert.equal(sessionResponse.status, 201);

    const login = (await analyticsSummary()).funnels.find((item) => item.id === "login");
    assert.deepEqual(login.steps.map((step) => step.unique_actors), [1, 0, 0]);
  });

  test("does not count login events that happened before the preceding step", async () => {
    now = "2026-08-29T13:10:00.000Z";
    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify({ phone: "13600136000" }),
    });
    const challenge = await challengeResponse.json();
    assert.equal(challengeResponse.status, 201);

    now = "2026-08-29T13:00:00.000Z";
    const sessionResponse = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
    });
    assert.equal(sessionResponse.status, 201);

    const login = (await analyticsSummary()).funnels.find((item) => item.id === "login");
    assert.deepEqual(login.steps.map((step) => step.unique_actors), [1, 0, 0]);
  });

  test("rejects server-only events and any property outside the privacy allowlist", async () => {
    const serverOnly = await fetch(`${baseUrl}/api/analytics/events`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify(clientEvent({ event_name: "login_otp_verified" })),
    });
    assert.equal(serverOnly.status, 400);
    assert.equal((await serverOnly.json()).error.code, "ANALYTICS_EVENT_NOT_ALLOWED");

    const withPhone = await fetch(`${baseUrl}/api/analytics/events`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify(clientEvent({
        properties: {
          result_count_bucket: "1-5",
          filter_count: 0,
          list_request_id: LIST_REQUEST_ID,
          phone: "13800138000",
        },
      })),
    });
    assert.equal(withPhone.status, 400);
    assert.equal((await withPhone.json()).error.code, "INVALID_ANALYTICS_PROPERTIES");
  });

  test("overwrites a client-supplied app version with the request context", async () => {
    const response = await fetch(`${baseUrl}/api/analytics/events`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify(clientEvent({ app_version: "forged-client-version" })),
    });
    assert.equal(response.status, 202);
    const recent = await fetch(
      `${baseUrl}/api/admin/analytics/events?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": ADMIN_TOKEN } },
    );
    const discovery = (await recent.json()).events
      .find((event) => event.event_name === "discovery_viewed");
    assert.equal(discovery.app_version, "android-0.1.0");
  });

  test("mirrors successful business transitions without double-counting idempotent requests", async () => {
    const requestConnection = () => fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    const created = await requestConnection();
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal((await requestConnection()).status, 200);

    const accepted = await fetch(
      `${baseUrl}/api/connections/requests/${createdBody.request.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-lin",
        },
        body: JSON.stringify({ action: "accept" }),
      },
    );
    assert.equal(accepted.status, 200);

    const summary = await analyticsSummary();
    const counts = Object.fromEntries(
      summary.event_counts.map((item) => [item.event_name, item.total]),
    );
    assert.equal(counts.connection_requested, 1);
    assert.equal(counts.connection_accepted, 1);
    assert.equal(
      summary.sources.some((item) => (
        item.event_name === "connection_requested"
        && item.source === "online_recommendation"
      )),
      true,
    );
  });

  test("attributes the collaboration funnel through one connection and project", async () => {
    const requested = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    const requestId = (await requested.json()).request.id;
    const accepted = await fetch(`${baseUrl}/api/connections/requests/${requestId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-lin",
      },
      body: JSON.stringify({ action: "accept" }),
    });
    const connectionId = (await accepted.json()).connection.id;

    const created = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        event_id: "hackathon-2026",
        origin_connection_id: connectionId,
        title: "现场协作终端",
        summary: "把现场讨论沉淀为任务",
        role_need: { title: "协作成员", skills: ["测试"], capacity: 1 },
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    const projectId = createdBody.project.id;
    const roleNeedId = createdBody.role_needs[0].id;
    const invited = await fetch(`${baseUrl}/api/projects/${projectId}/invitations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({ invitee_id: "user-lin", role_need_id: roleNeedId }),
    });
    const invitationId = (await invited.json()).invitation.id;
    assert.equal(invited.status, 201);
    const joined = await fetch(`${baseUrl}/api/team-invitations/${invitationId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-lin",
      },
      body: JSON.stringify({ action: "accept" }),
    });
    assert.equal(joined.status, 200);

    const otherRequested = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-su",
      },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
      }),
    });
    const otherRequestId = (await otherRequested.json()).request.id;
    const otherAccepted = await fetch(`${baseUrl}/api/connections/requests/${otherRequestId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-lin",
      },
      body: JSON.stringify({ action: "accept" }),
    });
    assert.equal(otherAccepted.status, 200);

    const recentResponse = await fetch(
      `${baseUrl}/api/admin/analytics/events?exhibition_id=hackathon-2026&limit=100`,
      { headers: { "x-analytics-admin-token": ADMIN_TOKEN } },
    );
    assert.equal(recentResponse.status, 200);
    const recent = (await recentResponse.json()).events;
    assert.equal(
      recent.find((event) => event.event_name === "project_created")
        .properties.origin_connection_id,
      connectionId,
    );
    assert.equal(
      recent.find((event) => event.event_name === "team_invited").properties.connection_id,
      connectionId,
    );
    assert.equal(
      recent.find((event) => event.event_name === "team_joined").properties.connection_id,
      connectionId,
    );

    const collaboration = (await analyticsSummary()).funnels
      .find((item) => item.id === "collaboration");
    assert.deepEqual(
      collaboration.steps.slice(0, 4).map((step) => step.unique_actors),
      [2, 1, 1, 1],
    );
    assert.deepEqual(
      collaboration.by_source
        .find((item) => item.source === "online_recommendation")
        .steps.slice(0, 4)
        .map((step) => ({ total: step.total, unique_actors: step.unique_actors })),
      [
        { total: 1, unique_actors: 1 },
        { total: 1, unique_actors: 1 },
        { total: 1, unique_actors: 1 },
        { total: 1, unique_actors: 1 },
      ],
    );
    assert.deepEqual(
      collaboration.by_source
        .find((item) => item.source === "nfc")
        .steps.slice(0, 4)
        .map((step) => ({ total: step.total, unique_actors: step.unique_actors })),
      [
        { total: 1, unique_actors: 1 },
        { total: 0, unique_actors: 0 },
        { total: 0, unique_actors: 0 },
        { total: 0, unique_actors: 0 },
      ],
    );
  });

  test("does not combine different candidates or sessions into a discovery funnel", () => {
    const database = openDatabase(":memory:");
    const service = createAnalyticsService(database, {
      clock: () => new Date("2026-08-29T13:10:00.000Z"),
      appVersion: "connection-attribution-test",
    });
    const insert = database.prepare(`
      INSERT INTO analytics_events (
        analytics_event_id, event_name, anonymous_id, user_id, exhibition_id,
        session_id, source, client_type, app_version, object_type, object_id,
        properties_json, occurred_at, received_at, dedupe_key
      ) VALUES (?, ?, NULL, 'user-zhou', 'hackathon-2026', ?,
                'online_recommendation', ?, 'connection-attribution-test', ?, ?, ?, ?, ?, ?)
    `);
    const sessionId = "71000000-0000-4000-8000-000000000001";
    const listRequestId = "72000000-0000-4000-8000-000000000002";
    const rows = [
      ["73000000-0000-4000-8000-000000000003", "discovery_viewed", "mobile_web", "discovery_list", listRequestId, {
        result_count_bucket: "1-5", filter_count: 0, list_request_id: listRequestId,
      }, "2026-08-29T13:00:00.000Z", "2026-08-29T13:00:00.000Z"],
      ["74000000-0000-4000-8000-000000000004", "match_impression", "mobile_web", "candidate", "user-lin", {
        candidate_id: "user-lin", rank: 1, rule_score_bucket: "high", list_request_id: listRequestId,
      }, "2026-08-29T13:01:00.000Z", "2026-08-29T13:01:00.000Z"],
      ["75000000-0000-4000-8000-000000000005", "match_detail_opened", "mobile_web", "candidate", "user-su", {
        candidate_id: "user-su", rank: 2, reason_count: 2, list_request_id: listRequestId,
      }, "2026-08-29T13:02:00.000Z", "2026-08-29T13:02:00.000Z"],
    ];
    for (const [id, name, clientType, objectType, objectId, properties, occurredAt, receivedAt] of rows) {
      insert.run(
        id,
        name,
        sessionId,
        clientType,
        objectType,
        objectId,
        JSON.stringify(properties),
        occurredAt,
        receivedAt,
        `connection-attribution:${id}`,
      );
    }

    const connection = service.summary("hackathon-2026").funnels
      .find((funnel) => funnel.id === "connection");
    assert.deepEqual(connection.steps.map((step) => step.unique_actors), [1, 1, 0, 0, 0]);
    database.close();
  });

  test("limits collaboration attribution to 72 hours after the accepted connection", () => {
    const database = openDatabase(":memory:");
    const service = createAnalyticsService(database, {
      clock: () => new Date("2026-08-29T13:00:00.000Z"),
      appVersion: "funnel-window-test",
    });
    const insert = database.prepare(`
      INSERT INTO analytics_events (
        analytics_event_id, event_name, anonymous_id, user_id, exhibition_id,
        session_id, source, client_type, app_version, object_type, object_id,
        properties_json, occurred_at, received_at, dedupe_key
      ) VALUES (?, ?, NULL, ?, 'hackathon-2026', ?, ?, 'backend',
                'funnel-window-test', ?, ?, ?, ?, ?, ?)
    `);
    insert.run(
      "51000000-0000-4000-8000-000000000001",
      "connection_accepted",
      "user-zhou",
      "52000000-0000-4000-8000-000000000002",
      "online_recommendation",
      "connection",
      "connection-window-test",
      JSON.stringify({ request_id: "request-window-test", connection_id: "connection-window-test" }),
      "2026-08-25T00:00:00.000Z",
      "2026-08-25T00:00:00.000Z",
      "window-accepted",
    );
    insert.run(
      "53000000-0000-4000-8000-000000000003",
      "project_created",
      "user-zhou",
      "54000000-0000-4000-8000-000000000004",
      "system",
      "project",
      "project-too-late",
      JSON.stringify({
        project_id: "project-too-late",
        origin_connection_id: "connection-window-test",
      }),
      "2026-08-28T01:00:01.000Z",
      "2026-08-28T01:00:01.000Z",
      "window-project",
    );

    const collaboration = service.summary("hackathon-2026").funnels
      .find((funnel) => funnel.id === "collaboration");
    assert.deepEqual(collaboration.steps.slice(0, 2).map((step) => step.unique_actors), [1, 0]);
    database.close();
  });

  test("enforces 30-day retention while the analytics service keeps running", () => {
    let serviceNow = new Date("2026-08-01T00:00:00.000Z");
    const database = openDatabase(":memory:");
    const service = createAnalyticsService(database, {
      clock: () => serviceNow,
      appVersion: "retention-test",
      retentionDays: 30,
    });
    database.prepare(`
      INSERT INTO analytics_events (
        analytics_event_id, event_name, anonymous_id, user_id, exhibition_id,
        session_id, source, client_type, app_version, properties_json,
        occurred_at, received_at, dedupe_key
      ) VALUES (?, 'login_otp_requested', ?, NULL, 'hackathon-2026', ?,
                'sms_login', 'backend', 'retention-test', '{}', ?, ?, ?)
    `).run(
      "61000000-0000-4000-8000-000000000001",
      "62000000-0000-4000-8000-000000000002",
      "63000000-0000-4000-8000-000000000003",
      "2026-08-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
      "retention-running-service",
    );
    assert.equal(service.summary("hackathon-2026").data_quality.total_events, 1);

    serviceNow = new Date("2026-08-31T00:00:01.000Z");
    assert.equal(service.summary("hackathon-2026").data_quality.total_events, 0);
    database.close();
  });

  test("records a blocked privacy guardrail without exposing the user's reason", async () => {
    const createRequest = () => fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    const created = await createRequest();
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    const blocked = await fetch(
      `${baseUrl}/api/connections/requests/${createdBody.request.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user-id": "user-lin",
        },
        body: JSON.stringify({ action: "block", reason_code: "private-user-reason" }),
      },
    );
    assert.equal(blocked.status, 200);

    const denied = await createRequest();
    assert.equal(denied.status, 409);
    assert.equal((await denied.json()).error.code, "CONNECTION_BLOCKED");

    const summary = await analyticsSummary();
    assert.equal(
      summary.event_counts.find((item) => item.event_name === "guardrail_blocked").total,
      1,
    );
    const exported = await fetch(
      `${baseUrl}/api/admin/analytics/export?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": ADMIN_TOKEN } },
    );
    assert.equal((await exported.text()).includes("private-user-reason"), false);
  });

  test("protects admin output, exports no phone or verification code, and clears demo analytics", async () => {
    const denied = await fetch(`${baseUrl}/api/admin/analytics/summary`);
    assert.equal(denied.status, 401);

    const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
      method: "POST",
      headers: telemetryHeaders(),
      body: JSON.stringify({ phone: "13900139000" }),
    });
    const challenge = await challengeResponse.json();
    assert.equal(challengeResponse.status, 201);

    const exported = await fetch(
      `${baseUrl}/api/admin/analytics/export?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": ADMIN_TOKEN } },
    );
    const csv = await exported.text();
    assert.equal(exported.status, 200);
    assert.equal(csv.includes("13900139000"), false);
    assert.equal(csv.includes(code), false);
    assert.equal(csv.includes(challenge.challenge_id), true);

    const reset = await fetch(`${baseUrl}/api/demo/reset`, {
      method: "POST",
      headers: { "x-demo-access-key": "analytics-demo-reset-key" },
    });
    assert.equal(reset.status, 200);
    const summary = await analyticsSummary();
    assert.equal(summary.data_quality.total_events, 0);
  });

  test("deletes one user's events and linked anonymous history without affecting another user", async () => {
    const login = async ({ phone, anonymousId }) => {
      const headers = telemetryHeaders({ "x-rally-anonymous-id": anonymousId });
      const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone }),
      });
      const challenge = await challengeResponse.json();
      assert.equal(challengeResponse.status, 201);
      const sessionResponse = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
      });
      assert.equal(sessionResponse.status, 201);
      return sessionResponse.json();
    };
    const first = await login({
      phone: "13500135000",
      anonymousId: ANONYMOUS_ID,
    });
    await login({
      phone: "13400134000",
      anonymousId: "10000000-0000-4000-8000-000000000088",
    });

    const denied = await fetch(
      `${baseUrl}/api/admin/analytics/users/${encodeURIComponent(first.user.id)}`,
      { method: "DELETE" },
    );
    assert.equal(denied.status, 401);

    const deleted = await fetch(
      `${baseUrl}/api/admin/analytics/users/${encodeURIComponent(first.user.id)}`
        + "?exhibition_id=hackathon-2026",
      {
        method: "DELETE",
        headers: { "x-analytics-admin-token": ADMIN_TOKEN },
      },
    );
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), {
      exhibition_id: "hackathon-2026",
      user_id: first.user.id,
      deleted_events: 3,
    });

    const summary = await analyticsSummary();
    const loginFunnel = summary.funnels.find((item) => item.id === "login");
    assert.deepEqual(loginFunnel.steps.map((step) => step.unique_actors), [1, 1, 1]);
    const exported = await fetch(
      `${baseUrl}/api/admin/analytics/export?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": ADMIN_TOKEN } },
    );
    const csv = await exported.text();
    assert.equal(csv.includes(first.user.id), false);
    assert.equal(csv.includes(ANONYMOUS_ID), false);
  });

  test("deletes only the matching login history when two users share one anonymous device ID", async () => {
    const sharedAnonymousId = "10000000-0000-4000-8000-000000000077";
    const login = async (phone) => {
      const headers = telemetryHeaders({ "x-rally-anonymous-id": sharedAnonymousId });
      const challengeResponse = await fetch(`${baseUrl}/api/auth/otp/challenges`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone }),
      });
      const challenge = await challengeResponse.json();
      assert.equal(challengeResponse.status, 201);
      const sessionResponse = await fetch(`${baseUrl}/api/auth/otp/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
      });
      assert.equal(sessionResponse.status, 201);
      return sessionResponse.json();
    };
    const first = await login("13300133000");
    const second = await login("13200132000");

    const deleted = await fetch(
      `${baseUrl}/api/admin/analytics/users/${encodeURIComponent(first.user.id)}`,
      {
        method: "DELETE",
        headers: { "x-analytics-admin-token": ADMIN_TOKEN },
      },
    );
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json()).deleted_events, 3);

    const recent = await fetch(
      `${baseUrl}/api/admin/analytics/events?exhibition_id=hackathon-2026`,
      { headers: { "x-analytics-admin-token": ADMIN_TOKEN } },
    );
    const events = (await recent.json()).events;
    assert.equal(events.some((event) => event.user_id === first.user.id), false);
    assert.equal(events.some((event) => event.user_id === second.user.id), true);
    assert.equal(
      events.filter((event) => event.event_name === "login_otp_requested").length,
      1,
    );
  });
});
