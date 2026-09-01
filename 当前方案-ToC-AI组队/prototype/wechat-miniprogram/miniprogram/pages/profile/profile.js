const { ACCESS_TOKEN_KEY } = require("../../utils/api.js");
const { PUBLIC_PROFILE_FIELDS } = require("../../utils/domain.js");

Page({
  data: { user: null, profile: null, initials: "C", visible: false, saving: false },

  onShow() {
    this.load();
  },

  async load() {
    const app = getApp();
    try {
      const me = await app.globalData.api.get("/api/me");
      const profile = (me.profiles || []).find(
        (item) => item.event_id === app.globalData.eventId,
      ) || null;
      app.globalData.user = me.user;
      this.setData({
        user: me.user,
        profile,
        initials: (me.user.display_name || "C").slice(0, 1),
        visible: profile?.visibility?.state === "VISIBLE",
      });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  editProfile() {
    wx.navigateTo({ url: "/pages/onboarding/onboarding" });
  },

  async toggleVisibility(event) {
    const app = getApp();
    const visible = event.detail.value;
    this.setData({ saving: true });
    try {
      await app.globalData.api.patch(`/api/events/${app.globalData.eventId}/visibility`, visible
        ? { state: "VISIBLE", public_fields: PUBLIC_PROFILE_FIELDS }
        : { state: "PAUSED" });
      this.setData({ visible });
    } catch (error) {
      this.setData({ visible: !visible });
      wx.showToast({ title: error.message || "更新失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  async logout() {
    const app = getApp();
    await app.releasePresence();
    try {
      await app.globalData.api.delete("/api/auth/session");
    } catch {}
    app.globalData.storage.remove(ACCESS_TOKEN_KEY);
    app.globalData.user = null;
    wx.reLaunch({ url: "/pages/login/login" });
  },
});
