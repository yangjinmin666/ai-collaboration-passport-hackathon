const { firstClaimableTask } = require("../../utils/domain.js");

Page({
  data: {
    projectId: "",
    room: null,
    working: false,
  },

  onLoad(options) {
    this.setData({ projectId: options.projectId || "" });
  },

  onShow() {
    if (this.data.projectId) this.load();
  },

  async load() {
    const app = getApp();
    try {
      const room = await app.globalData.api.get(`/api/projects/${this.data.projectId}/room`);
      const currentUserId = app.globalData.user?.id;
      const memberNames = new Map(
        (room.members || []).map((member) => [member.user_id, member.display_name]),
      );
      const claimableTask = firstClaimableTask(room.tasks || []);
      room.tasks = (room.tasks || []).map((task) => ({
        ...task,
        ownerName: task.confirmed_owner_id
          ? (memberNames.get(task.confirmed_owner_id) || "已有负责人")
          : "待领取",
        canClaim: task.status === "PROPOSED" && !task.confirmed_owner_id,
        claimLabel: task.id === claimableTask?.id ? "建议你先领取" : "我来负责",
        canStart: task.status === "ACCEPTED"
          && task.confirmed_owner_id === currentUserId
          && room.starter_pack?.status === "CONFIRMED",
        canComplete: task.status === "IN_PROGRESS" && task.confirmed_owner_id === currentUserId,
      }));
      room.canConfirmPlan = Boolean(
        room.starter_pack && room.starter_pack.status !== "CONFIRMED"
      );
      this.setData({ room });
    } catch (error) {
      wx.showToast({ title: error.message || "空间加载失败", icon: "none" });
    }
  },

  async generatePlan() {
    await this.runAction(async () => {
      await getApp().globalData.api.post(
        `/api/projects/${this.data.projectId}/starter-pack`,
        {},
      );
      wx.showToast({ title: "任务建议已生成", icon: "success" });
    });
  },

  async claimTask(event) {
    const taskId = event.currentTarget.dataset.taskId;
    await this.runAction(async () => {
      await getApp().globalData.api.patch(`/api/tasks/${taskId}`, { action: "claim" });
      wx.showToast({ title: "任务已领取", icon: "success" });
    });
  },

  async confirmPlan() {
    await this.runAction(async () => {
      const result = await getApp().globalData.api.post(
        `/api/projects/${this.data.projectId}/plan-confirmations`,
        {},
      );
      wx.showToast({
        title: `${result.confirmation_progress.confirmed}/${result.confirmation_progress.required} 已确认`,
        icon: "none",
      });
    });
  },

  async moveTask(event) {
    const { taskId, action } = event.currentTarget.dataset;
    await this.runAction(async () => {
      await getApp().globalData.api.patch(`/api/tasks/${taskId}`, { action });
      wx.showToast({ title: action === "start" ? "已开始执行" : "已完成", icon: "success" });
    });
  },

  async runAction(action) {
    if (this.data.working) return;
    this.setData({ working: true });
    try {
      await action();
      await this.load();
    } catch (error) {
      wx.showToast({ title: error.message || "操作失败", icon: "none" });
    } finally {
      this.setData({ working: false });
    }
  },
});
