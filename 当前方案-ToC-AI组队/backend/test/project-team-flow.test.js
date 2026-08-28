import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("connection to confirmed project membership", () => {
  let api;
  let baseUrl;

  const headers = (userId) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
  });

  beforeEach(async () => {
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => new Date("2026-08-29T06:00:00.000Z"),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function connectZhouAndLin() {
    const requested = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
      }),
    });
    const request = (await requested.json()).request;
    const accepted = await fetch(`${baseUrl}/api/connections/requests/${request.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    assert.equal(accepted.status, 200);
  }

  test("only a connected participant can accept an invitation into an available role", async () => {
    await connectZhouAndLin();
    const created = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        event_id: "hackathon-2026",
        title: "离线会议洞察终端",
        summary: "把线下讨论自动沉淀为可执行任务",
        role_need: {
          title: "硬件构建者",
          skills: ["嵌入式", "IoT"],
          capacity: 1,
        },
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.project.originator_id, "user-zhou");
    assert.equal(createdBody.role_needs[0].remaining_capacity, 1);

    const projectId = createdBody.project.id;
    const roleNeedId = createdBody.role_needs[0].id;
    const unconnected = await fetch(`${baseUrl}/api/projects/${projectId}/invitations`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({ invitee_id: "user-su", role_need_id: roleNeedId }),
    });
    assert.equal(unconnected.status, 409);
    assert.equal((await unconnected.json()).error.code, "ACTIVE_CONNECTION_REQUIRED");

    const invited = await fetch(`${baseUrl}/api/projects/${projectId}/invitations`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({ invitee_id: "user-lin", role_need_id: roleNeedId }),
    });
    const invitation = (await invited.json()).invitation;
    assert.equal(invited.status, 201);
    assert.equal(invitation.status, "PENDING");

    const accepted = await fetch(`${baseUrl}/api/team-invitations/${invitation.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    const acceptedBody = await accepted.json();
    assert.equal(accepted.status, 200);
    assert.equal(acceptedBody.invitation.status, "ACCEPTED");
    assert.equal(acceptedBody.membership.user_id, "user-lin");
    assert.equal(acceptedBody.role_need.remaining_capacity, 0);

    const replay = await fetch(`${baseUrl}/api/team-invitations/${invitation.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).idempotent_replay, true);

    const project = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      headers: headers("user-lin"),
    });
    const projectBody = await project.json();
    assert.equal(project.status, 200);
    assert.deepEqual(projectBody.members.map((member) => member.user_id).sort(), [
      "user-lin",
      "user-zhou",
    ]);
  });
});
