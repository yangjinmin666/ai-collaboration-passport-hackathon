import { randomUUID, timingSafeEqual } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_TYPES = new Set(["android_webview", "mobile_web"]);
const SOURCES = new Set([
  "sms_login",
  "online_recommendation",
  "nearby",
  "nfc",
  "qr",
  "physical_mutual",
  "connections_list",
  "project_room",
  "direct_link",
  "system",
]);
const FAILURE_CODES = new Set([
  "invalid_request",
  "invalid_code",
  "expired",
  "locked",
  "rate_limited",
  "provider_error",
  "unavailable",
  "invalid",
  "duplicate",
  "permission_denied",
  "timeout",
]);
const CLIENT_EVENT_RULES = {
  discovery_viewed: {
    result_count_bucket: { type: "enum", values: new Set(["0", "1-5", "6-20", "21+"]) },
    filter_count: { type: "integer", minimum: 0, maximum: 20 },
    list_request_id: { type: "uuid" },
  },
  match_impression: {
    candidate_id: { type: "string", maximum: 128 },
    rank: { type: "integer", minimum: 1, maximum: 1000 },
    rule_score_bucket: { type: "enum", values: new Set(["low", "medium", "high", "unknown"]) },
    list_request_id: { type: "uuid" },
  },
  match_detail_opened: {
    candidate_id: { type: "string", maximum: 128 },
    rank: { type: "integer", minimum: 1, maximum: 1000 },
    reason_count: { type: "integer", minimum: 0, maximum: 20 },
    list_request_id: { type: "uuid" },
  },
  room_viewed: {
    project_id: { type: "string", maximum: 128 },
    member_count: { type: "integer", minimum: 0, maximum: 100 },
    pack_status: {
      type: "enum",
      values: new Set(["none", "PROPOSED", "CONFIRMED", "ARCHIVED"]),
    },
  },
};
const BACKEND_EVENT_PROPERTIES = {
  login_otp_requested: new Set(["challenge_id", "provider"]),
  login_otp_request_failed: new Set(["failure_code", "retryable"]),
  login_otp_verified: new Set(["challenge_id", "new_user"]),
  login_otp_verification_failed: new Set(["challenge_id", "failure_code", "attempt_bucket"]),
  touch_handshake_failed: new Set(["handshake_id", "failure_code"]),
  guardrail_blocked: new Set(["guardrail_code", "object_type", "source"]),
};
const BUSINESS_EVENT_TYPES = [
  "event_joined",
  "profile_updated",
  "visibility_changed",
  "card_landing_opened",
  "connection_requested",
  "connection_accepted",
  "physical_mutual_connection_created",
  "project_created",
  "team_invitation_created",
  "team_invitation_accepted",
  "starter_pack_generated",
  "task_claimed",
];
const FUNNELS = [
  {
    id: "login",
    steps: ["login_otp_requested", "login_otp_verified", "event_joined"],
  },
  {
    id: "profile",
    steps: ["event_joined", "profile_completed", "visibility_enabled"],
  },
  {
    id: "connection",
    steps: [
      "discovery_viewed",
      "match_impression",
      "match_detail_opened",
      "connection_requested",
      "connection_accepted",
    ],
  },
  {
    id: "collaboration",
    steps: [
      "connection_accepted",
      "project_created",
      "team_invited",
      "team_joined",
      "room_viewed",
      "collaboration_pack_generated",
      "task_accepted",
    ],
  },
];

function orderedAfter(candidate, previous) {
  const candidateTime = new Date(candidate.ordering_at ?? candidate.occurred_at).getTime();
  const previousTime = new Date(previous.ordering_at ?? previous.occurred_at).getTime();
  if (candidateTime !== previousTime) return candidateTime > previousTime;
  return candidate.event_order > previous.event_order;
}

