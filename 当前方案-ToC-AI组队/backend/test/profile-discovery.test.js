import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createApi } from "../src/app.js";

describe("authorized activity profile discovery", () => {
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
      clock: () => new Date("2026-08-29T05:00:00.000Z"),
      platformMetadataFetcher: async ({ platform, url }) => ({
        platform,
        username: "su-design",
        name: "苏晴",
        avatar_url: "https://avatars.githubusercontent.com/u/42?v=4",
        bio: "Interaction designer",
        public_repos: 8,
        followers: 21,
        html_url: url,
      }),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await api.stop();
  });

  test("the mobile demo exposes the complete showcase roster", async () => {
    const response = await fetch(
      `${baseUrl}/api/events/hackathon-2026/discover`,
      { headers: headers("user-zhou") },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
      body.people.map((person) => person.user_id).sort(),
      [
        "user-aguang",
        "user-alan",
        "user-baiyu",
        "user-carlo",
        "user-hanche",
        "user-lin",
        "user-miya",
        "user-qiaohe",
        "user-qixi",
        "user-shenlan",
        "user-su-showcase",
      ],
    );
  });

  test("cannot enable discovery visibility without at least one public field", async () => {
    const response = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({
        state: "VISIBLE",
        expires_at: "2026-08-29T23:00:00.000Z",
        public_fields: [],
      }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "PUBLIC_FIELDS_REQUIRED");
  });

  test("a participant publishes editable evidence and an authorized GitHub link", async () => {
    const link = await fetch(`${baseUrl}/api/me/platform-links/github`, {
      method: "PUT",
      headers: headers("user-su"),
      body: JSON.stringify({ url: "https://github.com/su-design" }),
    });
    assert.equal(link.status, 200);
    assert.equal((await link.json()).platform_link.verification_state, "PUBLIC_API_SYNCED");
    const activityAfterLink = await fetch(
      `${baseUrl}/api/me/activity?event_id=hackathon-2026`,
      { headers: headers("user-su") },
    );
    assert.equal(
      (await activityAfterLink.json()).activity.some(
        (item) => item.event_type === "platform_link_saved",
      ),
      true,
    );

    const invalidProfile = await fetch(`${baseUrl}/api/events/hackathon-2026/profile`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({
        role: "交互设计师",
        status: "随便看看",
        skills: ["交互"],
        interests: [],
        availability: "",
        collaboration_preferences: [],
        collaboration_need: "寻找项目",
        evidence: [],
      }),
    });
    assert.equal(invalidProfile.status, 400);

    const profile = await fetch(`${baseUrl}/api/events/hackathon-2026/profile`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({
        display_name: "苏晴（COSPAN）",
        role: "交互与路演设计师",
        status: "未组队",
        skills: ["交互", "视觉", "路演"],
        interests: ["AI 硬件", "公共议题"],
        availability: "今天 14:00–22:00，可投入 5 小时",
        collaboration_preferences: ["用户测试", "结对协作"],
        collaboration_need: "寻找硬件或 AI 项目",
        evidence: ["两次黑客松最佳设计奖"],
      }),
    });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).profile.display_name, "苏晴（COSPAN）");
    const renamedMe = await fetch(`${baseUrl}/api/me`, { headers: headers("user-su") });
    assert.equal((await renamedMe.json()).user.display_name, "苏晴（COSPAN）");

    const visibility = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({
        state: "VISIBLE",
        expires_at: "2026-08-29T23:00:00.000Z",
        public_fields: [
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
        ],
      }),
    });
    assert.equal(visibility.status, 200);

    const project = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: headers("user-zhou"),
      body: JSON.stringify({
        event_id: "hackathon-2026",
        title: "现场协作引导终端",
        summary: "需要完成现场交互与路演表达",
        role_need: {
          title: "交互设计",
          skills: ["交互", "视觉"],
          capacity: 1,
        },
      }),
    });
    const projectId = (await project.json()).project.id;
    assert.equal(project.status, 201);

    const discover = await fetch(
      `${baseUrl}/api/events/hackathon-2026/discover?project_id=${projectId}`,
      { headers: headers("user-zhou") },
    );
    const discoverBody = await discover.json();
    const su = discoverBody.people.find((person) => person.user_id === "user-su");
    assert.equal(discover.status, 200);
    assert.deepEqual(su.platform_links, [{
      platform: "github",
      url: "https://github.com/su-design",
      verification_state: "PUBLIC_API_SYNCED",
      metadata: {
        username: "su-design",
        name: "苏晴",
        avatar_url: "https://avatars.githubusercontent.com/u/42?v=4",
        bio: "Interaction designer",
        public_repos: 8,
        followers: 21,
        html_url: "https://github.com/su-design",
      },
    }]);
    assert.equal(su.recommendation.reasons.length, 2);
    assert.equal(typeof su.recommendation.needs_confirmation, "string");
    assert.equal(su.recommendation.generated_by, "RULE_FALLBACK");
    assert.equal(su.recommendation.reasons[0].includes("交互设计"), true);
    assert.equal(discoverBody.people[0].user_id, "user-su");
    assert.equal(discoverBody.matching_context.project_id, projectId);
    assert.equal("score" in su.recommendation, false);

    const recruitingProfile = await fetch(`${baseUrl}/api/events/hackathon-2026/profile`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({
        role: "交互与路演设计师",
        status: "团队缺人",
        skills: ["交互", "视觉", "路演"],
        interests: ["AI 硬件", "公共议题"],
        availability: "今天 14:00–22:00，可投入 5 小时",
        collaboration_preferences: ["用户测试", "结对协作"],
        collaboration_need: "正在为自己的项目寻找技术成员",
        evidence: ["两次黑客松最佳设计奖"],
      }),
    });
    assert.equal(recruitingProfile.status, 200);
    const afterStatusChange = await fetch(
      `${baseUrl}/api/events/hackathon-2026/discover?project_id=${projectId}`,
      { headers: headers("user-zhou") },
    );
    assert.equal(
      (await afterStatusChange.json()).people.some((person) => person.user_id === "user-su"),
      false,
    );

    const card = await fetch(
      `${baseUrl}/c/cp_F6wR1cZ8mN4jX2pD?event=hackathon-2026&src=nfc`,
    );
    const cardBody = await card.json();
    assert.equal(card.status, 200);
    assert.equal(cardBody.profile.platform_links[0].platform, "github");

    const pause = await fetch(`${baseUrl}/api/events/hackathon-2026/visibility`, {
      method: "PATCH",
      headers: headers("user-su"),
      body: JSON.stringify({ state: "PAUSED" }),
    });
    assert.equal(pause.status, 200);
    const afterPause = await fetch(
      `${baseUrl}/api/events/hackathon-2026/discover`,
      { headers: headers("user-zhou") },
    );
    assert.equal(
      (await afterPause.json()).people.some((person) => person.user_id === "user-su"),
      false,
    );

    const disconnected = await fetch(`${baseUrl}/api/me/platform-links/github`, {
      method: "DELETE",
      headers: headers("user-su"),
    });
    assert.equal(disconnected.status, 204);
    const me = await fetch(`${baseUrl}/api/me`, { headers: headers("user-su") });
    assert.deepEqual((await me.json()).platform_links, []);
    const activityAfterRemoval = await fetch(
      `${baseUrl}/api/me/activity?event_id=hackathon-2026`,
      { headers: headers("user-su") },
    );
    assert.equal(
      (await activityAfterRemoval.json()).activity.some(
        (item) => item.event_type === "platform_link_removed",
      ),
      true,
    );
  });
});
