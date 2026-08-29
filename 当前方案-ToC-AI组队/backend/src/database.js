import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const ALL_PUBLIC_PROFILE_FIELDS = [
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
];
const DEMO_CARD_TOKENS = {
  "card-zhou": "cp_7mJ4Qv9N2xK8Rt5W",
  "card-lin": "cp_B3kP8sT6yH2nV9qL",
  "card-su": "cp_F6wR1cZ8mN4jX2pD",
};
const ZHOU_PUBLIC_PROFILE_FIELDS = ALL_PUBLIC_PROFILE_FIELDS.filter(
  (field) => !["collaboration_need", "evidence", "platform_links"].includes(field),
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

    CREATE UNIQUE INDEX IF NOT EXISTS users_by_phone
      ON users (phone) WHERE phone IS NOT NULL;

    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE INDEX IF NOT EXISTS auth_sessions_by_user
      ON auth_sessions (user_id, expires_at);

    CREATE TABLE IF NOT EXISTS otp_challenges (
      challenge_id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      display_name TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts_remaining INTEGER NOT NULL,
      request_ip TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS otp_challenges_by_phone
      ON otp_challenges (phone, created_at);

    CREATE INDEX IF NOT EXISTS otp_challenges_by_ip
      ON otp_challenges (request_ip, created_at);

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
      interests_json TEXT NOT NULL DEFAULT '[]',
      availability TEXT NOT NULL DEFAULT '',
      collaboration_preferences_json TEXT NOT NULL DEFAULT '[]',
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
      message TEXT CHECK (message IS NULL OR length(message) <= 240),
      expires_at TEXT NOT NULL,
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
      consent_mode TEXT NOT NULL DEFAULT 'recipient_confirmed'
        CHECK (consent_mode IN ('recipient_confirmed', 'physical_mutual')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED')),
      blocked_at TEXT,
      blocked_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES connection_requests(request_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id),
      FOREIGN KEY (user_a_id) REFERENCES users(user_id),
      FOREIGN KEY (user_b_id) REFERENCES users(user_id),
      FOREIGN KEY (blocked_by) REFERENCES users(user_id),
      CHECK (user_a_id < user_b_id)
    );

    CREATE TABLE IF NOT EXISTS connection_request_connections (
      request_id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      linked_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES connection_requests(request_id),
      FOREIGN KEY (connection_id) REFERENCES connections(connection_id)
    );

    CREATE TABLE IF NOT EXISTS user_blocks (
      event_id TEXT NOT NULL,
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      source_request_id TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (event_id, blocker_id, blocked_id),
      FOREIGN KEY (event_id) REFERENCES events(event_id),
      FOREIGN KEY (blocker_id) REFERENCES users(user_id),
      FOREIGN KEY (blocked_id) REFERENCES users(user_id),
      FOREIGN KEY (source_request_id) REFERENCES connection_requests(request_id),
      CHECK (blocker_id <> blocked_id)
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
  const otpColumns = database.prepare("PRAGMA table_info(otp_challenges)").all();
  if (!otpColumns.some((column) => column.name === "request_ip")) {
    database.exec("ALTER TABLE otp_challenges ADD COLUMN request_ip TEXT NOT NULL DEFAULT 'unknown'");
  }
  const requestColumns = database
    .prepare("PRAGMA table_info(connection_requests)")
    .all();
  if (!requestColumns.some((column) => column.name === "message")) {
    database.exec(`
      ALTER TABLE connection_requests
      ADD COLUMN message TEXT
      CHECK (message IS NULL OR length(message) <= 240)
    `);
  }
  if (!requestColumns.some((column) => column.name === "expires_at")) {
    database.exec("ALTER TABLE connection_requests ADD COLUMN expires_at TEXT");
    database.exec(`
      UPDATE connection_requests
      SET expires_at = CASE
        WHEN (
          SELECT events.ends_at
          FROM events
          WHERE events.event_id = connection_requests.event_id
        ) IS NULL THEN strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+24 hours')
        WHEN strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+24 hours') < (
          SELECT events.ends_at
          FROM events
          WHERE events.event_id = connection_requests.event_id
        ) THEN strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+24 hours')
        ELSE (
          SELECT events.ends_at
          FROM events
          WHERE events.event_id = connection_requests.event_id
        )
      END
      WHERE expires_at IS NULL
    `);
  }
  const connectionColumns = database
    .prepare("PRAGMA table_info(connections)")
    .all();
  if (!connectionColumns.some((column) => column.name === "status")) {
    database.exec(`
      ALTER TABLE connections
      ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'
      CHECK (status IN ('ACTIVE', 'BLOCKED'))
    `);
  }
  if (!connectionColumns.some((column) => column.name === "blocked_at")) {
    database.exec("ALTER TABLE connections ADD COLUMN blocked_at TEXT");
  }
  if (!connectionColumns.some((column) => column.name === "blocked_by")) {
    database.exec(`
      ALTER TABLE connections
      ADD COLUMN blocked_by TEXT REFERENCES users(user_id)
    `);
  }
  if (!connectionColumns.some((column) => column.name === "consent_mode")) {
    database.exec(`
      ALTER TABLE connections
      ADD COLUMN consent_mode TEXT NOT NULL DEFAULT 'recipient_confirmed'
      CHECK (consent_mode IN ('recipient_confirmed', 'physical_mutual'))
    `);
  }
  const profileColumns = new Set(
    database.prepare("PRAGMA table_info(profiles)").all().map((column) => column.name),
  );
  const profileMigrations = [
    ["interests_json", "TEXT NOT NULL DEFAULT '[]'"],
    ["availability", "TEXT NOT NULL DEFAULT ''"],
    ["collaboration_preferences_json", "TEXT NOT NULL DEFAULT '[]'"],
  ];
  for (const [name, definition] of profileMigrations) {
    if (!profileColumns.has(name)) database.exec(`ALTER TABLE profiles ADD COLUMN ${name} ${definition}`);
  }
  enforceUniqueConnectionPairs(database);
  backfillConnectionRequestConnections(database);
  seedDatabase(database);
  normalizeStoredPhoneNumbers(database);
  migrateDemoFixtures(database);
  migrateMinimumProfiles(database);
  return database;
}

function normalizeStoredPhoneNumbers(database) {
  database.prepare(`
    UPDATE users
    SET phone = '+86' || phone
    WHERE phone GLOB '1[3-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  `).run();
}

function backfillConnectionRequestConnections(database) {
  database.prepare(`
    INSERT OR IGNORE INTO connection_request_connections (
      request_id, connection_id, linked_at
    )
    SELECT request.request_id, connection.connection_id, connection.created_at
    FROM connections connection
    JOIN connection_requests request
      ON request.request_id = connection.request_id
  `).run();
  // Older versions represented reciprocal acceptance only through pair state.
  // A legitimate reciprocal request predates the keeper Connection; requests whose
  // own duplicate Connection was archived must remain unlinked rather than guessed.
  database.prepare(`
    INSERT OR IGNORE INTO connection_request_connections (
      request_id, connection_id, linked_at
    )
    SELECT request.request_id, connection.connection_id, connection.created_at
    FROM connection_requests request
    JOIN connections connection
      ON connection.event_id = request.event_id
      AND connection.user_a_id = CASE
        WHEN request.requester_id < request.recipient_id
          THEN request.requester_id
        ELSE request.recipient_id
      END
      AND connection.user_b_id = CASE
        WHEN request.requester_id < request.recipient_id
          THEN request.recipient_id
        ELSE request.requester_id
      END
    WHERE request.status = 'ACCEPTED'
      AND request.created_at <= connection.created_at
      AND NOT EXISTS (
        SELECT 1
        FROM archived_duplicate_connections archived
        WHERE archived.request_id = request.request_id
      )
  `).run();
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

function migrateMinimumProfiles(database) {
  const migrationId = "20260829_minimum_collaboration_profiles";
  if (database.prepare("SELECT 1 FROM schema_migrations WHERE migration_id = ?").get(migrationId)) {
    return;
  }
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE profiles SET status = '未组队' WHERE status = '正在找队伍'").run();
    database.prepare("UPDATE profiles SET status = '已组队但可交流' WHERE status = '可交流'").run();
    const updateDemo = database.prepare(`
      UPDATE profiles
      SET interests_json = ?, availability = ?, collaboration_preferences_json = ?
      WHERE user_id = ? AND event_id = 'hackathon-2026'
        AND interests_json = '[]' AND availability = ''
    `);
    updateDemo.run(
      JSON.stringify(["端侧 AI", "现场协作"]),
      "今天 18:00–24:00，可持续投入 6 小时",
      JSON.stringify(["快速原型", "结对协作"]),
      "user-zhou",
    );
    updateDemo.run(
      JSON.stringify(["端侧 AI", "智能硬件"]),
      "今天全天，可持续投入 8 小时",
      JSON.stringify(["快速原型", "现场联调"]),
      "user-lin",
    );
    updateDemo.run(
      JSON.stringify(["公共议题", "AI 硬件"]),
      "今天 14:00–22:00，可投入 5 小时",
      JSON.stringify(["用户测试", "结对协作"]),
      "user-su",
    );
    database.prepare(`
      INSERT INTO schema_migrations (migration_id, applied_at) VALUES (?, ?)
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
  insertUser.run("user-zhou", "周闻", "memoji-5", "zhou@example.test", "+8613800000001");
  insertUser.run("user-lin", "林澈", "memoji-4", "lin@example.test", "+8613800000002");
  insertUser.run("user-su", "苏晴", "memoji-1", "su@example.test", "+8613800000003");
  insertUser.run("user-mia", "米娅", "memoji-6", "mia@example.test", "+8613800000004");

  const insertProfile = database.prepare(`
    INSERT OR IGNORE INTO profiles (
      user_id, event_id, role, status, skills_json, interests_json, availability,
      collaboration_preferences_json, collaboration_need, evidence_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProfile.run(
    "user-zhou",
    "hackathon-2026",
    "AI / 后端构建者",
    "团队缺人",
    JSON.stringify(["Agent", "API", "端侧 AI"]),
    JSON.stringify(["端侧 AI", "现场协作"]),
    "今天 18:00–24:00，可持续投入 6 小时",
    JSON.stringify(["快速原型", "结对协作"]),
    "寻找硬件构建者",
    JSON.stringify(["GitHub · 本周 7 次提交"]),
  );
  insertProfile.run(
    "user-lin",
    "hackathon-2026",
    "硬件构建者",
    "未组队",
    JSON.stringify(["嵌入式", "IoT", "结构打样"]),
    JSON.stringify(["端侧 AI", "智能硬件"]),
    "今天全天，可持续投入 8 小时",
    JSON.stringify(["快速原型", "现场联调"]),
    "寻找 AI / 后端搭档",
    JSON.stringify(["做过 3 个 ESP32 端侧项目"]),
  );
  insertProfile.run(
    "user-su",
    "hackathon-2026",
    "交互设计师",
    "已组队但可交流",
    JSON.stringify(["交互", "视觉", "路演"]),
    JSON.stringify(["公共议题", "AI 硬件"]),
    "今天 14:00–22:00，可投入 5 小时",
    JSON.stringify(["用户测试", "结对协作"]),
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
      p.interests_json,
      p.availability,
      p.collaboration_preferences_json,
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
    interests: JSON.parse(row.interests_json),
    availability: row.availability,
    collaboration_preferences: JSON.parse(row.collaboration_preferences_json),
    collaboration_need: row.collaboration_need,
    evidence: JSON.parse(row.evidence_json),
    platform_links: database.prepare(`
      SELECT platform, url, verification_state, metadata_json
      FROM platform_links
      WHERE user_id = ?
      ORDER BY platform ASC
    `).all(row.user_id).map((link) => ({
      platform: link.platform,
      url: link.url,
      verification_state: link.verification_state,
      metadata: link.metadata_json ? JSON.parse(link.metadata_json) : null,
    })),
  };
  const authorizedFields = new Set(JSON.parse(row.public_fields_json));
  const publicProfile = { user_id: row.user_id };
  for (const field of ALL_PUBLIC_PROFILE_FIELDS) {
    if (
      authorizedFields.has(field)
      && (field !== "platform_links" || availableProfile.platform_links.length > 0)
    ) {
      publicProfile[field] = availableProfile[field];
    }
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

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function findUserIdentity(database, userId) {
  const row = database.prepare(`
    SELECT user_id, display_name, avatar
    FROM users
    WHERE user_id = ?
  `).get(userId);
  if (!row) return null;
  return {
    id: row.user_id,
    display_name: row.display_name,
    avatar: row.avatar,
  };
}

export function createAuthSession(database, { userId, now, expiresAt }) {
  const token = randomBytes(32).toString("base64url");
  database.prepare(`
    INSERT INTO auth_sessions (
      session_id, token_hash, user_id, created_at, expires_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, NULL)
  `).run(
    `ses_${randomUUID()}`,
    hashSessionToken(token),
    userId,
    now,
    expiresAt,
  );
  return { token, expiresAt };
}

export function createOtpChallenge(
  database,
  { challengeId, phone, displayName, codeHash, requestIp, now, expiresAt },
) {
  database.prepare(`
    INSERT INTO otp_challenges (
      challenge_id, phone, display_name, code_hash, attempts_remaining,
      request_ip, created_at, expires_at, consumed_at
    ) VALUES (?, ?, ?, ?, 5, ?, ?, ?, NULL)
  `).run(challengeId, phone, displayName, codeHash, requestIp, now, expiresAt);
}

export function deleteOtpChallenge(database, challengeId) {
  database.prepare(`
    DELETE FROM otp_challenges WHERE challenge_id = ? AND consumed_at IS NULL
  `).run(challengeId);
}

export function findLatestOtpChallengeAt(database, phone) {
  return database.prepare(`
    SELECT created_at FROM otp_challenges
    WHERE phone = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(phone)?.created_at ?? null;
}

export function readOtpPhoneWindow(database, { phone, since }) {
  const row = database.prepare(`
    SELECT count(*) AS challenge_count, min(created_at) AS oldest_created_at
    FROM otp_challenges
    WHERE phone = ? AND created_at > ?
  `).get(phone, since);
  return {
    count: Number(row.challenge_count),
    oldestCreatedAt: row.oldest_created_at ?? null,
  };
}

export function readOtpIpWindow(database, { requestIp, since }) {
  const row = database.prepare(`
    SELECT count(*) AS challenge_count, min(created_at) AS oldest_created_at
    FROM otp_challenges
    WHERE request_ip = ? AND created_at > ?
  `).get(requestIp, since);
  return {
    count: Number(row.challenge_count),
    oldestCreatedAt: row.oldest_created_at ?? null,
  };
}

export function findOtpChallenge(database, challengeId) {
  const row = database.prepare(`
    SELECT * FROM otp_challenges WHERE challenge_id = ?
  `).get(challengeId);
  if (!row) return null;
  return {
    id: row.challenge_id,
    phone: row.phone,
    displayName: row.display_name,
    codeHash: row.code_hash,
    attemptsRemaining: row.attempts_remaining,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

export function consumeOtpChallenge(database, { challengeId, now }) {
  return database.prepare(`
    UPDATE otp_challenges
    SET consumed_at = ?
    WHERE challenge_id = ?
      AND consumed_at IS NULL
      AND expires_at > ?
      AND attempts_remaining > 0
  `).run(now, challengeId, now).changes > 0;
}

export function recordOtpFailure(database, { challengeId, now }) {
  database.prepare(`
    UPDATE otp_challenges
    SET attempts_remaining = attempts_remaining - 1
    WHERE challenge_id = ?
      AND consumed_at IS NULL
      AND expires_at > ?
      AND attempts_remaining > 0
  `).run(challengeId, now);
}

export function findOrCreateOtpUser(
  database,
  { phone, displayName, eventId, now },
) {
  let row = database.prepare(`
    SELECT user_id FROM users WHERE phone = ?
  `).get(phone);
  const isNewUser = !row;
  if (!row) {
    const userId = `user_${randomUUID()}`;
    const avatarNumber = 1 + (
      Number.parseInt(createHash("sha256").update(phone).digest("hex").slice(0, 2), 16) % 10
    );
    database.prepare(`
      INSERT INTO users (user_id, display_name, avatar, email, phone)
      VALUES (?, ?, ?, NULL, ?)
    `).run(userId, displayName, `memoji-${avatarNumber}`, phone);
    row = { user_id: userId };
  }

  const event = database.prepare(`
    SELECT ends_at FROM events WHERE event_id = ? AND ends_at > ?
  `).get(eventId, now);
  if (event) {
    const insertedProfile = database.prepare(`
      INSERT OR IGNORE INTO profiles (
        user_id, event_id, role, status, skills_json, interests_json,
        availability, collaboration_preferences_json, collaboration_need,
        evidence_json
      ) VALUES (?, ?, '待完善协作资料', '未组队', '[]', '[]', '待补充', '[]', '', '[]')
    `).run(row.user_id, eventId);
    database.prepare(`
      INSERT OR IGNORE INTO visibility_grants (
        user_id, event_id, state, public_fields_json, starts_at, expires_at
      ) VALUES (?, ?, 'HIDDEN', '[]', ?, ?)
    `).run(row.user_id, eventId, now, event.ends_at);
    if (insertedProfile.changes > 0) {
      appendEventLog(database, {
        eventId,
        actorId: row.user_id,
        type: "event_joined",
        objectType: "profile",
        objectId: row.user_id,
        source: "mobile",
        payload: { event_id: eventId },
        createdAt: now,
      });
    }
  }

  return { userId: row.user_id, isNewUser };
}

export function findSessionUserId(database, { token, now }) {
  const row = database.prepare(`
    SELECT user_id
    FROM auth_sessions
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND expires_at > ?
  `).get(hashSessionToken(token), now);
  return row?.user_id ?? null;
}

export function revokeAuthSession(database, { token, now }) {
  const result = database.prepare(`
    UPDATE auth_sessions
    SET revoked_at = ?
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND expires_at > ?
  `).run(now, hashSessionToken(token), now);
  return result.changes > 0;
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

export function isConnectionBlocked(
  database,
  { firstUserId, secondUserId, eventId },
) {
  return Boolean(database.prepare(`
    SELECT 1
    FROM user_blocks
    WHERE event_id = ?
      AND (
        (blocker_id = ? AND blocked_id = ?)
        OR (blocker_id = ? AND blocked_id = ?)
      )
  `).get(
    eventId,
    firstUserId,
    secondUserId,
    secondUserId,
    firstUserId,
  ));
}

function mapConnectionRequest(row) {
  if (!row) return null;
  return {
    id: row.request_id,
    requester_id: row.requester_id,
    recipient_id: row.recipient_id,
    event_id: row.event_id,
    source: row.source,
    message: row.message ?? null,
    expires_at: row.expires_at,
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

export function findLatestConnectionRequest(
  database,
  { requesterId, recipientId, eventId, status },
) {
  return mapConnectionRequest(database.prepare(`
    SELECT *
    FROM connection_requests
    WHERE requester_id = ?
      AND recipient_id = ?
      AND event_id = ?
      AND status = ?
    ORDER BY updated_at DESC, request_id DESC
    LIMIT 1
  `).get(requesterId, recipientId, eventId, status));
}

export function countRecentConnectionRequests(
  database,
  { requesterId, eventId, since },
) {
  const row = database.prepare(`
    SELECT count(*) AS request_count
    FROM connection_requests
    WHERE requester_id = ?
      AND event_id = ?
      AND created_at >= ?
  `).get(requesterId, eventId, since);
  return Number(row.request_count);
}

export function createConnectionRequest(
  database,
  { requesterId, recipientId, eventId, source, message, expiresAt, now },
) {
  const request = {
    id: `req_${randomUUID()}`,
    requester_id: requesterId,
    recipient_id: recipientId,
    event_id: eventId,
    source,
    message: message ?? null,
    expires_at: expiresAt,
    status: "REQUESTED",
    created_at: now,
    updated_at: now,
  };
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare(`
      INSERT INTO connection_requests (
        request_id, requester_id, recipient_id, event_id, source, message,
        expires_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      request.id,
      request.requester_id,
      request.recipient_id,
      request.event_id,
      request.source,
      request.message,
      request.expires_at,
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

export function findEventEndsAt(database, eventId) {
  const row = database.prepare(
    "SELECT ends_at FROM events WHERE event_id = ?",
  ).get(eventId);
  return row?.ends_at ?? null;
}

export function expireConnectionRequests(database, { eventId, now }) {
  const staleRequests = database.prepare(`
    SELECT request.*
    FROM connection_requests request
    JOIN events event ON event.event_id = request.event_id
    WHERE request.event_id = ?
      AND request.status = 'REQUESTED'
      AND (request.expires_at <= ? OR event.ends_at <= ?)
  `).all(eventId, now, now);
  if (staleRequests.length === 0) return 0;

  database.exec("BEGIN IMMEDIATE");
  try {
    const expire = database.prepare(`
      UPDATE connection_requests
      SET status = 'EXPIRED', updated_at = ?
      WHERE request_id = ? AND status = 'REQUESTED'
    `);
    for (const request of staleRequests) {
      expire.run(now, request.request_id);
      appendEventLog(database, {
        eventId: request.event_id,
        type: "connection_expired",
        objectType: "connection_request",
        objectId: request.request_id,
        source: request.source,
        payload: {
          request_id: request.request_id,
          reason: "timeout_or_event_end",
        },
        createdAt: now,
      });
    }
    database.exec("COMMIT");
    return staleRequests.length;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function listConnectionRequests(
  database,
  { userId, eventId, direction, status },
) {
  const ownerColumn = direction === "incoming" ? "recipient_id" : "requester_id";
  const statusClause = status ? "AND request.status = ?" : "";
  const parameters = status
    ? [userId, eventId, status]
    : [userId, eventId];
  const rows = database.prepare(`
    SELECT
      request.*,
      counterpart.user_id AS counterpart_id,
      counterpart.display_name AS counterpart_display_name,
      counterpart.avatar AS counterpart_avatar,
      profile.role AS counterpart_role,
      profile.status AS counterpart_status,
      request_connection.connection_id
    FROM connection_requests request
    JOIN users counterpart
      ON counterpart.user_id = CASE
        WHEN ? = 'incoming' THEN request.requester_id
        ELSE request.recipient_id
      END
    LEFT JOIN profiles profile
      ON profile.user_id = counterpart.user_id
      AND profile.event_id = request.event_id
    LEFT JOIN connection_request_connections request_connection
      ON request_connection.request_id = request.request_id
    WHERE request.${ownerColumn} = ?
      AND request.event_id = ?
      ${statusClause}
    ORDER BY request.updated_at DESC, request.request_id DESC
  `).all(direction, ...parameters);

  return rows.map((row) => ({
    ...mapConnectionRequest(row),
    direction,
    connection_id: row.connection_id ?? null,
    counterpart: {
      id: row.counterpart_id,
      display_name: row.counterpart_display_name,
      avatar: row.counterpart_avatar,
      role: row.counterpart_role,
      status: row.counterpart_status,
    },
  }));
}

function linkConnectionRequest(
  database,
  { requestId, connectionId, linkedAt },
) {
  database.prepare(`
    INSERT OR IGNORE INTO connection_request_connections (
      request_id, connection_id, linked_at
    ) VALUES (?, ?, ?)
  `).run(requestId, connectionId, linkedAt);
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
    consent_mode: row.consent_mode,
    status: row.status,
    blocked_at: row.blocked_at ?? null,
    created_at: row.created_at,
  };
}

export function findConnectionById(database, connectionId) {
  return mapConnection(
    database.prepare("SELECT * FROM connections WHERE connection_id = ?").get(connectionId),
  );
}

export function findConnectionByRequestId(database, requestId) {
  return mapConnection(database.prepare(`
    SELECT connection.*
    FROM connection_request_connections request_connection
    JOIN connections connection
      ON connection.connection_id = request_connection.connection_id
    WHERE request_connection.request_id = ?
  `).get(requestId));
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

export function acceptConnectionRequest(
  database,
  { requestId, actorId, now, consentMode = "recipient_confirmed" },
) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const current = findConnectionRequestById(database, requestId);
    if (!current) {
      database.exec("ROLLBACK");
      return null;
    }
    if (current.status === "ACCEPTED") {
      const connection = findConnectionByRequestId(database, requestId);
      database.exec("COMMIT");
      return { request: current, connection, idempotentReplay: true };
    }
    if (current.status === "BLOCKED") {
      database.exec("COMMIT");
      return {
        request: current,
        connection: null,
        idempotentReplay: true,
        blocked: true,
      };
    }
    if (current.status !== "REQUESTED") {
      database.exec("ROLLBACK");
      return { request: current, connection: null, idempotentReplay: false };
    }
    if (isConnectionBlocked(database, {
      firstUserId: current.requester_id,
      secondUserId: current.recipient_id,
      eventId: current.event_id,
    })) {
      database.exec("ROLLBACK");
      return {
        request: current,
        connection: null,
        idempotentReplay: false,
        blocked: true,
      };
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
      linkConnectionRequest(database, {
        requestId,
        connectionId: existingConnection.id,
        linkedAt: now,
      });
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
        connection_id, request_id, event_id, user_a_id, user_b_id, source,
        consent_mode, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      connectionId,
      requestId,
      current.event_id,
      members[0],
      members[1],
      current.source,
      consentMode,
      now,
    );
    linkConnectionRequest(database, {
      requestId,
      connectionId,
      linkedAt: now,
    });
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

const PENDING_REQUEST_ACTIONS = {
  reject: {
    status: "REJECTED",
    eventType: "connection_rejected",
    buildPayload: (request, now) => ({
      request_id: request.id,
      latency_ms: Math.max(
        0,
        new Date(now).getTime() - new Date(request.created_at).getTime(),
      ),
    }),
  },
  cancel: {
    status: "CANCELLED",
    eventType: "connection_cancelled",
    buildPayload: (request) => ({ request_id: request.id }),
  },
};

function resolvePendingConnectionRequest(
  database,
  { requestId, actorId, action, now },
) {
  const resolution = PENDING_REQUEST_ACTIONS[action];
  database.exec("BEGIN IMMEDIATE");
  try {
    const current = findConnectionRequestById(database, requestId);
    if (!current) {
      database.exec("ROLLBACK");
      return null;
    }
    if (current.status === resolution.status) {
      database.exec("COMMIT");
      return { request: current, idempotentReplay: true };
    }
    if (current.status !== "REQUESTED") {
      database.exec("ROLLBACK");
      return { request: current, idempotentReplay: false };
    }

    database.prepare(`
      UPDATE connection_requests
      SET status = ?, updated_at = ?
      WHERE request_id = ? AND status = 'REQUESTED'
    `).run(resolution.status, now, requestId);
    const resolved = findConnectionRequestById(database, requestId);
    appendEventLog(database, {
      eventId: current.event_id,
      actorId,
      type: resolution.eventType,
      objectType: "connection_request",
      objectId: requestId,
      source: current.source,
      payload: resolution.buildPayload(current, now),
      createdAt: now,
    });
    database.exec("COMMIT");
    return { request: resolved, idempotentReplay: false };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function rejectConnectionRequest(database, parameters) {
  return resolvePendingConnectionRequest(database, {
    ...parameters,
    action: "reject",
  });
}

export function cancelConnectionRequest(database, parameters) {
  return resolvePendingConnectionRequest(database, {
    ...parameters,
    action: "cancel",
  });
}

export function blockConnectionRequest(
  database,
  { requestId, actorId, reasonCode, now },
) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const current = findConnectionRequestById(database, requestId);
    if (!current) {
      database.exec("ROLLBACK");
      return null;
    }
    if (![current.requester_id, current.recipient_id].includes(actorId)) {
      database.exec("ROLLBACK");
      return null;
    }

    const targetUserId = actorId === current.requester_id
      ? current.recipient_id
      : current.requester_id;
    const existingBlock = database.prepare(`
      SELECT 1
      FROM user_blocks
      WHERE event_id = ? AND blocker_id = ? AND blocked_id = ?
    `).get(current.event_id, actorId, targetUserId);
    const existingConnection = findConnectionBetween(database, {
      firstUserId: current.requester_id,
      secondUserId: current.recipient_id,
      eventId: current.event_id,
    });
    if (current.status === "BLOCKED" && existingBlock) {
      database.exec("COMMIT");
      return {
        request: current,
        connection: findConnectionByRequestId(database, requestId),
        idempotentReplay: true,
      };
    }

    const requestsToBlock = database.prepare(`
      SELECT request.request_id
      FROM connection_requests request
      WHERE request.event_id = ?
        AND (
          (request.requester_id = ? AND request.recipient_id = ?)
          OR (request.requester_id = ? AND request.recipient_id = ?)
        )
        AND (
          request.request_id = ?
          OR request.status = 'REQUESTED'
          OR (
            request.status = 'ACCEPTED'
            AND EXISTS (
              SELECT 1
              FROM connection_request_connections request_connection
              WHERE request_connection.request_id = request.request_id
            )
          )
        )
    `).all(
      current.event_id,
      current.requester_id,
      current.recipient_id,
      current.recipient_id,
      current.requester_id,
      requestId,
    );

    const markBlocked = database.prepare(`
      UPDATE connection_requests
      SET status = 'BLOCKED', updated_at = ?
      WHERE request_id = ?
    `);
    for (const request of requestsToBlock) {
      markBlocked.run(now, request.request_id);
    }
    database.prepare(`
      INSERT OR IGNORE INTO user_blocks (
        event_id, blocker_id, blocked_id, source_request_id, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      current.event_id,
      actorId,
      targetUserId,
      requestId,
      now,
    );
    database.prepare(`
      UPDATE connections
      SET status = 'BLOCKED',
          blocked_at = COALESCE(blocked_at, ?),
          blocked_by = COALESCE(blocked_by, ?)
      WHERE event_id = ?
        AND user_a_id = ?
        AND user_b_id = ?
    `).run(
      now,
      actorId,
      current.event_id,
      ...[current.requester_id, current.recipient_id].sort(),
    );
    const blocked = findConnectionRequestById(database, requestId);
    const connection = existingConnection
      ? findConnectionById(database, existingConnection.id)
      : null;
    if (connection) {
      const linkBlockedRequest = database.prepare(`
        INSERT OR IGNORE INTO connection_request_connections (
          request_id, connection_id, linked_at
        ) VALUES (?, ?, ?)
      `);
      for (const request of requestsToBlock) {
        linkBlockedRequest.run(request.request_id, connection.id, now);
      }
    }
    if (!existingBlock) {
      appendEventLog(database, {
        eventId: current.event_id,
        actorId,
        type: "user_blocked",
        objectType: "user",
        objectId: targetUserId,
        source: current.source,
        payload: {
          target_id: targetUserId,
          reason_code: reasonCode,
          request_id: requestId,
        },
        createdAt: now,
      });
    }
    database.exec("COMMIT");
    return {
      request: blocked,
      connection,
      idempotentReplay: Boolean(existingBlock),
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
