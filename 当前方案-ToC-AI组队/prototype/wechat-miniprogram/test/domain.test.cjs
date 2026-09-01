const assert = require("node:assert/strict");
const { describe, test } = require("node:test");

const {
  buildProfileInput,
  connectionRequestView,
  firstClaimableTask,
  validateProfileInput,
} = require("../miniprogram/utils/domain.js");

describe("Mini Program public flow domain rules", () => {
  test("normalizes a profile form into the backend ProfileInput contract", () => {
    const profile = buildProfileInput({
      displayName: "  林海  ",
      role: " 嵌入式工程师 ",
      status: "未组队",
      skills: "ESP32，IoT\n硬件",
      interests: "AI 硬件、空间交互",
      availability: " 今晚可投入 4 小时 ",
      collaborationPreferences: "结对协作，快速原型",
      collaborationNeed: " 寻找产品与设计搭档 ",
      evidence: "两次硬件黑客松",
    });

    assert.deepEqual(profile, {
      display_name: "林海",
      role: "嵌入式工程师",
      status: "未组队",
      skills: ["ESP32", "IoT", "硬件"],
      interests: ["AI 硬件", "空间交互"],
      availability: "今晚可投入 4 小时",
      collaboration_preferences: ["结对协作", "快速原型"],
      collaboration_need: "寻找产品与设计搭档",
      evidence: ["两次硬件黑客松"],
    });
    assert.deepEqual(validateProfileInput(profile), { valid: true, message: "" });
  });

  test("reports the first actionable profile validation failure", () => {
    const result = validateProfileInput({
      display_name: "林海",
      role: "工程师",
      status: "未组队",
      skills: ["ESP32", "IoT"],
      interests: ["AI 硬件"],
      availability: "今晚",
      collaboration_preferences: ["结对协作"],
      collaboration_need: "寻找设计搭档",
      evidence: [],
    });

    assert.deepEqual(result, {
      valid: false,
      message: "请填写 3–5 个技能，用逗号分隔",
    });
  });

  test("maps connection request state to the action the participant can take", () => {
    assert.deepEqual(
      connectionRequestView({ direction: "incoming", status: "REQUESTED" }),
      { tone: "active", label: "接受认识", action: "accept" },
    );
    assert.deepEqual(
      connectionRequestView({ direction: "outgoing", status: "REQUESTED" }),
      { tone: "muted", label: "等待对方", action: null },
    );
    assert.deepEqual(
      connectionRequestView({ direction: "incoming", status: "ACCEPTED" }),
      { tone: "success", label: "已连接", action: null },
    );
  });

  test("selects only an unowned proposed task for human claim", () => {
    const tasks = [
      { id: "owned", status: "ACCEPTED", confirmed_owner_id: "user-1" },
      { id: "claimable", status: "PROPOSED", confirmed_owner_id: null },
      { id: "later", status: "PROPOSED", confirmed_owner_id: null },
    ];

    assert.equal(firstClaimableTask(tasks).id, "claimable");
    assert.equal(firstClaimableTask([{ id: "done", status: "COMPLETED" }]), null);
  });
});
