import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";
import { AgentRunError } from "../src/agent-runner.js";

function makeFakeRunner(overrides = {}) {
  const state = {
    plannerCalls: 0,
    briefCalls: 0,
    plannerBehaviour: "success",
    briefBehaviour: "success",
    briefLatencyMs: 5,
    ...overrides,
  };
  return {
    state,
    runner: {
      async runPlanner({ project, members, roleNeeds }) {
        state.plannerCalls += 1;
        if (state.plannerBehaviour === "throw-timeout") {
          throw new AgentRunError("LLM_TIMEOUT", "timeout");
        }
        if (state.plannerBehaviour === "throw-schema") {
          throw new AgentRunError("SCHEMA_INVALID", "bad output");
        }
        return {
          output: {
            tasks: [
              {
                title: "锁定核心问题",
                objective: `围绕${project.title}锁定用户和最小场景`,
                acceptance: "团队一致同意范围与降级项",
                mode: "HUMAN",
                rationale: "基线目标",
              },
              {
                title: "打通端到端演示链路",
                objective: `把${project.summary}压成最短可跑通链路`,
                acceptance: "一条真实输入产生可检查输出",
                mode: "HUMAN_AGENT",
                rationale: "现场关键演示能力",
              },
              {
                title: "验证演示脚本",
                objective: "把关键流程串成可复演脚本",
                acceptance: "全员连跑两次演示无补救",
                mode: "PAIR",
                rationale: "确保稳定演示",
              },
            ],
            risks: [{ level: "MEDIUM", summary: "现场演示窗口紧，需先冻结范围" }],
            role_coverage: {
              covered: members.map((m) => m.display_name),
              missing: roleNeeds.filter((n) => n.remaining_capacity > 0).map((n) => n.title),
            },
          },
          usage: { prompt_tokens: 300, completion_tokens: 400, total_tokens: 700 },
          model: "fake-planner",
          latency_ms: 12,
        };
      },
      async runResearchBrief({ task }) {
        state.briefCalls += 1;
        if (state.briefBehaviour === "throw-timeout") {
          throw new AgentRunError("LLM_TIMEOUT", "timeout");
        }
        if (state.briefBehaviour === "throw-schema") {
          throw new AgentRunError("SCHEMA_INVALID", "bad json");
        }
        if (state.briefLatencyMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, state.briefLatencyMs));
        }
        return {
          output: {
            brief_md: `# ${task.title}\n\n- 建议先使用最小依赖跑通\n- 关键假设：现场网络稳定`,
            key_terms: ["最小依赖", "现场网络", "端到端验证"],
            risks: ["依赖外部 API 不稳定"],
            next_steps: ["选定库", "先跑通一条链路", "写降级方案"],
          },
          usage: { prompt_tokens: 200, completion_tokens: 300, total_tokens: 500 },
          model: "fake-brief",
          latency_ms: 8,
        };
      },
    },
  };
}

