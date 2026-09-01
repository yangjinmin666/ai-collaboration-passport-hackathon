const { connectionRequestView } = require("../../utils/domain.js");

function getLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: "gcj02",
      isHighAccuracy: true,
      success: resolve,
      fail: reject,
    });
  });
}

Page({
  data: {
    people: [],
    incoming: [],
    nearby: [],
    loading: true,
    nearbyEnabled: false,
    eventName: "现场活动",
    showEmptyPeople: false,
  },

  onShow() {
    this.load();
  },

  onHide() {
    this.stopNearby();
  },

  onUnload() {
    this.stopNearby();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    const app = getApp();
    this.setData({ loading: true });
    try {
      const me = await app.globalData.api.get("/api/me");
      app.globalData.user = me.user;
      const ownProfile = (me.profiles || []).find(
        (profile) => profile.event_id === app.globalData.eventId,
      );
      if (!ownProfile || ownProfile.skills.length < 3) {
        wx.navigateTo({ url: "/pages/onboarding/onboarding" });
        return;
      }
      const [events, discover, inbox] = await Promise.all([
        app.globalData.api.get("/api/events"),
        app.globalData.api.get(`/api/events/${app.globalData.eventId}/discover`),
        app.globalData.api.get("/api/connections/requests", {
          event_id: app.globalData.eventId,
          direction: "incoming",
          status: "REQUESTED",
        }),
      ]);
      const people = discover.people || [];
      const activeEvent = (events.events || []).find(
        (event) => event.id === app.globalData.eventId,
      );
      this.setData({
        eventName: activeEvent?.name || "现场活动",
        people,
        showEmptyPeople: people.length === 0,
        incoming: (inbox.requests || []).map((request) => ({
          ...request,
          view: connectionRequestView(request),
        })),
      });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async requestConnection(event) {
    const app = getApp();
    const person = this.data.people.find(
      (item) => item.user_id === event.currentTarget.dataset.userId,
    );
    if (!person) return;
    try {
      await app.globalData.api.post("/api/connections/requests", {
        recipient_id: person.user_id,
        event_id: app.globalData.eventId,
        source: "link",
        message: `我对你的「${person.role || "协作方向"}」很感兴趣，想现场认识一下。`,
      });
      wx.showToast({ title: "认识请求已发出", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "发送失败", icon: "none" });
    }
  },

  async acceptConnection(event) {
    const requestId = event.currentTarget.dataset.requestId;
    try {
      await getApp().globalData.api.patch(
        `/api/connections/requests/${requestId}`,
        { action: "accept" },
      );
      wx.showToast({ title: "已建立连接", icon: "success" });
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message || "操作失败", icon: "none" });
    }
  },

  async toggleNearby(event) {
    if (!event.detail.value) {
      this.stopNearby();
      return;
    }
    try {
      await this.publishLocation();
      this.setData({ nearbyEnabled: true });
      this.locationTimer = setInterval(() => this.publishLocation(), 60_000);
    } catch {
      this.stopNearby();
      this.setData({ nearbyEnabled: false });
      wx.showModal({
        title: "需要你授权位置",
        content: "只在小程序前台发布短时定位，离开页面就会删除。",
        confirmText: "去设置",
        success: ({ confirm }) => confirm && wx.openSetting(),
      });
    }
  },

  async publishLocation() {
    const app = getApp();
    const location = await getLocation();
    await app.globalData.api.put(`/api/events/${app.globalData.eventId}/presence`, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy_m: location.accuracy,
    });
    app.globalData.presenceActive = true;
    const nearby = await app.globalData.api.get(
      `/api/events/${app.globalData.eventId}/nearby`,
    );
    this.setData({
      nearby: (nearby.nearby || []).map((person) => ({
        ...person,
        distanceLabel: person.distance?.label || "附近",
      })),
    });
  },

  stopNearby() {
    if (this.locationTimer) clearInterval(this.locationTimer);
    this.locationTimer = null;
    const app = getApp();
    if (app.globalData.presenceActive) app.releasePresence();
    if (this.data.nearbyEnabled || this.data.nearby.length) {
      this.setData({ nearbyEnabled: false, nearby: [] });
    }
  },
});
