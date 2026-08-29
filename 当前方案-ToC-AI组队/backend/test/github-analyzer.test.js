import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { createApi } from "../src/app.js";
import { createGitHubAnalyzer } from "../src/github-analyzer.js";
import { GitHubApiError } from "../src/github-client.js";

describe("GitHub capability analyzer", () => {
  let api;
  let baseUrl;
  let llmShouldFail = false;
  const githubClient = {
    async getPublicRepositories(username) {
      if (username === "missing-user") {
        throw new GitHubApiError("GITHUB_USER_NOT_FOUND", "GitHub user not found.", 404);
      }
      if (username === "empty-user") {
        throw new GitHubApiError("NO_PUBLIC_REPOSITORIES", "GitHub user has no public repositories.", 422);
      }
      return [{
        name: "ai-api",
        description: "FastAPI backend for an OpenAI RAG application",
        language: "Python",
        languages: { Python: 900, Dockerfile: 100 },
        topics: ["fastapi", "openai", "postgres"],
        readme: "",
      }];
    },
  };
  const llmProvider = {
    async generateJson() {
      if (llmShouldFail) throw new Error("provider unavailable");
      return {
        tags: ["后端开发", "Python开发", "大语言模型"],
        summary: "擅长构建大模型后端应用",
      };
    },
  };

  before(async () => {
    api = createApi({
      databasePath: ":memory:",
      githubAnalyzer: createGitHubAnalyzer({ githubClient, llmProvider }),
    });
    const address = await api.start(0);
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => api.stop());

  async function analyze(githubUrl) {
    return fetch(`${baseUrl}/api/analyze-github`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ github_url: githubUrl }),
    });
  }

  test("serves the interactive analyzer page", async () => {
    const response = await fetch(`${baseUrl}/github-analyzer`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.match(html, /GitHub 能力标签测试台/);
    assert.match(html, /\/api\/analyze-github/);
  });

  test("returns only the strict public response shape", async () => {
    const response = await analyze("https://github.com/demo-user");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      tags: ["后端开发", "Python开发", "大语言模型"],
      summary: "擅长构建大模型后端应用",
    });
  });

  test("rejects non-profile and non-GitHub URLs", async () => {
    for (const value of ["not-a-url", "https://gitlab.com/demo", "https://github.com/a/repo"]) {
      const response = await analyze(value);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, "INVALID_GITHUB_URL");
    }
  });

  test("preserves user-not-found and no-repository errors", async () => {
    const missing = await analyze("https://github.com/missing-user");
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "GITHUB_USER_NOT_FOUND");
    const empty = await analyze("https://github.com/empty-user");
    assert.equal(empty.status, 422);
    assert.equal((await empty.json()).error.code, "NO_PUBLIC_REPOSITORIES");
  });

  test("uses deterministic tags when the LLM fails", async () => {
    llmShouldFail = true;
    try {
      const response = await analyze("https://github.com/demo-user");
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.ok(body.tags.length >= 3 && body.tags.length <= 5);
      assert.ok(body.tags.includes("Python开发"));
      assert.ok(body.tags.includes("大语言模型"));
      assert.ok([...body.summary].length <= 25);
      assert.deepEqual(Object.keys(body).sort(), ["summary", "tags"]);
    } finally {
      llmShouldFail = false;
    }
  });
});
