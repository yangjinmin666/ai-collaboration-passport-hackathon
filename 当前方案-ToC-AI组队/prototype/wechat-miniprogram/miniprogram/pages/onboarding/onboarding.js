const {
  buildProfileInput,
  PROFILE_STATUS_OPTIONS,
  PUBLIC_PROFILE_FIELDS,
  validateProfileInput,
} = require("../../utils/domain.js");

Page({
  data: {
    form: {
      displayName: "",
      role: "",
      status: PROFILE_STATUS_OPTIONS[0],
      skills: "",
      interests: "",
      availability: "",
      collaborationPreferences: "",
      collaborationNeed: "",
      evidence: "",
    },
    statuses: PROFILE_STATUS_OPTIONS,
    statusIndex: 0,
    saving: false,
  },

  onLoad() {
    const user = getApp().globalData.user;
    if (user?.display_name && user.display_name !== "COSPAN 新朋友") {
      this.setData({ "form.displayName": user.display_name });
    }
  },

  updateField(event) {
    this.setData({ [`form.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  changeStatus(event) {
    const statusIndex = Number(event.detail.value);
    this.setData({
      statusIndex,
      "form.status": PROFILE_STATUS_OPTIONS[statusIndex],
    });
  },

  async save() {
    if (this.data.saving) return;
    const profile = buildProfileInput(this.data.form);
    const validation = validateProfileInput(profile);
    if (!validation.valid) {
      wx.showToast({ title: validation.message, icon: "none" });
      return;
    }
    const app = getApp();
    this.setData({ saving: true });
    try {
      await app.globalData.api.patch(
        `/api/events/${app.globalData.eventId}/profile`,
        profile,
      );
      await app.globalData.api.patch(
        `/api/events/${app.globalData.eventId}/visibility`,
        { state: "VISIBLE", public_fields: PUBLIC_PROFILE_FIELDS },
      );
      wx.switchTab({ url: "/pages/discover/discover" });
    } catch (error) {
      wx.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
