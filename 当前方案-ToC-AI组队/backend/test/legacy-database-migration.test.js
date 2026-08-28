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
    temporaryDirectory = mkdtempSync(join(tmpdir(), "collaboration-passport-"));
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
      INSERT INTO connections VALUES
        ('con_oldest', 'req_oldest', 'hackathon-2026', 'user-lin', 'user-zhou', 'nfc', '2026-08-28T01:00:00.000Z'),
        ('con_duplicate', 'req_duplicate', 'hackathon-2026', 'user-lin', 'user-zhou', 'qr', '2026-08-28T02:00:00.000Z');
    `);
    legacy.close();

    api = createApi({ databasePath });
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
  });
});
