export function createLlmProvider({
  apiKey = process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY ?? null,
  baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
  model = process.env.LLM_MODEL ?? "gpt-4.1-mini",
  fetchImpl = fetch,
  timeoutMs = 20_000,
  maxTokens = 600,
  now = () => Date.now(),
} = {}) {
  return {
    async generateJson({ system, user, maxTokens: overrideMaxTokens, timeoutMs: overrideTimeoutMs } = {}) {
      if (!apiKey) throw new Error("LLM API key is not configured.");
      const startedAt = now();
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: overrideMaxTokens ?? maxTokens,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(overrideTimeoutMs ?? timeoutMs),
      });
      if (!response.ok) throw new Error(`LLM request failed with status ${response.status}.`);
      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("LLM response has no content.");
      const latency_ms = now() - startedAt;
      const usage = payload.usage ?? null;
      return {
        data: JSON.parse(content),
        usage: usage ? {
          prompt_tokens: Number(usage.prompt_tokens ?? 0),
          completion_tokens: Number(usage.completion_tokens ?? 0),
          total_tokens: Number(usage.total_tokens ?? 0),
        } : null,
        model: payload.model ?? model,
        latency_ms,
      };
    },
  };
}
