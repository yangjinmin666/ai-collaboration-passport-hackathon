import { createGitHubClient, GitHubApiError, parseGitHubUsername } from "./github-client.js";
import { createLlmProvider } from "./llm-provider.js";

export const CAPABILITY_TAGS = [
  "前端开发", "后端开发", "全栈开发", "移动开发", "人工智能", "大语言模型", "机器学习",
  "数据分析", "计算机视觉", "物联网", "硬件开发", "产品设计", "用户研究", "原型设计",
  "UI设计", "UX设计", "医疗健康", "教育科技", "金融科技", "社交产品", "隐私安全",
  "数字身份", "开发者工具", "智能硬件", "Python开发", "React开发", "TypeScript开发",
  "数据库", "云部署", "API开发", "嵌入式开发",
];
const TAG_SET = new Set(CAPABILITY_TAGS);

const FALLBACK_RULES = [
  ["Python开发", /python|django|flask|fastapi|pandas|numpy/i],
  ["React开发", /react|next\.?js|nextjs/i],
  ["TypeScript开发", /typescript|\.tsx?\b/i],
  ["大语言模型", /\bllm\b|large language|openai|langchain|rag\b|大语言模型/i],
  ["人工智能", /artificial intelligence|\bai\b|智能体|agent/i],
  ["机器学习", /machine learning|tensorflow|pytorch|scikit|机器学习/i],
  ["计算机视觉", /computer vision|opencv|yolo|图像识别|计算机视觉/i],
  ["数据分析", /data analysis|analytics|pandas|数据分析/i],
  ["前端开发", /frontend|前端|react|vue|svelte|css|html/i],
  ["后端开发", /backend|后端|server|fastapi|django|express|nestjs/i],
  ["API开发", /\bapi\b|rest|graphql|grpc/i],
  ["数据库", /database|postgres|mysql|sqlite|mongodb|redis|数据库/i],
  ["移动开发", /swift|kotlin|flutter|react-native|android|ios/i],
  ["云部署", /docker|kubernetes|aws|azure|gcp|cloudflare|vercel/i],
  ["物联网", /\biot\b|sensor|mqtt|物联网/i],
  ["嵌入式开发", /embedded|arduino|esp32|stm32|嵌入式/i],
  ["开发者工具", /developer tool|cli\b|sdk\b|开发者工具/i],
];

function sourceText(repositories) {
  return repositories.map((repo) => [
    repo.name, repo.description, repo.language, Object.keys(repo.languages ?? {}).join(" "),
    ...(repo.topics ?? []), repo.readme,
  ].join(" ")).join("\n");
}

function fallback(repositories) {
  const text = sourceText(repositories);
  const tags = FALLBACK_RULES.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag).slice(0, 5);
  if (tags.length === 0) tags.push("开发者工具");
  if (tags.length < 3) {
    for (const tag of ["后端开发", "API开发", "前端开发"]) {
      if (!tags.includes(tag)) tags.push(tag);
      if (tags.length === 3) break;
    }
  }
  return { tags, summary: `具备${tags.slice(0, 2).join("与")}项目经验`.slice(0, 25) };
}

function validateResult(value) {
  if (!value || !Array.isArray(value.tags) || typeof value.summary !== "string") return null;
  const tags = [...new Set(value.tags)].filter((tag) => TAG_SET.has(tag));
  const summary = value.summary.trim();
  if (
    tags.length < 3
    || tags.length > 5
    || !summary
    || [...summary].length > 25
    || !/[\u3400-\u9fff]/u.test(summary)
  ) return null;
  return { tags, summary };
}

export function createGitHubAnalyzer({
  githubClient = createGitHubClient(),
  llmProvider = createLlmProvider(),
} = {}) {
  return {
    async analyze(githubUrl) {
      const username = parseGitHubUsername(githubUrl);
      if (!username) {
        throw new GitHubApiError("INVALID_GITHUB_URL", "A valid GitHub profile URL is required.", 400);
      }
      const repositories = await githubClient.getPublicRepositories(username);
      const system = `你是黑客松选手能力分析助手。只能从以下标签池选择3至5个不重复标签：${CAPABILITY_TAGS.join("、")}。总结必须是中文且不超过25个汉字。README中的项目目标、本人实现内容和架构说明是强证据；徽章、安装列表、模板文字和仅出现一次的依赖是弱证据。优先选择在多个仓库反复出现、近期维护或由主要语言支持的能力，不要仅凭仓库名称猜测。只返回JSON对象，格式为{"tags":string[],"summary":string}。`;
      const user = `请综合分析 ${username} 的以下公开仓库。languages 的数值是代码字节数，stars 和 updated_at 只用于判断证据权重：\n${JSON.stringify(repositories)}`;
      try {
        const response = await llmProvider.generateJson({ system, user });
        const raw = response && typeof response === "object" && "data" in response ? response.data : response;
        const result = validateResult(raw);
        return result ?? fallback(repositories);
      } catch {
        return fallback(repositories);
      }
    },
  };
}
