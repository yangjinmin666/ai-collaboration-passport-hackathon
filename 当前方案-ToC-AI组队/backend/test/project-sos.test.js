import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("project SOS aid lifecycle", () => {
  let api;
  let baseUrl;
  let now;

  const headers = (userId) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
  });

  beforeEach(async () => {
    now = new Date("2026-08-29T08:00:00.000Z");
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => now,
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function createProject() {
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        event_id: "hackathon-2026",
        title: "离线会议洞察终端",
        summary: "把线下讨论自动沉淀为可执行任务",
        role_need: { title: "硬件构建者", skills: ["嵌入式"], capacity: 1 },
      }),
    });
    return (await response.json()).project.id;
  }

  test("an event participant can answer one structured SOS without joining the team", async () => {
    const projectId = await createProject();
    const created = await fetch(`${baseUrl}/api/projects/${projectId}/sos`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        category: "部署/API",
        problem: "ESP32 数据已经产生，但手机端无法稳定收到局域网上报",
        context: "Node 24 + HTTP API + 同一活动 Wi-Fi",
        attempts: ["固定端口", "关闭系统代理"],
        required_skills: ["网络调试", "Node.js"],
        estimated_minutes: 30,
        location_label: "路演区 B12",
        deadline: "2026-08-29T10:00:00.000Z",
        resolution_criteria: "连续完成 10 次上报且无丢包",
        reward_intent: {
          type: "PAID_INTENT",
          currency: "CNY",
          amount: 200,
          delivery_standard: "完成抓包定位并让 10 次上报全部通过",
          payment_note: "发布者线下验收后自行结算，RALLY 不托管或担保",
        },
      }),
    });
    const createdBody = await created.json();
    assert.equal(created.status, 201);
    assert.equal(createdBody.sos.status, "OPEN");
    assert.equal(createdBody.sos.reward_intent.payment_state, "NOT_PROCESSED");

    const sosId = createdBody.sos.id;
    const feed = await fetch(`${baseUrl}/api/events/hackathon-2026/sos`, {
      headers: headers("user-su"),
    });
    assert.equal(feed.status, 200);
    assert.equal((await feed.json()).sos[0].id, sosId);

    const responded = await fetch(`${baseUrl}/api/sos/${sosId}/responses`, {
      method: "POST",
      headers: headers("user-su"),
      body: JSON.stringify({
        message: "我可以先抓包定位广播与端口问题",
        available_minutes: 40,
      }),
    });
    const responseBody = await responded.json();
    assert.equal(responded.status, 201);
    assert.equal(responseBody.response.status, "PENDING");

    const accepted = await fetch(
      `${baseUrl}/api/sos-responses/${responseBody.response.id}`,
      {
        method: "PATCH",
        headers: headers("user-zhou"),
        body: JSON.stringify({ action: "accept" }),
      },
    );
    const acceptedBody = await accepted.json();
    assert.equal(accepted.status, 200);
    assert.equal(acceptedBody.sos.status, "CLAIMED");
    assert.equal(acceptedBody.response.status, "ACCEPTED");
    assert.equal(acceptedBody.project_membership_created, false);

    const withdrawn = await fetch(
      `${baseUrl}/api/sos-responses/${responseBody.response.id}`,
      {
        method: "PATCH",
        headers: headers("user-su"),
        body: JSON.stringify({ action: "withdraw", reason: "现场临时需要处理自己的设备故障" }),
      },
    );
    const withdrawnBody = await withdrawn.json();
    assert.equal(withdrawn.status, 200);
    assert.equal(withdrawnBody.sos.status, "OPEN");
    assert.equal(withdrawnBody.response.status, "WITHDRAWN");
    assert.equal(withdrawnBody.response.withdraw_reason.includes("设备故障"), true);

    const offeredAgain = await fetch(`${baseUrl}/api/sos/${sosId}/responses`, {
      method: "POST",
      headers: headers("user-su"),
      body: JSON.stringify({
        message: "故障已排除，我可以重新支援",
        available_minutes: 30,
      }),
    });
    assert.equal((await offeredAgain.json()).response.status, "PENDING");
    const acceptedAgain = await fetch(
      `${baseUrl}/api/sos-responses/${responseBody.response.id}`,
      {
        method: "PATCH",
        headers: headers("user-zhou"),
        body: JSON.stringify({ action: "accept" }),
      },
    );
    assert.equal((await acceptedAgain.json()).sos.status, "CLAIMED");

    const resolved = await fetch(`${baseUrl}/api/sos/${sosId}`, {
      method: "PATCH",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        action: "resolve",
        resolution_note: "修正广播地址并把客户端心跳改为 15 秒后，10 次上报全部成功",
      }),
    });
    const resolvedBody = await resolved.json();
    assert.equal(resolved.status, 200);
    assert.equal(resolvedBody.sos.status, "RESOLVED");
    assert.equal(resolvedBody.sos.resolution_note.includes("10 次上报"), true);

    const activeAfterResolution = await fetch(
      `${baseUrl}/api/events/hackathon-2026/sos`,
      { headers: headers("user-su") },
    );
    assert.deepEqual((await activeAfterResolution.json()).sos, []);
  });

  test("an overdue claimed SOS expires, allows replacement, and supports close then reopen", async () => {
    const projectId = await createProject();
    const payload = {
      category: "部署/API",
      problem: "接口联调阻塞",
      context: "现场网络不稳定",
      attempts: ["重试"],
      required_skills: ["网络调试"],
      estimated_minutes: 30,
      location_label: "B12",
      deadline: "2026-08-29T10:00:00.000Z",
      resolution_criteria: "连续通过 10 次请求",
    };
    const created = await fetch(`${baseUrl}/api/projects/${projectId}/sos`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify(payload),
    });
    const sosId = (await created.json()).sos.id;
    const offered = await fetch(`${baseUrl}/api/sos/${sosId}/responses`, {
      method: "POST",
      headers: headers("user-su"),
      body: JSON.stringify({ message: "我来排查", available_minutes: 30 }),
    });
    const responseId = (await offered.json()).response.id;
    assert.equal((await fetch(`${baseUrl}/api/sos-responses/${responseId}`, {
      method: "PATCH",
      headers: headers("user-zhou"),
      body: JSON.stringify({ action: "accept" }),
    })).status, 200);

    now = new Date("2026-08-29T10:00:00.001Z");
    const feed = await fetch(`${baseUrl}/api/events/hackathon-2026/sos`, {
      headers: headers("user-su"),
    });
    assert.deepEqual((await feed.json()).sos, []);

    const replacement = await fetch(`${baseUrl}/api/projects/${projectId}/sos`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({ ...payload, deadline: "2026-08-29T11:00:00.000Z" }),
    });
    assert.equal(replacement.status, 201);
    const replacementId = (await replacement.json()).sos.id;
    const closed = await fetch(`${baseUrl}/api/sos/${replacementId}`, {
      method: "PATCH",
      headers: headers("user-zhou"),
      body: JSON.stringify({ action: "close", resolution_note: "暂时改走离线方案" }),
    });
    assert.equal((await closed.json()).sos.status, "CLOSED");
    const reopened = await fetch(`${baseUrl}/api/sos/${replacementId}`, {
      method: "PATCH",
      headers: headers("user-zhou"),
      body: JSON.stringify({ action: "reopen" }),
    });
    assert.equal((await reopened.json()).sos.status, "OPEN");
  });

  test("event policy can disable paid aid intent without enabling platform payment", async () => {
    await api.stop();
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => now,
      eventPolicyOverrides: {
        "hackathon-2026": { paid_aid_enabled: false },
      },
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
    const projectId = await createProject();
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/sos`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        category: "部署/API",
        problem: "接口联调阻塞",
        context: "现场网络不稳定",
        attempts: ["重试"],
        required_skills: ["网络调试"],
        estimated_minutes: 30,
        location_label: "B12",
        deadline: "2026-08-29T10:00:00.000Z",
        resolution_criteria: "连续通过 10 次请求",
        reward_intent: {
          type: "PAID_INTENT",
          currency: "CNY",
          amount: 200,
          delivery_standard: "连续通过 10 次请求",
          payment_note: "线下验收后自行结算",
        },
      }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "PAID_AID_DISABLED");

    const events = await fetch(`${baseUrl}/api/events`, {
      headers: headers("user-zhou"),
    });
    assert.equal((await events.json()).events[0].collaboration_policy.paid_aid_enabled, false);
  });

  test("disabling paid aid stops new responses to an existing paid SOS", async () => {
    const directory = mkdtempSync(join(tmpdir(), "rally-paid-policy-"));
    const databasePath = join(directory, "policy.sqlite");
    let policyApi;
    try {
      policyApi = createApi({
        databasePath,
        allowInsecureDemoAuth: true,
        clock: () => now,
      });
      let address = await policyApi.start(0);
      let policyBaseUrl = `http://127.0.0.1:${address.port}`;
      const project = await fetch(`${policyBaseUrl}/api/projects`, {
        method: "POST",
        headers: headers("user-zhou"),
        body: JSON.stringify({
          event_id: "hackathon-2026",
          title: "现场网络救援",
          summary: "解决最后一公里联调",
          role_need: { title: "网络调试", skills: ["抓包"], capacity: 1 },
        }),
      });
      const projectId = (await project.json()).project.id;
      const created = await fetch(`${policyBaseUrl}/api/projects/${projectId}/sos`, {
        method: "POST",
        headers: headers("user-zhou"),
        body: JSON.stringify({
          category: "部署/API",
          problem: "现场接口仍不稳定",
          context: "已有可复现请求",
          attempts: ["重试"],
          required_skills: ["网络调试"],
          estimated_minutes: 30,
          location_label: "B12",
          deadline: "2026-08-29T10:00:00.000Z",
          resolution_criteria: "连续通过 10 次请求",
          reward_intent: {
            type: "PAID_INTENT",
            currency: "CNY",
            amount: 200,
            delivery_standard: "连续通过 10 次请求",
            payment_note: "发布者线下验收后自行结算",
          },
        }),
      });
      assert.equal(created.status, 201);
      const sosId = (await created.json()).sos.id;
      await policyApi.stop();

      policyApi = createApi({
        databasePath,
        allowInsecureDemoAuth: true,
        clock: () => now,
        eventPolicyOverrides: {
          "hackathon-2026": { paid_aid_enabled: false },
        },
      });
      address = await policyApi.start(0);
      policyBaseUrl = `http://127.0.0.1:${address.port}`;
      const response = await fetch(`${policyBaseUrl}/api/sos/${sosId}/responses`, {
        method: "POST",
        headers: headers("user-su"),
        body: JSON.stringify({ message: "我可以处理", available_minutes: 30 }),
      });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, "PAID_AID_DISABLED");
    } finally {
      if (policyApi) await policyApi.stop();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
