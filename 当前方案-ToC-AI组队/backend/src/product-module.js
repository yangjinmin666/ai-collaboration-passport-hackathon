import { randomUUID } from "node:crypto";

import {
  appendEventLog,
  findUserIdentity,
  isParticipantVisible,
  seedDatabase,
} from "./database.js";

const MAX_JSON_BYTES = 64 * 1024;
const PROFILE_FIELDS = new Set([
  "display_name",
  "avatar",
  "role",
  "status",
  "skills",
  "interests",
  "availability",
  "collaboration_preferences",
  "collaboration_need",
  "evidence",
  "platform_links",
]);
const PROFILE_STATUSES = new Set([
  "未组队",
  "有 Idea 找人",
  "团队缺人",
  "已组队但可交流",
]);
const PLATFORMS = new Set([
  "github",
  "website",
  "xiaohongshu",
  "douyin",
  "jike",
  "linkedin",
  "other",
]);

function installSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS event_presence (
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      latitude REAL NOT NULL CHECK (latitude >= -90 AND latitude <= 90),
      longitude REAL NOT NULL CHECK (longitude >= -180 AND longitude <= 180),
      accuracy_m REAL NOT NULL CHECK (accuracy_m >= 0),
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      PRIMARY KEY (user_id, event_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id)
    );

    CREATE INDEX IF NOT EXISTS active_event_presence
      ON event_presence (event_id, expires_at);

    CREATE TABLE IF NOT EXISTS platform_links (
      link_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      verification_state TEXT NOT NULL CHECK (
        verification_state IN ('USER_PROVIDED', 'PUBLIC_API_SYNCED')
      ),
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, platform),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS event_collaboration_policies (
      event_id TEXT PRIMARY KEY,
      sos_enabled INTEGER NOT NULL DEFAULT 1 CHECK (sos_enabled IN (0, 1)),
      external_aid_enabled INTEGER NOT NULL DEFAULT 1 CHECK (external_aid_enabled IN (0, 1)),
      paid_aid_enabled INTEGER NOT NULL DEFAULT 1 CHECK (paid_aid_enabled IN (0, 1)),
      FOREIGN KEY (event_id) REFERENCES events(event_id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      project_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      originator_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('FORMING', 'ACTIVE', 'ARCHIVED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(event_id),
      FOREIGN KEY (originator_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS project_role_needs (
      role_need_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      skills_json TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity >= 1 AND capacity <= 10),
      status TEXT NOT NULL CHECK (status IN ('OPEN', 'FILLED', 'CLOSED')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id)
    );

    CREATE TABLE IF NOT EXISTS project_memberships (
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_need_id TEXT,
      membership_role TEXT NOT NULL CHECK (
        membership_role IN ('ORIGINATOR', 'LEADER', 'MEMBER')
      ),
      joined_at TEXT NOT NULL,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(project_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (role_need_id) REFERENCES project_role_needs(role_need_id)
    );

    CREATE TABLE IF NOT EXISTS team_invitations (
      invitation_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      inviter_id TEXT NOT NULL,
      invitee_id TEXT NOT NULL,
      role_need_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')
      ),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id),
      FOREIGN KEY (inviter_id) REFERENCES users(user_id),
      FOREIGN KEY (invitee_id) REFERENCES users(user_id),
      FOREIGN KEY (role_need_id) REFERENCES project_role_needs(role_need_id),
      CHECK (inviter_id <> invitee_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS one_pending_project_invitation
      ON team_invitations (project_id, invitee_id)
      WHERE status = 'PENDING';

    CREATE TABLE IF NOT EXISTS starter_packs (
      pack_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL,
      generated_by TEXT NOT NULL CHECK (
        generated_by IN ('AI', 'TEMPLATE_FALLBACK')
      ),
      status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'CONFIRMED')),
      role_coverage_json TEXT NOT NULL,
      missing_roles_json TEXT NOT NULL,
      risk_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(project_id)
    );

    CREATE TABLE IF NOT EXISTS work_items (
      task_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      pack_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      objective TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('HUMAN', 'HUMAN_AGENT', 'PAIR')),
      suggested_owner_id TEXT,
      confirmed_owner_id TEXT,
      status TEXT NOT NULL CHECK (
        status IN ('PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'DONE', 'BLOCKED')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(project_id),
      FOREIGN KEY (pack_id) REFERENCES starter_packs(pack_id),
      FOREIGN KEY (suggested_owner_id) REFERENCES users(user_id),
      FOREIGN KEY (confirmed_owner_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS plan_confirmations (
      pack_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      confirmed_at TEXT NOT NULL,
      PRIMARY KEY (pack_id, user_id),
      FOREIGN KEY (pack_id) REFERENCES starter_packs(pack_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS project_sos (
      sos_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      category TEXT NOT NULL,
      problem TEXT NOT NULL,
      context TEXT NOT NULL,
      attempts_json TEXT NOT NULL,
      required_skills_json TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL,
      location_label TEXT NOT NULL,
      deadline TEXT NOT NULL,
      resolution_criteria TEXT NOT NULL,
      reward_intent_json TEXT,
      status TEXT NOT NULL CHECK (
        status IN ('OPEN', 'CLAIMED', 'RESOLVED', 'CLOSED', 'EXPIRED')
      ),
      accepted_response_id TEXT,
      resolution_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(project_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id),
      FOREIGN KEY (creator_id) REFERENCES users(user_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS one_active_sos_per_project
      ON project_sos (project_id)
      WHERE status IN ('OPEN', 'CLAIMED');

    CREATE TABLE IF NOT EXISTS project_sos_responses (
      response_id TEXT PRIMARY KEY,
      sos_id TEXT NOT NULL,
      responder_id TEXT NOT NULL,
      message TEXT NOT NULL,
      available_minutes INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (
        status IN ('PENDING', 'ACCEPTED', 'WAITLISTED', 'WITHDRAWN')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      withdraw_reason TEXT,
      UNIQUE (sos_id, responder_id),
      FOREIGN KEY (sos_id) REFERENCES project_sos(sos_id),
      FOREIGN KEY (responder_id) REFERENCES users(user_id)
    );
  `);
  database.prepare(`
    INSERT OR IGNORE INTO event_collaboration_policies (
      event_id, sos_enabled, external_aid_enabled, paid_aid_enabled
    )
    SELECT event_id, 1, 1, 1 FROM events
  `).run();

  const responseColumns = new Set(
    database.prepare("PRAGMA table_info(project_sos_responses)").all().map((column) => column.name),
  );
  if (!responseColumns.has("withdraw_reason")) {
    database.exec("ALTER TABLE project_sos_responses ADD COLUMN withdraw_reason TEXT");
  }
}

function findEventPolicy(database, eventId) {
  const row = database.prepare(`
    SELECT sos_enabled, external_aid_enabled, paid_aid_enabled
    FROM event_collaboration_policies WHERE event_id = ?
  `).get(eventId);
  return {
    sos_enabled: Boolean(row?.sos_enabled),
    external_aid_enabled: Boolean(row?.external_aid_enabled),
    paid_aid_enabled: Boolean(row?.paid_aid_enabled),
  };
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) return { error: "PAYLOAD_TOO_LARGE" };
    chunks.push(chunk);
  }
  if (chunks.length === 0) return { value: {} };
  try {
    return { value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { error: "INVALID_JSON" };
  }
}

function error(status, code, message) {
  return { status, body: { error: { code, message } } };
}

function jsonReadError(parsed) {
  if (!parsed.error) return null;
  if (parsed.error === "PAYLOAD_TOO_LARGE") {
    return error(413, parsed.error, "Request payload is too large.");
  }
  return error(400, parsed.error, "Request body must be valid JSON.");
}

function haversineMeters(first, second) {
  const radius = 6_371_000;
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude)
    * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function distanceBand(distanceMeters) {
  if (distanceMeters < 50) return { band: "under_50m", label: "50 米内" };
  if (distanceMeters < 200) return { band: "under_200m", label: "200 米内" };
  if (distanceMeters < 500) return { band: "under_500m", label: "500 米内" };
  return { band: "same_event", label: "活动现场" };
}

function parseObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function parseStringArray(value, { maximumItems, maximumLength }) {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const items = value.map((item) => typeof item === "string" ? item.trim() : null);
  if (items.some((item) => !item || item.length > maximumLength)) return null;
  return [...new Set(items)];
}

function platformUrlIsValid(platform, rawUrl) {
  if (!PLATFORMS.has(platform) || typeof rawUrl !== "string" || rawUrl.length > 500) {
    return null;
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const acceptedHosts = {
    github: new Set(["github.com", "www.github.com"]),
    xiaohongshu: new Set(["xiaohongshu.com", "www.xiaohongshu.com", "xhslink.com"]),
    douyin: new Set(["douyin.com", "www.douyin.com", "v.douyin.com"]),
    jike: new Set(["okjike.com", "web.okjike.com"]),
    linkedin: new Set(["linkedin.com", "www.linkedin.com"]),
  };
  if (acceptedHosts[platform] && !acceptedHosts[platform].has(host)) return null;
  if (platform === "github" && url.pathname.split("/").filter(Boolean).length !== 1) return null;
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function normalizePlatformMetadata(metadata) {
  if (!parseObject(metadata)) return null;
  const allowed = [
    "username",
    "name",
    "avatar_url",
    "bio",
    "public_repos",
    "followers",
    "html_url",
  ];
  return Object.fromEntries(
    allowed.filter((field) => metadata[field] !== undefined).map((field) => [field, metadata[field]]),
  );
}

export async function fetchPublicPlatformMetadata({ platform, url }) {
  if (platform !== "github") return null;
  const username = new URL(url).pathname.split("/").filter(Boolean)[0];
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "RALLY-Hackathon-MVP",
    "x-github-api-version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return normalizePlatformMetadata({
      username: payload.login,
      name: payload.name,
      avatar_url: payload.avatar_url,
      bio: payload.bio,
      public_repos: payload.public_repos,
      followers: payload.followers,
      html_url: payload.html_url,
    });
  } catch {
    return null;
  }
}

function mapPlatformLink(row) {
  return {
    platform: row.platform,
    url: row.url,
    verification_state: row.verification_state,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
  };
}

function listPlatformLinks(database, userId) {
  return database.prepare(`
    SELECT platform, url, verification_state, metadata_json
    FROM platform_links
    WHERE user_id = ?
    ORDER BY platform ASC
  `).all(userId).map(mapPlatformLink);
}

function appendPlatformLinkEvent(database, {
  actorId,
  platform,
  eventType,
  now,
  verificationState = null,
}) {
  const memberships = database.prepare(`
    SELECT event_id FROM profiles WHERE user_id = ? ORDER BY event_id ASC
  `).all(actorId);
  for (const membership of memberships) {
    appendEventLog(database, {
      eventId: membership.event_id,
      actorId,
      type: eventType,
      objectType: "platform_link",
      objectId: `${actorId}:${platform}`,
      source: "mobile",
      payload: {
        platform,
        ...(verificationState ? { verification_state: verificationState } : {}),
      },
      createdAt: now,
    });
  }
}

export function createProductModule(database, {
  clock,
  presenceTtlMs = 2 * 60 * 1000,
  platformMetadataFetcher = fetchPublicPlatformMetadata,
  demoAccessKey = null,
  eventPolicyOverrides = {},
} = {}) {
  installSchema(database);
  const updateEventPolicy = database.prepare(`
    UPDATE event_collaboration_policies
    SET sos_enabled = ?, external_aid_enabled = ?, paid_aid_enabled = ?
    WHERE event_id = ?
  `);
  for (const [eventId, override] of Object.entries(eventPolicyOverrides)) {
    const current = findEventPolicy(database, eventId);
    updateEventPolicy.run(
      (override.sos_enabled ?? current.sos_enabled) ? 1 : 0,
      (override.external_aid_enabled ?? current.external_aid_enabled) ? 1 : 0,
      (override.paid_aid_enabled ?? current.paid_aid_enabled) ? 1 : 0,
      eventId,
    );
  }

  async function publishPresence({ request, actorId, eventId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const now = clock().toISOString();
    if (!isParticipantVisible(database, { userId: actorId, eventId, now })) {
      return error(
        409,
        "PRESENCE_NOT_AVAILABLE",
        "Join the active event and make your profile visible before publishing presence.",
      );
    }

    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    const latitude = payload?.latitude;
    const longitude = payload?.longitude;
    const accuracy = payload?.accuracy_m;
    if (
      !Number.isFinite(latitude)
      || latitude < -90
      || latitude > 90
      || !Number.isFinite(longitude)
      || longitude < -180
      || longitude > 180
      || !Number.isFinite(accuracy)
      || accuracy < 0
      || accuracy > 1000
    ) {
      return error(
        400,
        "INVALID_COORDINATES",
        "latitude, longitude, and accuracy_m must describe a valid device location.",
      );
    }

    const expiresAt = new Date(new Date(now).getTime() + presenceTtlMs).toISOString();
    database.prepare(`
      INSERT INTO event_presence (
        user_id, event_id, latitude, longitude, accuracy_m, updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, event_id) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy_m = excluded.accuracy_m,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
    `).run(actorId, eventId, latitude, longitude, accuracy, now, expiresAt);
    appendEventLog(database, {
      eventId,
      actorId,
      type: "presence_updated",
      objectType: "event_presence",
      objectId: actorId,
      source: "mobile_geolocation",
      payload: { accuracy_band: accuracy <= 50 ? "good" : "coarse" },
      createdAt: now,
    });
    return {
      status: 200,
      body: {
        presence: { state: "ACTIVE", updated_at: now, expires_at: expiresAt },
        refresh_after_ms: Math.min(30_000, Math.floor(presenceTtlMs / 2)),
      },
    };
  }

  function listNearby({ actorId, eventId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const now = clock().toISOString();
    if (!isParticipantVisible(database, { userId: actorId, eventId, now })) {
      database.prepare("DELETE FROM event_presence WHERE user_id = ? AND event_id = ?")
        .run(actorId, eventId);
      return error(403, "VISIBILITY_REQUIRED", "Make your event profile visible before viewing nearby participants.");
    }
    const ownPresence = database.prepare(`
      SELECT latitude, longitude, updated_at
      FROM event_presence
      WHERE user_id = ? AND event_id = ? AND expires_at > ?
    `).get(actorId, eventId, now);
    if (!ownPresence) {
      return {
        status: 200,
        body: { nearby: [], presence_required: true, poll_after_ms: 15000 },
      };
    }

    const rows = database.prepare(`
      SELECT
        presence.user_id,
        presence.latitude,
        presence.longitude,
        presence.updated_at,
        user.display_name,
        user.avatar,
        profile.role,
        profile.status,
        profile.skills_json,
        profile.interests_json,
        profile.availability,
        profile.collaboration_preferences_json,
        profile.collaboration_need,
        visibility.public_fields_json
      FROM event_presence presence
      JOIN users user ON user.user_id = presence.user_id
      JOIN profiles profile
        ON profile.user_id = presence.user_id AND profile.event_id = presence.event_id
      JOIN visibility_grants visibility
        ON visibility.user_id = presence.user_id AND visibility.event_id = presence.event_id
      JOIN events event ON event.event_id = presence.event_id
      WHERE presence.event_id = ?
        AND presence.user_id <> ?
        AND presence.expires_at > ?
        AND visibility.state = 'VISIBLE'
        AND visibility.starts_at <= ?
        AND visibility.expires_at > ?
        AND event.starts_at <= ?
        AND event.ends_at > ?
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks block
          WHERE block.event_id = presence.event_id
            AND (
              (block.blocker_id = ? AND block.blocked_id = presence.user_id)
              OR (block.blocker_id = presence.user_id AND block.blocked_id = ?)
            )
        )
    `).all(eventId, actorId, now, now, now, now, now, actorId, actorId);

    const nearby = rows.map((row) => {
      const authorized = new Set(JSON.parse(row.public_fields_json));
      const available = {
        display_name: row.display_name,
        avatar: row.avatar,
        role: row.role,
        status: row.status,
        skills: JSON.parse(row.skills_json),
        interests: JSON.parse(row.interests_json),
        availability: row.availability,
        collaboration_preferences: JSON.parse(row.collaboration_preferences_json),
        collaboration_need: row.collaboration_need,
      };
      const profile = { user_id: row.user_id };
      for (const [field, value] of Object.entries(available)) {
        if (authorized.has(field)) profile[field] = value;
      }
      return {
        ...profile,
        distance: distanceBand(haversineMeters(ownPresence, row)),
        last_seen_at: row.updated_at,
      };
    }).sort((first, second) => {
      const order = ["under_50m", "under_200m", "under_500m", "same_event"];
      return order.indexOf(first.distance.band) - order.indexOf(second.distance.band);
    });
    return { status: 200, body: { nearby, presence_required: false, poll_after_ms: 15000 } };
  }

  function stopPresence({ actorId, eventId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const now = clock().toISOString();
    const removed = database.prepare(`
      DELETE FROM event_presence WHERE user_id = ? AND event_id = ?
    `).run(actorId, eventId);
    if (removed.changes > 0) {
      appendEventLog(database, {
        eventId,
        actorId,
        type: "presence_stopped",
        objectType: "event_presence",
        objectId: actorId,
        source: "mobile_geolocation",
        payload: {},
        createdAt: now,
      });
    }
    return { status: 204, body: null };
  }

  async function upsertPlatformLink({ request, actorId, platform }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    if (!PLATFORMS.has(platform)) {
      return error(400, "INVALID_PLATFORM", "This platform is not supported.");
    }
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    const normalizedUrl = platformUrlIsValid(platform, payload?.url);
    if (!normalizedUrl) {
      return error(
        400,
        "INVALID_PLATFORM_URL",
        "Provide a valid HTTPS profile URL for the selected platform.",
      );
    }
    const metadata = normalizePlatformMetadata(
      await platformMetadataFetcher({ platform, url: normalizedUrl }),
    );
    const verificationState = metadata ? "PUBLIC_API_SYNCED" : "USER_PROVIDED";
    const now = clock().toISOString();
    database.prepare(`
      INSERT INTO platform_links (
        link_id, user_id, platform, url, verification_state, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, platform) DO UPDATE SET
        url = excluded.url,
        verification_state = excluded.verification_state,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).run(
      `link_${randomUUID()}`,
      actorId,
      platform,
      normalizedUrl,
      verificationState,
      metadata ? JSON.stringify(metadata) : null,
      now,
      now,
    );
    const platformLink = database.prepare(`
      SELECT platform, url, verification_state, metadata_json
      FROM platform_links
      WHERE user_id = ? AND platform = ?
    `).get(actorId, platform);
    appendPlatformLinkEvent(database, {
      actorId,
      platform,
      eventType: "platform_link_saved",
      now,
      verificationState,
    });
    return { status: 200, body: { platform_link: mapPlatformLink(platformLink) } };
  }

  function deletePlatformLink({ actorId, platform }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    if (!PLATFORMS.has(platform)) {
      return error(400, "INVALID_PLATFORM", "This platform is not supported.");
    }
    const removed = database.prepare(`
      DELETE FROM platform_links WHERE user_id = ? AND platform = ?
    `).run(actorId, platform);
    if (removed.changes > 0) {
      appendPlatformLinkEvent(database, {
        actorId,
        platform,
        eventType: "platform_link_removed",
        now: clock().toISOString(),
      });
    }
    return { status: 204, body: null };
  }

  async function updateProfile({ request, actorId, eventId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    const skills = parseStringArray(payload?.skills, { maximumItems: 5, maximumLength: 40 });
    const interests = parseStringArray(payload?.interests, { maximumItems: 5, maximumLength: 60 });
    const collaborationPreferences = parseStringArray(
      payload?.collaboration_preferences,
      { maximumItems: 5, maximumLength: 60 },
    );
    const evidence = parseStringArray(payload?.evidence, { maximumItems: 12, maximumLength: 160 });
    if (
      !payload
      || typeof payload.role !== "string"
      || !payload.role.trim()
      || payload.role.length > 80
      || !PROFILE_STATUSES.has(payload.status)
      || typeof payload.availability !== "string"
      || !payload.availability.trim()
      || payload.availability.length > 120
      || typeof payload.collaboration_need !== "string"
      || payload.collaboration_need.length > 160
      || !skills
      || skills.length < 3
      || !interests
      || interests.length < 1
      || !collaborationPreferences
      || collaborationPreferences.length < 1
      || !evidence
    ) {
      return error(400, "INVALID_PROFILE", "Profile fields are incomplete or invalid.");
    }
    const existing = database.prepare(`
      SELECT 1 FROM profiles WHERE user_id = ? AND event_id = ?
    `).get(actorId, eventId);
    if (!existing) return error(404, "PROFILE_NOT_FOUND", "Join this event before editing a profile.");
    const now = clock().toISOString();
    database.prepare(`
      UPDATE profiles
      SET role = ?, status = ?, skills_json = ?, interests_json = ?, availability = ?,
          collaboration_preferences_json = ?, collaboration_need = ?, evidence_json = ?
      WHERE user_id = ? AND event_id = ?
    `).run(
      payload.role.trim(),
      payload.status.trim(),
      JSON.stringify(skills),
      JSON.stringify(interests),
      payload.availability.trim(),
      JSON.stringify(collaborationPreferences),
      payload.collaboration_need.trim(),
      JSON.stringify(evidence),
      actorId,
      eventId,
    );
    appendEventLog(database, {
      eventId,
      actorId,
      type: "profile_updated",
      objectType: "profile",
      objectId: actorId,
      source: "mobile",
      payload: {
        fields: [
          "role",
          "status",
          "skills",
          "interests",
          "availability",
          "collaboration_preferences",
          "collaboration_need",
          "evidence",
        ],
      },
      createdAt: now,
    });
    return {
      status: 200,
      body: {
        profile: {
          user_id: actorId,
          role: payload.role.trim(),
          status: payload.status.trim(),
          skills,
          interests,
          availability: payload.availability.trim(),
          collaboration_preferences: collaborationPreferences,
          collaboration_need: payload.collaboration_need.trim(),
          evidence,
          platform_links: listPlatformLinks(database, actorId),
        },
      },
    };
  }

  async function updateVisibility({ request, actorId, eventId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    if (!payload || !new Set(["HIDDEN", "VISIBLE", "PAUSED"]).has(payload.state)) {
      return error(400, "INVALID_VISIBILITY", "state must be HIDDEN, VISIBLE, or PAUSED.");
    }
    const current = database.prepare(`
      SELECT grant_row.*, event.ends_at
      FROM visibility_grants grant_row
      JOIN events event ON event.event_id = grant_row.event_id
      WHERE grant_row.user_id = ? AND grant_row.event_id = ?
    `).get(actorId, eventId);
    if (!current) return error(404, "PROFILE_NOT_FOUND", "Join this event before changing visibility.");
    const now = clock().toISOString();
    let publicFields = JSON.parse(current.public_fields_json);
    if (payload.public_fields !== undefined) {
      publicFields = parseStringArray(payload.public_fields, {
        maximumItems: PROFILE_FIELDS.size,
        maximumLength: 40,
      });
      if (!publicFields || publicFields.some((field) => !PROFILE_FIELDS.has(field))) {
        return error(400, "INVALID_PUBLIC_FIELDS", "public_fields contains an unsupported field.");
      }
    }
    let expiresAt = payload.expires_at ?? current.expires_at;
    if (payload.state === "VISIBLE") {
      const expiresTime = new Date(expiresAt).getTime();
      if (!Number.isFinite(expiresTime) || expiresTime <= new Date(now).getTime()) {
        return error(400, "INVALID_VISIBILITY_EXPIRY", "A visible profile needs a future expires_at.");
      }
      expiresAt = new Date(Math.min(expiresTime, new Date(current.ends_at).getTime())).toISOString();
    }
    database.prepare(`
      UPDATE visibility_grants
      SET state = ?, public_fields_json = ?, starts_at = ?, expires_at = ?
      WHERE user_id = ? AND event_id = ?
    `).run(payload.state, JSON.stringify(publicFields), now, expiresAt, actorId, eventId);
    if (payload.state !== "VISIBLE") {
      database.prepare(`
        DELETE FROM event_presence WHERE user_id = ? AND event_id = ?
      `).run(actorId, eventId);
    }
    appendEventLog(database, {
      eventId,
      actorId,
      type: "visibility_changed",
      objectType: "visibility_grant",
      objectId: actorId,
      source: "mobile",
      payload: { state: payload.state, public_fields: publicFields },
      createdAt: now,
    });
    return {
      status: 200,
      body: {
        visibility: {
          state: payload.state,
          public_fields: publicFields,
          expires_at: expiresAt,
        },
      },
    };
  }

  function listDiscoverable({ actorId, eventId, projectId = null }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const ownProfile = database.prepare(`
      SELECT * FROM profiles WHERE user_id = ? AND event_id = ?
    `).get(actorId, eventId);
    if (!ownProfile) return error(403, "EVENT_MEMBERSHIP_REQUIRED", "Join this event before discovery.");
    let projectContext = null;
    if (projectId) {
      projectContext = database.prepare(`
        SELECT project.*
        FROM projects project
        JOIN project_memberships membership ON membership.project_id = project.project_id
        WHERE project.project_id = ? AND project.event_id = ? AND membership.user_id = ?
      `).get(projectId, eventId, actorId);
      if (!projectContext) {
        return error(403, "PROJECT_MATCHING_FORBIDDEN", "Only project members can match against its role needs.");
      }
    } else {
      projectContext = database.prepare(`
        SELECT project.*
        FROM projects project
        JOIN project_memberships membership ON membership.project_id = project.project_id
        WHERE project.event_id = ? AND membership.user_id = ?
          AND project.status IN ('FORMING', 'ACTIVE')
        ORDER BY project.updated_at DESC
        LIMIT 1
      `).get(eventId, actorId) ?? null;
    }
    const openNeeds = projectContext
      ? listRoleNeeds(database, projectContext.project_id).filter(
        (need) => need.status === "OPEN" && need.remaining_capacity > 0,
      )
      : [];
    const now = clock().toISOString();
    const rows = database.prepare(`
      SELECT
        user.user_id,
        user.display_name,
        user.avatar,
        profile.role,
        profile.status,
        profile.skills_json,
        profile.interests_json,
        profile.availability,
        profile.collaboration_preferences_json,
        profile.collaboration_need,
        profile.evidence_json,
        visibility.public_fields_json
      FROM profiles profile
      JOIN users user ON user.user_id = profile.user_id
      JOIN visibility_grants visibility
        ON visibility.user_id = profile.user_id AND visibility.event_id = profile.event_id
      JOIN events event ON event.event_id = profile.event_id
      WHERE profile.event_id = ?
        AND profile.user_id <> ?
        AND visibility.state = 'VISIBLE'
        AND visibility.starts_at <= ?
        AND visibility.expires_at > ?
        AND event.starts_at <= ?
        AND event.ends_at > ?
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks block
          WHERE block.event_id = profile.event_id
            AND (
              (block.blocker_id = ? AND block.blocked_id = profile.user_id)
              OR (block.blocker_id = profile.user_id AND block.blocked_id = ?)
            )
        )
    `).all(eventId, actorId, now, now, now, now, actorId, actorId);

    const ownInterests = new Set(JSON.parse(ownProfile.interests_json));
    const ownPreferences = new Set(JSON.parse(ownProfile.collaboration_preferences_json));
    const openToJoining = new Set(["未组队", "已组队但可交流"]);
    const compatibleStatuses = projectContext
      ? openToJoining
      : new Set(
        new Set(["有 Idea 找人", "团队缺人"]).has(ownProfile.status)
          ? [...openToJoining]
          : [...PROFILE_STATUSES],
      );
    const people = rows.filter((row) => {
      if (!compatibleStatuses.has(row.status)) return false;
      if (!projectContext) return true;
      if (openNeeds.length === 0) return false;
      return !database.prepare(`
        SELECT 1 FROM project_memberships WHERE project_id = ? AND user_id = ?
      `).get(projectContext.project_id, row.user_id);
    }).map((row) => {
      const available = {
        display_name: row.display_name,
        avatar: row.avatar,
        role: row.role,
        status: row.status,
        skills: JSON.parse(row.skills_json),
        interests: JSON.parse(row.interests_json),
        availability: row.availability,
        collaboration_preferences: JSON.parse(row.collaboration_preferences_json),
        collaboration_need: row.collaboration_need,
        evidence: JSON.parse(row.evidence_json),
        platform_links: listPlatformLinks(database, row.user_id),
      };
      const authorized = new Set(JSON.parse(row.public_fields_json));
      const person = { user_id: row.user_id };
      for (const [field, value] of Object.entries(available)) {
        if (authorized.has(field) && (field !== "platform_links" || value.length > 0)) {
          person[field] = value;
        }
      }
      const candidateSkills = person.skills ?? [];
      const candidateInterests = person.interests ?? [];
      const candidatePreferences = person.collaboration_preferences ?? [];
      const roleMatches = openNeeds.map((need) => ({
        need,
        overlap: candidateSkills.filter((skill) => need.skills.includes(skill)),
      })).sort((first, second) => second.overlap.length - first.overlap.length);
      const bestRoleMatch = roleMatches[0];
      const sharedInterests = candidateInterests.filter((interest) => (
        ownInterests.has(interest)
        || (projectContext && `${projectContext.title} ${projectContext.summary}`.includes(interest))
      ));
      const sharedPreferences = candidatePreferences.filter((preference) => ownPreferences.has(preference));
      const factors = [];
      let internalScore = 0;
      if (bestRoleMatch?.overlap.length) {
        internalScore += Math.round(40 * bestRoleMatch.overlap.length / bestRoleMatch.need.skills.length);
        factors.push(`补齐${bestRoleMatch.need.title}`);
      }
      if (sharedInterests.length) {
        internalScore += 20;
        factors.push("主题兴趣相关");
      }
      if (person.availability) {
        internalScore += 15;
        factors.push("已公开投入时间");
      }
      if (sharedPreferences.length) {
        internalScore += 15;
        factors.push("协作偏好相近");
      }
      if (person.evidence?.length) {
        internalScore += 10;
        factors.push("存在能力证据");
      }
      const groundedReasons = [];
      if (bestRoleMatch?.overlap.length) {
        groundedReasons.push(
          `${bestRoleMatch.overlap.slice(0, 2).join("、")}对应「${bestRoleMatch.need.title}」缺口`,
        );
      }
      if (sharedInterests.length) groundedReasons.push(`共同关注${sharedInterests.slice(0, 2).join("、")}`);
      if (person.evidence?.[0]) groundedReasons.push(`有可查看的项目证据：${person.evidence[0]}`);
      if (person.availability) groundedReasons.push(`已公开投入时间：${person.availability}`);
      if (person.role) groundedReasons.push(`对方公开角色为${person.role}`);
      if (person.status) groundedReasons.push(`对方当前状态为${person.status}`);
      while (groundedReasons.length < 2) groundedReasons.push("同场活动成员，可当面确认合作边界");
      person.recommendation = {
        reasons: groundedReasons.slice(0, 2),
        evidence_refs: person.evidence?.slice(0, 2) ?? [],
        needs_confirmation: person.availability
          ? `请当面确认「${person.availability}」是否覆盖项目关键时段`
          : "对方未公开投入时间，需要当面确认",
        suggested_opening_question: bestRoleMatch?.need
          ? `你愿意先聊聊「${bestRoleMatch.need.title}」的交付边界吗？`
          : "你现在最想参与哪一部分？",
        ranking_factors: factors,
        generated_by: "RULE_FALLBACK",
      };
      Object.defineProperty(person, "_internalScore", { value: internalScore, enumerable: false });
      return person;
    }).sort((first, second) => (
      second._internalScore - first._internalScore
      || String(first.display_name ?? first.user_id).localeCompare(
        String(second.display_name ?? second.user_id),
        "zh-CN",
      )
    ));
    return {
      status: 200,
      body: {
        people,
        matching_context: projectContext ? {
          project_id: projectContext.project_id,
          project_title: projectContext.title,
          open_role_needs: openNeeds.map((need) => ({
            id: need.id,
            title: need.title,
            skills: need.skills,
            remaining_capacity: need.remaining_capacity,
          })),
        } : null,
        generated_at: now,
      },
    };
  }

  function mapProject(row) {
    return {
      id: row.project_id,
      event_id: row.event_id,
      title: row.title,
      summary: row.summary,
      originator_id: row.originator_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function mapRoleNeed(row) {
    const filled = Number(row.filled_count ?? 0);
    return {
      id: row.role_need_id,
      project_id: row.project_id,
      title: row.title,
      skills: JSON.parse(row.skills_json),
      capacity: Number(row.capacity),
      filled_count: filled,
      remaining_capacity: Math.max(0, Number(row.capacity) - filled),
      status: filled >= Number(row.capacity) ? "FILLED" : row.status,
    };
  }

  function findProject(database, projectId) {
    const row = database.prepare("SELECT * FROM projects WHERE project_id = ?").get(projectId);
    return row ? mapProject(row) : null;
  }

  function listRoleNeeds(database, projectId) {
    return database.prepare(`
      SELECT need.*, count(membership.user_id) AS filled_count
      FROM project_role_needs need
      LEFT JOIN project_memberships membership
        ON membership.role_need_id = need.role_need_id
      WHERE need.project_id = ?
      GROUP BY need.role_need_id
      ORDER BY need.created_at ASC
    `).all(projectId).map(mapRoleNeed);
  }

  function listMembers(database, projectId) {
    return database.prepare(`
      SELECT
        membership.user_id,
        membership.membership_role,
        membership.role_need_id,
        membership.joined_at,
        user.display_name,
        user.avatar,
        profile.role
      FROM project_memberships membership
      JOIN projects project ON project.project_id = membership.project_id
      JOIN users user ON user.user_id = membership.user_id
      LEFT JOIN profiles profile
        ON profile.user_id = membership.user_id AND profile.event_id = project.event_id
      WHERE membership.project_id = ?
      ORDER BY membership.joined_at ASC, membership.user_id ASC
    `).all(projectId).map((row) => ({
      user_id: row.user_id,
      display_name: row.display_name,
      avatar: row.avatar,
      profile_role: row.role,
      membership_role: row.membership_role,
      role_need_id: row.role_need_id,
      joined_at: row.joined_at,
    }));
  }

  async function createProject({ request, actorId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    const roleNeed = parseObject(payload?.role_need);
    const skills = parseStringArray(roleNeed?.skills, { maximumItems: 8, maximumLength: 40 });
    if (
      !payload
      || typeof payload.event_id !== "string"
      || typeof payload.title !== "string"
      || !payload.title.trim()
      || payload.title.length > 100
      || typeof payload.summary !== "string"
      || payload.summary.length > 500
      || !roleNeed
      || typeof roleNeed.title !== "string"
      || !roleNeed.title.trim()
      || roleNeed.title.length > 80
      || !skills
      || !Number.isInteger(roleNeed.capacity)
      || roleNeed.capacity < 1
      || roleNeed.capacity > 10
    ) {
      return error(400, "INVALID_PROJECT", "Project and role_need fields are incomplete or invalid.");
    }
    const now = clock().toISOString();
    const participant = database.prepare(`
      SELECT 1
      FROM profiles profile
      JOIN events event ON event.event_id = profile.event_id
      WHERE profile.user_id = ? AND profile.event_id = ?
        AND event.starts_at <= ? AND event.ends_at > ?
    `).get(actorId, payload.event_id, now, now);
    if (!participant) return error(403, "EVENT_MEMBERSHIP_REQUIRED", "Join the active event first.");

    const projectId = `prj_${randomUUID()}`;
    const roleNeedId = `need_${randomUUID()}`;
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`
        INSERT INTO projects (
          project_id, event_id, title, summary, originator_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'FORMING', ?, ?)
      `).run(
        projectId,
        payload.event_id,
        payload.title.trim(),
        payload.summary.trim(),
        actorId,
        now,
        now,
      );
      database.prepare(`
        INSERT INTO project_role_needs (
          role_need_id, project_id, title, skills_json, capacity, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?)
      `).run(
        roleNeedId,
        projectId,
        roleNeed.title.trim(),
        JSON.stringify(skills),
        roleNeed.capacity,
        now,
      );
      database.prepare(`
        INSERT INTO project_memberships (
          project_id, user_id, role_need_id, membership_role, joined_at
        ) VALUES (?, ?, NULL, 'ORIGINATOR', ?)
      `).run(projectId, actorId, now);
      appendEventLog(database, {
        eventId: payload.event_id,
        actorId,
        type: "project_created",
        objectType: "project",
        objectId: projectId,
        source: "mobile",
        payload: { role_need_id: roleNeedId },
        createdAt: now,
      });
      database.exec("COMMIT");
    } catch (caught) {
      database.exec("ROLLBACK");
      throw caught;
    }
    return {
      status: 201,
      body: {
        project: findProject(database, projectId),
        role_needs: listRoleNeeds(database, projectId),
        members: listMembers(database, projectId),
      },
    };
  }

  async function inviteToProject({ request, actorId, projectId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    if (!payload || typeof payload.invitee_id !== "string" || typeof payload.role_need_id !== "string") {
      return error(400, "INVALID_INVITATION", "invitee_id and role_need_id are required.");
    }
    const project = findProject(database, projectId);
    if (!project) return error(404, "PROJECT_NOT_FOUND", "Project not found.");
    const inviterMembership = database.prepare(`
      SELECT membership_role FROM project_memberships
      WHERE project_id = ? AND user_id = ?
    `).get(projectId, actorId);
    if (!inviterMembership || !new Set(["ORIGINATOR", "LEADER"]).has(inviterMembership.membership_role)) {
      return error(403, "INVITATION_FORBIDDEN", "Only a project originator or leader can invite members.");
    }
    const alreadyMember = database.prepare(`
      SELECT 1 FROM project_memberships WHERE project_id = ? AND user_id = ?
    `).get(projectId, payload.invitee_id);
    if (alreadyMember) return error(409, "ALREADY_PROJECT_MEMBER", "This person is already a project member.");
    const connected = database.prepare(`
      SELECT 1 FROM connections
      WHERE event_id = ? AND status = 'ACTIVE'
        AND user_a_id = ? AND user_b_id = ?
    `).get(project.event_id, ...[actorId, payload.invitee_id].sort());
    if (!connected) {
      return error(409, "ACTIVE_CONNECTION_REQUIRED", "Connect with this participant before inviting them.");
    }
    const roleNeed = listRoleNeeds(database, projectId).find((need) => need.id === payload.role_need_id);
    if (!roleNeed) return error(404, "ROLE_NEED_NOT_FOUND", "Role need not found.");
    if (roleNeed.remaining_capacity <= 0 || roleNeed.status !== "OPEN") {
      return error(409, "ROLE_NEED_FILLED", "This role no longer has capacity.");
    }
    const existing = database.prepare(`
      SELECT * FROM team_invitations
      WHERE project_id = ? AND invitee_id = ? AND status = 'PENDING'
    `).get(projectId, payload.invitee_id);
    if (existing) {
      return { status: 200, body: { invitation: mapInvitation(existing), idempotent_replay: true } };
    }
    const now = clock().toISOString();
    const eventEndsAt = database.prepare("SELECT ends_at FROM events WHERE event_id = ?").get(project.event_id).ends_at;
    const expiresAt = new Date(Math.min(
      new Date(now).getTime() + 24 * 60 * 60 * 1000,
      new Date(eventEndsAt).getTime(),
    )).toISOString();
    const invitationId = `inv_${randomUUID()}`;
    database.prepare(`
      INSERT INTO team_invitations (
        invitation_id, project_id, inviter_id, invitee_id, role_need_id,
        status, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
    `).run(
      invitationId,
      projectId,
      actorId,
      payload.invitee_id,
      payload.role_need_id,
      expiresAt,
      now,
      now,
    );
    appendEventLog(database, {
      eventId: project.event_id,
      actorId,
      type: "team_invitation_created",
      objectType: "team_invitation",
      objectId: invitationId,
      source: "mobile",
      payload: { project_id: projectId, invitee_id: payload.invitee_id },
      createdAt: now,
    });
    const invitation = database.prepare(
      "SELECT * FROM team_invitations WHERE invitation_id = ?",
    ).get(invitationId);
    return { status: 201, body: { invitation: mapInvitation(invitation), idempotent_replay: false } };
  }

  function mapInvitation(row) {
    return {
      id: row.invitation_id,
      project_id: row.project_id,
      inviter_id: row.inviter_id,
      invitee_id: row.invitee_id,
      role_need_id: row.role_need_id,
      status: row.status,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function resolveTeamInvitation({ actorId, invitationId, action }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    if (!new Set(["accept", "decline", "cancel"]).has(action)) {
      return error(400, "INVALID_ACTION", "action must be accept, decline, or cancel.");
    }
    const initial = database.prepare(
      "SELECT * FROM team_invitations WHERE invitation_id = ?",
    ).get(invitationId);
    if (!initial) return error(404, "INVITATION_NOT_FOUND", "Team invitation not found.");
    const expectedActor = action === "cancel" ? initial.inviter_id : initial.invitee_id;
    if (actorId !== expectedActor) {
      return error(403, "INVITATION_FORBIDDEN", "This invitation action is not available to you.");
    }
    if (action === "accept" && initial.status === "ACCEPTED") {
      const membership = listMembers(database, initial.project_id).find(
        (member) => member.user_id === initial.invitee_id,
      );
      const roleNeed = listRoleNeeds(database, initial.project_id).find(
        (need) => need.id === initial.role_need_id,
      );
      return {
        status: 200,
        body: {
          invitation: mapInvitation(initial),
          membership,
          role_need: roleNeed,
          idempotent_replay: true,
        },
      };
    }
    if (initial.status !== "PENDING") {
      return error(409, "INVITATION_NOT_PENDING", "This invitation is no longer pending.");
    }
    const now = clock().toISOString();
    if (initial.expires_at <= now) {
      database.prepare(`
        UPDATE team_invitations SET status = 'EXPIRED', updated_at = ?
        WHERE invitation_id = ? AND status = 'PENDING'
      `).run(now, invitationId);
      return error(409, "INVITATION_EXPIRED", "This invitation has expired.");
    }
    if (action !== "accept") {
      const status = action === "decline" ? "DECLINED" : "CANCELLED";
      database.prepare(`
        UPDATE team_invitations SET status = ?, updated_at = ?
        WHERE invitation_id = ? AND status = 'PENDING'
      `).run(status, now, invitationId);
      const resolved = database.prepare(
        "SELECT * FROM team_invitations WHERE invitation_id = ?",
      ).get(invitationId);
      const project = findProject(database, initial.project_id);
      appendEventLog(database, {
        eventId: project.event_id,
        actorId,
        type: status === "DECLINED" ? "team_invitation_declined" : "team_invitation_cancelled",
        objectType: "team_invitation",
        objectId: invitationId,
        source: "mobile",
        payload: { project_id: initial.project_id, invitee_id: initial.invitee_id },
        createdAt: now,
      });
      return { status: 200, body: { invitation: mapInvitation(resolved), idempotent_replay: false } };
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      const current = database.prepare(
        "SELECT * FROM team_invitations WHERE invitation_id = ?",
      ).get(invitationId);
      const roleNeed = listRoleNeeds(database, current.project_id).find(
        (need) => need.id === current.role_need_id,
      );
      if (!roleNeed || roleNeed.remaining_capacity <= 0 || roleNeed.status !== "OPEN") {
        database.exec("ROLLBACK");
        return error(409, "ROLE_NEED_FILLED", "This role no longer has capacity.");
      }
      database.prepare(`
        INSERT INTO project_memberships (
          project_id, user_id, role_need_id, membership_role, joined_at
        ) VALUES (?, ?, ?, 'MEMBER', ?)
      `).run(current.project_id, current.invitee_id, current.role_need_id, now);
      database.prepare(`
        UPDATE team_invitations SET status = 'ACCEPTED', updated_at = ?
        WHERE invitation_id = ? AND status = 'PENDING'
      `).run(now, invitationId);
      const filled = listRoleNeeds(database, current.project_id).find(
        (need) => need.id === current.role_need_id,
      );
      if (filled.remaining_capacity === 0) {
        database.prepare(`
          UPDATE project_role_needs SET status = 'FILLED' WHERE role_need_id = ?
        `).run(current.role_need_id);
      }
      database.prepare(`
        UPDATE projects SET status = 'ACTIVE', updated_at = ? WHERE project_id = ?
      `).run(now, current.project_id);
      const starterPack = findStarterPack(database, current.project_id);
      if (starterPack) {
        database.prepare("DELETE FROM plan_confirmations WHERE pack_id = ?").run(starterPack.id);
        database.prepare(`
          UPDATE starter_packs
          SET status = 'PROPOSED', confirmed_at = NULL
          WHERE pack_id = ?
        `).run(starterPack.id);
      }
      const project = findProject(database, current.project_id);
      appendEventLog(database, {
        eventId: project.event_id,
        actorId,
        type: "team_invitation_accepted",
        objectType: "project_membership",
        objectId: `${current.project_id}:${actorId}`,
        source: "mobile",
        payload: { project_id: current.project_id, role_need_id: current.role_need_id },
        createdAt: now,
      });
      if (starterPack) {
        appendEventLog(database, {
          eventId: project.event_id,
          actorId,
          type: "plan_reopened_for_member",
          objectType: "starter_pack",
          objectId: starterPack.id,
          source: "membership_change",
          payload: { project_id: current.project_id, member_id: current.invitee_id },
          createdAt: now,
        });
      }
      database.exec("COMMIT");
    } catch (caught) {
      database.exec("ROLLBACK");
      throw caught;
    }
    const resolved = database.prepare(
      "SELECT * FROM team_invitations WHERE invitation_id = ?",
    ).get(invitationId);
    return {
      status: 200,
      body: {
        invitation: mapInvitation(resolved),
        membership: listMembers(database, resolved.project_id).find(
          (member) => member.user_id === actorId,
        ),
        role_need: listRoleNeeds(database, resolved.project_id).find(
          (need) => need.id === resolved.role_need_id,
        ),
        idempotent_replay: false,
      },
    };
  }

  function readProject({ actorId, projectId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const project = findProject(database, projectId);
    if (!project) return error(404, "PROJECT_NOT_FOUND", "Project not found.");
    const member = database.prepare(`
      SELECT 1 FROM project_memberships WHERE project_id = ? AND user_id = ?
    `).get(projectId, actorId);
    if (!member) return error(403, "PROJECT_FORBIDDEN", "Only project members can view this project.");
    return {
      status: 200,
      body: {
        project,
        role_needs: listRoleNeeds(database, projectId),
        members: listMembers(database, projectId),
      },
    };
  }

  function mapStarterPack(row) {
    if (!row) return null;
    return {
      id: row.pack_id,
      project_id: row.project_id,
      version: Number(row.version),
      generated_by: row.generated_by,
      status: row.status,
      role_coverage: JSON.parse(row.role_coverage_json),
      missing_roles: JSON.parse(row.missing_roles_json),
      risk: JSON.parse(row.risk_json),
      created_at: row.created_at,
      confirmed_at: row.confirmed_at ?? null,
    };
  }

  function findStarterPack(database, projectId) {
    return mapStarterPack(database.prepare(`
      SELECT * FROM starter_packs WHERE project_id = ?
    `).get(projectId));
  }

  function mapTask(row) {
    return {
      id: row.task_id,
      project_id: row.project_id,
      pack_id: row.pack_id,
      position: Number(row.position),
      title: row.title,
      objective: row.objective,
      acceptance_criteria: row.acceptance_criteria,
      mode: row.mode,
      suggested_owner_id: row.suggested_owner_id ?? null,
      confirmed_owner_id: row.confirmed_owner_id ?? null,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function listTasks(database, projectId) {
    return database.prepare(`
      SELECT * FROM work_items
      WHERE project_id = ?
      ORDER BY position ASC, task_id ASC
    `).all(projectId).map(mapTask);
  }

  function projectMember(database, projectId, userId) {
    return database.prepare(`
      SELECT * FROM project_memberships WHERE project_id = ? AND user_id = ?
    `).get(projectId, userId) ?? null;
  }

  async function generateStarterPack({ actorId, projectId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const project = findProject(database, projectId);
    if (!project) return error(404, "PROJECT_NOT_FOUND", "Project not found.");
    const actorMembership = projectMember(database, projectId, actorId);
    if (!actorMembership || !new Set(["ORIGINATOR", "LEADER"]).has(actorMembership.membership_role)) {
      return error(403, "AGENT_DISPATCH_FORBIDDEN", "Only the project originator or leader can generate a shared plan.");
    }
    const existing = findStarterPack(database, projectId);
    if (existing) {
      return {
        status: 200,
        body: {
          starter_pack: existing,
          tasks: listTasks(database, projectId),
          idempotent_replay: true,
        },
      };
    }
    const members = listMembers(database, projectId);
    if (members.length < 2) {
      return error(409, "TEAM_NOT_READY", "At least two confirmed members are required.");
    }
    const now = clock().toISOString();
    const packId = `pack_${randomUUID()}`;
    const roleNeedMember = members.find((member) => member.role_need_id)?.user_id ?? null;
    const originator = members.find((member) => member.membership_role === "ORIGINATOR")?.user_id ?? actorId;
    const coverage = members.map((member) => ({
      user_id: member.user_id,
      display_name: member.display_name,
      role: member.profile_role,
    }));
    const missingRoles = listRoleNeeds(database, projectId)
      .filter((need) => need.remaining_capacity > 0)
      .map((need) => need.title);
    const risk = {
      level: "MEDIUM",
      summary: "黑客松交付窗口较短，需先冻结最小范围、验收标准和降级演示路径",
    };
    const templates = [
      {
        title: "冻结问题与最小交付边界",
        objective: `围绕“${project.title}”确认目标用户、核心问题和本场唯一交付结果`,
        acceptance: "团队确认一页范围说明，并明确至少一个不做项和降级方案",
        mode: "HUMAN",
        suggestedOwnerId: roleNeedMember,
      },
      {
        title: "跑通核心能力最短链路",
        objective: `把项目目标“${project.summary}”压缩成可重复验证的最短实现链路`,
        acceptance: "至少一条真实输入能够产生可检查的输出，并保留失败降级路径",
        mode: "HUMAN_AGENT",
        suggestedOwnerId: originator,
      },
      {
        title: "验证并冻结演示验收脚本",
        objective: "把问题、关键能力与结果串成可重复的现场演示",
        acceptance: "全队按同一脚本连续完成两次无口头补救演示",
        mode: "PAIR",
        suggestedOwnerId: null,
      },
    ];
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`
        INSERT INTO starter_packs (
          pack_id, project_id, version, generated_by, status,
          role_coverage_json, missing_roles_json, risk_json, created_at, confirmed_at
        ) VALUES (?, ?, 1, 'TEMPLATE_FALLBACK', 'PROPOSED', ?, ?, ?, ?, NULL)
      `).run(
        packId,
        projectId,
        JSON.stringify(coverage),
        JSON.stringify(missingRoles),
        JSON.stringify(risk),
        now,
      );
      const insertTask = database.prepare(`
        INSERT INTO work_items (
          task_id, project_id, pack_id, position, title, objective,
          acceptance_criteria, mode, suggested_owner_id, confirmed_owner_id,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'PROPOSED', ?, ?)
      `);
      templates.forEach((task, index) => {
        insertTask.run(
          `task_${randomUUID()}`,
          projectId,
          packId,
          index + 1,
          task.title,
          task.objective,
          task.acceptance,
          task.mode,
          task.suggestedOwnerId,
          now,
          now,
        );
      });
      appendEventLog(database, {
        eventId: project.event_id,
        actorId,
        type: "starter_pack_generated",
        objectType: "starter_pack",
        objectId: packId,
        source: "template_fallback",
        payload: { project_id: projectId, task_count: templates.length },
        createdAt: now,
      });
      database.exec("COMMIT");
    } catch (caught) {
      database.exec("ROLLBACK");
      throw caught;
    }
    return {
      status: 201,
      body: {
        starter_pack: findStarterPack(database, projectId),
        tasks: listTasks(database, projectId),
        idempotent_replay: false,
      },
    };
  }

  function updateTask({ actorId, taskId, action }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const row = database.prepare("SELECT * FROM work_items WHERE task_id = ?").get(taskId);
    if (!row) return error(404, "TASK_NOT_FOUND", "Task not found.");
    if (!projectMember(database, row.project_id, actorId)) {
      return error(403, "TASK_FORBIDDEN", "Only project members can change this task.");
    }
    const current = mapTask(row);
    const now = clock().toISOString();
    if (action === "claim") {
      if (current.confirmed_owner_id && current.confirmed_owner_id !== actorId) {
        return error(409, "TASK_ALREADY_CLAIMED", "This task has already been accepted by another member.");
      }
      if (current.confirmed_owner_id === actorId && current.status !== "ACCEPTED") {
        return error(
          409,
          "TASK_ALREADY_STARTED",
          "A task that has entered execution cannot be claimed again.",
        );
      }
      const replay = current.confirmed_owner_id === actorId;
      if (!replay) {
        database.prepare(`
          UPDATE work_items
          SET confirmed_owner_id = ?, status = 'ACCEPTED', updated_at = ?
          WHERE task_id = ?
        `).run(actorId, now, taskId);
        const project = findProject(database, current.project_id);
        appendEventLog(database, {
          eventId: project.event_id,
          actorId,
          type: "task_claimed",
          objectType: "work_item",
          objectId: taskId,
          source: "mobile",
          payload: { project_id: current.project_id, previous_suggestion: current.suggested_owner_id },
          createdAt: now,
        });
      }
      return {
        status: 200,
        body: {
          task: mapTask(database.prepare("SELECT * FROM work_items WHERE task_id = ?").get(taskId)),
          idempotent_replay: replay,
        },
      };
    }
    const transitions = {
      start: { from: "ACCEPTED", to: "IN_PROGRESS", event: "task_started" },
      complete: { from: "IN_PROGRESS", to: "DONE", event: "task_completed" },
      block: { from: "IN_PROGRESS", to: "BLOCKED", event: "task_blocked" },
    };
    const transition = transitions[action];
    if (!transition) return error(400, "INVALID_ACTION", "action must be claim, start, complete, or block.");
    if (current.confirmed_owner_id !== actorId) {
      return error(403, "TASK_OWNER_ONLY", "Only the confirmed task owner can change execution status.");
    }
    if (current.status !== transition.from) {
      return error(409, "INVALID_TASK_TRANSITION", "This task action is not valid in its current state.");
    }
    database.prepare(`
      UPDATE work_items SET status = ?, updated_at = ? WHERE task_id = ?
    `).run(transition.to, now, taskId);
    const project = findProject(database, current.project_id);
    appendEventLog(database, {
      eventId: project.event_id,
      actorId,
      type: transition.event,
      objectType: "work_item",
      objectId: taskId,
      source: "mobile",
      payload: { project_id: current.project_id },
      createdAt: now,
    });
    return {
      status: 200,
      body: { task: mapTask(database.prepare("SELECT * FROM work_items WHERE task_id = ?").get(taskId)) },
    };
  }

  function confirmPlan({ actorId, projectId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const project = findProject(database, projectId);
    if (!project) return error(404, "PROJECT_NOT_FOUND", "Project not found.");
    if (!projectMember(database, projectId, actorId)) {
      return error(403, "PLAN_FORBIDDEN", "Only project members can confirm this plan.");
    }
    const pack = findStarterPack(database, projectId);
    if (!pack) return error(409, "STARTER_PACK_REQUIRED", "Generate a starter pack first.");
    const now = clock().toISOString();
    const inserted = database.prepare(`
      INSERT OR IGNORE INTO plan_confirmations (pack_id, user_id, confirmed_at)
      VALUES (?, ?, ?)
    `).run(pack.id, actorId, now);
    const required = Number(database.prepare(`
      SELECT count(*) AS count FROM project_memberships WHERE project_id = ?
    `).get(projectId).count);
    const confirmed = Number(database.prepare(`
      SELECT count(*) AS count FROM plan_confirmations WHERE pack_id = ?
    `).get(pack.id).count);
    if (confirmed === required && pack.status !== "CONFIRMED") {
      database.prepare(`
        UPDATE starter_packs SET status = 'CONFIRMED', confirmed_at = ? WHERE pack_id = ?
      `).run(now, pack.id);
      appendEventLog(database, {
        eventId: project.event_id,
        actorId,
        type: "plan_confirmed",
        objectType: "starter_pack",
        objectId: pack.id,
        source: "team_confirmation",
        payload: { project_id: projectId, confirmed_members: confirmed },
        createdAt: now,
      });
    } else if (inserted.changes > 0) {
      appendEventLog(database, {
        eventId: project.event_id,
        actorId,
        type: "plan_confirmation_recorded",
        objectType: "starter_pack",
        objectId: pack.id,
        source: "mobile",
        payload: { project_id: projectId },
        createdAt: now,
      });
    }
    return {
      status: 200,
      body: {
        starter_pack: findStarterPack(database, projectId),
        confirmation_progress: { confirmed, required },
        idempotent_replay: inserted.changes === 0,
      },
    };
  }

  function projectActivity(database, project) {
    return database.prepare(`
      SELECT * FROM event_logs
      WHERE event_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT 200
    `).all(project.event_id).map((row) => ({
      event_type: row.event_type,
      actor_id: row.actor_id,
      object_type: row.object_type,
      object_id: row.object_id,
      source: row.source,
      payload: JSON.parse(row.payload_json),
      created_at: row.created_at,
    })).filter((item) => (
      item.object_id === project.id || item.payload.project_id === project.id
    ));
  }

  function readRoom({ actorId, projectId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const project = findProject(database, projectId);
    if (!project) return error(404, "PROJECT_NOT_FOUND", "Project not found.");
    if (!projectMember(database, projectId, actorId)) {
      return error(403, "PROJECT_FORBIDDEN", "Only project members can view this RALLY Room.");
    }
    const pack = findStarterPack(database, projectId);
    const required = listMembers(database, projectId).length;
    const confirmed = pack ? Number(database.prepare(`
      SELECT count(*) AS count FROM plan_confirmations WHERE pack_id = ?
    `).get(pack.id).count) : 0;
    return {
      status: 200,
      body: {
        project,
        members: listMembers(database, projectId),
        role_needs: listRoleNeeds(database, projectId),
        starter_pack: pack,
        tasks: listTasks(database, projectId),
        confirmation_progress: { confirmed, required },
        sos: listProjectSos(database, projectId),
        activity: projectActivity(database, project),
      },
    };
  }

  function listEvents({ actorId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const events = database.prepare(`
      SELECT event.*,
        policy.sos_enabled,
        policy.external_aid_enabled,
        policy.paid_aid_enabled,
        EXISTS (
          SELECT 1 FROM profiles profile
          WHERE profile.event_id = event.event_id AND profile.user_id = ?
        ) AS joined
      FROM events event
      LEFT JOIN event_collaboration_policies policy ON policy.event_id = event.event_id
      ORDER BY event.starts_at ASC
    `).all(actorId).map((row) => ({
      id: row.event_id,
      name: row.name,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      joined: Boolean(row.joined),
      collaboration_policy: {
        sos_enabled: Boolean(row.sos_enabled),
        external_aid_enabled: Boolean(row.external_aid_enabled),
        paid_aid_enabled: Boolean(row.paid_aid_enabled),
      },
    }));
    return { status: 200, body: { events } };
  }

  function readMe({ actorId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const user = findUserIdentity(database, actorId);
    const profiles = database.prepare(`
      SELECT
        profile.*,
        visibility.state AS visibility_state,
        visibility.public_fields_json,
        visibility.expires_at AS visibility_expires_at
      FROM profiles profile
      JOIN visibility_grants visibility
        ON visibility.user_id = profile.user_id AND visibility.event_id = profile.event_id
      WHERE profile.user_id = ?
      ORDER BY profile.event_id ASC
    `).all(actorId).map((row) => ({
      event_id: row.event_id,
      role: row.role,
      status: row.status,
      skills: JSON.parse(row.skills_json),
      interests: JSON.parse(row.interests_json),
      availability: row.availability,
      collaboration_preferences: JSON.parse(row.collaboration_preferences_json),
      collaboration_need: row.collaboration_need,
      evidence: JSON.parse(row.evidence_json),
      visibility: {
        state: row.visibility_state,
        public_fields: JSON.parse(row.public_fields_json),
        expires_at: row.visibility_expires_at,
      },
    }));
    return {
      status: 200,
      body: { user, profiles, platform_links: listPlatformLinks(database, actorId) },
    };
  }

  async function joinEvent({ request, actorId, eventId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const event = database.prepare("SELECT * FROM events WHERE event_id = ?").get(eventId);
    if (!event) return error(404, "EVENT_NOT_FOUND", "Event not found.");
    const now = clock().toISOString();
    if (event.ends_at <= now) return error(409, "EVENT_ENDED", "This event has ended.");
    const existing = database.prepare(`
      SELECT 1 FROM profiles WHERE user_id = ? AND event_id = ?
    `).get(actorId, eventId);
    if (existing) {
      const me = readMe({ actorId }).body;
      return {
        status: 200,
        body: {
          profile: me.profiles.find((profile) => profile.event_id === eventId),
          visibility: me.profiles.find((profile) => profile.event_id === eventId).visibility,
          idempotent_replay: true,
        },
      };
    }
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    const skills = parseStringArray(payload?.skills, { maximumItems: 5, maximumLength: 40 });
    const interests = parseStringArray(payload?.interests, { maximumItems: 5, maximumLength: 60 });
    const collaborationPreferences = parseStringArray(
      payload?.collaboration_preferences,
      { maximumItems: 5, maximumLength: 60 },
    );
    const evidence = parseStringArray(payload?.evidence, { maximumItems: 12, maximumLength: 160 });
    if (
      !payload
      || typeof payload.role !== "string"
      || !payload.role.trim()
      || payload.role.length > 80
      || !PROFILE_STATUSES.has(payload.status)
      || typeof payload.availability !== "string"
      || !payload.availability.trim()
      || payload.availability.length > 120
      || typeof payload.collaboration_need !== "string"
      || payload.collaboration_need.length > 160
      || !skills
      || skills.length < 3
      || !interests
      || interests.length < 1
      || !collaborationPreferences
      || collaborationPreferences.length < 1
      || !evidence
    ) {
      return error(400, "INVALID_PROFILE", "A valid minimum collaboration profile is required.");
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`
        INSERT INTO profiles (
          user_id, event_id, role, status, skills_json, interests_json, availability,
          collaboration_preferences_json, collaboration_need, evidence_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        actorId,
        eventId,
        payload.role.trim(),
        payload.status.trim(),
        JSON.stringify(skills),
        JSON.stringify(interests),
        payload.availability.trim(),
        JSON.stringify(collaborationPreferences),
        payload.collaboration_need.trim(),
        JSON.stringify(evidence),
      );
      database.prepare(`
        INSERT INTO visibility_grants (
          user_id, event_id, state, public_fields_json, starts_at, expires_at
        ) VALUES (?, ?, 'HIDDEN', '[]', ?, ?)
      `).run(actorId, eventId, now, event.ends_at);
      appendEventLog(database, {
        eventId,
        actorId,
        type: "event_joined",
        objectType: "profile",
        objectId: actorId,
        source: "mobile",
        payload: { event_id: eventId },
        createdAt: now,
      });
      database.exec("COMMIT");
    } catch (caught) {
      database.exec("ROLLBACK");
      throw caught;
    }
    const me = readMe({ actorId }).body;
    const profile = me.profiles.find((item) => item.event_id === eventId);
    return {
      status: 201,
      body: {
        profile,
        visibility: profile.visibility,
        idempotent_replay: false,
      },
    };
  }

  function readPersonalActivity({ actorId, eventId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    if (!eventId) return error(400, "EVENT_REQUIRED", "event_id is required.");
    const rows = database.prepare(`
      SELECT * FROM event_logs
      WHERE event_id = ? AND actor_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT 200
    `).all(eventId, actorId);
    return {
      status: 200,
      body: {
        activity: rows.map((row) => ({
          event_type: row.event_type,
          actor_id: row.actor_id,
          object_type: row.object_type,
          object_id: row.object_id,
          source: row.source,
          payload: JSON.parse(row.payload_json),
          created_at: row.created_at,
        })),
      },
    };
  }

  function resetDemo({ request }) {
    const suppliedKey = request.headers["x-demo-access-key"];
    if (
      typeof demoAccessKey !== "string"
      || typeof suppliedKey !== "string"
      || suppliedKey !== demoAccessKey
    ) {
      return error(403, "DEMO_ACCESS_DENIED", "A valid demo access key is required.");
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      for (const table of [
        "plan_confirmations",
        "work_items",
        "starter_packs",
        "project_sos_responses",
        "project_sos",
        "team_invitations",
        "project_memberships",
        "project_role_needs",
        "projects",
        "event_presence",
        "platform_links",
        "connection_request_connections",
        "connections",
        "connection_requests",
        "user_blocks",
        "archived_duplicate_connections",
        "event_logs",
        "nfc_assets",
        "visibility_grants",
        "profiles",
      ]) {
        database.exec(`DELETE FROM ${table}`);
      }
      seedDatabase(database);
      database.exec("COMMIT");
    } catch (caught) {
      database.exec("ROLLBACK");
      throw caught;
    }
    return {
      status: 200,
      body: { reset: true, reset_at: clock().toISOString(), event_id: "hackathon-2026" },
    };
  }

  function mapSos(row) {
    if (!row) return null;
    return {
      id: row.sos_id,
      project_id: row.project_id,
      event_id: row.event_id,
      creator_id: row.creator_id,
      category: row.category,
      problem: row.problem,
      context: row.context,
      attempts: JSON.parse(row.attempts_json),
      required_skills: JSON.parse(row.required_skills_json),
      estimated_minutes: Number(row.estimated_minutes),
      location_label: row.location_label,
      deadline: row.deadline,
      resolution_criteria: row.resolution_criteria,
      reward_intent: row.reward_intent_json ? JSON.parse(row.reward_intent_json) : null,
      status: row.status,
      accepted_response_id: row.accepted_response_id ?? null,
      resolution_note: row.resolution_note ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at ?? null,
    };
  }

  function mapSosResponse(row) {
    if (!row) return null;
    return {
      id: row.response_id,
      sos_id: row.sos_id,
      responder_id: row.responder_id,
      message: row.message,
      available_minutes: Number(row.available_minutes),
      status: row.status,
      withdraw_reason: row.withdraw_reason ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function listProjectSos(database, projectId) {
    return database.prepare(`
      SELECT * FROM project_sos WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(projectId).map(mapSos);
  }

  async function createProjectSos({ request, actorId, projectId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const project = findProject(database, projectId);
    if (!project) return error(404, "PROJECT_NOT_FOUND", "Project not found.");
    if (!projectMember(database, projectId, actorId)) {
      return error(403, "PROJECT_FORBIDDEN", "Only project members can publish an SOS.");
    }
    const policy = findEventPolicy(database, project.event_id);
    if (!policy.sos_enabled || !policy.external_aid_enabled) {
      return error(403, "SOS_DISABLED", "This event does not allow external project SOS requests.");
    }
    const now = clock().toISOString();
    database.prepare(`
      UPDATE project_sos SET status = 'EXPIRED', updated_at = ?
      WHERE project_id = ? AND status IN ('OPEN', 'CLAIMED') AND deadline <= ?
    `).run(now, projectId, now);
    const active = database.prepare(`
      SELECT 1 FROM project_sos WHERE project_id = ? AND status IN ('OPEN', 'CLAIMED')
    `).get(projectId);
    if (active) return error(409, "ACTIVE_SOS_EXISTS", "This project already has an active SOS.");
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    const categories = new Set([
      "技术/硬件",
      "模型/数据",
      "部署/API",
      "设计/交互",
      "测试/演示",
      "路演/商业",
      "设备/资源",
    ]);
    const attempts = parseStringArray(payload?.attempts, { maximumItems: 10, maximumLength: 200 });
    const skills = parseStringArray(payload?.required_skills, { maximumItems: 10, maximumLength: 50 });
    const deadlineTime = new Date(payload?.deadline).getTime();
    const reward = payload?.reward_intent === undefined || payload?.reward_intent === null
      ? null
      : parseObject(payload.reward_intent);
    const rewardTypes = new Set(["VOLUNTEER", "GIFT", "POINTS", "PAID_INTENT"]);
    const rewardValid = reward === null || (
      rewardTypes.has(reward.type)
      && (
        reward.type === "VOLUNTEER"
        || (
          new Set(["GIFT", "POINTS"]).has(reward.type)
          && typeof reward.description === "string"
          && reward.description.trim().length > 0
          && reward.description.length <= 500
        )
        || (
          reward.type === "PAID_INTENT"
          && typeof reward.currency === "string"
          && /^[A-Z]{3}$/.test(reward.currency)
          && Number.isInteger(reward.amount)
          && reward.amount > 0
          && reward.amount <= 100_000
          && typeof reward.delivery_standard === "string"
          && reward.delivery_standard.trim().length > 0
          && reward.delivery_standard.length <= 500
          && typeof reward.payment_note === "string"
          && reward.payment_note.trim().length > 0
          && reward.payment_note.length <= 500
        )
      )
    );
    if (
      !payload
      || !categories.has(payload.category)
      || typeof payload.problem !== "string"
      || !payload.problem.trim()
      || payload.problem.length > 500
      || typeof payload.context !== "string"
      || payload.context.length > 1000
      || !attempts
      || !skills
      || !Number.isInteger(payload.estimated_minutes)
      || payload.estimated_minutes < 5
      || payload.estimated_minutes > 480
      || typeof payload.location_label !== "string"
      || payload.location_label.length > 100
      || !Number.isFinite(deadlineTime)
      || deadlineTime <= new Date(now).getTime()
      || typeof payload.resolution_criteria !== "string"
      || !payload.resolution_criteria.trim()
      || payload.resolution_criteria.length > 500
      || !rewardValid
    ) {
      return error(400, "INVALID_SOS", "SOS fields are incomplete or invalid.");
    }
    if (reward?.type === "PAID_INTENT" && !policy.paid_aid_enabled) {
      return error(409, "PAID_AID_DISABLED", "This event does not allow paid aid intent.");
    }
    const eventEndsAt = database.prepare("SELECT ends_at FROM events WHERE event_id = ?").get(project.event_id).ends_at;
    const deadline = new Date(Math.min(deadlineTime, new Date(eventEndsAt).getTime())).toISOString();
    const rewardIntent = reward ? {
      type: reward.type,
      ...(reward.type === "PAID_INTENT" ? {
        currency: reward.currency,
        amount: reward.amount,
        delivery_standard: reward.delivery_standard.trim(),
        payment_note: reward.payment_note.trim(),
      } : {}),
      ...(new Set(["GIFT", "POINTS"]).has(reward.type)
        ? { description: reward.description.trim() }
        : {}),
      payment_state: "NOT_PROCESSED",
      disclaimer: "RALLY only records reward intent and does not process or escrow payment.",
    } : null;
    const sosId = `sos_${randomUUID()}`;
    database.prepare(`
      INSERT INTO project_sos (
        sos_id, project_id, event_id, creator_id, category, problem, context,
        attempts_json, required_skills_json, estimated_minutes, location_label,
        deadline, resolution_criteria, reward_intent_json, status,
        accepted_response_id, resolution_note, created_at, updated_at, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', NULL, NULL, ?, ?, NULL)
    `).run(
      sosId,
      projectId,
      project.event_id,
      actorId,
      payload.category,
      payload.problem.trim(),
      payload.context.trim(),
      JSON.stringify(attempts),
      JSON.stringify(skills),
      payload.estimated_minutes,
      payload.location_label.trim(),
      deadline,
      payload.resolution_criteria.trim(),
      rewardIntent ? JSON.stringify(rewardIntent) : null,
      now,
      now,
    );
    appendEventLog(database, {
      eventId: project.event_id,
      actorId,
      type: "project_sos_created",
      objectType: "project_sos",
      objectId: sosId,
      source: "mobile",
      payload: { project_id: projectId, category: payload.category },
      createdAt: now,
    });
    return {
      status: 201,
      body: { sos: mapSos(database.prepare("SELECT * FROM project_sos WHERE sos_id = ?").get(sosId)) },
    };
  }

  function listEventSos({ actorId, eventId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const participant = database.prepare(`
      SELECT 1 FROM profiles WHERE user_id = ? AND event_id = ?
    `).get(actorId, eventId);
    if (!participant) return error(403, "EVENT_MEMBERSHIP_REQUIRED", "Join this event before viewing SOS requests.");
    const policy = findEventPolicy(database, eventId);
    if (!policy.sos_enabled || !policy.external_aid_enabled) {
      return error(403, "SOS_DISABLED", "This event does not allow external project SOS requests.");
    }
    const now = clock().toISOString();
    database.prepare(`
      UPDATE project_sos SET status = 'EXPIRED', updated_at = ?
      WHERE event_id = ? AND status IN ('OPEN', 'CLAIMED') AND deadline <= ?
    `).run(now, eventId, now);
    const rows = database.prepare(`
      SELECT sos.*, project.title AS project_title,
        (SELECT count(*) FROM project_sos_responses response WHERE response.sos_id = sos.sos_id) AS response_count
      FROM project_sos sos
      JOIN projects project ON project.project_id = sos.project_id
      WHERE sos.event_id = ? AND sos.status IN ('OPEN', 'CLAIMED') AND sos.deadline > ?
      ORDER BY sos.deadline ASC, sos.created_at DESC
    `).all(eventId, now);
    return {
      status: 200,
      body: {
        sos: rows.map((row) => ({
          ...mapSos(row),
          project_title: row.project_title,
          response_count: Number(row.response_count),
        })),
      },
    };
  }

  async function respondToSos({ request, actorId, sosId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const sosRow = database.prepare("SELECT * FROM project_sos WHERE sos_id = ?").get(sosId);
    if (!sosRow) return error(404, "SOS_NOT_FOUND", "Project SOS not found.");
    const sos = mapSos(sosRow);
    const policy = findEventPolicy(database, sos.event_id);
    if (!policy.sos_enabled || !policy.external_aid_enabled) {
      return error(403, "SOS_DISABLED", "This event does not allow external project SOS requests.");
    }
    if (sos.reward_intent?.type === "PAID_INTENT" && !policy.paid_aid_enabled) {
      return error(
        409,
        "PAID_AID_DISABLED",
        "This event no longer accepts responses to paid aid requests.",
      );
    }
    if (sos.status !== "OPEN" || sos.deadline <= clock().toISOString()) {
      return error(409, "SOS_NOT_OPEN", "This SOS is no longer accepting responses.");
    }
    const participant = database.prepare(`
      SELECT 1 FROM profiles WHERE user_id = ? AND event_id = ?
    `).get(actorId, sos.event_id);
    if (!participant) return error(403, "EVENT_MEMBERSHIP_REQUIRED", "Join this event before responding.");
    if (projectMember(database, sos.project_id, actorId)) {
      return error(409, "PROJECT_MEMBER_CANNOT_RESPOND", "Project members should update the SOS instead.");
    }
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    if (
      !payload
      || typeof payload.message !== "string"
      || !payload.message.trim()
      || payload.message.length > 500
      || !Number.isInteger(payload.available_minutes)
      || payload.available_minutes < 5
      || payload.available_minutes > 480
    ) {
      return error(400, "INVALID_SOS_RESPONSE", "message and available_minutes are invalid.");
    }
    const existing = database.prepare(`
      SELECT * FROM project_sos_responses WHERE sos_id = ? AND responder_id = ?
    `).get(sosId, actorId);
    if (existing) {
      if (existing.status === "WITHDRAWN") {
        const now = clock().toISOString();
        database.prepare(`
          UPDATE project_sos_responses
          SET message = ?, available_minutes = ?, status = 'PENDING',
              withdraw_reason = NULL, updated_at = ?
          WHERE response_id = ?
        `).run(payload.message.trim(), payload.available_minutes, now, existing.response_id);
        appendEventLog(database, {
          eventId: sos.event_id,
          actorId,
          type: "project_sos_responded",
          objectType: "project_sos_response",
          objectId: existing.response_id,
          source: "mobile",
          payload: { project_id: sos.project_id, sos_id: sosId, resumed: true },
          createdAt: now,
        });
        return {
          status: 200,
          body: {
            response: mapSosResponse(
              database.prepare("SELECT * FROM project_sos_responses WHERE response_id = ?")
                .get(existing.response_id),
            ),
            idempotent_replay: false,
          },
        };
      }
      return { status: 200, body: { response: mapSosResponse(existing), idempotent_replay: true } };
    }
    const now = clock().toISOString();
    const responseId = `aid_${randomUUID()}`;
    database.prepare(`
      INSERT INTO project_sos_responses (
        response_id, sos_id, responder_id, message, available_minutes,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(
      responseId,
      sosId,
      actorId,
      payload.message.trim(),
      payload.available_minutes,
      now,
      now,
    );
    appendEventLog(database, {
      eventId: sos.event_id,
      actorId,
      type: "project_sos_responded",
      objectType: "project_sos_response",
      objectId: responseId,
      source: "mobile",
      payload: { project_id: sos.project_id, sos_id: sosId },
      createdAt: now,
    });
    return {
      status: 201,
      body: {
        response: mapSosResponse(
          database.prepare("SELECT * FROM project_sos_responses WHERE response_id = ?").get(responseId),
        ),
        idempotent_replay: false,
      },
    };
  }

  function acceptSosResponse({ actorId, responseId, action, withdrawReason = "" }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    if (!new Set(["accept", "withdraw"]).has(action)) {
      return error(400, "INVALID_ACTION", "action must be accept or withdraw.");
    }
    const responseRow = database.prepare(`
      SELECT response.*, sos.project_id, sos.event_id, sos.status AS sos_status,
        sos.accepted_response_id
      FROM project_sos_responses response
      JOIN project_sos sos ON sos.sos_id = response.sos_id
      WHERE response.response_id = ?
    `).get(responseId);
    if (!responseRow) return error(404, "SOS_RESPONSE_NOT_FOUND", "SOS response not found.");
    if (action === "withdraw") {
      if (responseRow.responder_id !== actorId) {
        return error(403, "SOS_WITHDRAW_FORBIDDEN", "Only the selected responder can withdraw help.");
      }
      const reason = typeof withdrawReason === "string" ? withdrawReason.trim() : "";
      if (!reason || reason.length > 500) {
        return error(400, "INVALID_WITHDRAW_REASON", "A withdrawal reason is required.");
      }
      if (responseRow.status === "WITHDRAWN" && responseRow.sos_status === "OPEN") {
        return {
          status: 200,
          body: {
            response: mapSosResponse(responseRow),
            sos: mapSos(database.prepare("SELECT * FROM project_sos WHERE sos_id = ?").get(responseRow.sos_id)),
            project_membership_created: false,
            idempotent_replay: true,
          },
        };
      }
      if (
        responseRow.status !== "ACCEPTED"
        || responseRow.sos_status !== "CLAIMED"
        || responseRow.accepted_response_id !== responseId
      ) {
        return error(409, "SOS_RESPONSE_NOT_SELECTED", "Only the selected active responder can withdraw.");
      }
      const now = clock().toISOString();
      database.exec("BEGIN IMMEDIATE");
      try {
        database.prepare(`
          UPDATE project_sos_responses
          SET status = 'WITHDRAWN', withdraw_reason = ?, updated_at = ?
          WHERE response_id = ?
        `).run(reason, now, responseId);
        database.prepare(`
          UPDATE project_sos_responses
          SET status = 'PENDING', updated_at = ?
          WHERE sos_id = ? AND status = 'WAITLISTED'
        `).run(now, responseRow.sos_id);
        database.prepare(`
          UPDATE project_sos
          SET status = 'OPEN', accepted_response_id = NULL, updated_at = ?
          WHERE sos_id = ? AND status = 'CLAIMED'
        `).run(now, responseRow.sos_id);
        appendEventLog(database, {
          eventId: responseRow.event_id,
          actorId,
          type: "project_sos_help_withdrawn",
          objectType: "project_sos_response",
          objectId: responseId,
          source: "mobile",
          payload: { project_id: responseRow.project_id, sos_id: responseRow.sos_id, reason },
          createdAt: now,
        });
        database.exec("COMMIT");
      } catch (caught) {
        database.exec("ROLLBACK");
        throw caught;
      }
      return {
        status: 200,
        body: {
          response: mapSosResponse(
            database.prepare("SELECT * FROM project_sos_responses WHERE response_id = ?").get(responseId),
          ),
          sos: mapSos(database.prepare("SELECT * FROM project_sos WHERE sos_id = ?").get(responseRow.sos_id)),
          project_membership_created: false,
          idempotent_replay: false,
        },
      };
    }
    const membership = projectMember(database, responseRow.project_id, actorId);
    if (!membership || !new Set(["ORIGINATOR", "LEADER"]).has(membership.membership_role)) {
      return error(403, "SOS_SELECTION_FORBIDDEN", "Only the project originator or leader can choose help.");
    }
    if (responseRow.status === "ACCEPTED" && responseRow.sos_status === "CLAIMED") {
      return {
        status: 200,
        body: {
          response: mapSosResponse(responseRow),
          sos: mapSos(database.prepare("SELECT * FROM project_sos WHERE sos_id = ?").get(responseRow.sos_id)),
          project_membership_created: false,
          idempotent_replay: true,
        },
      };
    }
    if (responseRow.status !== "PENDING" || responseRow.sos_status !== "OPEN") {
      return error(409, "SOS_RESPONSE_NOT_PENDING", "This response can no longer be selected.");
    }
    const now = clock().toISOString();
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`
        UPDATE project_sos_responses
        SET status = CASE WHEN response_id = ? THEN 'ACCEPTED' ELSE 'WAITLISTED' END,
            updated_at = ?
        WHERE sos_id = ? AND status = 'PENDING'
      `).run(responseId, now, responseRow.sos_id);
      database.prepare(`
        UPDATE project_sos
        SET status = 'CLAIMED', accepted_response_id = ?, updated_at = ?
        WHERE sos_id = ? AND status = 'OPEN'
      `).run(responseId, now, responseRow.sos_id);
      appendEventLog(database, {
        eventId: responseRow.event_id,
        actorId,
        type: "project_sos_help_selected",
        objectType: "project_sos",
        objectId: responseRow.sos_id,
        source: "mobile",
        payload: { project_id: responseRow.project_id, response_id: responseId },
        createdAt: now,
      });
      database.exec("COMMIT");
    } catch (caught) {
      database.exec("ROLLBACK");
      throw caught;
    }
    return {
      status: 200,
      body: {
        response: mapSosResponse(
          database.prepare("SELECT * FROM project_sos_responses WHERE response_id = ?").get(responseId),
        ),
        sos: mapSos(database.prepare("SELECT * FROM project_sos WHERE sos_id = ?").get(responseRow.sos_id)),
        project_membership_created: false,
        idempotent_replay: false,
      },
    };
  }

  async function resolveSos({ request, actorId, sosId }) {
    if (!actorId) return error(401, "AUTH_REQUIRED", "A valid session is required.");
    const row = database.prepare("SELECT * FROM project_sos WHERE sos_id = ?").get(sosId);
    if (!row) return error(404, "SOS_NOT_FOUND", "Project SOS not found.");
    const sos = mapSos(row);
    if (sos.creator_id !== actorId) {
      return error(403, "SOS_LIFECYCLE_FORBIDDEN", "Only the SOS publisher can change its lifecycle.");
    }
    const parsed = await readJson(request);
    const readError = jsonReadError(parsed);
    if (readError) return readError;
    const payload = parseObject(parsed.value);
    const action = payload?.action;
    if (!new Set(["resolve", "close", "reopen"]).has(action)) {
      return error(400, "INVALID_SOS_ACTION", "action must be resolve, close, or reopen.");
    }
    const note = typeof payload.resolution_note === "string"
      ? payload.resolution_note.trim()
      : "";
    if ((action === "resolve" || action === "close") && (!note || note.length > 1000)) {
      return error(400, "INVALID_SOS_NOTE", "A non-empty resolution_note is required.");
    }
    if (action === "resolve" && sos.status === "RESOLVED") {
      return { status: 200, body: { sos, idempotent_replay: true } };
    }
    if (action === "close" && sos.status === "CLOSED") {
      return { status: 200, body: { sos, idempotent_replay: true } };
    }
    if (action === "reopen" && sos.status === "OPEN") {
      return { status: 200, body: { sos, idempotent_replay: true } };
    }
    const now = clock().toISOString();
    if (action === "reopen") {
      if (sos.status !== "CLOSED" || sos.deadline <= now) {
        return error(409, "SOS_CANNOT_REOPEN", "Only a closed, unexpired SOS can be reopened.");
      }
      const anotherActive = database.prepare(`
        SELECT 1 FROM project_sos
        WHERE project_id = ? AND sos_id <> ? AND status IN ('OPEN', 'CLAIMED')
      `).get(sos.project_id, sosId);
      if (anotherActive) return error(409, "ACTIVE_SOS_EXISTS", "This project already has an active SOS.");
      database.exec("BEGIN IMMEDIATE");
      try {
        database.prepare(`
          UPDATE project_sos
          SET status = 'OPEN', accepted_response_id = NULL, resolution_note = NULL,
              updated_at = ?, resolved_at = NULL
          WHERE sos_id = ?
        `).run(now, sosId);
        database.prepare(`
          UPDATE project_sos_responses
          SET status = 'PENDING', updated_at = ?
          WHERE sos_id = ? AND status IN ('ACCEPTED', 'WAITLISTED')
        `).run(now, sosId);
        database.exec("COMMIT");
      } catch (caught) {
        database.exec("ROLLBACK");
        throw caught;
      }
    } else {
      if (!new Set(["OPEN", "CLAIMED"]).has(sos.status)) {
        return error(409, "SOS_NOT_ACTIVE", "This SOS is no longer active.");
      }
      const nextStatus = action === "resolve" ? "RESOLVED" : "CLOSED";
      database.prepare(`
        UPDATE project_sos
        SET status = ?, resolution_note = ?, updated_at = ?, resolved_at = ?
        WHERE sos_id = ?
      `).run(nextStatus, note, now, action === "resolve" ? now : null, sosId);
    }
    appendEventLog(database, {
      eventId: sos.event_id,
      actorId,
      type: `project_sos_${action === "resolve" ? "resolved" : action === "close" ? "closed" : "reopened"}`,
      objectType: "project_sos",
      objectId: sosId,
      source: "mobile",
      payload: { project_id: sos.project_id, criteria: sos.resolution_criteria },
      createdAt: now,
    });
    return {
      status: 200,
      body: {
        sos: mapSos(database.prepare("SELECT * FROM project_sos WHERE sos_id = ?").get(sosId)),
        idempotent_replay: false,
      },
    };
  }

  return {
    async handle({ request, url, actorId }) {
      try {
      if (request.method === "GET" && url.pathname === "/api/events") {
        return listEvents({ actorId });
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        return readMe({ actorId });
      }

      if (request.method === "GET" && url.pathname === "/api/me/activity") {
        return readPersonalActivity({
          actorId,
          eventId: url.searchParams.get("event_id"),
        });
      }

      if (request.method === "POST" && url.pathname === "/api/demo/reset") {
        return resetDemo({ request });
      }

      const joinMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/join$/);
      if (request.method === "POST" && joinMatch) {
        return joinEvent({
          request,
          actorId,
          eventId: decodeURIComponent(joinMatch[1]),
        });
      }

      const projectSosMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/sos$/);
      if (request.method === "POST" && projectSosMatch) {
        return createProjectSos({
          request,
          actorId,
          projectId: decodeURIComponent(projectSosMatch[1]),
        });
      }

      const eventSosMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/sos$/);
      if (request.method === "GET" && eventSosMatch) {
        return listEventSos({
          actorId,
          eventId: decodeURIComponent(eventSosMatch[1]),
        });
      }

      const sosResponseCreateMatch = url.pathname.match(/^\/api\/sos\/([^/]+)\/responses$/);
      if (request.method === "POST" && sosResponseCreateMatch) {
        return respondToSos({
          request,
          actorId,
          sosId: decodeURIComponent(sosResponseCreateMatch[1]),
        });
      }

      const sosResponseMatch = url.pathname.match(/^\/api\/sos-responses\/([^/]+)$/);
      if (request.method === "PATCH" && sosResponseMatch) {
        const parsed = await readJson(request);
        const readError = jsonReadError(parsed);
        if (readError) return readError;
        if (!parseObject(parsed.value)) {
          return error(400, "INVALID_REQUEST", "Request body must be a JSON object.");
        }
        return acceptSosResponse({
          actorId,
          responseId: decodeURIComponent(sosResponseMatch[1]),
          action: parsed.value.action,
          withdrawReason: parsed.value.reason,
        });
      }

      const sosMatch = url.pathname.match(/^\/api\/sos\/([^/]+)$/);
      if (request.method === "PATCH" && sosMatch) {
        return resolveSos({
          request,
          actorId,
          sosId: decodeURIComponent(sosMatch[1]),
        });
      }

      const starterPackMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/starter-pack$/);
      if (request.method === "POST" && starterPackMatch) {
        return generateStarterPack({
          actorId,
          projectId: decodeURIComponent(starterPackMatch[1]),
        });
      }

      const confirmationMatch = url.pathname.match(
        /^\/api\/projects\/([^/]+)\/plan-confirmations$/,
      );
      if (request.method === "POST" && confirmationMatch) {
        return confirmPlan({
          actorId,
          projectId: decodeURIComponent(confirmationMatch[1]),
        });
      }

      const roomMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/room$/);
      if (request.method === "GET" && roomMatch) {
        return readRoom({
          actorId,
          projectId: decodeURIComponent(roomMatch[1]),
        });
      }

      const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
      if (request.method === "PATCH" && taskMatch) {
        const parsed = await readJson(request);
        const readError = jsonReadError(parsed);
        if (readError) return readError;
        if (!parseObject(parsed.value)) {
          return error(400, "INVALID_REQUEST", "Request body must be a JSON object.");
        }
        return updateTask({
          actorId,
          taskId: decodeURIComponent(taskMatch[1]),
          action: parsed.value.action,
        });
      }

      if (request.method === "POST" && url.pathname === "/api/projects") {
        return createProject({ request, actorId });
      }

      const projectInvitationMatch = url.pathname.match(
        /^\/api\/projects\/([^/]+)\/invitations$/,
      );
      if (request.method === "POST" && projectInvitationMatch) {
        return inviteToProject({
          request,
          actorId,
          projectId: decodeURIComponent(projectInvitationMatch[1]),
        });
      }

      const teamInvitationMatch = url.pathname.match(/^\/api\/team-invitations\/([^/]+)$/);
      if (request.method === "PATCH" && teamInvitationMatch) {
        const parsed = await readJson(request);
        const readError = jsonReadError(parsed);
        if (readError) return readError;
        if (!parseObject(parsed.value)) {
          return error(400, "INVALID_REQUEST", "Request body must be a JSON object.");
        }
        return resolveTeamInvitation({
          actorId,
          invitationId: decodeURIComponent(teamInvitationMatch[1]),
          action: parsed.value.action,
        });
      }

      const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (request.method === "GET" && projectMatch) {
        return readProject({
          actorId,
          projectId: decodeURIComponent(projectMatch[1]),
        });
      }

      const platformLinkMatch = url.pathname.match(/^\/api\/me\/platform-links\/([^/]+)$/);
      if (request.method === "PUT" && platformLinkMatch) {
        return upsertPlatformLink({
          request,
          actorId,
          platform: decodeURIComponent(platformLinkMatch[1]).toLowerCase(),
        });
      }
      if (request.method === "DELETE" && platformLinkMatch) {
        return deletePlatformLink({
          actorId,
          platform: decodeURIComponent(platformLinkMatch[1]).toLowerCase(),
        });
      }

      const profileMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/profile$/);
      if (request.method === "PATCH" && profileMatch) {
        return updateProfile({
          request,
          actorId,
          eventId: decodeURIComponent(profileMatch[1]),
        });
      }

      const visibilityMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/visibility$/);
      if (request.method === "PATCH" && visibilityMatch) {
        return updateVisibility({
          request,
          actorId,
          eventId: decodeURIComponent(visibilityMatch[1]),
        });
      }

      const discoverMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/discover$/);
      if (request.method === "GET" && discoverMatch) {
        return listDiscoverable({
          actorId,
          eventId: decodeURIComponent(discoverMatch[1]),
          projectId: url.searchParams.get("project_id"),
        });
      }

      const presenceMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/presence$/);
      if (request.method === "PUT" && presenceMatch) {
        return publishPresence({
          request,
          actorId,
          eventId: decodeURIComponent(presenceMatch[1]),
        });
      }
      if (request.method === "DELETE" && presenceMatch) {
        return stopPresence({
          actorId,
          eventId: decodeURIComponent(presenceMatch[1]),
        });
      }

      const nearbyMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/nearby$/);
      if (request.method === "GET" && nearbyMatch) {
        return listNearby({
          actorId,
          eventId: decodeURIComponent(nearbyMatch[1]),
        });
      }
      return null;
      } catch (caught) {
        if (caught instanceof URIError) {
          return error(
            400,
            "INVALID_PATH_PARAMETER",
            "The URL contains an invalid encoded path parameter.",
          );
        }
        throw caught;
      }
    },
  };
}
