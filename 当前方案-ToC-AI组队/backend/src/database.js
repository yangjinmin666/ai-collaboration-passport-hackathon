import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const ALL_PUBLIC_PROFILE_FIELDS = [
  "display_name",
  "avatar",
  "role",
  "status",
  "skills",
  "collaboration_need",
  "evidence",
];
const DEMO_CARD_TOKENS = {
  "card-zhou": "cp_7mJ4Qv9N2xK8Rt5W",
  "card-lin": "cp_B3kP8sT6yH2nV9qL",
  "card-su": "cp_F6wR1cZ8mN4jX2pD",
};
const ZHOU_PUBLIC_PROFILE_FIELDS = ALL_PUBLIC_PROFILE_FIELDS.filter(
  (field) => !["collaboration_need", "evidence"].includes(field),
);

export function openDatabase(databasePath) {
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      email TEXT,
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      skills_json TEXT NOT NULL,
      collaboration_need TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      PRIMARY KEY (user_id, event_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id)
    );

    CREATE TABLE IF NOT EXISTS visibility_grants (
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('HIDDEN', 'VISIBLE', 'PAUSED', 'EXPIRED')),
      public_fields_json TEXT NOT NULL DEFAULT '[]',
      starts_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      PRIMARY KEY (user_id, event_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id)
    );

    CREATE TABLE IF NOT EXISTS nfc_assets (
      card_id TEXT PRIMARY KEY,
      opaque_token TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'INACTIVE')),
      FOREIGN KEY (owner_id) REFERENCES users(user_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id)
    );

    CREATE TABLE IF NOT EXISTS connection_requests (
      request_id TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('nfc', 'qr', 'link')),
      status TEXT NOT NULL CHECK (
        status IN ('REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'BLOCKED')
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (requester_id) REFERENCES users(user_id),
      FOREIGN KEY (recipient_id) REFERENCES users(user_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id),
      CHECK (requester_id <> recipient_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS one_active_connection_request
      ON connection_requests (requester_id, recipient_id, event_id)
      WHERE status = 'REQUESTED';

    CREATE TABLE IF NOT EXISTS connections (
      connection_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL UNIQUE,
      event_id TEXT NOT NULL,
      user_a_id TEXT NOT NULL,
      user_b_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('nfc', 'qr', 'link')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES connection_requests(request_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id),
      FOREIGN KEY (user_a_id) REFERENCES users(user_id),
      FOREIGN KEY (user_b_id) REFERENCES users(user_id),
      CHECK (user_a_id < user_b_id)
    );

    CREATE TABLE IF NOT EXISTS archived_duplicate_connections (
      connection_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      user_a_id TEXT NOT NULL,
      user_b_id TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT NOT NULL,
      archive_reason TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_logs (
      log_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      actor_id TEXT,
      event_type TEXT NOT NULL,
      object_type TEXT NOT NULL,
      object_id TEXT NOT NULL,
      source TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(event_id)
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const visibilityColumns = database
    .prepare("PRAGMA table_info(visibility_grants)")
    .all();
  if (!visibilityColumns.some((column) => column.name === "public_fields_json")) {
    database.exec(`
      ALTER TABLE visibility_grants
      ADD COLUMN public_fields_json TEXT NOT NULL
      DEFAULT '[]'
    `);
  }
  enforceUniqueConnectionPairs(database);
  seedDatabase(database);
  migrateDemoFixtures(database);
  return database;
}

function enforceUniqueConnectionPairs(database) {
  const duplicates = database.prepare(`
    SELECT duplicate.*
    FROM connections duplicate
    WHERE EXISTS (
      SELECT 1
      FROM connections keeper
      WHERE keeper.event_id = duplicate.event_id
        AND keeper.user_a_id = duplicate.user_a_id
        AND keeper.user_b_id = duplicate.user_b_id
        AND (
          keeper.created_at < duplicate.created_at
          OR (
            keeper.created_at = duplicate.created_at
            AND keeper.connection_id < duplicate.connection_id
          )
        )
    )
  `).all();

  database.exec("BEGIN IMMEDIATE");
  try {
    const archive = database.prepare(`
      INSERT OR IGNORE INTO archived_duplicate_connections (
        connection_id, request_id, event_id, user_a_id, user_b_id, source,
        created_at, archived_at, archive_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const remove = database.prepare(
      "DELETE FROM connections WHERE connection_id = ?",
    );
    const archivedAt = new Date().toISOString();
    for (const duplicate of duplicates) {
      archive.run(
        duplicate.connection_id,
        duplicate.request_id,
        duplicate.event_id,
        duplicate.user_a_id,
        duplicate.user_b_id,
        duplicate.source,
        duplicate.created_at,
        archivedAt,
        "duplicate_pair_before_unique_index",
      );
      remove.run(duplicate.connection_id);
    }
    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS one_connection_per_pair_per_event
      ON connections (event_id, user_a_id, user_b_id)
    `);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function migrateDemoFixtures(database) {
  const migrationId = "20260828_opaque_tokens_and_public_fields";
  const alreadyApplied = database
    .prepare("SELECT 1 FROM schema_migrations WHERE migration_id = ?")
    .get(migrationId);
  if (alreadyApplied) return;

  database.exec("BEGIN IMMEDIATE");
  try {
    const updateToken = database.prepare(
      "UPDATE nfc_assets SET opaque_token = ? WHERE card_id = ?",
    );
    for (const [cardId, token] of Object.entries(DEMO_CARD_TOKENS)) {
      updateToken.run(token, cardId);
    }

    const updatePublicFields = database.prepare(`
      UPDATE visibility_grants
      SET public_fields_json = ?
      WHERE user_id = ? AND event_id = 'hackathon-2026'
    `);
    updatePublicFields.run(
      JSON.stringify(ZHOU_PUBLIC_PROFILE_FIELDS),
      "user-zhou",
    );
    updatePublicFields.run(
      JSON.stringify(ALL_PUBLIC_PROFILE_FIELDS),
      "user-lin",
    );
    updatePublicFields.run(
      JSON.stringify(ALL_PUBLIC_PROFILE_FIELDS),
      "user-su",
    );
    database.prepare(`
      INSERT INTO schema_migrations (migration_id, applied_at)
      VALUES (?, ?)
    `).run(migrationId, new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function seedDatabase(database) {
  const insertEvent = database.prepare(`
    INSERT OR IGNORE INTO events (event_id, name, starts_at, ends_at)
    VALUES (?, ?, ?, ?)
  `);
  insertEvent.run(
    "hackathon-2026",
    "2026 AI Hardware Hackathon",
    "2020-01-01T00:00:00.000Z",
    "2099-12-31T23:59:59.999Z",
  );

  const insertUser = database.prepare(`
    INSERT OR IGNORE INTO users (user_id, display_name, avatar, email, phone)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertUser.run("user-zhou", "周闻", "memoji-5", "zhou@example.test", "13800000001");
  insertUser.run("user-lin", "林澈", "memoji-4", "lin@example.test", "13800000002");
  insertUser.run("user-su", "苏晴", "memoji-1", "su@example.test", "13800000003");

  const insertProfile = database.prepare(`
    INSERT OR IGNORE INTO profiles (
      user_id, event_id, role, status, skills_json, collaboration_need, evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertProfile.run(
    "user-zhou",
    "hackathon-2026",
    "AI / 后端构建者",
    "团队缺人",
    JSON.stringify(["Agent", "API", "端侧 AI"]),
    "寻找硬件构建者",
    JSON.stringify(["GitHub · 本周 7 次提交"]),
  );
  insertProfile.run(
    "user-lin",
    "hackathon-2026",
    "硬件构建者",
    "未组队",
    JSON.stringify(["嵌入式", "IoT", "结构打样"]),
    "寻找 AI / 后端搭档",
    JSON.stringify(["做过 3 个 ESP32 端侧项目"]),
  );
  insertProfile.run(
    "user-su",
    "hackathon-2026",
    "交互设计师",
    "可交流",
    JSON.stringify(["交互", "视觉", "路演"]),
    "寻找有社会议题的项目",
    JSON.stringify(["两次黑客松最佳设计奖"]),
  );

  const insertVisibility = database.prepare(`
    INSERT OR IGNORE INTO visibility_grants (
      user_id, event_id, state, public_fields_json, starts_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertVisibility.run(
    "user-zhou",
    "hackathon-2026",
    "VISIBLE",
    JSON.stringify(ZHOU_PUBLIC_PROFILE_FIELDS),
    "2020-01-01T00:00:00.000Z",
    "2099-12-31T23:59:59.999Z",
  );
  insertVisibility.run(
    "user-lin",
    "hackathon-2026",
    "VISIBLE",
    JSON.stringify(ALL_PUBLIC_PROFILE_FIELDS),
    "2020-01-01T00:00:00.000Z",
    "2099-12-31T23:59:59.999Z",
  );
  insertVisibility.run(
    "user-su",
    "hackathon-2026",
    "PAUSED",
    JSON.stringify(ALL_PUBLIC_PROFILE_FIELDS),
    "2020-01-01T00:00:00.000Z",
    "2099-12-31T23:59:59.999Z",
  );

  const insertCard = database.prepare(`
    INSERT OR IGNORE INTO nfc_assets (card_id, opaque_token, owner_id, event_id, state)
    VALUES (?, ?, ?, ?, ?)
  `);
  // Fixed random-looking tokens keep the demo deterministic without leaking owner identity.
  insertCard.run("card-zhou", DEMO_CARD_TOKENS["card-zhou"], "user-zhou", "hackathon-2026", "ACTIVE");
  insertCard.run("card-lin", DEMO_CARD_TOKENS["card-lin"], "user-lin", "hackathon-2026", "ACTIVE");
  insertCard.run("card-su", DEMO_CARD_TOKENS["card-su"], "user-su", "hackathon-2026", "ACTIVE");
}

export function findPublicCardProfile(database, { opaqueToken, eventId, now }) {
  const row = database.prepare(`
    SELECT
      n.card_id,
      u.user_id,
      u.display_name,
      u.avatar,
      p.role,
      p.status,
      p.skills_json,
      p.collaboration_need,
      p.evidence_json,
      v.public_fields_json,
      e.event_id,
      e.name AS event_name
    FROM nfc_assets n
    JOIN users u ON u.user_id = n.owner_id
    JOIN profiles p ON p.user_id = n.owner_id AND p.event_id = n.event_id
    JOIN visibility_grants v ON v.user_id = n.owner_id AND v.event_id = n.event_id
    JOIN events e ON e.event_id = n.event_id
    WHERE n.opaque_token = ?
      AND n.event_id = ?
      AND n.state = 'ACTIVE'
      AND v.state = 'VISIBLE'
      AND v.starts_at <= ?
      AND v.expires_at > ?
      AND e.starts_at <= ?
      AND e.ends_at > ?
  `).get(opaqueToken, eventId, now, now, now, now);

  if (!row) return null;
  const availableProfile = {
    display_name: row.display_name,
    avatar: row.avatar,
    role: row.role,
    status: row.status,
    skills: JSON.parse(row.skills_json),
    collaboration_need: row.collaboration_need,
    evidence: JSON.parse(row.evidence_json),
  };
  const authorizedFields = new Set(JSON.parse(row.public_fields_json));
  const publicProfile = { user_id: row.user_id };
  for (const field of ALL_PUBLIC_PROFILE_FIELDS) {
    if (authorizedFields.has(field)) publicProfile[field] = availableProfile[field];
  }

  return {
    cardId: row.card_id,
    ownerId: row.user_id,
    event: { id: row.event_id, name: row.event_name },
    profile: publicProfile,
  };
}

export function appendEventLog(database, event) {
  database.prepare(`
    INSERT INTO event_logs (
      log_id, event_id, actor_id, event_type, object_type, object_id,
      source, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    event.eventId,
    event.actorId ?? null,
    event.type,
    event.objectType,
    event.objectId,
    event.source,
    JSON.stringify(event.payload ?? {}),
    event.createdAt,
  );
}

export function userExists(database, userId) {
  return Boolean(
    database.prepare("SELECT 1 FROM users WHERE user_id = ?").get(userId),
  );
}

export function isParticipantVisible(database, { userId, eventId, now }) {
  return Boolean(database.prepare(`
    SELECT 1
    FROM profiles p
    JOIN visibility_grants v ON v.user_id = p.user_id AND v.event_id = p.event_id
    JOIN events e ON e.event_id = p.event_id
    WHERE p.user_id = ?
      AND p.event_id = ?
      AND v.state = 'VISIBLE'
      AND v.starts_at <= ?
      AND v.expires_at > ?
      AND e.starts_at <= ?
      AND e.ends_at > ?
  `).get(userId, eventId, now, now, now, now));
}

function mapConnectionRequest(row) {
  if (!row) return null;
  return {
    id: row.request_id,
    requester_id: row.requester_id,
    recipient_id: row.recipient_id,
    event_id: row.event_id,
    source: row.source,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function findActiveConnectionRequest(
  database,
  { requesterId, recipientId, eventId },
) {
  return mapConnectionRequest(database.prepare(`
    SELECT * FROM connection_requests
    WHERE requester_id = ? AND recipient_id = ? AND event_id = ? AND status = 'REQUESTED'
  `).get(requesterId, recipientId, eventId));
}

export function createConnectionRequest(
  database,
  { requesterId, recipientId, eventId, source, now },
) {
  const request = {
    id: `req_${randomUUID()}`,
    requester_id: requesterId,
    recipient_id: recipientId,
    event_id: eventId,
    source,
    status: "REQUESTED",
    created_at: now,
    updated_at: now,
  };
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare(`
      INSERT INTO connection_requests (
        request_id, requester_id, recipient_id, event_id, source, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      request.id,
      request.requester_id,
      request.recipient_id,
      request.event_id,
      request.source,
      request.status,
      request.created_at,
      request.updated_at,
    );
    appendEventLog(database, {
      eventId,
      actorId: requesterId,
      type: "connection_requested",
      objectType: "connection_request",
      objectId: request.id,
      source,
      payload: {
        requester_id: requesterId,
        recipient_id: recipientId,
        event_id: eventId,
      },
      createdAt: now,
    });
    database.exec("COMMIT");
    return request;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function findConnectionRequestById(database, requestId) {
  return mapConnectionRequest(
    database.prepare("SELECT * FROM connection_requests WHERE request_id = ?").get(requestId),
  );
}

function mapConnection(row) {
  if (!row) return null;
  return {
    id: row.connection_id,
    request_id: row.request_id,
    event_id: row.event_id,
    members: [row.user_a_id, row.user_b_id],
    source: row.source,
    created_at: row.created_at,
  };
}

export function findConnectionById(database, connectionId) {
  return mapConnection(
    database.prepare("SELECT * FROM connections WHERE connection_id = ?").get(connectionId),
  );
}

export function findConnectionByRequestId(database, requestId) {
  return mapConnection(
    database.prepare("SELECT * FROM connections WHERE request_id = ?").get(requestId),
  );
}

export function findConnectionBetween(
  database,
  { firstUserId, secondUserId, eventId },
) {
  const [userAId, userBId] = [firstUserId, secondUserId].sort();
  return mapConnection(database.prepare(`
    SELECT * FROM connections
    WHERE event_id = ? AND user_a_id = ? AND user_b_id = ?
  `).get(eventId, userAId, userBId));
}

function appendConnectionAcceptedLog(
  database,
  { request, connectionId, actorId, now },
) {
  const latencyMs = Math.max(
    0,
    new Date(now).getTime() - new Date(request.created_at).getTime(),
  );
  appendEventLog(database, {
    eventId: request.event_id,
    actorId,
    type: "connection_accepted",
    objectType: "connection",
    objectId: connectionId,
    source: request.source,
    payload: { request_id: request.id, latency_ms: latencyMs },
    createdAt: now,
  });
}

export function acceptConnectionRequest(database, { requestId, actorId, now }) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const current = findConnectionRequestById(database, requestId);
    if (!current) {
      database.exec("ROLLBACK");
      return null;
    }
    if (current.status === "ACCEPTED") {
      const connection = findConnectionByRequestId(database, requestId)
        ?? findConnectionBetween(database, {
          firstUserId: current.requester_id,
          secondUserId: current.recipient_id,
          eventId: current.event_id,
        });
      database.exec("COMMIT");
      return { request: current, connection, idempotentReplay: true };
    }
    if (current.status !== "REQUESTED") {
      database.exec("ROLLBACK");
      return { request: current, connection: null, idempotentReplay: false };
    }

    database.prepare(`
      UPDATE connection_requests
      SET status = 'ACCEPTED', updated_at = ?
      WHERE request_id = ? AND status = 'REQUESTED'
    `).run(now, requestId);
    const members = [current.requester_id, current.recipient_id].sort();
    const existingConnection = findConnectionBetween(database, {
      firstUserId: members[0],
      secondUserId: members[1],
      eventId: current.event_id,
    });
    if (existingConnection) {
      const accepted = findConnectionRequestById(database, requestId);
      appendConnectionAcceptedLog(database, {
        request: accepted,
        connectionId: existingConnection.id,
        actorId,
        now,
      });
      database.exec("COMMIT");
      return {
        request: accepted,
        connection: existingConnection,
        idempotentReplay: true,
      };
    }

    const connectionId = `con_${randomUUID()}`;
    database.prepare(`
      INSERT INTO connections (
        connection_id, request_id, event_id, user_a_id, user_b_id, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      connectionId,
      requestId,
      current.event_id,
      members[0],
      members[1],
      current.source,
      now,
    );
    const accepted = findConnectionRequestById(database, requestId);
    const connection = findConnectionById(database, connectionId);
    appendConnectionAcceptedLog(database, {
      request: accepted,
      connectionId,
      actorId,
      now,
    });
    database.exec("COMMIT");
    return { request: accepted, connection, idempotentReplay: false };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
