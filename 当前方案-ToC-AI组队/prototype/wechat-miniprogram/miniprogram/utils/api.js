const ACCESS_TOKEN_KEY = "cospan_access_token";

class ApiError extends Error {
  constructor(message, { code = "REQUEST_FAILED", statusCode = 0 } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function queryString(query) {
  const parts = Object.entries(query || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => (
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value)).replace(/%20/g, "+")}`
    ));
  return parts.length ? `?${parts.join("&")}` : "";
}

function createApiClient({ baseUrl, request, storage, onUnauthorized = null }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl) throw new Error("A COSPAN API base URL is required.");
  if (typeof request !== "function") throw new Error("A request adapter is required.");

  async function call(method, path, { data, query, authenticate = true, headers = {} } = {}) {
    const token = authenticate ? storage.get(ACCESS_TOKEN_KEY) : null;
    const response = await request({
      url: `${normalizedBaseUrl}${path}${queryString(query)}`,
      method,
      data,
      header: {
        "content-type": "application/json",
        "x-cospan-surface": "mobile",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
    if (response.statusCode >= 200 && response.statusCode < 300) return response.data;
    const errorBody = response.data?.error || {};
    if (response.statusCode === 401) {
      storage.remove(ACCESS_TOKEN_KEY);
      if (typeof onUnauthorized === "function") onUnauthorized();
    }
    throw new ApiError(errorBody.message || "COSPAN 服务暂时不可用", {
      code: errorBody.code,
      statusCode: response.statusCode,
    });
  }

  return {
    get: (path, query, options = {}) => call("GET", path, { ...options, query }),
    post: (path, data, options = {}) => call("POST", path, { ...options, data }),
    patch: (path, data, options = {}) => call("PATCH", path, { ...options, data }),
    put: (path, data, options = {}) => call("PUT", path, { ...options, data }),
    delete: (path, options = {}) => call("DELETE", path, options),
  };
}

module.exports = {
  ACCESS_TOKEN_KEY,
  ApiError,
  createApiClient,
};