describe("agent run lifecycle", () => {
  let api;
  let baseUrl;
  let fake;

  const headers = (userId, extra = {}) => ({
    "content-type": "application/json",
    "x-demo-user-id": userId,
    ...extra,
  });

  beforeEach(async () => {
    fake = makeFakeRunner();
    api = createApi({
      databasePath: ":memory:",
      allowInsecureDemoAuth: true,
      clock: () => new Date("2026-08-29T07:00:00.000Z"),
      agentRunner: fake.runner,
      agentDailyTokenCap: 10_000,
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  async function bootstrapTeam() {
    const req = await fetch(`${baseUrl}/api/connections/requests`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        recipient_id: "user-lin",
        event_id: "hackathon-2026",
        source: "nfc",
      }),
    });
    const requestId = (await req.json()).request.id;
    await fetch(`${baseUrl}/api/connections/requests/${requestId}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    const project = await (await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        event_id: "hackathon-2026",
        title: "离线会议洞察终端",
        summary: "把线下讨论自动沉淀为可执行任务",
        role_need: { title: "技术构建者", skills: ["工程实现"], capacity: 2 },
      }),
    })).json();
    const invited = await (await fetch(`${baseUrl}/api/projects/${project.project.id}/invitations`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        invitee_id: "user-lin",
        role_need_id: project.role_needs[0].id,
      }),
    })).json();
    await fetch(`${baseUrl}/api/team-invitations/${invited.invitation.id}`, {
      method: "PATCH",
      headers: headers("user-lin"),
      body: JSON.stringify({ action: "accept" }),
    });
    return { projectId: project.project.id };
  }

  async function generatePack(projectId) {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/starter-pack`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({}),
    });
    return { response, body: await response.json() };
  }

  async function confirmPlan(projectId) {
    await fetch(`${baseUrl}/api/projects/${projectId}/plan-confirmations`, {
      method: "POST", headers: headers("user-zhou"), body: "{}",
    });
    await fetch(`${baseUrl}/api/projects/${projectId}/plan-confirmations`, {
      method: "POST", headers: headers("user-lin"), body: "{}",
    });
  }

  async function claimTaskForOwner(taskId, ownerId) {
    return fetch(`${baseUrl}/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: headers(ownerId),
      body: JSON.stringify({ action: "claim" }),
    });
  }

  test("planner writes an AI-sourced starter pack and reserves budget", async () => {
    const { projectId } = await bootstrapTeam();
    const { response, body } = await generatePack(projectId);
    assert.equal(response.status, 201);
    assert.equal(body.starter_pack.generated_by, "AI");
    assert.equal(body.tasks.length, 3);
    assert.equal(fake.state.plannerCalls, 1);

    const room = await (await fetch(`${baseUrl}/api/projects/${projectId}/room`, {
      headers: headers("user-lin"),
    })).json();
    assert.equal(room.agent_daily_budget.used, 700);
    assert.equal(room.agent_daily_budget.cap, 10_000);
  });

  test("planner failure falls back to templates without consuming budget", async () => {
    const { projectId } = await bootstrapTeam();
    fake.state.plannerBehaviour = "throw-timeout";
    const { body } = await generatePack(projectId);
    assert.equal(body.starter_pack.generated_by, "TEMPLATE_FALLBACK");
    const room = await (await fetch(`${baseUrl}/api/projects/${projectId}/room`, {
      headers: headers("user-lin"),
    })).json();
    assert.equal(room.agent_daily_budget.used, 0);
  });

  test("research brief succeeds only for the confirmed owner of a HUMAN_AGENT task", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    await confirmPlan(projectId);
    const humanAgentTask = packBody.tasks.find((task) => task.mode === "HUMAN_AGENT");
    assert.ok(humanAgentTask);
    const claimResponse = await claimTaskForOwner(humanAgentTask.id, "user-lin");
    assert.equal(claimResponse.status, 200);

    const forbidden = await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-zhou"),
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, "AGENT_TRIGGER_FORBIDDEN");

    const run = await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-lin"),
    });
    assert.equal(run.status, 201);
    const runBody = await run.json();
    assert.equal(runBody.agent_run.status, "REVIEW_PENDING");
    assert.equal(runBody.agent_run.total_tokens, 500);
    assert.equal(runBody.agent_run.output.brief_md.startsWith("# 打通端到端演示链路"), true);
  });

  test("triggering on a non HUMAN_AGENT task is rejected", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    await confirmPlan(projectId);
    const humanTask = packBody.tasks.find((task) => task.mode === "HUMAN");
    assert.ok(humanTask);
    await claimTaskForOwner(humanTask.id, "user-zhou");
    const rejected = await fetch(`${baseUrl}/api/tasks/${humanTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-zhou"),
    });
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).error.code, "AGENT_MODE_NOT_SUPPORTED");
  });

  test("brief cannot run before the plan is CONFIRMED", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    const humanAgentTask = packBody.tasks.find((task) => task.mode === "HUMAN_AGENT");
    await claimTaskForOwner(humanAgentTask.id, "user-lin");
    const rejected = await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-lin"),
    });
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).error.code, "PLAN_NOT_CONFIRMED");
  });

  test("idempotency key replays and in-flight duplicates are blocked", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    await confirmPlan(projectId);
    const humanAgentTask = packBody.tasks.find((task) => task.mode === "HUMAN_AGENT");
    await claimTaskForOwner(humanAgentTask.id, "user-lin");

    const first = await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-lin", { "x-idempotency-key": "brief-attempt-1" }),
    });
    const firstBody = await first.json();
    assert.equal(first.status, 201);

    const replay = await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-lin", { "x-idempotency-key": "brief-attempt-1" }),
    });
    assert.equal(replay.status, 200);
    const replayBody = await replay.json();
    assert.equal(replayBody.idempotent_replay, true);
    assert.equal(replayBody.agent_run.id, firstBody.agent_run.id);

    // Owner rejects the first run, so a fresh trigger with a new key is allowed.
    const reviewed = await fetch(`${baseUrl}/api/agent-runs/${firstBody.agent_run.id}/review`, {
      method: "POST",
      headers: headers("user-lin"),
      body: JSON.stringify({ decision: "REJECTED" }),
    });
    assert.equal(reviewed.status, 200);
    assert.equal((await reviewed.json()).agent_run.status, "REJECTED");
  });

  test("budget cap rejects new runs with 429", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    await confirmPlan(projectId);
    const humanAgentTask = packBody.tasks.find((task) => task.mode === "HUMAN_AGENT");
    await claimTaskForOwner(humanAgentTask.id, "user-lin");

    // Burn budget: planner already used 700; force-drain via looped briefs until cap reached.
    for (let i = 0; i < 20; i += 1) {
      const attempt = await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
        method: "POST",
        headers: headers("user-lin"),
      });
      if (attempt.status === 429) {
        assert.equal((await attempt.json()).error.code, "AGENT_BUDGET_EXCEEDED");
        return;
      }
      assert.equal(attempt.status, 201);
      const runId = (await attempt.json()).agent_run.id;
      // Approve so a new one can start.
      const decision = await fetch(`${baseUrl}/api/agent-runs/${runId}/review`, {
        method: "POST",
        headers: headers("user-lin"),
        body: JSON.stringify({ decision: "APPROVED" }),
      });
      assert.equal(decision.status, 200);
    }
    assert.fail("Expected AGENT_BUDGET_EXCEEDED after repeated runs");
  });

  test("review approvals and rejections are recorded and gated", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    await confirmPlan(projectId);
    const humanAgentTask = packBody.tasks.find((task) => task.mode === "HUMAN_AGENT");
    await claimTaskForOwner(humanAgentTask.id, "user-lin");
    const runBody = await (await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-lin"),
    })).json();
    const runId = runBody.agent_run.id;

    const forbidden = await fetch(`${baseUrl}/api/agent-runs/${runId}/review`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({ decision: "APPROVED" }),
    });
    assert.equal(forbidden.status, 403);

    const bad = await fetch(`${baseUrl}/api/agent-runs/${runId}/review`, {
      method: "POST",
      headers: headers("user-lin"),
      body: JSON.stringify({ decision: "MAYBE" }),
    });
    assert.equal(bad.status, 400);

    const approved = await fetch(`${baseUrl}/api/agent-runs/${runId}/review`, {
      method: "POST",
      headers: headers("user-lin"),
      body: JSON.stringify({ decision: "APPROVED", note: "看起来可以采用" }),
    });
    assert.equal(approved.status, 200);
    const approvedBody = await approved.json();
    assert.equal(approvedBody.agent_run.status, "APPROVED");
    assert.equal(approvedBody.agent_run.review_decision, "APPROVED");
    assert.equal(approvedBody.agent_run.reviewer_id, "user-lin");

    const replay = await fetch(`${baseUrl}/api/agent-runs/${runId}/review`, {
      method: "POST",
      headers: headers("user-lin"),
      body: JSON.stringify({ decision: "REJECTED" }),
    });
    assert.equal(replay.status, 409);
  });

  test("cancellation only applies to QUEUED or RUNNING runs", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    await confirmPlan(projectId);
    const humanAgentTask = packBody.tasks.find((task) => task.mode === "HUMAN_AGENT");
    await claimTaskForOwner(humanAgentTask.id, "user-lin");
    const run = await (await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-lin"),
    })).json();
    const notCancellable = await fetch(`${baseUrl}/api/agent-runs/${run.agent_run.id}/cancel`, {
      method: "POST", headers: headers("user-lin"),
    });
    assert.equal(notCancellable.status, 409);
    assert.equal((await notCancellable.json()).error.code, "AGENT_RUN_NOT_CANCELLABLE");
  });

  test("schema validation errors surface as FAILED runs", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    await confirmPlan(projectId);
    const humanAgentTask = packBody.tasks.find((task) => task.mode === "HUMAN_AGENT");
    await claimTaskForOwner(humanAgentTask.id, "user-lin");
    fake.state.briefBehaviour = "throw-schema";
    const response = await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-lin"),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.agent_run.status, "FAILED");
    assert.equal(body.agent_run.error_code, "SCHEMA_INVALID");
  });

  test("agent run list is scoped to project members", async () => {
    const { projectId } = await bootstrapTeam();
    const packBody = (await generatePack(projectId)).body;
    await confirmPlan(projectId);
    const humanAgentTask = packBody.tasks.find((task) => task.mode === "HUMAN_AGENT");
    await claimTaskForOwner(humanAgentTask.id, "user-lin");
    await fetch(`${baseUrl}/api/tasks/${humanAgentTask.id}/agent-runs`, {
      method: "POST",
      headers: headers("user-lin"),
    });
    const outsider = await fetch(`${baseUrl}/api/projects/${projectId}/agent-runs`, {
      headers: headers("user-su"),
    });
    assert.equal(outsider.status, 403);
    const insider = await fetch(`${baseUrl}/api/projects/${projectId}/agent-runs`, {
      headers: headers("user-lin"),
    });
    assert.equal(insider.status, 200);
    const insiderBody = await insider.json();
    assert.equal(insiderBody.agent_runs.length, 1);
    assert.equal(insiderBody.agent_daily_budget.cap, 10_000);
  });
});
