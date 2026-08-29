import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("human-confirmed COSPAN Space starter pack", () => {
  let api;
  let baseUrl;

  const headers = (userId, extra = {}) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
    ...extra,
  });

  beforeEach(async () => {
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => new Date("2026-08-29T07:00:00.000Z"),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function createTeam() {
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
    await fetch(`${baseUrl}/api/connections/requests/${request.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    const projectResponse = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        event_id: "hackathon-2026",
        title: "离线会议洞察终端",
        summary: "把线下讨论自动沉淀为可执行任务",
        role_need: { title: "技术构建者", skills: ["工程实现"], capacity: 2 },
      }),
    });
    const project = await projectResponse.json();
    const invited = await fetch(`${baseUrl}/api/projects/${project.project.id}/invitations`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        invitee_id: "user-lin",
        role_need_id: project.role_needs[0].id,
      }),
    });
    const invitation = (await invited.json()).invitation;
    await fetch(`${baseUrl}/api/team-invitations/${invitation.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    return {
      projectId: project.project.id,
      roleNeedId: project.role_needs[0].id,
    };
  }

  test("Agent suggestions stay proposals until people claim tasks and all members confirm", async () => {
    const { projectId, roleNeedId } = await createTeam();
    const generated = await fetch(`${baseUrl}/api/projects/${projectId}/starter-pack`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({}),
    });
    const generatedBody = await generated.json();
    assert.equal(generated.status, 201);
    assert.equal(generatedBody.starter_pack.status, "PROPOSED");
    assert.equal(generatedBody.starter_pack.generated_by, "TEMPLATE_FALLBACK");
    assert.equal(generatedBody.tasks.length, 3);
    assert.equal(generatedBody.tasks.every((task) => task.confirmed_owner_id === null), true);

    const preferredTask = generatedBody.tasks[2];
    const claimed = await fetch(`${baseUrl}/api/tasks/${preferredTask.id}`, {
      method: "PATCH",
      headers: headers("user-lin", { "x-cospan-surface": "desktop" }),
      body: JSON.stringify({ action: "claim" }),
    });
    const claimedBody = await claimed.json();
    assert.equal(claimed.status, 200);
    assert.equal(claimedBody.task.confirmed_owner_id, "user-lin");
    assert.equal(claimedBody.task.status, "ACCEPTED");

    const prematureStart = await fetch(`${baseUrl}/api/tasks/${preferredTask.id}`, {
      method: "PATCH",
      headers: headers("user-lin", { "x-cospan-surface": "desktop" }),
      body: JSON.stringify({ action: "start" }),
    });
    assert.equal(prematureStart.status, 409);
    assert.equal((await prematureStart.json()).error.code, "PLAN_NOT_CONFIRMED");

    const firstConfirmation = await fetch(
      `${baseUrl}/api/projects/${projectId}/plan-confirmations`,
      {
        method: "POST",
        headers: headers("user-zhou", { "x-cospan-surface": "desktop" }),
        body: "{}",
      },
    );
    const firstBody = await firstConfirmation.json();
    assert.equal(firstBody.starter_pack.status, "PROPOSED");
    assert.deepEqual(firstBody.confirmation_progress, { confirmed: 1, required: 2 });

    const finalConfirmation = await fetch(
      `${baseUrl}/api/projects/${projectId}/plan-confirmations`,
      {
        method: "POST",
        headers: headers("user-lin", { "x-cospan-surface": "mobile" }),
        body: "{}",
      },
    );
    const finalBody = await finalConfirmation.json();
    assert.equal(finalBody.starter_pack.status, "CONFIRMED");
    assert.deepEqual(finalBody.confirmation_progress, { confirmed: 2, required: 2 });

    const room = await fetch(`${baseUrl}/api/projects/${projectId}/room`, {
      headers: headers("user-lin"),
    });
    const roomBody = await room.json();
    assert.equal(room.status, 200);
    assert.equal(roomBody.starter_pack.status, "CONFIRMED");
    assert.equal(roomBody.tasks.find((task) => task.id === preferredTask.id).status, "ACCEPTED");
    assert.equal(roomBody.activity.some((item) => item.event_type === "task_claimed"), true);
    assert.equal(roomBody.activity.some((item) => item.event_type === "plan_confirmed"), true);
    assert.equal(roomBody.activity.some(
      (item) => item.event_type === "task_claimed" && item.source === "desktop"
    ), true);
    assert.equal(roomBody.activity.some(
      (item) => item.event_type === "plan_confirmation_recorded" && item.source === "desktop"
    ), true);
    assert.equal(roomBody.activity.some(
      (item) => item.event_type === "plan_confirmation_recorded" && item.source === "mobile"
    ), true);

    const started = await fetch(`${baseUrl}/api/tasks/${preferredTask.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "start" }),
    });
    assert.equal(started.status, 200);
    const reclaimed = await fetch(`${baseUrl}/api/tasks/${preferredTask.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "claim" }),
    });
    assert.equal(reclaimed.status, 409);
    assert.equal((await reclaimed.json()).error.code, "TASK_ALREADY_STARTED");

    const visibleSu = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({
        state: "VISIBLE",
        expires_at: "2026-08-29T23:00:00.000Z",
      }),
    });
    assert.equal(visibleSu.status, 200);
    const suRequest = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        recipient_id: "user-su",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    const suRequestId = (await suRequest.json()).request.id;
    assert.equal((await fetch(`${baseUrl}/api/connections/requests/${suRequestId}`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({ action: "accept" }),
    })).status, 200);
    const suInvitation = await fetch(`${baseUrl}/api/projects/${projectId}/invitations`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({ invitee_id: "user-su", role_need_id: roleNeedId }),
    });
    const suInvitationId = (await suInvitation.json()).invitation.id;
    assert.equal((await fetch(`${baseUrl}/api/team-invitations/${suInvitationId}`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({ action: "accept" }),
    })).status, 200);

    const reopenedRoom = await fetch(`${baseUrl}/api/projects/${projectId}/room`, {
      headers: headers("user-su"),
    });
    const reopenedBody = await reopenedRoom.json();
    assert.equal(reopenedBody.starter_pack.status, "PROPOSED");
    assert.deepEqual(reopenedBody.confirmation_progress, { confirmed: 0, required: 3 });
    assert.equal(reopenedBody.activity.some((item) => item.event_type === "plan_reopened_for_member"), true);
  });
});