function connectionSequenceCounts(events, startSource = null) {
  const discoveries = events.filter((event) => (
    event.event_name === "discovery_viewed"
    && event.user_id
    && event.properties.list_request_id
    && (!startSource || event.source === startSource)
  ));
  const impressions = events.filter((event) => event.event_name === "match_impression");
  const details = events.filter((event) => event.event_name === "match_detail_opened");
  const requests = events.filter((event) => event.event_name === "connection_requested");
  const accepted = events.filter((event) => event.event_name === "connection_accepted");
  const discoveryCohort = new Map();
  for (const event of discoveries) {
    const key = [
      event.source,
      event.user_id,
      event.session_id,
      event.properties.list_request_id,
    ].join(":");
    if (!discoveryCohort.has(key)) {
      discoveryCohort.set(key, {
        source: event.source,
        userId: event.user_id,
        sessionId: event.session_id,
        listRequestId: event.properties.list_request_id,
        last: event,
      });
    }
  }
  const impressionCohort = new Map();
  for (const [key, state] of discoveryCohort) {
    const candidateImpressions = new Map();
    for (const impression of impressions) {
      if (
        impression.source === state.source
        && impression.user_id === state.userId
        && impression.session_id === state.sessionId
        && impression.properties.list_request_id === state.listRequestId
        && impression.properties.candidate_id
        && orderedAfter(impression, state.last)
        && !candidateImpressions.has(impression.properties.candidate_id)
      ) {
        candidateImpressions.set(impression.properties.candidate_id, impression);
      }
    }
    if (candidateImpressions.size > 0) {
      impressionCohort.set(key, { ...state, candidateImpressions });
    }
  }
  const detailCohort = new Map();
  for (const [key, state] of impressionCohort) {
    const detail = details.find((event) => {
      const impression = state.candidateImpressions.get(event.properties.candidate_id);
      return Boolean(impression)
        && event.source === state.source
        && event.user_id === state.userId
        && event.session_id === state.sessionId
        && event.properties.list_request_id === state.listRequestId
        && orderedAfter(event, impression);
    });
    if (detail) {
      detailCohort.set(key, {
        ...state,
        candidateId: detail.properties.candidate_id,
        last: detail,
      });
    }
  }
  const requestCohort = new Map();
  for (const [key, state] of detailCohort) {
    const request = firstFollowing(requests, state.last, (event) => (
      event.source === state.source
      && event.user_id === state.userId
      && event.session_id === state.sessionId
      && event.properties.list_request_id === state.listRequestId
      && event.properties.recipient_id === state.candidateId
      && Boolean(event.properties.request_id)
    ));
    if (request) requestCohort.set(key, { ...state, requestId: request.properties.request_id, last: request });
  }
  const acceptedCohort = new Map();
  for (const [key, state] of requestCohort) {
    const match = firstFollowing(accepted, state.last, (event) => (
      event.source === state.source && event.properties.request_id === state.requestId
    ));
    if (match) acceptedCohort.set(key, { ...state, last: match });
  }
  return [
    discoveryCohort.size,
    impressionCohort.size,
    detailCohort.size,
    requestCohort.size,
    acceptedCohort.size,
  ];
}

function firstFollowing(events, previous, predicate, deadlineMs = Number.POSITIVE_INFINITY) {
  return events.find((event) => (
    orderedAfter(event, previous)
    && new Date(event.ordering_at ?? event.occurred_at).getTime() <= deadlineMs
    && predicate(event)
  )) ?? null;
}

function actorSequenceCounts(events, steps, identityFor, {
  bindSource = false,
  startSource = null,
} = {}) {
  const stepEvents = new Map(steps.map((step) => [
    step,
    events.filter((event) => event.event_name === step),
  ]));
  const cohort = new Map();
  for (const event of stepEvents.get(steps[0])) {
    if (startSource && event.source !== startSource) continue;
    const actor = identityFor(event, steps[0]);
    if (!actor) continue;
    const key = bindSource ? `${event.source}:${actor}` : actor;
    if (!cohort.has(key)) cohort.set(key, { actor, source: event.source, last: event });
  }
  const counts = [cohort.size];
  let current = cohort;
  for (const step of steps.slice(1)) {
    const next = new Map();
    for (const [key, state] of current) {
      const match = firstFollowing(stepEvents.get(step), state.last, (event) => (
        identityFor(event, step) === state.actor
        && (!bindSource || event.source === state.source)
      ));
      if (match) next.set(key, { ...state, last: match });
    }
    current = next;
    counts.push(current.size);
  }
  return counts;
}

function loginSequenceCounts(events, startSource = null) {
  const requested = events.filter((event) => (
    event.event_name === "login_otp_requested"
    && event.anonymous_id
    && (!startSource || event.source === startSource)
  ));
  const verified = events.filter((event) => event.event_name === "login_otp_verified");
  const joined = events.filter((event) => event.event_name === "event_joined");
  const requestedCohort = new Map();
  for (const event of requested) {
    if (!requestedCohort.has(event.anonymous_id)) {
      requestedCohort.set(event.anonymous_id, { anonymousId: event.anonymous_id, last: event });
    }
  }
  const verifiedCohort = new Map();
  for (const [anonymousId, state] of requestedCohort) {
    const match = firstFollowing(verified, state.last, (event) => (
      event.anonymous_id === anonymousId
      && Boolean(event.user_id)
      && (!startSource || event.source === startSource)
    ));
    if (match) {
      verifiedCohort.set(anonymousId, {
        anonymousId,
        userId: match.user_id,
        last: match,
      });
    }
  }
  const joinedCohort = new Map();
  for (const [anonymousId, state] of verifiedCohort) {
    const match = firstFollowing(joined, state.last, (event) => event.user_id === state.userId);
    if (match) joinedCohort.set(anonymousId, { ...state, last: match });
  }
  return [requestedCohort.size, verifiedCohort.size, joinedCohort.size];
}

