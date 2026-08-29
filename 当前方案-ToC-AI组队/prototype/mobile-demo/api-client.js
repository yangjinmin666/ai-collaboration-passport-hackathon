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
    getTelemetryHeaders = () => globalThis.__rallyTelemetryContext?.() ?? {},
    observeRequest = (observation) => globalThis.__rallyApiObserved?.(observation),
  }) {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.getAccessToken = getAccessToken;
    this.demoUserId = demoUserId;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.retryDelaysMs = retryDelaysMs;
    this.getTelemetryHeaders = getTelemetryHeaders;
    this.observeRequest = observeRequest;
    this.inFlightWrites = new Map();
  }

  notifyRequest(observation) {
    try {
      this.observeRequest?.(observation);
    } catch {
      // Analytics must never break the product request path.
    }
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
      ...(this.getTelemetryHeaders?.() ?? {}),
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
        if (response.ok) {
          this.notifyRequest({ ok: true, method, path, status: response.status, payload });
          return payload;
        }
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
        if (!apiError.isRetryable || attempt === attempts - 1) {
          this.notifyRequest({
            ok: false,
            method,
            path,
            status: apiError.status,
            errorCode: apiError.code,
          });
          throw apiError;
        }
        lastError = apiError;
      }
      await wait(retryDelaysMs[attempt]);
    }
    throw lastError;
  }
}

const TELEMETRY_EVENT_NAMES = new Set([
  "discovery_viewed",
  "match_impression",
  "match_detail_opened",
  "room_viewed",
]);
const TELEMETRY_QUEUE_KEY = "rally_analytics_queue_v1";
const TELEMETRY_ANONYMOUS_KEY = "rally_analytics_anonymous_id";
const TELEMETRY_SESSION_KEY = "rally_analytics_session_id";
const TELEMETRY_SESSION_ACTIVITY_KEY = "rally_analytics_session_activity";
const TELEMETRY_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function browserUuid(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl?.randomUUID === "function") return cryptoImpl.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoImpl.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

function storageValue(storage, key) {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function setStorageValue(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Private mode or full storage: retain the in-memory value for this page.
  }
}

function identifier(storage, key, cryptoImpl) {
  const existing = storageValue(storage, key);
  if (/^[0-9a-f-]{36}$/i.test(existing || "")) return existing;
  const created = browserUuid(cryptoImpl);
  setStorageValue(storage, key, created);
  return created;
}

function countBucket(count) {
  if (count <= 0) return "0";
  if (count <= 5) return "1-5";
  if (count <= 20) return "6-20";
  return "21+";
}

