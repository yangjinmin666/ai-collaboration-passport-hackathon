const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

export class GitHubApiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "GitHubApiError";
    this.code = code;
    this.status = status;
  }
}

export function parseGitHubUsername(rawUrl) {
  if (typeof rawUrl !== "string") return null;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:"
    || !GITHUB_HOSTS.has(url.hostname.toLowerCase())
    || url.username
    || url.password
    || parts.length !== 1
    || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(parts[0])
  ) return null;
  return parts[0];
}

function headers(token) {
  const value = {
    accept: "application/vnd.github+json",
    "user-agent": "RALLY-Hackathon-MVP",
    "x-github-api-version": "2022-11-28",
  };
  if (token) value.authorization = `Bearer ${token}`;
  return value;
}

async function requestJson(path, { fetchImpl, token, timeoutMs }) {
  let response;
  try {
    response = await fetchImpl(`https://api.github.com${path}`, {
      headers: headers(token),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new GitHubApiError("GITHUB_API_FAILED", "GitHub API is temporarily unavailable.");
  }
  if (response.status === 404) {
    throw new GitHubApiError("GITHUB_USER_NOT_FOUND", "GitHub user not found.", 404);
  }
  if (!response.ok) {
    throw new GitHubApiError("GITHUB_API_FAILED", "GitHub API request failed.");
  }
  return response.json();
}

export function createGitHubClient({
  fetchImpl = fetch,
  token = process.env.GITHUB_TOKEN ?? null,
  timeoutMs = 4000,
  repoLimit = 6,
  readmeLimit = 6,
  languagesLimit = 6,
} = {}) {
  return {
    async getPublicRepositories(username) {
      const repos = await requestJson(
        `/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=${repoLimit}`,
        { fetchImpl, token, timeoutMs },
      );
      const useful = repos.filter((repo) => !repo.fork && !repo.archived).slice(0, repoLimit);
      if (useful.length === 0) {
        throw new GitHubApiError("NO_PUBLIC_REPOSITORIES", "GitHub user has no public repositories.", 422);
      }

      const readmeCandidates = useful.slice(0, readmeLimit);
      const languageMaps = new Map(await Promise.all(useful.slice(0, languagesLimit).map(async (repo) => {
        try {
          const payload = await requestJson(
            `/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/languages`,
            { fetchImpl, token, timeoutMs },
          );
          return [repo.name, payload];
        } catch {
          return [repo.name, repo.language ? { [repo.language]: 1 } : {}];
        }
      })));
      const readmes = new Map(await Promise.all(readmeCandidates.map(async (repo) => {
        try {
          const response = await fetchImpl(
            `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/readme`,
            { headers: { ...headers(token), accept: "application/vnd.github.raw+json" }, signal: AbortSignal.timeout(timeoutMs) },
          );
          return [repo.name, response.ok ? (await response.text()).slice(0, 6000) : null];
        } catch {
          return [repo.name, null];
        }
      })));

      return useful.map((repo) => ({
        name: repo.name,
        description: repo.description ?? "",
        language: repo.language ?? "",
        languages: languageMaps.get(repo.name) ?? (repo.language ? { [repo.language]: 1 } : {}),
        topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 12) : [],
        readme: readmes.get(repo.name) ?? "",
        stars: Number.isInteger(repo.stargazers_count) ? repo.stargazers_count : 0,
        updated_at: repo.updated_at ?? null,
      }));
    },
  };
}