function collaborationSequenceCounts(events, startSource = null) {
  const steps = FUNNELS.find((funnel) => funnel.id === "collaboration").steps;
  const accepted = events.filter((event) => (
    event.event_name === steps[0]
    && event.object_id
    && (!startSource || event.source === startSource)
  ));
  const projects = events.filter((event) => event.event_name === steps[1]);
  const cohort = new Map();
  for (const event of accepted) {
    if (!cohort.has(event.object_id)) {
      cohort.set(event.object_id, {
        connectionId: event.object_id,
        source: event.source,
        last: event,
      });
    }
  }
  const counts = [cohort.size];
  let current = new Map();
  for (const [connectionId, state] of cohort) {
    const deadlineMs = new Date(state.last.ordering_at ?? state.last.occurred_at).getTime()
      + 72 * 60 * 60 * 1000;
    const project = firstFollowing(projects, state.last, (event) => (
      event.properties.origin_connection_id === connectionId
      && Boolean(event.properties.project_id)
    ), deadlineMs);
    if (project) {
      current.set(connectionId, {
        ...state,
        projectId: project.properties.project_id,
        deadlineMs,
        last: project,
      });
    }
  }
  counts.push(current.size);
  for (const step of steps.slice(2)) {
    const candidates = events.filter((event) => event.event_name === step);
    const next = new Map();
    for (const [connectionId, state] of current) {
      const match = firstFollowing(candidates, state.last, (event) => (
        event.properties.project_id === state.projectId
      ), state.deadlineMs);
      if (match) next.set(connectionId, { ...state, last: match });
    }
    current = next;
    counts.push(current.size);
  }
  return counts;
}

function funnelStepSummary(funnel, counts, byName, attributedTotals = null) {
  return funnel.steps.map((eventName, index) => {
    const previous = index === 0 ? null : counts[index - 1];
    return {
      event_name: eventName,
      total: attributedTotals?.[index] ?? byName.get(eventName)?.total ?? 0,
      unique_actors: counts[index],
      conversion_from_previous: previous === null || previous === 0
        ? null
        : Number((counts[index] / previous).toFixed(4)),
    };
  });
}

export class AnalyticsRequestError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AnalyticsRequestError";
    this.status = status;
    this.code = code;
  }
}

function headerValue(request, name) {
  const value = request.headers[name];
  return typeof value === "string" ? value.trim() : "";
}

function validUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function cleanVersion(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:+-]{1,64}$/.test(trimmed) ? trimmed : fallback;
}

function normalizeBusinessSource(source, eventName) {
  if (new Set(["nfc", "qr", "physical_mutual", "nearby"]).has(source)) return source;
  if (source === "link") return eventName === "card_landing_opened"
    ? "direct_link"
    : "online_recommendation";
  if (new Set(["collaboration_pack_generated", "task_accepted", "team_joined"]).has(eventName)) {
    return "project_room";
  }
  return "system";
}

function connectionBusinessSource(database, row, requestId) {
  const connection = row.object_type === "connection"
    ? database.prepare("SELECT consent_mode FROM connections WHERE connection_id = ?").get(row.object_id)
    : database.prepare(`
        SELECT connection.consent_mode
        FROM connection_request_connections linked
        JOIN connections connection ON connection.connection_id = linked.connection_id
        WHERE linked.request_id = ?
      `).get(requestId);
  if (connection?.consent_mode === "physical_mutual") return "physical_mutual";
  return normalizeBusinessSource(row.source, row.event_type);
}

function connectionIdForPair(database, eventId, firstUserId, secondUserId) {
  if (!eventId || !firstUserId || !secondUserId) return null;
  const connection = database.prepare(`
    SELECT connection_id
    FROM connections
    WHERE event_id = ? AND status = 'ACTIVE'
      AND ((user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?))
    LIMIT 1
  `).get(eventId, firstUserId, secondUserId, secondUserId, firstUserId);
  return connection?.connection_id ?? null;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resultCountBucket(count) {
  if (count <= 0) return "0";
  if (count <= 5) return "1-5";
  if (count <= 20) return "6-20";
  return "21+";
}

function latencyBucket(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "unknown";
  if (milliseconds < 60_000) return "under_1m";
  if (milliseconds < 5 * 60_000) return "1-5m";
  if (milliseconds < 60 * 60_000) return "5-60m";
  return "over_1h";
}

function safeBackendProperties(eventName, properties) {
  const allowed = BACKEND_EVENT_PROPERTIES[eventName];
  if (!allowed) throw new Error(`Unsupported backend analytics event: ${eventName}`);
  const clean = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (!allowed.has(key)) continue;
    if (key === "failure_code") {
      clean[key] = FAILURE_CODES.has(value) ? value : "invalid_request";
      continue;
    }
    if (typeof value === "string") clean[key] = value.slice(0, 128);
    else if (typeof value === "boolean" || Number.isFinite(value)) clean[key] = value;
  }
  return clean;
}

function validateProperty(name, value, rule) {
  if (rule.type === "string") {
    return typeof value === "string" && value.length > 0 && value.length <= rule.maximum;
  }
  if (rule.type === "integer") {
    return Number.isInteger(value) && value >= rule.minimum && value <= rule.maximum;
  }
  if (rule.type === "enum") return rule.values.has(value);
  if (rule.type === "uuid") return validUuid(value);
  return false;
}