function safeQueue(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(TELEMETRY_QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class RallyTelemetryClient {
  constructor({
    baseUrl,
    exhibitionId = "hackathon-2026",
    appVersion = "demo-0.1.0",
    clientType = "mobile_web",
    getAccessToken = () => null,
    fetchImpl = globalThis.fetch,
    localStorageImpl = globalThis.localStorage,
    sessionStorageImpl = globalThis.sessionStorage,
    cryptoImpl = globalThis.crypto,
    clock = () => new Date(),
  }) {
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.exhibitionId = exhibitionId;
    this.appVersion = appVersion;
    this.clientType = clientType;
    this.getAccessToken = getAccessToken;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.localStorage = localStorageImpl;
    this.clock = clock;
    this.crypto = cryptoImpl;
    this.anonymousId = identifier(localStorageImpl, TELEMETRY_ANONYMOUS_KEY, cryptoImpl);
    this.sessionStorage = sessionStorageImpl;
    const storedSessionId = storageValue(sessionStorageImpl, TELEMETRY_SESSION_KEY);
    const lastActivity = Number(storageValue(sessionStorageImpl, TELEMETRY_SESSION_ACTIVITY_KEY));
    const nowMs = clock().getTime();
    this.sessionId = /^[0-9a-f-]{36}$/i.test(storedSessionId || "")
      && Number.isFinite(lastActivity)
      && nowMs - lastActivity <= TELEMETRY_SESSION_TIMEOUT_MS
      ? storedSessionId
      : browserUuid(cryptoImpl);
    setStorageValue(sessionStorageImpl, TELEMETRY_SESSION_KEY, this.sessionId);
    setStorageValue(sessionStorageImpl, TELEMETRY_SESSION_ACTIVITY_KEY, String(nowMs));
    this.flushing = null;
  }

  ensureSession() {
    const nowMs = this.clock().getTime();
    const lastActivity = Number(storageValue(
      this.sessionStorage,
      TELEMETRY_SESSION_ACTIVITY_KEY,
    ));
    if (
      !Number.isFinite(lastActivity)
      || nowMs - lastActivity > TELEMETRY_SESSION_TIMEOUT_MS
    ) {
      this.sessionId = browserUuid(this.crypto);
      setStorageValue(this.sessionStorage, TELEMETRY_SESSION_KEY, this.sessionId);
    }
    setStorageValue(this.sessionStorage, TELEMETRY_SESSION_ACTIVITY_KEY, String(nowMs));
    return this.sessionId;
  }

  contextHeaders({ sessionId = null } = {}) {
    return {
      "x-rally-anonymous-id": this.anonymousId,
      "x-rally-session-id": sessionId || this.ensureSession(),
      "x-rally-client-type": this.clientType,
      "x-rally-app-version": this.appVersion,
    };
  }

  readQueue() {
    const cutoff = this.clock().getTime() - 24 * 60 * 60 * 1000;
    return safeQueue(this.localStorage)
      .filter((item) => new Date(item.queued_at).getTime() >= cutoff)
      .slice(-20);
  }

  writeQueue(queue) {
    setStorageValue(this.localStorage, TELEMETRY_QUEUE_KEY, JSON.stringify(queue.slice(-20)));
  }

  track(eventName, properties, {
    source,
    objectType = null,
    objectId = null,
  }) {
    if (!TELEMETRY_EVENT_NAMES.has(eventName)) return null;
    this.ensureSession();
    const now = this.clock().toISOString();
    const event = {
      analytics_event_id: browserUuid(this.crypto),
      event_name: eventName,
      anonymous_id: this.anonymousId,
      exhibition_id: this.exhibitionId,
      session_id: this.sessionId,
      source,
      client_type: this.clientType,
      app_version: this.appVersion,
      ...(objectType ? { object_type: objectType } : {}),
      ...(objectId ? { object_id: objectId } : {}),
      properties,
      occurred_at: now,
      queued_at: now,
    };
    const queue = this.readQueue();
    queue.push(event);
    this.writeQueue(queue);
    void this.flush();
    return event.analytics_event_id;
  }

  async flush({ keepalive = false } = {}) {
    if (this.flushing) return this.flushing;
    const queued = this.readQueue();
    if (queued.length === 0) return null;
    const sessionId = queued[0].session_id;
    const batch = queued.filter((item) => item.session_id === sessionId).slice(0, 20);
    const eventIds = new Set(batch.map((item) => item.analytics_event_id));
    const payload = batch.map(({ queued_at: _queuedAt, ...event }) => event);
    const token = this.getAccessToken();
    let delivered = false;
    this.flushing = this.fetchImpl(`${this.baseUrl}/api/analytics/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.contextHeaders({ sessionId }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events: payload }),
      keepalive,
    }).then((response) => {
      if (!response.ok) return false;
      delivered = true;
      this.writeQueue(this.readQueue().filter((item) => !eventIds.has(item.analytics_event_id)));
      return true;
    }).catch(() => false).finally(() => {
      this.flushing = null;
      if (delivered && this.readQueue().length > 0) {
        queueMicrotask(() => { void this.flush(); });
      }
    });
    return this.flushing;
  }
}

function telemetryBaseUrl(params) {
  const packaged = document.querySelector('meta[name="rally-api-origin"]')?.content.trim();
  const trusted = packaged || storageValue(globalThis.localStorage, "rally_api_base");
  const requested = params.get("apiBase");
  const candidate = trusted || requested || location.origin;
  try {
    const url = new URL(candidate, location.href);
    if (!new Set(["http:", "https:"]).has(url.protocol)) return null;
    if (location.protocol === "https:" && url.protocol !== "https:") return null;
    if (!trusted && requested) {
      const pageUrl = new URL(location.href);
      const loopback = new Set(["127.0.0.1", "::1", "localhost"]);
      const sameHost = url.hostname === pageUrl.hostname;
      const bothLoopback = loopback.has(url.hostname) && loopback.has(pageUrl.hostname);
      if (!sameHost && !bothLoopback) return null;
    }
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function clientAppVersion() {
  const configured = document.querySelector('meta[name="rally-app-version"]')?.content.trim();
  if (/^[A-Za-z0-9._:+-]{1,64}$/.test(configured || "")) return configured;
  return location.hostname === "rally.local" ? "android-0.1.0" : "web-0.1.0";
}

function bootBrowserTelemetry() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  const params = new URLSearchParams(location.search);
  const packaged = document.querySelector('meta[name="rally-api-origin"]')?.content.trim();
  if (params.get("live") !== "1" && !packaged) return;
  const baseUrl = telemetryBaseUrl(params);
  if (!baseUrl) return;
  const telemetry = new RallyTelemetryClient({
    baseUrl,
    exhibitionId: params.get("event") || "hackathon-2026",
    appVersion: clientAppVersion(),
    clientType: location.hostname === "rally.local" ? "android_webview" : "mobile_web",
    getAccessToken: () => storageValue(globalThis.localStorage, "rally_access_token"),
  });
  globalThis.__rallyTelemetryContext = () => telemetry.contextHeaders();

  let discovery = null;
  let room = null;
  let detailActive = null;
  let analyzeQueued = false;
  const trackedViews = new Set();
  const trackedImpressions = new Set();
  const observedElements = new WeakSet();
  const pendingTimers = new WeakMap();

  const candidateFor = (localId) => {
    const text = String(localId || "");
    return discovery?.people.find((person) => (
      person.user_id === text
      || person.user_id === `user-${text}`
      || person.user_id.replace(/^user-/, "") === text.replace(/^user-/, "")
    )) ?? null;
  };
  const candidateRank = (candidate) => Math.max(
    1,
    (discovery?.people.findIndex((person) => person.user_id === candidate.user_id) ?? 0) + 1,
  );
  const discoverySource = () => (
    document.body.dataset.variant === "B" ? "nearby" : "online_recommendation"
  );

  const recordImpression = (element) => {
    if (!discovery || !element.isConnected) return;
    const localId = element.dataset.personId || element.dataset.person;
    const candidate = candidateFor(localId);
    if (!candidate) return;
    const key = `${discovery.listRequestId}:${candidate.user_id}`;
    if (trackedImpressions.has(key)) return;
    trackedImpressions.add(key);
    telemetry.track("match_impression", {
      candidate_id: candidate.user_id,
      rank: candidateRank(candidate),
      rule_score_bucket: "unknown",
      list_request_id: discovery.listRequestId,
    }, {
      source: discoverySource(),
      objectType: "candidate",
      objectId: candidate.user_id,
    });
  };

  const intersectionObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const existing = pendingTimers.get(entry.target);
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (!existing) {
              const timer = setTimeout(() => {
                pendingTimers.delete(entry.target);
                recordImpression(entry.target);
              }, 1000);
              pendingTimers.set(entry.target, timer);
            }
          } else if (existing) {
            clearTimeout(existing);
            pendingTimers.delete(entry.target);
          }
        }
      }, { threshold: [0.5] })
    : null;

  const analyze = () => {
    analyzeQueued = false;
    const discoveryView = document.querySelector(".view-a, .view-b, .view-c");
    if (discovery && discoveryView) {
      const viewKey = discovery.listRequestId;
      if (!trackedViews.has(viewKey)) {
        trackedViews.add(viewKey);
        telemetry.track("discovery_viewed", {
          result_count_bucket: countBucket(discovery.people.length),
          filter_count: document.querySelector(".discovery-filter-trigger b")
            ? Number.parseInt(document.querySelector(".discovery-filter-trigger b").textContent, 10) || 0
            : 0,
          list_request_id: discovery.listRequestId,
        }, {
          source: discoverySource(),
          objectType: "discovery_list",
          objectId: discovery.listRequestId,
        });
      }
      const candidateElements = document.querySelectorAll([
        ".recommendation-card-active[data-person-id]",
        ".radar-person[data-person]",
        ".ledger-person[data-person]",
      ].join(", "));
      candidateElements.forEach((element) => {
        if (observedElements.has(element)) return;
        observedElements.add(element);
        if (intersectionObserver) intersectionObserver.observe(element);
        else setTimeout(() => recordImpression(element), 1000);
      });
    }

    const detail = document.querySelector(".person-overlay [data-person]");
    if (detail && discovery) {
      const candidate = candidateFor(detail.dataset.person);
      const key = candidate ? `${discovery.listRequestId}:${candidate.user_id}` : null;
      if (candidate && detailActive !== key) {
        detailActive = key;
        telemetry.track("match_detail_opened", {
          candidate_id: candidate.user_id,
          rank: candidateRank(candidate),
          reason_count: Array.isArray(candidate.recommendation?.reasons)
            ? candidate.recommendation.reasons.length
            : 0,
          list_request_id: discovery.listRequestId,
        }, {
          source: discoverySource(),
          objectType: "candidate",
          objectId: candidate.user_id,
        });
      }
    } else {
      detailActive = null;
    }

    if (room && document.querySelector(".live-workspace-view .live-project-summary")) {
      const roomKey = `room:${room.projectId}`;
      if (!trackedViews.has(roomKey)) {
        trackedViews.add(roomKey);
        telemetry.track("room_viewed", {
          project_id: room.projectId,
          member_count: room.memberCount,
          pack_status: room.packStatus,
        }, {
          source: "project_room",
          objectType: "project",
          objectId: room.projectId,
        });
      }
    }
  };
  const scheduleAnalyze = () => {
    if (analyzeQueued) return;
    analyzeQueued = true;
    queueMicrotask(analyze);
  };

  globalThis.__rallyApiObserved = (observation) => {
    if (!observation?.ok || observation.method !== "GET") return;
    const discoverMatch = observation.path.match(/^\/api\/events\/([^/]+)\/discover(?:\?|$)/);
    if (discoverMatch && Array.isArray(observation.payload?.people)) {
      discovery = {
        people: observation.payload.people,
        listRequestId: browserUuid(),
      };
      scheduleAnalyze();
      return;
    }
    const roomMatch = observation.path.match(/^\/api\/projects\/([^/]+)\/room(?:\?|$)/);
    if (roomMatch && observation.payload?.project) {
      room = {
        projectId: decodeURIComponent(roomMatch[1]),
        memberCount: Array.isArray(observation.payload.members)
          ? observation.payload.members.length
          : 0,
        packStatus: observation.payload.starter_pack?.status || "none",
      };
      scheduleAnalyze();
    }
  };
  globalThis.__rallyDiscoveryAttribution = (candidateId) => {
    const candidate = candidateFor(candidateId);
    if (!discovery || !candidate) return null;
    return {
      candidate_id: candidate.user_id,
      list_request_id: discovery.listRequestId,
    };
  };

  const root = document.querySelector("#app");
  if (root) new MutationObserver(scheduleAnalyze).observe(root, { childList: true, subtree: true });
  window.addEventListener("pagehide", () => { void telemetry.flush({ keepalive: true }); });
  void telemetry.flush();
}

bootBrowserTelemetry();

export { browserUuid, countBucket };
