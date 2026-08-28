import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("legacy demo database migration", () => {
  let api;
  let baseUrl;
  let temporaryDirectory;

  before(async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "rally-"));
    const databasePath = join(temporaryDirectory, "legacy.sqlite");
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      CREATE TABLE visibility_grants (
        user_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        state TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        PRIMARY KEY (user_id, event_id)
      );
      CREATE TABLE nfc_assets (
        card_id TEXT PRIMARY KEY,
        opaque_token TEXT NOT NULL UNIQUE,
        owner_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        state TEXT NOT NULL
      );
      CREATE TABLE events (
        event_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL
      );
      CREATE TABLE connection_requests (
        request_id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE connections (
        connection_id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL UNIQUE,
        event_id TEXT NOT NULL,
        user_a_id TEXT NOT NULL,
        user_b_id TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      INSERT INTO visibility_grants VALUES
        ('user-zhou', 'hackathon-2026', 'VISIBLE', '2020-01-01', '2099-01-01'),
        ('user-lin', 'hackathon-2026', 'VISIBLE', '2020-01-01', '2099-01-01'),
        ('user-su', 'hackathon-2026', 'PAUSED', '2020-01-01', '2099-01-01');
      INSERT INTO nfc_assets VALUES
        ('card-zhou', 'tok_zhou_demo', 'user-zhou', 'hackathon-2026', 'ACTIVE'),
        ('card-lin', 'tok_lin_demo', 'user-lin', 'hackathon-2026', 'ACTIVE'),
        ('card-su', 'tok_su_paused', 'user-su', 'hackathon-2026', 'ACTIVE');
      INSERT INTO events VALUES
        ('hackathon-2026', 'Legacy Hackathon', '2020-01-01T00:00:00.000Z', '2099-12-31T23:59:59.999Z');
      INSERT INTO connection_requests VALUES
        ('req_legacy_pending', 'user-zhou', 'user-lin', 'hackathon-2026', 'link', 'REQUESTED', '2026-08-28T00:00:00.000Z', '2026-08-28T00:00:00.000Z'),
        ('req_oldest', 'user-zhou', 'user-lin', 'hackathon-2026', 'nfc', 'ACCEPTED', '2026-08-28T00:00:00.000Z', '2026-08-28T01:00:00.000Z'),
        ('req_reciprocal', 'user-lin', 'user-zhou', 'hackathon-2026', 'qr', 'ACCEPTED', '2026-08-28T00:30:00.000Z', '2026-08-28T01:30:00.000Z'),
        ('req_duplicate', 'user-zhou', 'user-lin', 'hackathon-2026', 'qr', 'ACCEPTED', '2026-08-28T01:30:00.000Z', '2026-08-28T02:00:00.000Z');
      INSERT INTO connections VALUES
        ('con_oldest', 'req_oldest', 'hackathon-2026', 'user-lin', 'user-zhou', 'nfc', '2026-08-28T01:00:00.000Z'),
        ('con_duplicate', 'req_duplicate', 'hackathon-2026', 'user-lin', 'user-zhou', 'qr', '2026-08-28T02:00:00.000Z');
    `);
    legacy.close();

    api = createApi({
      databasePath,
      allowInsecureDemoAuth: true,
      clock: () => new Date("2026-08-29T00:00:00.001Z"),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await api.stop();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  test("old tokens and duplicate pair data upgrade without blocking startup", async () => {
    const newCard = await fetch(
      `${baseUrl}/c/cp_7mJ4Qv9N2xK8Rt5W?event=hackathon-2026&src=nfc`,
    );
    const newCardBody = await newCard.json();
    assert.equal(newCard.status, 200);
    assert.equal("collaboration_need" in newCardBody.profile, false);
    assert.equal("evidence" in newCardBody.profile, false);

    const oldCard = await fetch(
      `${baseUrl}/c/tok_zhou_demo?event=hackathon-2026&src=nfc`,
    );
    assert.equal(oldCard.status, 404);

    const existingPair = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-user-id": "user-zhou",
      },
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
      }),
    });
    const existingPairBody = await existingPair.json();
    assert.equal(existingPair.status, 200);
    assert.equal(existingPairBody.connection.id, "con_oldest");
    assert.equal(existingPairBody.connection.consent_mode, "recipient_confirmed");
  });

  test("legacy pending requests retain the 24-hour expiry ceiling", async () => {
    const inbox = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=incoming`,
      { headers: { "x-demo-user-id": "user-lin" } },
    );
    const inboxBody = await inbox.json();
    const migrated = inboxBody.requests.find(
      (request) => request.id === "req_legacy_pending",
    );
    assert.equal(inbox.status, 200);
    assert.equal(migrated.status, "EXPIRED");
    assert.equal(migrated.expires_at, "2026-08-29T00:00:00.000Z");
  });

  test("legacy reciprocal acceptance is linked without attaching an archived duplicate", async () => {
    const zhouOutgoing = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing`,
      { headers: { "x-demo-user-id": "user-zhou" } },
    );
    const zhouBody = await zhouOutgoing.json();
    const keeper = zhouBody.requests.find((request) => request.id === "req_oldest");
    const archived = zhouBody.requests.find(
      (request) => request.id === "req_duplicate",
    );
    assert.equal(keeper.connection_id, "con_oldest");
    assert.equal(archived.connection_id, null);

    const linOutgoing = await fetch(
      `${baseUrl}/api/connections/requests?event_id=hackathon-2026&direction=outgoing`,
      { headers: { "x-demo-user-id": "user-lin" } },
    );
    const linBody = await linOutgoing.json();
    const reciprocal = linBody.requests.find(
      (request) => request.id === "req_reciprocal",
    );
    assert.equal(reciprocal.connection_id, "con_oldest");
  });
});

test("minimum-profile migration never expands an existing visibility grant", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rally-privacy-"));
  const databasePath = join(directory, "existing.sqlite");
  let api = createApi({
    databasePath,
    allowInsecureDemoAuth: true,
    clock: () => new Date("2026-08-29T05:00:00.000Z"),
  });
  await api.start(0);
  await api.stop();

  const existing = new DatabaseSync(databasePath);
  existing.prepare(`
    UPDATE visibility_grants SET public_fields_json = '["display_name"]'
    WHERE user_id = 'user-lin' AND event_id = 'hackathon-2026'
  `).run();
  existing.prepare(`
    DELETE FROM schema_migrations
    WHERE migration_id = '20260829_minimum_collaboration_profiles'
  `).run();
  existing.close();

  try {
    api = createApi({
      databasePath,
      allowInsecureDemoAuth: true,
      clock: () => new Date("2026-08-29T05:00:00.000Z"),
    });
    const address = await api.start(0);
    const response = await fetch(
      `http://127.0.0.1:${address.port}/c/cp_B3kP8sT6yH2nV9qL?event=hackathon-2026&src=nfc`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).profile, {
      user_id: "user-lin",
      display_name: "林澈",
    });
  } finally {
    await api.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