function validateClientProperties(eventName, properties) {
  const rules = CLIENT_EVENT_RULES[eventName];
  if (!rules) {
    throw new AnalyticsRequestError(
      400,
      "ANALYTICS_EVENT_NOT_ALLOWED",
      "This event can only be produced by the backend.",
    );
  }
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_PROPERTIES", "properties must be an object.");
  }
  const propertyNames = Object.keys(properties);
  if (propertyNames.length !== Object.keys(rules).length) {
    throw new AnalyticsRequestError(
      400,
      "INVALID_ANALYTICS_PROPERTIES",
      "Event properties do not match the allowlist.",
    );
  }
  for (const [name, rule] of Object.entries(rules)) {
    if (!validateProperty(name, properties[name], rule)) {
      throw new AnalyticsRequestError(
        400,
        "INVALID_ANALYTICS_PROPERTIES",
        `Invalid analytics property: ${name}.`,
      );
    }
  }
  return properties;
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sameSecret(expected, supplied) {
  if (typeof expected !== "string" || expected.length < 32 || typeof supplied !== "string") {
    return false;
  }
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function ensureSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      analytics_event_id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      anonymous_id TEXT,
      user_id TEXT,
      exhibition_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      source TEXT NOT NULL,
      client_type TEXT NOT NULL,
      app_version TEXT NOT NULL,
      object_type TEXT,
      object_id TEXT,
      properties_json TEXT NOT NULL DEFAULT '{}',
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      dedupe_key TEXT UNIQUE,
      origin_log_id TEXT UNIQUE,
      FOREIGN KEY (exhibition_id) REFERENCES events(event_id)
    );

    CREATE INDEX IF NOT EXISTS analytics_events_by_funnel
      ON analytics_events (exhibition_id, event_name, received_at);
    CREATE INDEX IF NOT EXISTS analytics_events_by_user
      ON analytics_events (user_id, exhibition_id, received_at);
    CREATE INDEX IF NOT EXISTS analytics_events_by_anonymous
      ON analytics_events (anonymous_id, exhibition_id, received_at);

    CREATE TABLE IF NOT EXISTS analytics_mirrored_logs (
      log_id TEXT PRIMARY KEY,
      analytics_event_id TEXT,
      processed_at TEXT NOT NULL
    );
  `);
}

function mapBusinessEvent(database, row) {
  const payload = parseJsonObject(row.payload_json);
  const common = {
    analyticsEventId: row.log_id,
    anonymousId: null,
    userId: row.actor_id,
    exhibitionId: row.event_id,
    sessionId: row.log_id,
    objectType: row.object_type,
    objectId: row.object_id,
    occurredAt: row.created_at,
    receivedAt: row.created_at,
    originLogId: row.log_id,
    dedupeKey: `event-log:${row.log_id}`,
  };
  if (row.event_type === "event_joined") {
    return {
      ...common,
      eventName: "event_joined",
      source: "system",
      properties: {
        membership_id: row.object_id,
        new_user: Boolean(payload.new_user),
      },
      dedupeKey: `event_joined:${row.event_id}:${row.actor_id}`,
    };
  }
  if (row.event_type === "profile_updated") {
    const profile = database.prepare(`
      SELECT evidence_json FROM profiles WHERE event_id = ? AND user_id = ?
    `).get(row.event_id, row.actor_id);
    return {
      ...common,
      eventName: "profile_completed",
      source: "system",
      properties: {
        field_count: Array.isArray(payload.fields) ? payload.fields.length : 0,
        evidence_count: profile ? JSON.parse(profile.evidence_json).length : 0,
        completion_version: "v1",
      },
      dedupeKey: `profile_completed:${row.event_id}:${row.actor_id}`,
    };
  }
  if (row.event_type === "visibility_changed") {
    if (payload.state !== "VISIBLE") return null;
    return {
      ...common,
      eventName: "visibility_enabled",
      source: "system",
      properties: {
        scope: "event",
        public_field_count: Array.isArray(payload.public_fields) ? payload.public_fields.length : 0,
        expiry_bucket: "event_end",
      },
    };
  }
  if (row.event_type === "card_landing_opened") {
    return {
      ...common,
      eventName: "card_landing_opened",
      source: normalizeBusinessSource(row.source, "card_landing_opened"),
      properties: { card_id: row.object_id, owner_id: payload.owner_id },
    };
  }
  if (row.event_type === "connection_requested") {
    return {
      ...common,
      eventName: "connection_requested",
      sessionId: payload.analytics_session_id ?? common.sessionId,
      source: connectionBusinessSource(database, row, row.object_id),
      properties: {
        request_id: row.object_id,
        recipient_id: payload.recipient_id,
        ...(payload.candidate_id ? { candidate_id: payload.candidate_id } : {}),
        ...(payload.list_request_id ? { list_request_id: payload.list_request_id } : {}),
      },
    };
  }
  if (row.event_type === "connection_accepted") {
    return {
      ...common,
      eventName: "connection_accepted",
      source: connectionBusinessSource(database, row, payload.request_id),
      properties: {
        request_id: payload.request_id,
        connection_id: row.object_id,
        latency_seconds_bucket: latencyBucket(payload.latency_ms),
      },
    };
  }
  if (row.event_type === "physical_mutual_connection_created") {
    return {
      ...common,
      eventName: "touch_handshake_completed",
      source: "physical_mutual",
      properties: {
        handshake_id: row.log_id,
        connection_id: row.object_id,
      },
    };
  }
  if (row.event_type === "project_created") {
    const roleNeed = database.prepare(`
      SELECT COUNT(*) AS count FROM project_role_needs WHERE project_id = ?
    `).get(row.object_id);
    return {
      ...common,
      eventName: "project_created",
      source: "system",
      properties: {
        project_id: row.object_id,
        origin_connection_id: payload.origin_connection_id ?? null,
        role_need_count: roleNeed?.count ?? 0,
      },
    };
  }
  if (row.event_type === "team_invitation_created") {
    const invitation = database.prepare(`
      SELECT invitation.project_id, invitation.role_need_id,
             invitation.inviter_id, invitation.invitee_id, project.event_id
      FROM team_invitations invitation
      JOIN projects project ON project.project_id = invitation.project_id
      WHERE invitation.invitation_id = ?
    `).get(row.object_id);
    const connectionId = connectionIdForPair(
      database,
      invitation?.event_id,
      invitation?.inviter_id,
      invitation?.invitee_id,
    );
    return {
      ...common,
      eventName: "team_invited",
      source: "project_room",
      properties: {
        project_id: invitation?.project_id ?? payload.project_id,
        invitation_id: row.object_id,
        role_need_id: invitation?.role_need_id ?? null,
        connection_id: connectionId,
      },
    };
  }
  if (row.event_type === "team_invitation_accepted") {
    const invitationId = payload.invitation_id;
    const invitation = database.prepare(`
      SELECT invitation.inviter_id, invitation.invitee_id, project.event_id
      FROM team_invitations invitation
      JOIN projects project ON project.project_id = invitation.project_id
      WHERE invitation.invitation_id = ?
    `).get(invitationId);
    return {
      ...common,
      eventName: "team_joined",
      source: "project_room",
      properties: {
        project_id: payload.project_id,
        invitation_id: invitationId,
        role_need_id: payload.role_need_id,
        connection_id: connectionIdForPair(
          database,
          invitation?.event_id,
          invitation?.inviter_id,
          invitation?.invitee_id,
        ),
      },
    };
  }
  if (row.event_type === "starter_pack_generated") {
    const members = database.prepare(`
      SELECT COUNT(*) AS count FROM project_memberships WHERE project_id = ?
    `).get(payload.project_id);
    return {
      ...common,
      eventName: "collaboration_pack_generated",
      source: "project_room",
      properties: {
        project_id: payload.project_id,
        member_count: members?.count ?? 0,
        fallback_used: row.source === "template_fallback",
        generation_source: row.source === "template_fallback" ? "template" : "agent",
      },
    };
  }
  if (row.event_type === "task_claimed") {
    return {
      ...common,
      eventName: "task_accepted",
      source: "project_room",
      properties: {
        task_id: row.object_id,
        project_id: payload.project_id,
        assignee_id: row.actor_id,
      },
    };
  }
  return null;
}

export function createAnalyticsService(database, {
  clock = () => new Date(),
  appVersion = "development",
  adminToken = null,
  retentionDays = 30,
} = {}) {
  ensureSchema(database);
  const normalizedAppVersion = cleanVersion(appVersion, "development");
  const requestWindows = new Map();
  let lastCleanupAtMs = null;

  function retentionCutoff() {
    const days = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30;
    return new Date(clock().getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }

  function insertEvent(event) {
    const result = database.prepare(`
      INSERT OR IGNORE INTO analytics_events (
        analytics_event_id, event_name, anonymous_id, user_id, exhibition_id,
        session_id, source, client_type, app_version, object_type, object_id,
        properties_json, occurred_at, received_at, dedupe_key, origin_log_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.analyticsEventId,
      event.eventName,
      event.anonymousId ?? null,
      event.userId ?? null,
      event.exhibitionId,
      event.sessionId,
      event.source,
      event.clientType,
      event.appVersion,
      event.objectType ?? null,
      event.objectId ?? null,
      JSON.stringify(event.properties ?? {}),
      event.occurredAt,
      event.receivedAt,
      event.dedupeKey ?? event.analyticsEventId,
      event.originLogId ?? null,
    );
    return result.changes > 0;
  }

  function cleanupExpired({ force = false } = {}) {
    const nowMs = clock().getTime();
    if (!force && lastCleanupAtMs !== null && nowMs - lastCleanupAtMs < 60 * 60 * 1000) {
      return 0;
    }
    lastCleanupAtMs = nowMs;
    const result = database.prepare(
      "DELETE FROM analytics_events WHERE received_at < ?",
    ).run(retentionCutoff());
    database.prepare(`
      DELETE FROM analytics_mirrored_logs
      WHERE log_id NOT IN (SELECT log_id FROM event_logs)
    `).run();
    return result.changes;
  }

  function syncBusinessEvents() {
    const placeholders = BUSINESS_EVENT_TYPES.map(() => "?").join(", ");
    const rows = database.prepare(`
      SELECT event_logs.*
      FROM event_logs
      LEFT JOIN analytics_mirrored_logs mirrored ON mirrored.log_id = event_logs.log_id
      WHERE mirrored.log_id IS NULL
        AND event_logs.created_at >= ?
        AND event_logs.event_type IN (${placeholders})
      ORDER BY event_logs.created_at ASC, event_logs.rowid ASC
      LIMIT 500
    `).all(retentionCutoff(), ...BUSINESS_EVENT_TYPES);
    if (rows.length === 0) return 0;
    const processedAt = clock().toISOString();
    let inserted = 0;
    database.exec("BEGIN IMMEDIATE");
    try {
      const markProcessed = database.prepare(`
        INSERT OR IGNORE INTO analytics_mirrored_logs (log_id, analytics_event_id, processed_at)
        VALUES (?, ?, ?)
      `);
      for (const row of rows) {
        const mapped = mapBusinessEvent(database, row);
        if (mapped) {
          if (insertEvent({
            ...mapped,
            clientType: "backend",
            appVersion: normalizedAppVersion,
          })) inserted += 1;
        }
        markProcessed.run(row.log_id, mapped?.analyticsEventId ?? null, processedAt);
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return inserted;
  }

  function requestContext(request) {
    const anonymousId = headerValue(request, "x-rally-anonymous-id");
    const sessionId = headerValue(request, "x-rally-session-id");
    const clientType = headerValue(request, "x-rally-client-type");
    return {
      anonymousId: validUuid(anonymousId) ? anonymousId : null,
      sessionId: validUuid(sessionId) ? sessionId : randomUUID(),
      clientType: CLIENT_TYPES.has(clientType) ? clientType : "backend",
      clientAppVersion: cleanVersion(
        headerValue(request, "x-rally-app-version"),
        normalizedAppVersion,
      ),
    };
  }

  function recordBackendEvent({
    eventName,
    exhibitionId,
    userId = null,
    source = "system",
    objectType = null,
    objectId = null,
    properties = {},
    request = null,
    occurredAt = clock().toISOString(),
    dedupeKey = null,
  }) {
    const context = request ? requestContext(request) : {
      anonymousId: null,
      sessionId: randomUUID(),
    };
    return insertEvent({
      analyticsEventId: randomUUID(),
      eventName,
      anonymousId: context.anonymousId,
      userId,
      exhibitionId,
      sessionId: context.sessionId,
      source: SOURCES.has(source) ? source : "system",
      clientType: "backend",
      appVersion: normalizedAppVersion,
      objectType,
      objectId,
      properties: safeBackendProperties(eventName, properties),
      occurredAt,
      receivedAt: clock().toISOString(),
      dedupeKey,
    });
  }

  function rateLimit(identity, nowMs, requestedCount) {
    const cutoff = nowMs - 60_000;
    const current = (requestWindows.get(identity) ?? []).filter((time) => time >= cutoff);
    if (current.length + requestedCount > 120) {
      requestWindows.set(identity, current);
      throw new AnalyticsRequestError(429, "ANALYTICS_RATE_LIMITED", "Too many analytics events.");
    }
    current.push(...Array.from({ length: requestedCount }, () => nowMs));
    requestWindows.set(identity, current);
  }

  function validateClientEvent(raw, { actorId, context, receivedAt, nowMs }) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_EVENT", "Each event must be an object.");
    }
    const allowedFields = new Set([
      "analytics_event_id",
      "event_name",
      "anonymous_id",
      "exhibition_id",
      "session_id",
      "source",
      "client_type",
      "app_version",
      "object_type",
      "object_id",
      "properties",
      "occurred_at",
    ]);
    if (Object.keys(raw).some((key) => !allowedFields.has(key))) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_EVENT", "Event contains unknown fields.");
    }
    if (!validUuid(raw.analytics_event_id) || !validUuid(raw.session_id)) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_EVENT", "Event and session IDs must be UUIDs.");
    }
    if (raw.session_id !== context.sessionId) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_CONTEXT", "Session context does not match.");
    }
    if (!actorId && (!validUuid(raw.anonymous_id) || raw.anonymous_id !== context.anonymousId)) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_CONTEXT", "Anonymous context does not match.");
    }
    if (!CLIENT_TYPES.has(raw.client_type) || raw.client_type !== context.clientType) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_CONTEXT", "Client type does not match.");
    }
    if (!SOURCES.has(raw.source)) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_SOURCE", "Unsupported analytics source.");
    }
    const occurredMs = new Date(raw.occurred_at).getTime();
    if (
      !Number.isFinite(occurredMs)
      || occurredMs < nowMs - 24 * 60 * 60 * 1000
      || occurredMs > nowMs + 5 * 60 * 1000
    ) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_TIME", "Event time is outside the allowed window.");
    }
    if (!database.prepare("SELECT 1 FROM events WHERE event_id = ?").get(raw.exhibition_id)) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_EXHIBITION", "Unknown exhibition.");
    }
    const properties = validateClientProperties(raw.event_name, raw.properties);
    const appVersionValue = context.clientAppVersion;
    if (
      (raw.object_type !== undefined && (
        typeof raw.object_type !== "string" || raw.object_type.length > 64
      ))
      || (raw.object_id !== undefined && (
        typeof raw.object_id !== "string" || raw.object_id.length > 128
      ))
    ) {
      throw new AnalyticsRequestError(400, "INVALID_ANALYTICS_EVENT", "Invalid analytics object.");
    }
    return {
      analyticsEventId: raw.analytics_event_id,
      eventName: raw.event_name,
      anonymousId: context.anonymousId,
      userId: actorId,
      exhibitionId: raw.exhibition_id,
      sessionId: raw.session_id,
      source: raw.source,
      clientType: raw.client_type,
      appVersion: appVersionValue,
      objectType: raw.object_type ?? null,
      objectId: raw.object_id ?? null,
      properties,
      occurredAt: new Date(occurredMs).toISOString(),
      receivedAt,
      dedupeKey: `client:${raw.analytics_event_id}`,
    };
  }

  function ingestClientEvents(payload, { actorId = null, request }) {
    cleanupExpired();
    const rawEvents = Array.isArray(payload?.events) ? payload.events : [payload];
    if (rawEvents.length === 0 || rawEvents.length > 20) {
      throw new AnalyticsRequestError(
        400,
        "INVALID_ANALYTICS_BATCH",
        "An analytics batch must contain between 1 and 20 events.",
      );
    }
    const context = requestContext(request);
    const nowDate = clock();
    const receivedAt = nowDate.toISOString();
    const validated = rawEvents.map((raw) => validateClientEvent(raw, {
      actorId,
      context,
      receivedAt,
      nowMs: nowDate.getTime(),
    }));
    rateLimit(actorId ?? context.anonymousId, nowDate.getTime(), validated.length);
    let accepted = 0;
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const event of validated) {
        if (insertEvent(event)) accepted += 1;
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return { accepted, duplicates: validated.length - accepted };
  }

  function summary(exhibitionId) {
    cleanupExpired();
    syncBusinessEvents();
    const eventCounts = database.prepare(`
      SELECT event_name,
             COUNT(*) AS total,
             COUNT(DISTINCT COALESCE(user_id, anonymous_id, analytics_event_id)) AS unique_actors
      FROM analytics_events
      WHERE exhibition_id = ?
      GROUP BY event_name
      ORDER BY event_name
    `).all(exhibitionId);
    const byName = new Map(eventCounts.map((row) => [row.event_name, row]));
    const orderedEvents = database.prepare(`
      SELECT rowid AS event_order, event_name, anonymous_id, user_id, source,
             session_id, client_type, object_id, properties_json, occurred_at, received_at
      FROM analytics_events
      WHERE exhibition_id = ?
      ORDER BY occurred_at ASC, rowid ASC
    `).all(exhibitionId).map((event) => ({
      ...event,
      properties: parseJsonObject(event.properties_json),
      ordering_at: event.client_type === "backend" ? event.received_at : event.occurred_at,
    })).sort((first, second) => {
      const timeDifference = new Date(first.ordering_at).getTime() - new Date(second.ordering_at).getTime();
      return timeDifference || first.event_order - second.event_order;
    });
    const sequenceCounts = (funnel, startSource = null) => {
      if (funnel.id === "login") return loginSequenceCounts(orderedEvents, startSource);
      if (funnel.id === "profile") {
        return actorSequenceCounts(
          orderedEvents,
          funnel.steps,
          (event) => event.user_id,
          { startSource },
        );
      }
      if (funnel.id === "connection") {
        return connectionSequenceCounts(orderedEvents, startSource);
      }
      return collaborationSequenceCounts(orderedEvents, startSource);
    };
    const funnels = FUNNELS.map((funnel) => {
      const counts = sequenceCounts(funnel);
      const startSources = [...new Set(
        orderedEvents
          .filter((event) => event.event_name === funnel.steps[0])
          .map((event) => event.source),
      )].sort();
      return {
        id: funnel.id,
        steps: funnelStepSummary(funnel, counts, byName),
        by_source: startSources.map((source) => {
          const sourceCounts = sequenceCounts(funnel, source);
          return {
            source,
            steps: funnelStepSummary(funnel, sourceCounts, byName, sourceCounts),
          };
        }),
      };
    });
    const sources = database.prepare(`
      SELECT source, event_name, COUNT(*) AS total
      FROM analytics_events
      WHERE exhibition_id = ?
      GROUP BY source, event_name
      ORDER BY source, event_name
    `).all(exhibitionId);
    const appVersions = database.prepare(`
      SELECT app_version, client_type, COUNT(*) AS total
      FROM analytics_events
      WHERE exhibition_id = ?
      GROUP BY app_version, client_type
      ORDER BY app_version, client_type
    `).all(exhibitionId);
    const quality = database.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN user_id IS NULL AND anonymous_id IS NULL THEN 1 ELSE 0 END)
               AS without_identity
      FROM analytics_events
      WHERE exhibition_id = ?
    `).get(exhibitionId);
    return {
      exhibition_id: exhibitionId,
      generated_at: clock().toISOString(),
      event_counts: eventCounts,
      funnels,
      sources,
      app_versions: appVersions,
      data_quality: {
        total_events: quality.total,
        events_without_identity: quality.without_identity ?? 0,
      },
    };
  }

  function exportCsv(exhibitionId) {
    cleanupExpired();
    syncBusinessEvents();
    const rows = database.prepare(`
      SELECT analytics_event_id, event_name, anonymous_id, user_id, exhibition_id,
             session_id, source, client_type, app_version, object_type, object_id,
             properties_json, occurred_at, received_at
      FROM analytics_events
      WHERE exhibition_id = ?
      ORDER BY received_at ASC, rowid ASC
    `).all(exhibitionId);
    const columns = [
      "analytics_event_id",
      "event_name",
      "anonymous_id",
      "user_id",
      "exhibition_id",
      "session_id",
      "source",
      "client_type",
      "app_version",
      "object_type",
      "object_id",
      "properties_json",
      "occurred_at",
      "received_at",
    ];
    return [
      columns.join(","),
      ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
    ].join("\n");
  }

  function deleteUserEvents(exhibitionId, userId) {
    const bridges = database.prepare(`
      SELECT event_name, anonymous_id, properties_json
      FROM analytics_events
      WHERE exhibition_id = ? AND user_id = ? AND anonymous_id IS NOT NULL
    `).all(exhibitionId, userId);
    const anonymousIds = [...new Set(bridges.map((row) => row.anonymous_id))];
    const ownedAnonymousIds = anonymousIds.filter((anonymousId) => {
      const linkedUsers = database.prepare(`
        SELECT DISTINCT user_id
        FROM analytics_events
        WHERE exhibition_id = ? AND anonymous_id = ? AND user_id IS NOT NULL
      `).all(exhibitionId, anonymousId);
      return linkedUsers.length === 1 && linkedUsers[0].user_id === userId;
    });
    const challengeIds = new Set(
      bridges
        .filter((row) => row.event_name === "login_otp_verified")
        .map((row) => parseJsonObject(row.properties_json).challenge_id)
        .filter(Boolean),
    );
    const linkedRequestEventIds = anonymousIds.length === 0 || challengeIds.size === 0
      ? []
      : database.prepare(`
          SELECT analytics_event_id, properties_json
          FROM analytics_events
          WHERE exhibition_id = ? AND user_id IS NULL
            AND event_name = 'login_otp_requested'
            AND anonymous_id IN (${anonymousIds.map(() => "?").join(", ")})
        `).all(exhibitionId, ...anonymousIds)
        .filter((row) => challengeIds.has(parseJsonObject(row.properties_json).challenge_id))
        .map((row) => row.analytics_event_id);
    const conditions = ["user_id = ?"];
    const parameters = [exhibitionId, userId];
    if (ownedAnonymousIds.length > 0) {
      conditions.push(`(user_id IS NULL AND anonymous_id IN (${ownedAnonymousIds.map(() => "?").join(", ")}))`);
      parameters.push(...ownedAnonymousIds);
    }
    if (linkedRequestEventIds.length > 0) {
      conditions.push(`analytics_event_id IN (${linkedRequestEventIds.map(() => "?").join(", ")})`);
      parameters.push(...linkedRequestEventIds);
    }
    const result = database.prepare(`
      DELETE FROM analytics_events
      WHERE exhibition_id = ?
        AND (${conditions.join(" OR ")})
    `).run(...parameters);
    return result.changes;
  }

  function recentEvents(exhibitionId, limit = 100) {
    cleanupExpired();
    syncBusinessEvents();
    return database.prepare(`
      SELECT analytics_event_id, event_name, anonymous_id, user_id, exhibition_id,
             session_id, source, client_type, app_version, object_type, object_id,
             properties_json, occurred_at, received_at
      FROM analytics_events
      WHERE exhibition_id = ?
      ORDER BY received_at DESC, rowid DESC
      LIMIT ?
    `).all(exhibitionId, limit).map(({ properties_json: propertiesJson, ...event }) => ({
      ...event,
      properties: parseJsonObject(propertiesJson),
    }));
  }

  function reset(exhibitionId = null) {
    if (exhibitionId) {
      database.prepare("DELETE FROM analytics_events WHERE exhibition_id = ?").run(exhibitionId);
    } else {
      database.prepare("DELETE FROM analytics_events").run();
    }
    database.prepare("DELETE FROM analytics_mirrored_logs").run();
  }

  cleanupExpired({ force: true });
  syncBusinessEvents();

  return {
    adminEnabled: typeof adminToken === "string" && adminToken.length >= 32,
    adminAuthorized: (supplied) => sameSecret(adminToken, supplied),
    deleteUserEvents,
    exportCsv,
    ingestClientEvents,
    recentEvents,
    recordBackendEvent,
    requestContext,
    reset,
    summary,
    syncBusinessEvents,
  };
}

export { resultCountBucket };
