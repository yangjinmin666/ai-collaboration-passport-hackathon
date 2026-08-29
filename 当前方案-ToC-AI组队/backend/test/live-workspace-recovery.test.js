import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("live mobile workspace recovery", () => {
  let api;
  let baseUrl;

  const headers = (userId) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
  });

  const request = async (path, userId, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { ...headers(userId), ...options.headers },
    });
    return { response, body: response.status === 204 ? null : await response.json() };
  };

  beforeEach(async () => {
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => new Date("2026-08-29T08:00:00.000Z"),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => api.stop());

  test("a recipient can recover an invitation and both members can recover the joined project", async () => {
    const requested = await request("/api/connections/requests", "user-zhou", {
      method: "POST",
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "link",
      }),
    });
    await request(`/api/connections/requests/${requested.body.request.id}`, "user-lin", {
      method: "PATCH",
      body: JSON.stringify({ action: "accept" }),
    });

    const created = await request("/api/projects", "user-zhou", {
      method: "POST",
      body: JSON.stringify({
        event_id: "hackathon-2026",
        title: "离线会议洞察终端",
        summary: "把线下讨论自动沉淀为可执行任务",
        role_need: { title: "硬件构建者", skills: ["嵌入式"], capacity: 1 },
      }),
    });
    const projectId = created.body.project.id;
    const roleNeedId = created.body.role_needs[0].id;
    const invited = await request(`/api/projects/${projectId}/invitations`, "user-zhou", {
      method: "POST",
      body: JSON.stringify({ invitee_id: "user-lin", role_need_id: roleNeedId }),
    });

    const inbox = await request(
      "/api/team-invitations?event_id=hackathon-2026&direction=incoming&status=PENDING",
      "user-lin",
    );
    assert.equal(inbox.response.status, 200);
    assert.equal(inbox.body.invitations.length, 1);
    assert.deepEqual(inbox.body.invitations[0], {
      ...inbox.body.invitations[0],
      id: invited.body.invitation.id,
      project: {
        id: projectId,
        title: "离线会议洞察终端",
        summary: "把线下讨论自动沉淀为可执行任务",
        status: "FORMING",
      },
      counterpart: {
        id: "user-zhou",
        display_name: "周闻",
        avatar: "memoji-5",
      },
      role_need: {
        id: roleNeedId,
        title: "硬件构建者",
        skills: ["嵌入式"],
      },
    });

    await request(`/api/team-invitations/${invited.body.invitation.id}`, "user-lin", {
      method: "PATCH",
      body: JSON.stringify({ action: "accept" }),
    });

    for (const userId of ["user-zhou", "user-lin"]) {
      const projects = await request(
        "/api/projects?event_id=hackathon-2026",
        userId,
      );
      assert.equal(projects.response.status, 200);
      assert.equal(projects.body.projects.length, 1);
      assert.equal(projects.body.projects[0].id, projectId);
      assert.deepEqual(
        projects.body.projects[0].members.map((member) => member.user_id).sort(),
        ["user-lin", "user-zhou"],
      );
      assert.equal(projects.body.projects[0].my_membership.membership_role,
        userId === "user-zhou" ? "ORIGINATOR" : "MEMBER");
    }
  });
});
