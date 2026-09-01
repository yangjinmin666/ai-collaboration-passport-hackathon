const { cleanList } = require("../../utils/domain.js");

Page({
  data: {
    projects: [],
    invitations: [],
    connections: [],
    showCreate: false,
    creating: false,
    projectForm: {
      title: "",
      summary: "",
      roleTitle: "",
      roleSkills: "",
    },
  },

  onShow() {
    this.load();
  },

  async load() {
    const app = getApp();
    try {
      const query = { event_id: app.globalData.eventId };
      const [projects, invitations, incoming, outgoing] = await Promise.all([
        app.globalData.api.get("/api/projects", query),
        app.globalData.api.get("/api/team-invitations", {
          ...query,
          direction: "incoming",
          status: "PENDING",
        }),
        app.globalData.api.get("/api/connections/requests", {
          ...query,
          direction: "incoming",
          status: "ACCEPTED",
        }),
        app.globalData.api.get("/api/connections/requests", {
          ...query,
          direction: "outgoing",
          status: "ACCEPTED",
        }),
      ]);
      const connectionMap = new Map();
      [...(incoming.requests || []), ...(outgoing.requests || [])].forEach((request) => {
        connectionMap.set(request.counterpart.id, request.counterpart);
      });
      const connections = [...connectionMap.values()];
      const mappedProjects = (projects.projects || []).map((project) => {
        const members = new Set((project.members || []).map((member) => member.user_id));
        const openRoles = (project.role_needs || []).filter(
          (need) => need.remaining_capacity > 0,
        );
        const inviteCandidates = connections.filter((person) => !members.has(person.id));
        const inviteOptions = inviteCandidates.flatMap((person) => openRoles.map((role) => ({
          key: `${person.id}:${role.id}`,
          inviteeId: person.id,
          displayName: person.display_name,
          roleNeedId: role.id,
          roleTitle: role.title,
        })));
        return {
          ...project,
          inviteOptions: project.my_membership.membership_role === "MEMBER"
            ? []
            : inviteOptions,
        };
      });
      this.setData({
        projects: mappedProjects,
        invitations: invitations.invitations || [],
        connections,
      });
    } catch (error) {
      wx.showToast({ title: error.message || "加载失败", icon: "none" });
    }
  },

  toggleCreate() {
    this.setData({ showCreate: !this.data.showCreate });
  },

  updateProjectField(event) {
    this.setData({ [`projectForm.${event.currentTarget.dataset.field}`]: event.detail.value });
  },

  async createProject() {
    if (this.data.creating) return;
    const form = this.data.projectForm;
    const skills = cleanList(form.roleSkills);
    if (!form.title.trim() || !form.roleTitle.trim() || !skills.length) {
      wx.showToast({ title: "请补齐项目和缺口信息", icon: "none" });
      return;
    }
    const app = getApp();
    this.setData({ creating: true });
    try {
      const result = await app.globalData.api.post("/api/projects", {
        event_id: app.globalData.eventId,
        title: form.title.trim(),
        summary: form.summary.trim(),
        role_need: {
          title: form.roleTitle.trim(),
          skills,
          capacity: 2,
        },
      });
      this.setData({ showCreate: false });
      wx.navigateTo({ url: `/pages/room/room?projectId=${result.project.id}` });
    } catch (error) {
      wx.showToast({ title: error.message || "创建失败", icon: "none" });
    } finally {
      this.setData({ creating: false });
    }
  },

  async acceptInvitation(event) {
    const invitationId = event.currentTarget.dataset.invitationId;
    try {
      const result = await getApp().globalData.api.patch(
        `/api/team-invitations/${invitationId}`,
        { action: "accept" },
      );
      wx.navigateTo({ url: `/pages/room/room?projectId=${result.invitation.project_id}` });
    } catch (error) {
      wx.showToast({ title: error.message || "接受失败", icon: "none" });
    }
  },

  async inviteCandidate(event) {
    const project = this.data.projects.find(
      (item) => item.id === event.currentTarget.dataset.projectId,
    );
    const option = project?.inviteOptions.find(
      (item) => item.key === event.currentTarget.dataset.optionKey,
    );
    if (!project || !option) return;
    try {
      await getApp().globalData.api.post(`/api/projects/${project.id}/invitations`, {
        invitee_id: option.inviteeId,
        role_need_id: option.roleNeedId,
      });
      wx.showToast({ title: "入队邀请已发出", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error.message || "邀请失败", icon: "none" });
    }
  },

  openRoom(event) {
    wx.navigateTo({
      url: `/pages/room/room?projectId=${event.currentTarget.dataset.projectId}`,
    });
  },
});
