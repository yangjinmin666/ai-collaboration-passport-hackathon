export class ApiError extends Error {
  constructor(message, { status = 0, code = "NETWORK_ERROR", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuthenticationError() {
    return this.status === 401;
  }

  get isRetryable() {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export class RallyApiClient {
  constructor({
    baseUrl,
    getAccessToken = () => null,
    demoUserId = null,
    fetchImpl = globalThis.fetch,
    retryDelaysMs = [250, 750],
  }) {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.getAccessToken = getAccessToken;
    this.demoUserId = demoUserId;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.retryDelaysMs = retryDelaysMs;
    this.inFlightWrites = new Map();
  }

  authHeaders() {
    const token = this.getAccessToken();
    if (token) return { authorization: `Bearer ${token}` };
    return this.demoUserId ? { "x-demo-user-id": this.demoUserId } : {};
  }

  get(path, options) {
    return this.request(path, { ...options, method: "GET" });
  }

  post(path, body, options) {
    return this.request(path, { ...options, method: "POST", body });
  }

  put(path, body, options) {
    return this.request(path, { ...options, method: "PUT", body });
  }

  patch(path, body, options) {
    return this.request(path, { ...options, method: "PATCH", body });
  }

  delete(path, options) {
    return this.request(path, { ...options, method: "DELETE" });
  }

  runExclusive(resourceKey, operation) {
    const current = this.inFlightWrites.get(resourceKey);
    if (current) return current;
    const pending = Promise.resolve().then(operation);
    this.inFlightWrites.set(resourceKey, pending);
    pending.finally(() => {
      if (this.inFlightWrites.get(resourceKey) === pending) {
        this.inFlightWrites.delete(resourceKey);
      }
    }).catch(() => {});
    return pending;
  }

  async request(path, {
    method = "GET",
    body,
    headers = {},
    signal,
    keepalive = false,
    authenticate = true,
    retryDelaysMs = method === "GET" ? this.retryDelaysMs : [],
  } = {}) {
    const requestHeaders = {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(authenticate ? this.authHeaders() : {}),
      ...headers,
    };
    const attempts = retryDelaysMs.length + 1;
    let lastError;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: requestHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
          keepalive,
        });
        const payload = response.status === 204
          ? null
          : await response.json().catch(() => null);
        if (response.ok) return payload;
        const apiError = new ApiError(
          payload?.error?.message || `请求失败（${response.status}）`,
          {
            status: response.status,
            code: payload?.error?.code || "HTTP_ERROR",
            details: payload?.error || null,
          },
        );
        if (!apiError.isRetryable || attempt === attempts - 1) throw apiError;
        lastError = apiError;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        const apiError = error instanceof ApiError
          ? error
          : new ApiError(error?.message || "网络连接失败");
        if (!apiError.isRetryable || attempt === attempts - 1) throw apiError;
        lastError = apiError;
      }
      await wait(retryDelaysMs[attempt]);
    }
    throw lastError;
  }
}
