const { ACTIVE_EVENT_ID, API_BASE_URL } = require("./config.js");
const { createRuntime } = require("./utils/runtime.js");

App({
  globalData: {
    api: null,
    storage: null,
    eventId: ACTIVE_EVENT_ID,
    user: null,
    presenceActive: false,
  },

  onLaunch() {
    const runtime = createRuntime({ wxApi: wx, baseUrl: API_BASE_URL });
    this.globalData.api = runtime.api;
    this.globalData.storage = runtime.storage;
  },

  onHide() {
    this.releasePresence();
  },

  async releasePresence() {
    if (!this.globalData.presenceActive || !this.globalData.api) return;
    this.globalData.presenceActive = false;
    try {
      await this.globalData.api.delete(`/api/events/${this.globalData.eventId}/presence`);
    } catch {}
  },
});
