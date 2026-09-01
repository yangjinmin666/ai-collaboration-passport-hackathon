const PROFILE_STATUS_OPTIONS = Object.freeze([
  "未组队",
  "有 Idea 找人",
  "团队缺人",
  "已组队但可交流",
]);
const ALLOWED_PROFILE_STATUSES = new Set(PROFILE_STATUS_OPTIONS);
const PUBLIC_PROFILE_FIELDS = Object.freeze([
  "display_name",
  "avatar",
  "role",
  "status",
  "skills",
  "interests",
  "availability",
  "collaboration_preferences",
  "collaboration_need",
  "evidence",
  "platform_links",
]);

function cleanText(value) {
  return String(value || "").trim();
}

function cleanList(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/[,，、\n]/);
  return [...new Set(items.map(cleanText).filter(Boolean))];
}

function buildProfileInput(form = {}) {
  return {
    display_name: cleanText(form.displayName ?? form.display_name),
    role: cleanText(form.role),
    status: cleanText(form.status),
    skills: cleanList(form.skills),
    interests: cleanList(form.interests),
    availability: cleanText(form.availability),
    collaboration_preferences: cleanList(
      form.collaborationPreferences ?? form.collaboration_preferences,
    ),
    collaboration_need: cleanText(form.collaborationNeed ?? form.collaboration_need),
    evidence: cleanList(form.evidence),
  };
}

function validateProfileInput(profile) {
  if (!profile.display_name || profile.display_name.length > 40) {
    return { valid: false, message: "请填写 1–40 个字的名称" };
  }
  if (!profile.role || profile.role.length > 80) {
    return { valid: false, message: "请填写你在现场的角色" };
  }
  if (!ALLOWED_PROFILE_STATUSES.has(profile.status)) {
    return { valid: false, message: "请选择当前组队状态" };
  }
  if (profile.skills.length < 3 || profile.skills.length > 5) {
    return { valid: false, message: "请填写 3–5 个技能，用逗号分隔" };
  }
  if (profile.interests.length < 1 || profile.interests.length > 5) {
    return { valid: false, message: "请填写 1–5 个感兴趣的方向" };
  }
  if (!profile.availability || profile.availability.length > 120) {
    return { valid: false, message: "请填写今天可投入的时间" };
  }
  if (
    profile.collaboration_preferences.length < 1
    || profile.collaboration_preferences.length > 5
  ) {
    return { valid: false, message: "请填写 1–5 个协作偏好" };
  }
  if (!profile.collaboration_need || profile.collaboration_need.length > 160) {
    return { valid: false, message: "请说明你现在想找什么人或协作" };
  }
  if (profile.evidence.length > 12) {
    return { valid: false, message: "经历证据最多填写 12 项" };
  }
  return { valid: true, message: "" };
}

function connectionRequestView(request = {}) {
  if (request.status === "ACCEPTED") {
    return { tone: "success", label: "已连接", action: null };
  }
  if (request.status === "REQUESTED" && request.direction === "incoming") {
    return { tone: "active", label: "接受认识", action: "accept" };
  }
  if (request.status === "REQUESTED") {
    return { tone: "muted", label: "等待对方", action: null };
  }
  return { tone: "muted", label: "已结束", action: null };
}

function firstClaimableTask(tasks = []) {
  return tasks.find((task) => (
    task.status === "PROPOSED" && !task.confirmed_owner_id
  )) || null;
}

module.exports = {
  buildProfileInput,
  cleanList,
  connectionRequestView,
  firstClaimableTask,
  PROFILE_STATUS_OPTIONS,
  PUBLIC_PROFILE_FIELDS,
  validateProfileInput,
};
