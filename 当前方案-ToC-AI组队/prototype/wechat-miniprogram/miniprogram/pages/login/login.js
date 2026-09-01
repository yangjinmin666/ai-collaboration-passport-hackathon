const { ACCESS_TOKEN_KEY } = require("../../utils/api.js");
const { loginWithWechat } = require("../../utils/auth.js");

Page({
  data: { loading: false },

  async onLoad() {
    const app = getApp();
    if (!app.globalData.storage.get(ACCESS_TOKEN_KEY)) return;
    try {
      const me = await app.globalData.api.get("/api/me");
      app.globalData.user = me.user;
      wx.switchTab({ url: "/pages/discover/discover" });
    } catch {
      app.globalData.storage.remove(ACCESS_TOKEN_KEY);
    }
  },

  async login() {
    if (this.data.loading) return;
    const app = getApp();
    this.setData({ loading: true });
    try {
      const session = await loginWithWechat({
        wxApi: wx,
        api: app.globalData.api,
        storage: app.globalData.storage,
      });
      app.globalData.user = session.user;
      wx.reLaunch({
        url: session.is_new_user
          ? "/pages/onboarding/onboarding"
          : "/pages/discover/discover",
      });
    } catch (error) {
      wx.showToast({ title: error.message || "登录失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },
});
