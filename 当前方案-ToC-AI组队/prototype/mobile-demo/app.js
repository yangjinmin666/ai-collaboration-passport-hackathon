/*
 * PROTOTYPE — throwaway mobile UI.
 * Three variants of the nearby-discovery experience, switchable via ?variant=.
 */

const currentUser = {
  id: "zhou",
  name: "周闻",
  monogram: "ZW",
  avatar: "memoji-5",
  role: "AI / 后端构建者",
  skills: ["Agent", "API", "端侧 AI"],
};

const people = [
  {
    id: "lin",
    name: "林澈",
    monogram: "LC",
    avatar: "memoji-4",
    role: "硬件构建者",
    skills: ["嵌入式", "IoT", "结构打样"],
    status: "未组队",
    proximity: "很近",
    signal: 3,
    glyph: "glyph-orbit",
    evidence: "做过 3 个 ESP32 端侧项目",
    reason: "你的项目缺硬件闭环；林澈能把模型能力落到真实设备。",
    caution: "现场可投入时间还没有确认",
    fit: "补齐硬件",
    fitDetail: "核心缺口",
    pairLabel: "AI × HARDWARE",
    teamRole: "硬件",
  },
  {
    id: "su",
    name: "苏晴",
    monogram: "SQ",
    avatar: "memoji-1",
    role: "交互设计师",
    skills: ["交互", "视觉", "路演"],
    status: "可交流",
    proximity: "附近",
    signal: 2,
    glyph: "glyph-grid",
    evidence: "两次黑客松最佳设计奖",
    reason: "她能补齐产品表达和现场演示，让技术原型更容易被理解。",
    caution: "目前优先寻找有社会议题的项目",
    fit: "补齐设计",
    fitDetail: "演示表达",
    pairLabel: "AI × DESIGN",
    teamRole: "设计",
  },
  {
    id: "qixi",
    name: "七喜",
    monogram: "QX",
    avatar: "memoji-2",
    role: "创意技术开发者",
    skills: ["生成艺术", "WebGL", "声音交互"],
    status: "正在找队伍",
    proximity: "很近",
    signal: 3,
    glyph: "glyph-cross",
    evidence: "做过 4 个生成式互动装置",
    reason: "她能把碰卡动作变成可感知的现场反馈，让硬件交互更有记忆点。",
    caution: "对后端与供应链不熟悉",
    fit: "增强体验",
    fitDetail: "可选能力",
    pairLabel: "AI × CREATIVE",
    teamRole: "创意技术",
  },
  {
    id: "shenlan",
    name: "沈蓝",
    monogram: "SL",
    avatar: "memoji-3",
    role: "隐私与身份工程师",
    skills: ["数字身份", "权限", "端侧隐私"],
    status: "项目 SOS",
    proximity: "附近",
    signal: 2,
    glyph: "glyph-grid",
    evidence: "负责过匿名社交产品的隐私模型",
    reason: "她能快速检查公开身份、碰卡授权和拉黑机制是否存在隐私漏洞。",
    caution: "只接受 1 小时以内的定点支援",
    fit: "安全救援",
    fitDetail: "SOS 支援",
    pairLabel: "AI × PRIVACY",
    teamRole: "隐私",
  },
  {
    id: "baiyu",
    name: "白榆",
    monogram: "BY",
    avatar: "memoji-8",
    role: "多模态算法工程师",
    skills: ["Embedding", "RAG", "推荐"],
    status: "可支援",
    proximity: "同场",
    signal: 1,
    glyph: "glyph-orbit",
    evidence: "开源过 2 个轻量级语义检索项目",
    reason: "她能把能力标签检索做成可解释推荐，而不是给人一个生硬匹配分。",
    caution: "不会参与硬件打样",
    fit: "模型支援",
    fitDetail: "可支援",
    pairLabel: "AI × MODEL",
    teamRole: "算法",
  },
  {
    id: "miya",
    name: "米娅",
    monogram: "MY",
    avatar: "memoji-9",
    role: "品牌与路演设计师",
    skills: ["品牌", "叙事", "Demo Day"],
    status: "已组队 · 可支援",
    proximity: "附近",
    signal: 2,
    glyph: "glyph-sun",
    evidence: "辅导过 6 支黑客松团队完成路演",
    reason: "她能把从发现到碰卡建联的核心故事压缩成评委一眼看懂的 90 秒演示。",
    caution: "仅在今晚彩排时段有空",
    fit: "补齐路演",
    fitDetail: "冲刺阶段",
    pairLabel: "AI × STORY",
    teamRole: "路演",
  },
  {
    id: "qiaohe",
    name: "乔禾",
    monogram: "QH",
    avatar: "memoji-7",
    role: "用户研究与现场运营",
    skills: ["访谈", "可用性测试", "活动运营"],
    status: "现场支援",
    proximity: "同场",
    signal: 1,
    glyph: "glyph-grid",
    evidence: "现场完成过 30 人快速概念测试",
    reason: "她可以直接帮你们在会场验证：用户是否愿意公开状态并主动碰卡。",
    caution: "需要先给出明确的三个验证问题",
    fit: "现场验证",
    fitDetail: "快速反馈",
    pairLabel: "AI × RESEARCH",
    teamRole: "用户研究",
  },
  {
    id: "alan",
    name: "阿岚",
    monogram: "AL",
    avatar: "memoji-10",
    role: "产品发起人",
    skills: ["产品", "用户研究", "商业"],
    status: "团队招人",
    proximity: "同场",
    signal: 1,
    glyph: "glyph-cross",
    evidence: "从 0 到 1 做过开发者社区",
    reason: "你们对开发者协作有共同兴趣，适合交换用户验证方法。",
    caution: "双方项目方向暂时不同",
    fit: "交换验证",
    fitDetail: "同类赛道",
    pairLabel: "AI × PRODUCT",
    teamRole: "产品",
  },
  {
    id: "aguang",
    name: "阿光",
    monogram: "AG",
    avatar: "memoji-6",
    role: "开发者社区增长",
    skills: ["社区", "内容", "裂变"],
    status: "团队急聘",
    proximity: "附近",
    signal: 2,
    glyph: "glyph-sun",
    evidence: "运营过 8000 人 AI 开发者社群",
    reason: "他能帮助验证黑客松现场裂变路径，并设计碰卡后的邀请与分享机制。",
    caution: "更关心获客，不负责产品交互",
    fit: "增长支援",
    fitDetail: "获客裂变",
    pairLabel: "AI × GROWTH",
    teamRole: "增长",
  },
  {
    id: "hanche",
    name: "韩彻",
    monogram: "HC",
    avatar: "memoji-11",
    role: "安全研究员",
    skills: ["红队", "风控", "滥用防护"],
    status: "项目 SOS",
    proximity: "同场",
    signal: 1,
    glyph: "glyph-orbit",
    evidence: "做过社交产品反骚扰与举报系统",
    reason: "他能在半小时内审查建联、撤回与拉黑边界，避免 Demo 留下明显安全漏洞。",
    caution: "只处理明确的安全问题清单",
    fit: "安全加固",
    fitDetail: "SOS 支援",
    pairLabel: "AI × SECURITY",
    teamRole: "安全",
  },
  {
    id: "carlo",
    name: "卡洛",
    monogram: "KL",
    avatar: "memoji-12",
    role: "工业与结构设计师",
    skills: ["CMF", "结构", "快速打样"],
    status: "正在找队伍",
    proximity: "附近",
    signal: 2,
    glyph: "glyph-cross",
    evidence: "48 小时内完成过可佩戴设备外壳",
    reason: "他能把 NFC 卡片和未来墨水屏工牌做成可佩戴、可展示的实体原型。",
    caution: "需要今天内冻结尺寸和器件清单",
    fit: "补齐结构",
    fitDetail: "工牌落地",
    pairLabel: "AI × INDUSTRIAL",
    teamRole: "工业设计",
  },
];

// The discovery dataset is never truncated by the UI. AI ranking changes order,
// not eligibility: every nearby person remains available in every discovery view.
const rankedPeople = [...people];
const radarPeople = rankedPeople;

// These fields represent participant-authored profile content. They are kept
// separate from Agent-generated ranking reasons so the UI never presents a
// model summary as something the participant wrote.
const participantProfiles = {
  lin: {
    bio: "我喜欢把屏幕里的概念做成真正能被拿起来、戴在身上的东西。这次带了 ESP32、几块小屏和 NFC 模块，希望找懂 AI 或产品的队友，一起在现场做出可以演示的完整闭环。",
    location: "上海",
    availability: "今天可投入 12 小时",
    collaboration: "喜欢先定义接口和验收标准，再快速打样。",
    projects: [
      { title: "离线会议提醒器", detail: "ESP32 + 墨水屏，48 小时完成硬件与外壳打样。", tags: ["ESP32", "E-ink"] },
      { title: "桌面空气质终端", detail: "完成传感器选型、PCB 联调与小批量组装。", tags: ["IoT", "结构打样"] },
    ],
  },
  su: {
    bio: "我是交互设计师，关心复杂技术如何在三十秒内被人看懂。习惯边画、边问、边改，也可以帮团队整理路演叙事。",
    location: "杭州",
    availability: "本次活动可投入 8 小时",
    collaboration: "偏好用可点击原型尽早验证，不在第一版追求视觉细节。",
    projects: [
      { title: "无障碍导览地图", detail: "负责现场调研、交互原型与 Demo Day 表达。", tags: ["用户研究", "路演"] },
      { title: "AI 学习伙伴", detail: "设计从对话到学习计划的可解释转化流程。", tags: ["AI UX", "原型"] },
    ],
  },
  qixi: {
    bio: "我用代码做视觉、声音和空间交互。比起在屏幕上再加一个按钮，我更想让一个动作本身变成有记忆点的反馈。",
    location: "北京",
    availability: "今天可投入 10 小时",
    collaboration: "先做一个能被感知的核心瞬间，再向外补全功能。",
    projects: [
      { title: "Breath Canvas", detail: "让现场声音实时驱动 WebGL 粒子与灯光。", tags: ["WebGL", "声音交互"] },
      { title: "Touch Echo", detail: "通过触摸与振动构建双人互动装置。", tags: ["生成艺术", "传感器"] },
    ],
  },
  shenlan: {
    bio: "我专注数字身份和隐私设计，尤其关心用户到底授权了什么、授权多久、如何撤回。这次主要提供短时审查和边界检查。",
    location: "深圳",
    availability: "可提供 1 小时定点支援",
    collaboration: "请先给出数据流和权限清单，我会返回可执行的修改项。",
    projects: [{ title: "匿名社区权限模型", detail: "设计分层公开、授权到期和拉黑后的数据隔离。", tags: ["权限", "隐私"] }],
  },
  baiyu: {
    bio: "我在做轻量级语义检索和可解释推荐，希望系统告诉用户‘为什么’，而不是只丢出一个百分比。",
    location: "上海",
    availability: "可投入 4 小时",
    collaboration: "适合快速评审检索、排序与评估方案。",
    projects: [{ title: "Tiny Semantic Search", detail: "开源端侧语义检索 Demo，支持证据反查。", tags: ["Embedding", "RAG"] }],
  },
  miya: {
    bio: "我帮早期团队找到一句话能讲清的价值，再把这句话变成品牌、Demo 和路演节奏。",
    location: "香港",
    availability: "今晚彩排时段可投入 2 小时",
    collaboration: "带着可运行的 Demo 和真实用户反馈来，我会帮你们压缩叙事。",
    projects: [{ title: "6 支黑客松团队路演", detail: "从核心冲突、现场演示到 90 秒叙事完成辅导。", tags: ["品牌", "Demo Day"] }],
  },
  qiaohe: {
    bio: "我做现场用户研究和活动运营，擅长在很短时间里把一个模糊问题变成可观察的行为。",
    location: "广州",
    availability: "可投入 4 小时",
    collaboration: "请先冻结三个验证问题，再一起去现场拉人测试。",
    projects: [{ title: "30 人快速概念测试", detail: "在一天内完成招募、访谈、记录与问题排序。", tags: ["访谈", "可用性测试"] }],
  },
  alan: {
    bio: "我在做开发者协作产品，关心新团队如何从‘认识’走到真正开工。这次也想交换现场验证方法。",
    location: "北京",
    availability: "可投入 8 小时",
    collaboration: "喜欢先明确假设、证据和停止条件。",
    projects: [{ title: "开发者共创社区", detail: "从 0 到 1 搭建项目匹配与共创活动流程。", tags: ["产品", "社区"] }],
  },
  aguang: {
    bio: "我做开发者社区和内容增长，尤其关心一个好产品如何让第一批用户愿意带来下一个人。",
    location: "成都",
    availability: "可投入 6 小时",
    collaboration: "我可以帮忙拆解现场获客、分享和邀请链路。",
    projects: [{ title: "AI 开发者社群", detail: "运营 8000 人社群，建立内容、活动与邀请增长机制。", tags: ["社区", "增长"] }],
  },
  hanche: {
    bio: "我做社交产品的滥用防护和红队测试。如果你们有明确的建联、撤回或拉黑流程，我可以快速找出最危险的缺口。",
    location: "深圳",
    availability: "可提供 1 小时安全审查",
    collaboration: "需要一份明确的安全问题清单和当前流程。",
    projects: [{ title: "社交产品反骚扰系统", detail: "建立举报、拉黑、限频与审计链路。", tags: ["风控", "红队"] }],
  },
  carlo: {
    bio: "我做工业设计和快速结构打样，喜欢让一个原本只有线框图的产品在 48 小时内变成真正能拿在手里的原型。",
    location: "苏州",
    availability: "可投入 10 小时",
    collaboration: "今天内需要冻结尺寸、器件和佩戴方式。",
    projects: [{ title: "48h 可穿戴设备外壳", detail: "完成 CMF、内部堆叠、3D 打印与佩戴测试。", tags: ["CMF", "结构"] }],
  },
};

const availabilityHoursByPerson = {
  lin: 12,
  su: 8,
  qixi: 10,
  shenlan: 1,
  baiyu: 4,
  miya: 2,
  qiaohe: 4,
  alan: 8,
  aguang: 6,
  hanche: 1,
  carlo: 10,
};
const publicEvidencePeople = new Set(["lin", "su", "baiyu", "miya", "aguang", "carlo"]);
const defaultDiscoveryFilters = () => ({
  statuses: [],
  roles: [],
  minimumHours: 0,
  distance: "event",
  evidenceRequired: false,
});

const variantNames = {
  A: "发现 · 推荐",
  B: "发现 · 附近",
  C: "发现 · 名册",
};

const initialParams = new URLSearchParams(location.search);
const startsInOnboarding = initialParams.get("onboarding") === "1";
const startsInWorkspace = initialParams.get("workspace") === "1" && !startsInOnboarding;
const storedAccessToken = localStorage.getItem("rally_access_token");

function resolveApiBase() {
  const explicitlyTrustedBase = localStorage.getItem("rally_api_base");
  const candidate = storedAccessToken
    ? (explicitlyTrustedBase || location.origin)
    : (initialParams.get("apiBase") || "http://127.0.0.1:8787");
  try {
    const url = new URL(candidate, location.href);
    if (!["http:", "https:"].includes(url.protocol)) return location.origin;
    return url.href.replace(/\/$/, "");
  } catch {
    return location.origin;
  }
}

const liveConfig = {
  enabled: initialParams.get("live") === "1",
  apiBase: resolveApiBase(),
  eventId: initialParams.get("event") || "hackathon-2026",
  demoUserId: initialParams.get("demoUser") || "user-zhou",
  accessToken: storedAccessToken,
};
const platformCatalog = {
  github: { label: "GitHub", hint: "https://github.com/用户名" },
  jike: { label: "即刻", hint: "https://web.okjike.com/u/..." },
  xiaohongshu: { label: "小红书", hint: "https://www.xiaohongshu.com/user/profile/..." },
  douyin: { label: "抖音", hint: "https://www.douyin.com/user/..." },
  linkedin: { label: "LinkedIn", hint: "https://www.linkedin.com/in/..." },
  website: { label: "作品链接", hint: "https://你的作品地址" },
  other: { label: "其他链接", hint: "https://你的公开资料地址" },
};

const state = {
  variant: readVariant(),
  onboarding: startsInOnboarding,
  onboardingStep: 0,
  collaborationStatus: "TEAM_RECRUITING",
  connectedSources: ["GitHub"],
  previewMode: "mobile",
  draftVersion: 0,
  recommendationIndex: 0,
  workspaceSection: "overview",
  workspaceStarted: false,
  workspaceSos: false,
  assignmentOverrides: {},
  tab: startsInWorkspace ? "collaboration" : "discover",
  selectedId: "lin",
  visible: liveConfig.enabled ? false : !startsInOnboarding,
  stage: "browse",
  greeted: startsInWorkspace ? ["lin"] : [],
  connected: startsInWorkspace ? ["lin"] : [],
  invited: startsInWorkspace ? ["lin"] : [],
  joined: startsInWorkspace ? ["lin"] : [],
  connectionFilter: "all",
  discoveryFilters: defaultDiscoveryFilters(),
  discoveryFilterDraft: defaultDiscoveryFilters(),
  acceptedTasks: [],
  live: {
    enabled: liveConfig.enabled,
    started: false,
    watcherId: null,
    requestInFlight: false,
    status: liveConfig.enabled ? "idle" : "demo",
    nearby: [],
    platformLinks: [],
    meLoaded: false,
    meLoading: false,
    error: "",
    lastUpdatedAt: null,
  },
  toast: "",
  overlay: null,
  personDetailExpanded: false,
};

const app = document.querySelector("#app");

function readVariant() {
  const key = new URLSearchParams(location.search).get("variant")?.toUpperCase();
  return ["A", "B", "C"].includes(key) ? key : "A";
}

function setVariant(key) {
  state.variant = key;
  const url = new URL(location.href);
  url.searchParams.set("variant", key);
  history.replaceState({}, "", url);
  render();
}

function selectedPerson() {
  return people.find((person) => person.id === state.selectedId)
    || state.live?.nearby.find((person) => person.id === state.selectedId)
    || people[0];
}

function selectedParticipantProfile(person = selectedPerson()) {
  return participantProfiles[person.id] || {
    bio: "这位参与者还没有填写公开的个人简介。",
    location: "本场活动",
    availability: "投入时间待确认",
    collaboration: "协作偏好待确认",
    projects: [],
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeLiveText(value, fallback, maximumLength = 160) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return escapeHtml(value.trim().slice(0, maximumLength));
}

function activeRadarPeople() {
  if (!state.live.enabled) return radarPeople;
  if (state.live.status === "connected" || state.live.status === "requesting") {
    return state.live.nearby;
  }
  return radarPeople;
}

function roleFilterFor(person) {
  const searchable = `${person.role || ""} ${(person.skills || []).join(" ")} ${person.teamRole || ""}`;
  if (/硬件|嵌入式|IoT|结构|工业|CMF|打样/i.test(searchable)) return "hardware";
  if (/交互|视觉|品牌|创意|WebGL|路演|叙事/i.test(searchable)) return "design";
  if (/算法|Embedding|RAG|推荐|Agent|API|后端|AI/i.test(searchable)) return "ai";
  if (/安全|隐私|身份|风控|红队/i.test(searchable)) return "safety";
  if (/增长|社区|内容|裂变|运营/i.test(searchable)) return "growth";
  return "product";
}

function statusFilterFor(person) {
  const status = person.status || "";
  if (/未组队|找队伍|正在找/.test(status)) return "seeking";
  if (/招人|急聘|团队缺人/.test(status)) return "recruiting";
  return "support";
}

function availableHoursFor(person) {
  if (Number.isFinite(person.availabilityHours)) return person.availabilityHours;
  if (availabilityHoursByPerson[person.id] !== undefined) return availabilityHoursByPerson[person.id];
  const hours = String(person.availability || "").match(/(\d+(?:\.\d+)?)\s*小?时/);
  return hours ? Number(hours[1]) : 0;
}

function hasPublicEvidence(person) {
  if (typeof person.hasPublicEvidence === "boolean") return person.hasPublicEvidence;
  return publicEvidencePeople.has(person.id);
}

function distanceSignalFor(person) {
  return Number.isFinite(person.signal) ? person.signal : 1;
}

function filterDiscoveryPeople(pool, filters = state.discoveryFilters) {
  return pool.filter((person) => {
    if (filters.statuses.length && !filters.statuses.includes(statusFilterFor(person))) return false;
    if (filters.roles.length && !filters.roles.includes(roleFilterFor(person))) return false;
    if (availableHoursFor(person) < filters.minimumHours) return false;
    if (filters.distance === "nearby" && distanceSignalFor(person) < 2) return false;
    if (filters.distance === "very_near" && distanceSignalFor(person) < 3) return false;
    if (filters.evidenceRequired && !hasPublicEvidence(person)) return false;
    return true;
  });
}

function activeDiscoveryFilterCount(filters = state.discoveryFilters) {
  return [
    filters.statuses.length > 0,
    filters.roles.length > 0,
    filters.minimumHours > 0,
    filters.distance !== "event",
    filters.evidenceRequired,
  ].filter(Boolean).length;
}

function livePerson(person) {
  const localId = String(person.user_id || "")
    .replace(/^user-/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64) || "nearby-user";
  const preset = people.find((item) => item.id === localId);
  const displayName = safeLiveText(person.display_name, "现场协作者", 40);
  const role = safeLiveText(person.role, "已授权活动成员", 80);
  const status = safeLiveText(person.status, "活动中", 40);
  const avatar = typeof person.avatar === "string" && /^memoji-\d+$/.test(person.avatar)
    ? person.avatar
    : undefined;
  const skills = Array.isArray(person.skills)
    ? person.skills.slice(0, 12).map((skill) => safeLiveText(skill, "", 40)).filter(Boolean)
    : [];
  const evidenceItems = Array.isArray(person.evidence)
    ? person.evidence.slice(0, 8).map((item) => safeLiveText(item, "", 120)).filter(Boolean)
    : [];
  const platformLinks = Array.isArray(person.platform_links) ? person.platform_links : [];
  const signal = person.distance?.band === "under_50m"
    ? 3
    : person.distance?.band === "under_200m"
      ? 2
      : 1;
  return {
    id: preset?.id || localId,
    name: displayName,
    monogram: displayName.slice(0, 2).toUpperCase(),
    glyph: preset?.glyph || "glyph-orbit",
    avatar,
    role,
    status,
    skills,
    availability: safeLiveText(person.availability, "", 120),
    proximity: safeLiveText(person.distance?.label, "活动现场", 40),
    evidence: evidenceItems[0] || "活动内授权公开资料",
    hasPublicEvidence: evidenceItems.length > 0 || platformLinks.length > 0,
    reason: "对方正在同一活动现场，可以直接当面确认协作意图。",
    caution: "具体投入时间和分工仍需当面确认",
    fit: "同场协作",
    fitDetail: "真实定位",
    pairLabel: "RALLY × LIVE",
    teamRole: role,
    signal,
  };
}

function glyph(person, size = "md") {
  if (person.avatar) return `<span class="memoji-avatar ${person.avatar} glyph-${size}" aria-label="${person.name || "默认头像"}"></span>`;
  return `<span class="identity-glyph ${person.glyph} glyph-${size}" aria-hidden="true"><i></i><b>${person.monogram}</b></span>`;
}

function signalBars(level) {
  return `<span class="signal-bars" aria-label="距离信号 ${level} 格">
    ${[1, 2, 3].map((item) => `<i class="${item <= level ? "on" : ""}"></i>`).join("")}
  </span>`;
}

function render() {
  document.body.dataset.variant = state.variant;
  document.body.dataset.flow = state.onboarding ? "onboarding" : "product";
  document.body.dataset.tab = state.tab;
  const phone = `
    <main class="prototype-stage">
      <section class="phone-shell" aria-label="RALLY 集结手机端原型">
        <div class="phone-status"><span>09:41</span><span class="phone-island"></span><span>5G&nbsp;&nbsp;●</span></div>
        <div class="screen">
          ${state.onboarding ? renderOnboarding() : renderCurrentView()}
        </div>
        ${state.onboarding ? "" : renderAppNav()}
      </section>
      <aside class="prototype-notes">
        <p class="eyebrow">${state.onboarding ? "RALLY / PASSPORT ASSEMBLY" : `RALLY / MOBILE / ${state.variant}`}</p>
        <h1>${state.onboarding ? "协作护照引导" : variantNames[state.variant]}</h1>
        <p>${state.onboarding ? "借鉴 Bonjour 的低负担资料搭建方式，但把流程重心改成当下协作意图、能力证据和用户授权。" : variantDescription()}</p>
        ${renderStateLedger()}
      </aside>
    </main>
  `;

  app.innerHTML = `${phone}${renderOverlay()}${renderToast()}`;
  bindEvents();
  syncLivePresenceLifecycle();
}

function collaborationStatusLabel() {
  const labels = {
    SEEKING_TEAM: "正在找队伍",
    IDEA_RECRUITING: "有想法，正在组队",
    TEAM_RECRUITING: "团队补位中",
    TEAMED_OPEN: "已组队，可交流",
  };
  return labels[state.collaborationStatus] || labels.TEAM_RECRUITING;
}

function collaborationNeedLabel() {
  const labels = {
    SEEKING_TEAM: "寻找可加入的项目",
    IDEA_RECRUITING: "共同发起者 × 1",
    TEAM_RECRUITING: "硬件构建者 × 1",
    TEAMED_OPEN: "可支援 Agent / API",
  };
  return labels[state.collaborationStatus] || labels.TEAM_RECRUITING;
}

function renderOnboarding() {
  const steps = [renderOnboardingStatus, renderOnboardingSources, renderOnboardingDraft, renderOnboardingPreview];
  return `<div class="onboarding-shell view-c">
    <header class="onboarding-header">
      <button class="onboarding-back" data-action="onboarding-back" aria-label="返回">${state.onboardingStep ? "←" : "×"}</button>
      <div class="onboarding-progress" aria-label="第 ${state.onboardingStep + 1} 步，共 4 步"><span style="width:${(state.onboardingStep + 1) * 25}%"></span></div>
      <strong>${state.onboardingStep + 1} / 4</strong>
    </header>
    ${steps[state.onboardingStep]()}
  </div>`;
}

function onboardingGuide(kicker, title, body) {
  return `<section class="passport-guide">
    <span class="guide-mark">P·AI</span>
    <div><p>${kicker}</p><h2>${title}</h2><span>${body}</span></div>
  </section>`;
}

function renderOnboardingStatus() {
  const choices = [
    ["SEEKING_TEAM", "正在找队伍", "我有能力，想加入一个值得做的项目"],
    ["IDEA_RECRUITING", "有想法，正在组队", "方向还在成形，寻找共同发起者"],
    ["TEAM_RECRUITING", "团队补位中", "项目已明确，正在补齐关键角色"],
    ["TEAMED_OPEN", "已组队，可交流", "不招人，但愿意认识和支援别人"],
  ];
  return `<div class="onboarding-step">
    ${onboardingGuide("LIVE INTENT", "你现在来现场，最需要什么？", "先表达此刻的协作状态。它会自动到期，不会变成永久职业标签。")}
    <section class="status-choice-list">
      ${choices.map(([id, title, desc], index) => `<button class="status-choice ${state.collaborationStatus === id ? "selected" : ""}" data-action="choose-status" data-status="${id}"><span>0${index + 1}</span><div><strong>${title}</strong><small>${desc}</small></div><i>${state.collaborationStatus === id ? "●" : "○"}</i></button>`).join("")}
    </section>
    <div class="visibility-receipt"><span>公开范围</span><strong>仅本场活动</strong><em>活动结束自动隐藏</em></div>
    ${renderOnboardingFooter("下一步 · 组装能力证据")}
  </div>`;
}

function renderOnboardingSources() {
  const sources = [
    ["GitHub", "GH", "代码与项目"],
    ["即刻", "JK", "构建动态"],
    ["小红书", "RED", "内容与作品"],
    ["作品链接", "URL", "Demo／案例"],
  ];
  return `<div class="onboarding-step">
    ${onboardingGuide("EVIDENCE FIRST", "不用从头写简历。", "从你已经留下的数字痕迹开始，AI 只提取草稿，公开前仍由你逐项确认。")}
    <section class="source-grid">
      ${sources.map(([name, mark, desc]) => { const active = state.connectedSources.includes(name); return `<button class="source-card ${active ? "connected" : ""}" data-action="toggle-source" data-source="${name}"><span>${mark}</span><div><strong>${name}</strong><small>${desc}</small></div><em>${active ? "已连接" : "添加"}</em></button>`; }).join("")}
    </section>
    <article class="now-building-card">
      <div><p># NOW BUILDING</p><span>从 GitHub 草稿中找到</span></div>
      <h3>离线会议洞察终端</h3>
      <p>让线下讨论自动沉淀为可检索的决策、分歧与行动项。</p>
      <div><span>TypeScript</span><span>Agent</span><span>7 commits this week</span></div>
    </article>
    ${renderOnboardingFooter("交给 AI 生成草稿", "暂时跳过")}
  </div>`;
}

function renderOnboardingDraft() {
  const draft = state.draftVersion % 2 === 0
    ? {
        role: "AI / 后端构建者",
        summary: "Agent 将现场对话转成可执行决策",
        vibe: "先跑通真实闭环，再把系统做漂亮；喜欢和能快速落地的人一起工作。",
      }
    : {
        role: "AI 产品 / Agent 构建者",
        summary: "把离线讨论压缩成可检索、可追踪的团队行动",
        vibe: "擅长把模糊问题做成能演示的产品；现在想认识愿意一起打磨硬件闭环的人。",
      };
  return `<div class="onboarding-step">
    ${onboardingGuide("AI DRAFT / REVIEW", "这是草稿，不是 AI 对你的定义。", "我们把证据、Now Building 和当前需求拼成协作护照；你决定哪些内容对外出现。")}
    <section class="draft-passport">
      <div class="draft-head"><span class="memoji-avatar memoji-5 draft-avatar" aria-label="周闻的默认头像"></span><div><h3>周闻</h3><p>${draft.role}</p></div><button data-action="draft-refresh">AI 重组</button></div>
      <div class="draft-section"><span>NOW BUILDING</span><strong>离线会议洞察终端</strong><small>${draft.summary}</small></div>
      <div class="draft-section"><span>能力证据</span><div class="draft-tags"><b>Agent</b><b>API</b><b>端侧 AI</b><b>GitHub 已连接</b></div></div>
      <div class="draft-section"><span>当前协作状态</span><strong>${collaborationStatusLabel()}</strong><small>当前意图：${collaborationNeedLabel()}</small></div>
      <div class="draft-section vibe-section"><span>BUILDER'S VIBE</span><p>${draft.vibe}</p></div>
    </section>
    <p class="consent-note">✓ 所有字段将由你确认后公开 · 不读取私信和非公开内容</p>
    ${renderOnboardingFooter("确认草稿 · 预览公开面")}
  </div>`;
}

function renderOnboardingPreview() {
  return `<div class="onboarding-step onboarding-preview-step">
    ${onboardingGuide("ONE IDENTITY / THREE SURFACES", "发布前，看一眼别人会看到什么。", "同一份协作身份会适配发现卡、完整护照和墨水屏，不需要重复维护。")}
    <div class="preview-tabs">
      ${[["mobile","发现卡"],["passport","完整护照"],["eink","工牌公开面"]].map(([id,label]) => `<button class="${state.previewMode === id ? "active" : ""}" data-action="preview-mode" data-mode="${id}">${label}</button>`).join("")}
    </div>
    ${renderOnboardingSurface()}
    <div class="publish-scope"><span>● 公开到今天 22:00</span><small>你可以随时暂停、修改或撤回</small></div>
    ${renderOnboardingFooter("公开协作护照 · 进入现场", "返回修改")}
  </div>`;
}

function renderOnboardingSurface() {
  if (state.previewMode === "eink") return `<div class="onboarding-eink"><div><span>● ${collaborationStatusLabel()}</span><em>至 22:00</em></div><h3>周闻 / ZW</h3><p>AI · 后端 · Agent</p><section><span>当前协作意图</span><strong>${collaborationNeedLabel()}</strong></section><footer><b>碰卡直接建联</b><span>P·0087</span></footer></div>`;
  if (state.previewMode === "passport") return `<article class="onboarding-full-passport"><header><span class="memoji-avatar memoji-5 draft-avatar" aria-label="周闻的默认头像"></span><div><h3>周闻</h3><p>AI / 后端构建者</p></div></header><p class="passport-vibe">“先跑通真实闭环，再把系统做漂亮。”</p><div><span>NOW BUILDING</span><strong>离线会议洞察终端</strong></div><div><span>项目证据</span><strong>GitHub · 7 commits this week</strong></div><div><span>${collaborationStatusLabel()}</span><strong>${collaborationNeedLabel()}</strong></div></article>`;
  return `<article class="onboarding-discovery-card"><div class="discovery-card-meta"><span>${collaborationStatusLabel()}</span><em>同场</em></div><h3>周闻</h3><p>AI / 后端构建者</p><div class="draft-tags"><b>Agent</b><b>API</b><b>端侧 AI</b></div><section><span>当前协作意图</span><strong>${collaborationNeedLabel()}</strong><small>可先在线表达意愿，也可当面碰卡直连</small></section></article>`;
}

function renderOnboardingFooter(primaryLabel, secondaryLabel = "稍后设置") {
  return `<footer class="onboarding-footer"><button class="text-action" data-action="skip-onboarding">${secondaryLabel}</button><button class="primary-button" data-action="${state.onboardingStep === 3 ? "publish-passport" : "onboarding-next"}">${primaryLabel}</button></footer>`;
}

function renderCurrentView() {
  if (state.tab === "connections") return renderConnections();
  if (state.tab === "collaboration") return renderCollaboration();
  if (state.tab === "profile") return renderProfile();
  if (state.variant === "B") return renderVariantB();
  if (state.variant === "C") return renderVariantC();
  return renderVariantA();
}

function commonHeader(title = "发现") {
  const filterCount = activeDiscoveryFilterCount();
  const filterButton = title === "发现"
    ? `<button class="discovery-filter-trigger ${filterCount ? "is-filtered" : ""}" data-action="open-discovery-filters" aria-label="设置筛选偏好${filterCount ? `，已启用 ${filterCount} 项` : ""}">
        <span aria-hidden="true"><i></i><i></i><i></i></span>${filterCount ? `<b>${filterCount}</b>` : ""}
      </button>`
    : "";
  return `
    <header class="app-header">
      <div class="app-header-start">${filterButton}<div class="app-brand"><strong>RALLY</strong><span>集结 · ${title}</span></div></div>
      <span class="event-context"><i></i>当前活动 · 2026</span>
    </header>
  `;
}

function renderDiscoveryTabs() {
  return `<nav class="discovery-tabs" aria-label="发现浏览方式">
    ${[["A", "推荐"], ["B", "附近"], ["C", "名册"]].map(([key, label]) => `
      <button class="${state.variant === key ? "active" : ""}" data-discovery-view="${key}" aria-pressed="${state.variant === key}">${label}</button>
    `).join("")}
  </nav>`;
}

function renderVariantA() {
  const recommendationPool = filterDiscoveryPeople(rankedPeople);
  const person = recommendedPerson(recommendationPool);
  if (!person) return renderDiscoveryEmpty("推荐");
  const currentIndex = state.recommendationIndex % recommendationPool.length;
  const nextPerson = recommendationPool[(currentIndex + 1) % recommendationPool.length];
  return `
    <div class="view view-a">
      ${commonHeader("发现")}
      ${renderDiscoveryTabs()}
      <section class="recommendation-intro">
        <div><span>为你的项目推荐</span><strong>${collaborationNeedLabel()}</strong></div>
        <em>${currentIndex + 1} / ${recommendationPool.length}</em>
      </section>
      <section class="recommendation-deck" aria-label="协作者推荐卡片">
        <article class="recommendation-card recommendation-card-next" aria-hidden="true">
          ${glyph(nextPerson, "xl")}
        </article>
        <article class="recommendation-card recommendation-card-active" tabindex="0" data-swipe-card data-person-id="${person.id}" aria-label="${person.name}，${person.role}。点击查看完整信息，左右滑动表达意愿">
          <header class="recommendation-card-head">
            <span class="status-pill status-open"><i></i>${person.status}</span>
            <span>${person.proximity}</span>
          </header>
          <div class="recommendation-person">
            ${glyph(person, "xl")}
            <div><h3>${person.name}</h3><p>${person.role}</p></div>
          </div>
          <div class="recommendation-skills">${person.skills.map((skill) => `<span>${skill}</span>`).join("")}</div>
          <section class="recommendation-evidence"><span>做过什么</span><strong>${person.evidence}</strong></section>
          <section class="recommendation-reason"><span>为什么值得聊</span><p>${person.reason}</p></section>
          <footer><span>点击查看完整信息</span><b>${person.fit}</b></footer>
          <div class="swipe-verdict swipe-verdict-no">暂不看</div>
          <div class="swipe-verdict swipe-verdict-yes">想认识</div>
        </article>
      </section>
      <section class="recommendation-actions" aria-label="推荐操作">
        <button class="recommendation-dismiss" data-action="dismiss-recommendation" data-person="${person.id}" aria-label="暂不看 ${person.name}"><span>×</span><small>暂不看</small></button>
        <button class="recommendation-detail" data-action="open-person" data-person="${person.id}" aria-label="查看 ${person.name} 的完整信息"><span>•••</span><small>看详情</small></button>
        <button class="recommendation-like" data-action="like-recommendation" data-person="${person.id}" aria-label="向 ${person.name} 表达想认识"><span>认识</span><small>想认识</small></button>
      </section>
      <p class="recommendation-hint"><span>← 左滑暂不看</span><span>右滑想认识 →</span></p>
      <section class="recommendation-progress" aria-label="推荐浏览进度">
        ${recommendationPool.map((item, index) => `<i class="${index === currentIndex ? "active" : ""}" title="${item.name}"></i>`).join("")}
      </section>
      <section class="recommendation-boundary">
        <span>线上只表达意愿</span>
        <p>线下碰卡后才会直接交换双方授权信息并建联。</p>
      </section>
    </div>
  `;
}

function renderDiscoveryEmpty(mode) {
  return `<div class="view view-${state.variant.toLowerCase()}">
    ${commonHeader("发现")}
    ${renderDiscoveryTabs()}
    <section class="discovery-filter-empty">
      <span class="empty-symbol">⌁</span>
      <p class="micro-label">STRICT FILTERS / 0 RESULT</p>
      <h3>当前筛选下暂无${mode}结果</h3>
      <p>RALLY 不会自动放宽你的筛选条件。调整状态、职能或投入时间后再查看。</p>
      <button class="primary-button" data-action="open-discovery-filters">调整筛选</button>
    </section>
  </div>`;
}

function recommendedPerson(pool = filterDiscoveryPeople(rankedPeople)) {
  if (!pool.length) return null;
  return pool[state.recommendationIndex % pool.length];
}

function advanceRecommendation(pool = filterDiscoveryPeople(rankedPeople)) {
  if (!pool.length) return;
  state.recommendationIndex = (state.recommendationIndex + 1) % pool.length;
  state.selectedId = recommendedPerson(pool).id;
}

function expressRecommendationInterest(personId) {
  const person = people.find((item) => item.id === personId) || recommendedPerson();
  if (!person) return;
  if (!state.greeted.includes(person.id)) state.greeted.push(person.id);
  showToast(`已向 ${person.name} 表达“想认识”`);
  advanceRecommendation();
}

function dismissRecommendation() {
  advanceRecommendation();
  showToast("已跳过，继续看下一位");
}

function radarPosition(index, total) {
  const innerCount = total > 8 ? Math.ceil(total * 0.36) : Math.min(total, 3);
  const onInnerRing = index < innerCount;
  const ringIndex = onInnerRing ? index : index - innerCount;
  const ringTotal = onInnerRing ? innerCount : Math.max(total - innerCount, 1);
  const radius = onInnerRing ? 25 : 38;
  const offset = onInnerRing ? -22 : -82;
  const angle = (offset + (ringIndex * 360) / ringTotal) * (Math.PI / 180);
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius;
  return `--radar-x:${x.toFixed(2)}%;--radar-y:${y.toFixed(2)}%`;
}

function renderVariantB() {
  const nearbyPeople = filterDiscoveryPeople(activeRadarPeople());
  const person = nearbyPeople.find((item) => item.id === state.selectedId)
    || nearbyPeople[0]
    || selectedPerson();
  const liveStatus = state.live.status === "connected"
    ? ["● 真实定位已连接", `最近更新 ${state.live.lastUpdatedAt || "刚刚"}`]
    : state.live.status === "requesting"
      ? ["○ 正在请求定位", "请允许浏览器使用当前位置"]
      : state.live.status === "error"
        ? ["○ 已使用演示数据", state.live.error || "真实定位暂不可用"]
        : ["● 手机前台发现", "仅在打开本页时更新，离开后停止"];
  return `
    <div class="view view-b">
      ${commonHeader("发现")}
      ${renderDiscoveryTabs()}
      <div class="mobile-discovery-note" aria-live="polite"><span>${liveStatus[0]}</span><small>${liveStatus[1]}</small></div>
      <section class="radar-copy">
        <span class="status-pill ${state.visible ? "status-open" : "status-paused"}"><i></i>${state.visible ? "附近可见" : "已暂停展示"}</span>
        <h3>附近有 ${nearbyPeople.length} 位协作者</h3>
        <p>已根据你正在补齐的能力排序。点击头像，看看为什么值得聊。</p>
      </section>
      <section class="radar-field" aria-label="附近人员扫描区">
        <div class="radar-sweep"></div>
        <button class="radar-self" data-tab="profile" aria-label="打开我的身份">${glyph(currentUser, "sm")}</button>
        ${nearbyPeople.map((item, index) => `
          <button class="radar-person ${state.selectedId === item.id ? "active" : ""}" style="${radarPosition(index, nearbyPeople.length)}" data-person="${item.id}" aria-label="选择 ${item.name}">
            ${glyph(item, "sm")}
            <span class="radar-person-name">${item.name}</span>
          </button>
        `).join("")}
      </section>
      ${nearbyPeople.length ? `<section class="radar-ticket">
        <div class="ticket-head">
          ${glyph(person, "sm")}
          <div><p>${person.name}</p><span>${person.role} · ${person.proximity}</span></div>
          ${signalBars(person.signal)}
        </div>
        <p class="ticket-reason">${person.reason}</p>
        <div class="ticket-actions">
          <button class="secondary-button" data-action="next-person">换一个</button>
          <button class="primary-button" data-action="open-person" data-person="${person.id}">查看为什么</button>
        </div>
      </section>` : `<section class="radar-ticket"><p class="ticket-reason">${activeDiscoveryFilterCount() ? "附近暂时没有同时满足当前筛选条件的人，RALLY 没有自动放宽条件。" : "暂未发现仍在活动内公开位置的协作者。定位只在本页前台开启，并会在离开后立即停止。"}</p>${activeDiscoveryFilterCount() ? `<button class="secondary-button full" data-action="open-discovery-filters">调整筛选</button>` : ""}</section>`}
    </div>
  `;
}

function renderVariantC() {
  const directoryPeople = filterDiscoveryPeople(people);
  if (!directoryPeople.length) return renderDiscoveryEmpty("名册");
  return `
    <div class="view view-c">
      ${commonHeader("发现")}
      ${renderDiscoveryTabs()}
      <section class="directory-copy"><span class="status-pill status-open"><i></i>本场活动</span><h3>活动名册</h3><p>查看明确授权参加当前活动的成员，名册仍属于你手机上的发现页。</p></section>
      <section class="ledger-status">
        <div><span>可见成员</span><strong>${String(directoryPeople.length).padStart(2, "0")} 人</strong></div>
        <div><span>当前筛选</span><strong>${activeDiscoveryFilterCount() ? `${activeDiscoveryFilterCount()} 项条件` : "全部角色"}</strong></div>
        <div><span>排序方式</span><strong>项目缺口</strong></div>
      </section>
      <div class="ledger-rule"><span>按当前缺口优先</span><b>EVENT DIRECTORY</b></div>
      <section class="ledger-list">
        ${directoryPeople.map((person) => `
          <button class="ledger-person" data-person="${person.id}">
            ${glyph(person, "xs")}
            <span class="ledger-main">
              <span class="ledger-name">${person.name}<em>${person.status}</em></span>
              <span>${person.skills.join(" / ")}</span>
              <span class="ledger-reason">${person.reason}</span>
            </span>
            <span class="ledger-fit">${person.fit}</span>
          </button>
        `).join("")}
      </section>
      <button class="ledger-scan" data-action="refresh"><span>↻</span>刷新活动名册</button>
    </div>
  `;
}

function renderConnections() {
  const connectedPeople = people.filter((person) => state.connected.includes(person.id));
  const pendingPeople = people.filter((person) => state.greeted.includes(person.id) && !state.connected.includes(person.id));
  const visibleConnectedPeople = state.connectionFilter === "pending" ? [] : connectedPeople;
  const visiblePendingPeople = state.connectionFilter === "connected" ? [] : pendingPeople;
  const filters = [
    ["all", "全部"],
    ["pending", "待回应"],
    ["connected", "已建联"],
  ];
  const emptyCopy = state.connectionFilter === "pending"
    ? ["没有待回应的招呼", "向感兴趣的人表达“想认识”后，等待中的记录会出现在这里。"]
    : state.connectionFilter === "connected"
      ? ["还没有正式连接", "现实交流后通过碰卡完成双方确认，连接会保存在这里。"]
      : ["还没有连接记录", "你可以先在线表达“想认识”，也可以在现实交流后直接碰卡建联。"];
  return `
    <div class="view utility-view">
      ${commonHeader("连接")}
      <section class="connection-hero">
        <div class="connection-summary"><strong>${connectedPeople.length}</strong><span>位已建联</span>${pendingPeople.length ? `<em>${pendingPeople.length} 个待回应</em>` : ""}</div>
        <p>${connectedPeople.length ? "碰卡来源、认识原因和共同项目都会保存在这里。" : "线上先表达想认识，见面后通过碰卡建立真实连接。"}</p>
      </section>
      <div class="filter-row" role="group" aria-label="连接状态筛选">
        ${filters.map(([id, label]) => `<button class="${state.connectionFilter === id ? "active" : ""}" data-action="filter-connections" data-filter="${id}" aria-pressed="${state.connectionFilter === id}">${label}</button>`).join("")}
      </div>
      <section class="connection-list">
        ${visibleConnectedPeople.map((person) => `
          <article class="connection-card">
            <div class="connection-card-head">${glyph(person, "md")}<div><h4>${person.name}</h4><p>${person.role}</p></div><span class="source-chip">碰卡建联</span></div>
            <div class="connection-context"><span>认识于</span><strong>AI Hardware Hackathon</strong><small>刚刚 · ${person.pairLabel}</small></div>
            <button class="primary-button full" data-tab="collaboration">查看共同项目</button>
          </article>
        `).join("")}
        ${visiblePendingPeople.map((person) => `<article class="pending-row">${glyph(person, "sm")}<div><strong>${person.name}</strong><span>招呼已发出 · 等待见面</span></div><em>待回应</em></article>`).join("")}
        ${visibleConnectedPeople.length || visiblePendingPeople.length ? "" : `
          <div class="empty-state"><span class="empty-symbol">◎</span><h4>${emptyCopy[0]}</h4><p>${emptyCopy[1]}</p><button class="primary-button" data-tab="discover">去发现</button></div>
        `}
      </section>
    </div>
  `;
}

function renderCollaboration() {
  const joinedPeople = people.filter((person) => state.joined.includes(person.id));
  if (!joinedPeople.length) return renderCollaborationLobby();
  return renderWorkspace(joinedPeople);
}

function renderCollaborationLobby() {
  const connectedPeople = people.filter((person) => state.connected.includes(person.id));
  const pendingPeople = people.filter((person) => state.greeted.includes(person.id) && !state.connected.includes(person.id));
  return `
    <div class="view utility-view collaboration-lobby">
      ${commonHeader("协作")}
      <section class="collaboration-empty">
        <span class="collaboration-empty-mark">＋</span>
        <p class="micro-label">RALLY ROOM</p>
        <h3>还没有进行中的项目启动舱</h3>
        <p>完成建联并确认入队后，RALLY 会创建临时启动舱；成员确认 Agent 建议后，再把执行同步到常用工具。</p>
        <button class="primary-button" data-tab="discover">去发现队友</button>
      </section>
      ${(connectedPeople.length || pendingPeople.length) ? `<section class="collaboration-inbox"><div><p class="micro-label">COLLABORATION INBOX</p><h3>协作收件箱</h3></div>${connectedPeople.map((person) => `<article>${glyph(person, "sm")}<span><strong>${person.name}</strong><small>已碰卡建联 · 待加入明确项目</small></span><em>已建联</em></article>`).join("")}${pendingPeople.map((person) => `<article>${glyph(person, "sm")}<span><strong>${person.name}</strong><small>已表达想认识 · 等待回应</small></span><em>待回应</em></article>`).join("")}</section>` : ""}
    </div>
  `;
}

function workspaceTasks(latestMember) {
  return [
    { id: "hardware-choice", title: `确认${latestMember.teamRole}交付边界`, owner: latestMember.name, type: "关键路径", mode: "独立", reason: "先冻结硬件承诺，避免后续返工", risk: latestMember.caution, done: "输出一页可演示边界清单" },
    { id: "data-link", title: "定义端侧数据上报接口", owner: currentUser.name, type: "并行任务", mode: "Agent 辅助", reason: "当前用户已有 API 与 Agent 经验", risk: "需要先确认离线失败时的降级路径", done: "接口字段与失败回退通过联调" },
    { id: "demo-check", title: "冻结 90 秒演示验收脚本", owner: "全员", type: "共同确认", mode: "结对", reason: "跨职能结果需要所有成员理解", risk: "脚本冻结过晚会压缩联调时间", done: "全员完成一次无提示彩排" },
  ];
}

function taskOwner(task) {
  return state.assignmentOverrides[task.id] || task.owner;
}

function renderAssignmentItems(tasks) {
  return tasks.map((task, index) => `<article><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${task.title}</strong><small>${task.type} · ${task.mode} · 当前负责人：${taskOwner(task)}</small><small class="assignment-reason">${task.reason}</small><small class="assignment-risk">先确认：${task.risk}</small></span>${taskOwner(task) === currentUser.name ? `<em>我负责</em>` : `<button data-action="reassign-task" data-task-id="${task.id}">我来负责</button>`}</article>`).join("");
}

function renderWorkspaceTimeline(latestMember) {
  return `<div class="workspace-timeline">
    <article><i></i><span><strong>项目方向由周闻发起</strong><small>从 0 到 1 · 今天 09:10</small></span></article>
    <article><i></i><span><strong>${latestMember.name} 确认加入项目</strong><small>线下碰卡来源 · 今天 09:41</small></span></article>
    <article><i></i><span><strong>Agent 生成启动方案 V1</strong><small>${state.workspaceStarted ? "团队已确认" : "等待团队确认"}</small></span></article>
    ${state.workspaceStarted ? `<article class="is-current"><i></i><span><strong>团队进入执行</strong><small>当前有效版本 · 全员可见</small></span></article>` : ""}
  </div>`;
}

function renderWorkspace(joinedPeople) {
  const latestMember = joinedPeople.at(-1);
  const tasks = workspaceTasks(latestMember);
  const memberCount = 2 + joinedPeople.length;
  return `
    <div class="view utility-view workspace-view">
      ${commonHeader("协作")}
      <section class="workspace-project-head">
        <div class="workspace-live"><i></i>${state.workspaceStarted ? "执行中" : "等待团队确认"}</div>
        <span class="workspace-room-label">RALLY ROOM · 项目启动舱</span>
        <h3>离线会议洞察终端</h3>
        <p>让线下讨论自动沉淀为可检索的决策、分歧与行动项。</p>
        <div class="workspace-project-meta">
          <div class="workspace-avatar-stack" aria-label="${memberCount} 位项目成员"><span>ZW</span><span>YK</span>${joinedPeople.map((person) => `<span>${person.monogram}</span>`).join("")}</div>
          <strong>${memberCount} 位成员</strong><span>${state.workspaceStarted ? "方案已确认" : "还差首次分工"}</span><b>剩余 68h</b>
        </div>
        <div class="workspace-launch-track" aria-label="项目启动进度">
          <article class="is-done"><i>✓</i><span><b>成员已到齐</b><small>${memberCount} 人已入队</small></span></article>
          <article class="${state.workspaceStarted ? "is-done" : "is-current"}"><i>${state.workspaceStarted ? "✓" : "2"}</i><span><b>分工确认</b><small>${state.workspaceStarted ? "团队已确认" : "等待人来决定"}</small></span></article>
          <article class="${state.workspaceStarted ? "is-current" : ""}"><i>3</i><span><b>进入执行</b><small>${state.workspaceStarted ? "可同步工具" : "确认后开始"}</small></span></article>
        </div>
      </section>
      <nav class="workspace-tabs" aria-label="协作空间内容">
        ${[["overview", "启动"], ["tasks", "分工"], ["records", "动态"]].map(([id, label]) => `<button class="${state.workspaceSection === id ? "active" : ""}" data-action="workspace-section" data-section="${id}">${label}</button>`).join("")}
      </nav>
      <div class="workspace-mobile-content">${state.workspaceSection === "tasks" ? renderWorkspaceTasks(tasks) : state.workspaceSection === "records" ? renderWorkspaceRecords(latestMember) : renderWorkspaceOverview(joinedPeople, tasks, latestMember)}</div>
      ${renderDesktopWorkspace(joinedPeople, tasks, latestMember)}
    </div>
  `;
}

function renderDesktopWorkspace(joinedPeople, tasks, latestMember) {
  return `
    <section class="workspace-desktop-grid" aria-label="桌面协作工作台">
      <aside class="desktop-workspace-panel desktop-members-panel">
        <header><p class="micro-label">TEAM</p><h3>成员与权限</h3><span>谁能调度 Agent</span></header>
        <div class="workspace-members">
          <article>${glyph(currentUser, "sm")}<span><strong>${currentUser.name}</strong><small>项目发起人 · AI / 后端</small></span><em>Coordinator</em></article>
          <article><span class="member-monogram">YK</span><span><strong>一可</strong><small>共同创建者 · 产品验证</small></span><em>可编辑</em></article>
          ${joinedPeople.map((person) => `<article class="workspace-member-new">${glyph(person, "sm")}<span><strong>${person.name}</strong><small>协作成员 · ${person.teamRole}</small></span><em>可编辑</em></article>`).join("")}
        </div>
        <aside class="workspace-governance"><span>权限边界</span><p>只有 Coordinator 能发起 Agent 重排；成员可认领和调整自己的任务。</p></aside>
        ${renderToolHandoff()}
      </aside>

      <main class="desktop-workspace-panel desktop-agent-panel">
        <header><p class="micro-label">AGENT ROUTING</p><h3>分工与执行</h3><span>建议不会自动生效</span></header>
        <section class="agent-proposal ${state.workspaceStarted ? "is-confirmed" : ""}">
          <header><div><p class="micro-label">PROPOSAL · V1</p><h3>${state.workspaceStarted ? "团队已确认启动方案" : "等待人类确认的分工提案"}</h3></div><span>${state.workspaceStarted ? "执行中" : "待确认"}</span></header>
          <p>Agent 根据项目目标和成员证据生成建议；任何人都可以主动认领感兴趣的工作。</p>
          <div class="assignment-list">${renderAssignmentItems(tasks)}</div>
          ${state.workspaceStarted ? `<div class="proposal-confirmed"><b>✓</b><span>方案已由人确认，Agent 正在按此版本提供协作建议。</span></div>` : `<button class="primary-button full" data-action="confirm-workspace-plan">模拟团队确认并开始协作</button>`}
        </section>
        <section class="desktop-task-board">
          <header><h4>当前任务</h4><span>${state.acceptedTasks.length} / ${tasks.length} 已接受</span></header>
          <div class="task-list">${tasks.map((task) => renderTask(task, state.acceptedTasks.includes(task.id))).join("")}</div>
        </section>
      </main>

      <aside class="desktop-workspace-panel desktop-records-panel">
        <header><p class="micro-label">PROJECT MEMORY</p><h3>记录与决策</h3><span>受保护的协作基线</span></header>
        ${renderWorkspaceTimeline(latestMember)}
        <aside class="record-policy"><b>重大变更：2 / 3</b><p>删除存档、重写超过 30% 任务或重新分配多数成员工作，必须由多位成员确认。</p></aside>
        <article class="workspace-risk"><span>待确认</span><p>${latestMember.name}：${latestMember.caution}。</p></article>
      </aside>
    </section>
  `;
}

function renderWorkspaceOverview(joinedPeople, tasks, latestMember) {
  const memberCount = 2 + joinedPeople.length;
  return `
    <section class="workspace-section workspace-overview">
      ${state.workspaceStarted ? `
        <section class="workspace-started-card">
          <span class="workspace-started-mark">✓</span>
          <p class="micro-label">PROJECT STARTED</p>
          <h3>项目已经正式启动</h3>
          <p>${memberCount} 位成员完成首次分工。RALLY 只保留关键确认与贡献记录，日常执行继续使用团队已有工具。</p>
          <div><button class="secondary-button" data-action="open-workspace-tasks">查看我的任务</button><button class="secondary-button" data-action="trigger-project-sos">发起项目 SOS</button></div>
        </section>
      ` : `
        <section class="workspace-next-action">
          <header><div><p class="micro-label">NEXT STEP</p><h3>确认 Agent 分工建议</h3></div><span>约 1 分钟</span></header>
          <p>Agent 已根据成员能力和项目目标生成 V1 草案。成员可以主动认领，最终方案必须由人确认。</p>
          <div class="workspace-assignment-preview">
            ${tasks.slice(0, 2).map((task) => `<article><i></i><span><strong>${task.title}</strong><small>建议负责人：${taskOwner(task)}</small></span></article>`).join("")}
            <small>另有 ${Math.max(tasks.length - 2, 0)} 项启动任务</small>
          </div>
          <button class="primary-button full" data-action="open-workspace-tasks">查看并确认分工</button>
        </section>
      `}

      ${state.workspaceSos ? `<article class="workspace-sos-live"><span>SOS 已发布</span><strong>需要一位熟悉端侧数据同步的开发者</strong><small>已向当前活动中明确开放协作的成员展示</small></article>` : ""}

      <section class="workspace-activity-preview">
        <header><div><p class="micro-label">RECENT ACTIVITY</p><h3>最近动态</h3></div><button data-action="workspace-section" data-section="records">查看全部</button></header>
        <article><i></i><span><strong>${latestMember.name} 已确认加入团队</strong><small>线下碰卡 · 刚刚</small></span></article>
        <article><i></i><span><strong>Agent 生成分工建议 V1</strong><small>${state.workspaceStarted ? "已由团队确认" : "等待成员确认"}</small></span></article>
        ${state.workspaceStarted ? `<article><i></i><span><strong>项目进入执行阶段</strong><small>当前有效版本 · 刚刚</small></span></article>` : ""}
      </section>
    </section>
  `;
}

function renderWorkspaceTasks(tasks) {
  return `
    <section class="workspace-section workspace-tasks">
      <section class="agent-proposal ${state.workspaceStarted ? "is-confirmed" : ""}">
        <header><div><p class="micro-label">AGENT PROPOSAL · V1</p><h3>${state.workspaceStarted ? "团队已确认启动方案" : "Agent 已生成分工建议"}</h3></div><span>${state.workspaceStarted ? "已确认" : "待确认"}</span></header>
        <p>Agent 只能提出建议。每位成员都可以认领真正想做的部分，最终选择权交给人。</p>
        <div class="assignment-list">${renderAssignmentItems(tasks)}</div>
        ${state.workspaceStarted ? `<div class="proposal-confirmed"><b>✓</b><span>方案已由人确认；后续调整不会覆盖历史版本。</span></div>` : `<button class="primary-button full" data-action="confirm-workspace-plan">模拟团队确认并开始协作</button>`}
      </section>

      ${state.workspaceStarted ? `<section class="workspace-owned-tasks"><header class="workspace-section-title"><div><p class="micro-label">HUMAN-OWNED TASKS</p><h3>启动任务</h3></div><span>${state.acceptedTasks.length} / ${tasks.length}</span></header><p class="workspace-section-copy">任务需要由成员本人接受。Agent 不能替任何人承诺时间或自动开始工作。</p><div class="task-list">${tasks.map((task) => renderTask(task, state.acceptedTasks.includes(task.id))).join("")}</div></section>` : ""}
    </section>
  `;
}

function renderWorkspaceRecords(latestMember) {
  return `
    <section class="workspace-section workspace-records">
      <header class="workspace-section-title"><div><p class="micro-label">PROTECTED HISTORY</p><h3>协作记录</h3></div><span>不可静默覆盖</span></header>
      ${renderWorkspaceTimeline(latestMember)}
      <aside class="record-policy"><b>重大变更需要 2 / 3 确认</b><p>删除存档、重写超过 30% 任务或重新分配多数成员工作，都要保留旧版本并由多位成员确认。</p></aside>
      <button class="workspace-sos-button" data-action="trigger-project-sos">＋ 发起项目 SOS</button>
    </section>
  `;
}

function renderToolHandoff() {
  return `<section class="workspace-handoff"><div><span>继续执行</span><p>启动舱确认后，把任务与成员同步到团队已有工具。</p></div><div><button data-action="export-workspace" data-target="飞书">飞书</button><button data-action="export-workspace" data-target="GitHub">GitHub</button></div></section>`;
}

function renderTask(task, accepted) {
  const owner = taskOwner(task);
  const canAccept = owner === currentUser.name || owner === "全员";
  const content = `<span>${accepted ? "✓" : "○"}</span><div><strong>${task.title}</strong><small>负责人：${owner}</small><small class="task-done">完成：${task.done}</small></div><em>${accepted ? "已接受" : canAccept ? "由我接受" : "待对方接受"}</em>`;
  if (!canAccept && !accepted) return `<article class="task-item is-readonly">${content}</article>`;
  return `<button class="task-item ${accepted ? "accepted" : ""}" data-task="${task.id}">${content}</button>`;
}

function renderProfile() {
  const linkedPlatforms = state.live.platformLinks;
  return `
    <div class="view utility-view profile-view">
      ${commonHeader("我的")}
      <section class="profile-intro">
        ${glyph(currentUser, "xl")}
        <div><h3>${currentUser.name}</h3><p>${currentUser.role}</p><span class="passport-id">PASSPORT P·0087</span></div>
      </section>
      <section class="visibility-panel">
        <div><p class="micro-label">DISCOVERABILITY</p><h3>${state.visible ? "活动内可见" : "已暂停展示"}</h3><p>只展示你主动选择的公开字段，活动结束后自动隐藏。</p></div>
        <button class="toggle ${state.visible ? "on" : ""}" data-action="toggle-visible" aria-pressed="${state.visible}"><i></i></button>
      </section>
      <section class="device-preview">
        <div class="device-preview-head"><div><p class="micro-label">AI PASSPORT / E-INK</p><h3>墨水屏公开面</h3></div><span class="sync-chip">● 已同步</span></div>
        <div class="eink-card ${state.visible ? "" : "is-hidden"}">
          <div class="eink-top"><span>${state.visible ? `● ${collaborationStatusLabel()}` : "○ 已暂停"}</span><em>至 22:00</em></div>
          <div class="eink-identity"><span class="eink-glyph">ZW</span><div><strong>周闻</strong><small>AI / 后端 / Agent</small></div></div>
          <div class="eink-need"><span>当前协作意图</span><b>${collaborationNeedLabel()}</b></div>
          <div class="fake-qr" aria-label="二维码预览">${Array.from({ length: 36 }, (_, i) => `<i class="${[0,1,2,5,6,7,8,11,12,13,17,18,19,22,24,25,29,30,31,34,35].includes(i) ? "black" : ""}"></i>`).join("")}</div>
          <p>碰我建联 · P0087</p>
        </div>
        <button class="secondary-button full" data-action="sync-card">编辑卡片公开内容</button>
      </section>
      <section class="platform-links-panel">
        <header><div><p class="micro-label">AUTHORIZED EVIDENCE</p><h3>外部平台与作品</h3></div><span>${linkedPlatforms.length ? `${linkedPlatforms.length} 项` : "自主授权"}</span></header>
        <p>只读取公开资料。GitHub 可同步公开摘要，其他平台只保存你主动提交的链接。</p>
        ${linkedPlatforms.length ? `<div class="linked-platform-list">${linkedPlatforms.map((link) => {
          const label = platformCatalog[link.platform]?.label || link.platform;
          const host = new URL(link.url).hostname.replace(/^www\./, "");
          const metadata = link.metadata || {};
          const title = metadata.name ? `${label} · ${metadata.name}` : label;
          const facts = metadata.username
            ? [`@${metadata.username}`, Number.isInteger(metadata.public_repos) ? `${metadata.public_repos} 个公开仓库` : "", Number.isInteger(metadata.followers) ? `${metadata.followers} 关注者` : ""].filter(Boolean).join(" · ")
            : `${host} · 用户提交`;
          return `<article><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(facts)}</small>${metadata.bio ? `<small class="platform-bio">${escapeHtml(metadata.bio)}</small>` : ""}</a><button data-action="remove-platform" data-platform="${escapeHtml(link.platform)}" aria-label="移除 ${escapeHtml(label)}">×</button></article>`;
        }).join("")}</div>` : `<div class="platform-empty">尚未绑定真实链接</div>`}
        <div class="platform-connect-grid">${Object.entries(platformCatalog).map(([platform, item]) => `<button data-action="bind-platform" data-platform="${platform}">＋ ${item.label}</button>`).join("")}</div>
      </section>
      <section class="profile-fields"><button data-action="restart-onboarding"><span>重新组装协作护照</span><b>4 步 ›</b></button><button><span>能力与项目证据</span><b>5 项 ›</b></button><button><span>设备与隐私</span><b>已连接 ›</b></button></section>
    </div>
  `;
}

function renderAppNav() {
  const items = [
    ["discover", "⌁", "发现"],
    ["connections", "↔", "连接"],
    ["collaboration", "◎", "协作"],
    ["profile", "◉", "我的"],
  ];
  const connectionCount = state.connected.length || state.greeted.length;
  const collaborationCount = state.joined.length;
  return `<nav class="app-nav">${items.map(([id, icon, label]) => `<button class="${state.tab === id ? "active" : ""}" data-tab="${id}"><span>${icon}</span><small>${label}</small>${id === "connections" && connectionCount ? `<i>${connectionCount}</i>` : id === "collaboration" && collaborationCount ? `<i>${collaborationCount}</i>` : ""}</button>`).join("")}</nav>`;
}

function renderDiscoveryFilterChip(group, value, label) {
  const selected = state.discoveryFilterDraft[group].includes(value);
  return `<button class="discovery-filter-chip ${selected ? "selected" : ""}" data-action="toggle-discovery-filter" data-group="${group}" data-value="${value}" aria-pressed="${selected}">${label}</button>`;
}

function renderDiscoveryFilterSheet() {
  const draft = state.discoveryFilterDraft;
  const previewCount = filterDiscoveryPeople(rankedPeople, draft).length;
  const activeCount = activeDiscoveryFilterCount(draft);
  const statusOptions = [
    ["seeking", "正在找队伍"],
    ["recruiting", "团队正在招人"],
    ["support", "可交流／可支援"],
  ];
  const roleOptions = [
    ["hardware", "硬件／结构"],
    ["design", "设计／路演"],
    ["ai", "AI／算法"],
    ["product", "产品／研究"],
    ["growth", "增长／运营"],
    ["safety", "安全／隐私"],
  ];
  const hourOptions = [[0, "不限"], [2, "≥ 2h"], [4, "≥ 4h"], [8, "≥ 8h"]];
  const distanceOptions = [["event", "整个会场"], ["nearby", "附近"], ["very_near", "很近"]];
  return `<div class="overlay discovery-filter-overlay">
    <button class="overlay-backdrop" data-action="close-discovery-filters" aria-label="关闭发现筛选"></button>
    <section class="bottom-sheet discovery-filter-sheet" aria-label="筛选偏好设置">
      <header class="discovery-filter-head">
        <button class="filter-sheet-close" data-action="close-discovery-filters" aria-label="返回发现页">←</button>
        <div><p class="micro-label">DISCOVERY FILTERS</p><h3>筛选偏好</h3></div>
        <button class="filter-reset-link" data-action="reset-discovery-filters">重置</button>
      </header>
      <section class="filter-impact" aria-live="polite">
        <span>本场公开成员</span>
        <div><strong>${rankedPeople.length}</strong><i>→</i><strong>${previewCount}</strong><em>人符合</em></div>
        <p>${activeCount ? `已启用 ${activeCount} 类筛选条件，需同时满足才会出现。` : "尚未设置筛选条件，当前展示全部授权成员。"}</p>
      </section>
      <section class="filter-setting-block">
        <header><div><strong>协作状态</strong><small>至少满足一个所选状态</small></div><em>必须满足</em></header>
        <div class="discovery-filter-chips">${statusOptions.map(([value, label]) => renderDiscoveryFilterChip("statuses", value, label)).join("")}</div>
      </section>
      <section class="filter-setting-block">
        <header><div><strong>需要的职能</strong><small>按能力与当前角色共同判断</small></div><em>必须满足</em></header>
        <div class="discovery-filter-chips">${roleOptions.map(([value, label]) => renderDiscoveryFilterChip("roles", value, label)).join("")}</div>
      </section>
      <section class="filter-setting-block">
        <header><div><strong>最低可投入时间</strong><small>未标注投入时间的人不会纳入结果</small></div><em>必须满足</em></header>
        <div class="discovery-filter-segments">${hourOptions.map(([value, label]) => `<button class="${draft.minimumHours === value ? "selected" : ""}" data-action="set-discovery-filter" data-filter="minimumHours" data-value="${value}" aria-pressed="${draft.minimumHours === value}">${label}</button>`).join("")}</div>
      </section>
      <section class="filter-setting-block">
        <header><div><strong>现场范围</strong><small>只改变发现结果，不公开精确位置</small></div><em>必须满足</em></header>
        <div class="discovery-filter-segments">${distanceOptions.map(([value, label]) => `<button class="${draft.distance === value ? "selected" : ""}" data-action="set-discovery-filter" data-filter="distance" data-value="${value}" aria-pressed="${draft.distance === value}">${label}</button>`).join("")}</div>
      </section>
      <button class="filter-switch-row ${draft.evidenceRequired ? "selected" : ""}" data-action="toggle-discovery-evidence" aria-pressed="${draft.evidenceRequired}">
        <span><strong>必须有公开项目证据</strong><small>仅自述能力但没有可查看证据的人将被排除</small></span><i><b></b></i>
      </button>
      <aside class="filter-boundary-note"><b>筛选条件只决定“是否出现”</b><span>AI 仍可解释推荐顺序，但不会替你修改条件，也不会给人生成匹配百分比。</span></aside>
      <footer class="discovery-filter-actions">
        <button class="secondary-button" data-action="close-discovery-filters">取消</button>
        <button class="primary-button" data-action="apply-discovery-filters">查看 ${previewCount} 人</button>
      </footer>
    </section>
  </div>`;
}

function renderOverlay() {
  if (!state.overlay) return "";
  if (state.overlay === "filters") return renderDiscoveryFilterSheet();
  const person = selectedPerson();
  if (state.overlay === "person") {
    const greeted = state.greeted.includes(person.id);
    const profile = selectedParticipantProfile(person);
    const expandedClass = state.personDetailExpanded ? "is-expanded" : "is-preview";
    return `<div class="overlay person-overlay ${expandedClass}"><button class="overlay-backdrop" data-action="close-overlay" aria-label="关闭"></button><section class="bottom-sheet person-sheet ${expandedClass}" data-person-sheet-surface aria-label="${person.name} 的个人资料">
      <div class="person-sheet-drag-zone" data-person-sheet-drag role="button" tabindex="0" aria-label="${state.personDetailExpanded ? "下滑收起完整资料" : "上滑查看完整资料"}">
        <div class="sheet-handle"></div>
        ${state.personDetailExpanded ? `<div class="person-sheet-nav"><button data-action="collapse-person" aria-label="返回发现页">↓</button><span>个人资料</span><small>顶部下滑收起</small></div>` : ""}
      </div>
      <div class="person-sheet-content">
        <div class="person-sheet-head">${glyph(person, "lg")}<div><span class="status-pill">${person.status}</span><h3>${person.name}</h3><p>${person.role} · ${person.proximity}</p></div><strong class="large-fit">${person.fit}<small>${person.fitDetail}</small></strong></div>
        <div class="skill-line">${person.skills.map((skill) => `<span>${skill}</span>`).join("")}</div>
        <article class="participant-bio">
          <header><span>本人简介</span><em>原文</em></header>
          <p>${profile.bio}</p>
        </article>
        ${state.personDetailExpanded ? `
          <section class="profile-facts" aria-label="基本信息">
            <article><span>所在地</span><strong>${profile.location}</strong></article>
            <article><span>可投入时间</span><strong>${profile.availability}</strong></article>
          </section>
          <section class="profile-section profile-projects">
            <header><span>SELECTED WORK</span><h4>过往项目</h4></header>
            ${profile.projects.length ? profile.projects.map((project, index) => `<article>
              <span>${String(index + 1).padStart(2, "0")}</span>
              <div><h5>${project.title}</h5><p>${project.detail}</p><div>${project.tags.map((tag) => `<em>${tag}</em>`).join("")}</div></div>
            </article>`).join("") : `<p class="profile-empty-copy">尚未公开过往项目。</p>`}
          </section>
          <section class="profile-section collaboration-style">
            <header><span>WORKING TOGETHER</span><h4>协作方式</h4></header>
            <p>${profile.collaboration}</p>
          </section>
          <section class="profile-section evidence-section">
            <header><span>PUBLIC EVIDENCE</span><h4>能力证据</h4></header>
            <strong>${person.evidence}</strong>
          </section>
          <article class="ai-reason ai-reference"><p class="micro-label">AGENT REFERENCE</p><h4>系统推荐参考</h4><p>${person.reason}</p><div class="caution"><span>见面前建议确认</span><strong>${person.caution}</strong></div></article>
        ` : `
          <button class="person-expand-cue" data-action="expand-person">
            <span>继续上滑</span><strong>查看过往项目与全部资料</strong><i>↑</i>
          </button>
        `}
      </div>
      <div class="sheet-actions person-sheet-actions"><button class="secondary-button" data-action="greet" data-person="${person.id}">${greeted ? "已表达想认识" : "想认识"}</button><button class="primary-button" data-action="direct-tap" data-person="${person.id}">模拟碰卡直连</button></div>
    </section></div>`;
  }
  if (state.overlay === "tap") {
    return `<div class="overlay handshake-overlay"><section class="handshake-card">
      <button class="close-x" data-action="close-overlay" aria-label="关闭">×</button>
      <p class="micro-label">PHYSICAL HANDSHAKE</p><h3>把两张 AI Passport<br>靠在一起</h3>
      <div class="tap-visual"><div class="tap-passport passport-left"><span>ZW</span></div><div class="tap-waves"><i></i><i></i><i></i></div><div class="tap-passport passport-right"><span>${person.monogram}</span></div></div>
      <p class="handshake-copy">检测到 ${person.name} 的主动碰卡信号。双方把卡靠在一起，本身就构成这次建联授权。</p>
      <button class="primary-button full pulse-button" data-action="confirm-connect" data-person="${person.id}">模拟双方主动碰卡</button>
      <button class="text-action" data-action="close-overlay">取消本次握手</button>
    </section></div>`;
  }
  if (state.overlay === "success") {
    return `<div class="overlay success-overlay"><section class="success-card">
      <div class="success-mark">✓</div><p class="micro-label">CONNECTION STAMP</p><h3>你和 ${person.name}<br>已经建立协作关系</h3>
      <div class="stamp"><span>CONNECTED</span><strong>${person.pairLabel}</strong><small>HACKATHON 01 · JUST NOW</small></div>
      <p>下一步不是交换联系方式，而是邀请对方进入一个明确项目。</p>
      <button class="primary-button full" data-action="invite-team" data-person="${person.id}">邀请加入「离线会议洞察终端」</button>
      <button class="secondary-button full" data-action="view-connection">稍后处理</button>
    </section></div>`;
  }
  if (state.overlay === "invite-sent") {
    return `<div class="overlay success-overlay"><section class="success-card team-success">
      <div class="success-mark">→</div><p class="micro-label">INVITATION SENT</p><h3>已邀请 ${person.name}<br>加入项目</h3>
      <p>对方确认前不会被写入团队，也不会被分配任务。</p>
      <button class="primary-button full" data-action="confirm-team-invite" data-person="${person.id}">模拟对方确认加入</button>
      <button class="secondary-button full" data-action="view-connection">稍后处理</button>
    </section></div>`;
  }
  if (state.overlay === "joined") {
    return `<div class="overlay success-overlay"><section class="success-card team-success">
      <div class="success-mark">＋</div><p class="micro-label">TEAM UPDATED</p><h3>${person.name} 已加入项目</h3>
      <p>AI 已根据三位成员的能力，生成角色覆盖、一个风险提示和三个启动任务。</p>
      <button class="primary-button full" data-action="view-project">进入项目启动舱</button>
    </section></div>`;
  }
  return "";
}

function renderToast() {
  return state.toast ? `<div class="toast" role="status">${state.toast}</div>` : "";
}

function renderStateLedger() {
  return `<div class="state-ledger"><span>当前状态</span><strong>${stageLabel()}</strong><small>刷新后重置 · 硬件事件为模拟</small></div>`;
}

function stageLabel() {
  if (state.onboarding) return `正在组装协作护照 · ${state.onboardingStep + 1}/4`;
  if (state.acceptedTasks.length) return "已开始协作";
  if (state.joined.length) return "已加入项目";
  if (state.connected.length) return "已碰卡建联";
  if (state.greeted.length) return "已发送招呼";
  return `正在浏览${variantNames[state.variant]}`;
}

function variantDescription() {
  if (state.variant === "B") return "手机端发现的附近模式：只在前台开启时更新，再进入统一人物详情。";
  if (state.variant === "C") return "手机端发现的名册模式：浏览本场活动中已授权可见的完整成员。";
  return "手机端发现的推荐模式：围绕当前项目缺口解释谁值得先聊。";
}

function bindEvents() {
  document.querySelectorAll("[data-person]:not([data-action])").forEach((element) => {
    element.addEventListener("click", () => {
      state.selectedId = element.dataset.person;
      state.overlay = "person";
      state.personDetailExpanded = false;
      render();
    });
  });
  document.querySelectorAll("button[data-tab]").forEach((element) => element.addEventListener("click", () => {
    state.tab = element.dataset.tab;
    state.overlay = null;
    render();
  }));
  document.querySelectorAll("[data-action]").forEach((element) => element.addEventListener("click", () => handleAction(element.dataset.action, element)));
  document.querySelectorAll("[data-task]").forEach((element) => element.addEventListener("click", () => toggleTask(element.dataset.task)));
  document.querySelectorAll("[data-discovery-view]").forEach((element) => element.addEventListener("click", () => setVariant(element.dataset.discoveryView)));
  bindRecommendationSwipe();
  bindPersonSheetGesture();
}

function bindPersonSheetGesture() {
  const dragZone = document.querySelector("[data-person-sheet-drag]");
  const sheet = document.querySelector(".person-sheet");
  if (!dragZone || !sheet) return;

  let startY = 0;
  let deltaY = 0;
  let dragging = false;

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("--sheet-drag-y");
    if (!state.personDetailExpanded && deltaY < -42) {
      transitionPersonDetail(true);
    } else if (state.personDetailExpanded && deltaY > 52) {
      transitionPersonDetail(false);
    }
  };

  const start = (event) => {
    const startedFromHandle = Boolean(event.target.closest?.("[data-person-sheet-drag]"));
    if (state.personDetailExpanded && !startedFromHandle) return;
    if (!startedFromHandle && event.target.closest?.("button, a, input, select, textarea")) return;
    startY = event.clientY;
    deltaY = 0;
    dragging = true;
    sheet.classList.add("is-dragging");
    try {
      sheet.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic prototype gestures may not create an active browser pointer.
    }
  };
  const move = (event) => {
    if (!dragging) return;
    deltaY = event.clientY - startY;
    const resisted = state.personDetailExpanded
      ? Math.max(-8, Math.min(deltaY * .82, 116))
      : Math.max(deltaY * .72, -112);
    sheet.style.setProperty("--sheet-drag-y", `${resisted}px`);
  };
  sheet.addEventListener("pointerdown", start);
  sheet.addEventListener("pointermove", move);
  sheet.addEventListener("pointerup", finish);
  sheet.addEventListener("pointercancel", finish);
  dragZone.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" && !state.personDetailExpanded) {
      transitionPersonDetail(true);
    }
    if ((event.key === "ArrowDown" || event.key === "Escape") && state.personDetailExpanded) {
      transitionPersonDetail(false);
    }
  });
}

function transitionPersonDetail(expanded) {
  const update = () => {
    state.personDetailExpanded = expanded;
    render();
  };
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reducedMotion) {
    update();
    return;
  }
  document.documentElement.dataset.personTransition = expanded ? "expanding" : "collapsing";
  const transition = document.startViewTransition(update);
  transition.finished.finally(() => {
    delete document.documentElement.dataset.personTransition;
  });
}

function bindRecommendationSwipe() {
  const card = document.querySelector("[data-swipe-card]");
  if (!card) return;

  let startX = 0;
  let deltaX = 0;
  let dragging = false;

  const resetCard = () => {
    card.classList.remove("is-dragging", "is-positive", "is-negative");
    card.style.removeProperty("--swipe-x");
    card.style.removeProperty("--swipe-rotate");
    card.style.removeProperty("--swipe-progress");
  };

  const completeSwipe = (direction) => {
    card.classList.remove("is-dragging");
    card.classList.add(direction === "right" ? "is-swiping-right" : "is-swiping-left");
    window.setTimeout(() => {
      if (direction === "right") expressRecommendationInterest(card.dataset.personId);
      else dismissRecommendation();
      render();
    }, 190);
  };

  card.addEventListener("pointerdown", (event) => {
    dragging = true;
    startX = event.clientX;
    deltaX = 0;
    card.classList.add("is-dragging");
    try {
      card.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events used by the prototype test do not create an active browser pointer.
    }
  });

  card.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    deltaX = event.clientX - startX;
    card.classList.toggle("is-positive", deltaX > 0);
    card.classList.toggle("is-negative", deltaX < 0);
    card.style.setProperty("--swipe-x", `${deltaX}px`);
    card.style.setProperty("--swipe-rotate", `${deltaX * 0.035}deg`);
    card.style.setProperty("--swipe-progress", String(Math.min(Math.abs(deltaX) / 90, 1)));
  });

  card.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(deltaX) >= 72) completeSwipe(deltaX > 0 ? "right" : "left");
    else if (Math.abs(deltaX) < 7) {
      state.selectedId = card.dataset.personId;
      state.overlay = "person";
      state.personDetailExpanded = false;
      render();
    } else resetCard();
  });

  card.addEventListener("pointercancel", () => {
    dragging = false;
    resetCard();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      completeSwipe("left");
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      completeSwipe("right");
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      state.selectedId = card.dataset.personId;
      state.overlay = "person";
      state.personDetailExpanded = false;
      render();
    }
  });
}

function handleAction(action, element) {
  if (action === "choose-status") {
    state.collaborationStatus = element.dataset.status;
  }
  if (action === "toggle-source") {
    const source = element.dataset.source;
    state.connectedSources = state.connectedSources.includes(source)
      ? state.connectedSources.filter((item) => item !== source)
      : [...state.connectedSources, source];
  }
  if (action === "onboarding-next") {
    state.onboardingStep = Math.min(3, state.onboardingStep + 1);
    document.querySelector(".screen")?.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (action === "onboarding-back") {
    if (state.onboardingStep > 0) state.onboardingStep -= 1;
    else finishOnboarding(false);
  }
  if (action === "skip-onboarding") {
    if (state.onboardingStep === 0) finishOnboarding(false);
    else if (state.onboardingStep === 3) state.onboardingStep = 2;
    else state.onboardingStep += 1;
  }
  if (action === "preview-mode") state.previewMode = element.dataset.mode;
  if (action === "open-discovery-filters") {
    state.discoveryFilterDraft = {
      ...state.discoveryFilters,
      statuses: [...state.discoveryFilters.statuses],
      roles: [...state.discoveryFilters.roles],
    };
    state.overlay = "filters";
  }
  if (action === "close-discovery-filters") state.overlay = null;
  if (action === "reset-discovery-filters") state.discoveryFilterDraft = defaultDiscoveryFilters();
  if (action === "toggle-discovery-filter") {
    const group = element.dataset.group;
    const value = element.dataset.value;
    if (["statuses", "roles"].includes(group)) {
      state.discoveryFilterDraft[group] = state.discoveryFilterDraft[group].includes(value)
        ? state.discoveryFilterDraft[group].filter((item) => item !== value)
        : [...state.discoveryFilterDraft[group], value];
    }
  }
  if (action === "set-discovery-filter") {
    if (element.dataset.filter === "minimumHours") {
      state.discoveryFilterDraft.minimumHours = Number(element.dataset.value);
    }
    if (element.dataset.filter === "distance") {
      state.discoveryFilterDraft.distance = element.dataset.value;
    }
  }
  if (action === "toggle-discovery-evidence") {
    state.discoveryFilterDraft.evidenceRequired = !state.discoveryFilterDraft.evidenceRequired;
  }
  if (action === "apply-discovery-filters") {
    state.discoveryFilters = {
      ...state.discoveryFilterDraft,
      statuses: [...state.discoveryFilterDraft.statuses],
      roles: [...state.discoveryFilterDraft.roles],
    };
    state.recommendationIndex = 0;
    const firstResult = filterDiscoveryPeople(rankedPeople)[0];
    if (firstResult) state.selectedId = firstResult.id;
    state.overlay = null;
    showToast(activeDiscoveryFilterCount() ? `已应用筛选 · ${filterDiscoveryPeople(rankedPeople).length} 人符合` : "已显示本场全部成员");
  }
  if (action === "filter-connections") {
    state.connectionFilter = ["all", "pending", "connected"].includes(element.dataset.filter)
      ? element.dataset.filter
      : "all";
  }
  if (action === "draft-refresh") {
    state.draftVersion += 1;
    showToast("AI 已根据项目证据重组表达");
  }
  if (action === "publish-passport") {
    finishOnboarding(true);
    showToast("协作护照已公开至今天 22:00");
  }
  if (action === "restart-onboarding") {
    state.onboarding = true;
    state.onboardingStep = 0;
    state.overlay = null;
    const url = new URL(location.href);
    url.searchParams.set("onboarding", "1");
    history.replaceState({}, "", url);
  }
  if (action === "close-overlay") state.overlay = null;
  if (action === "open-person") {
    state.selectedId = element.dataset.person || state.selectedId;
    state.overlay = "person";
    state.personDetailExpanded = false;
  }
  if (action === "expand-person") {
    transitionPersonDetail(true);
    return;
  }
  if (action === "collapse-person") {
    transitionPersonDetail(false);
    return;
  }
  if (action === "dismiss-recommendation") dismissRecommendation();
  if (action === "like-recommendation") expressRecommendationInterest(element.dataset.person);
  if (action === "next-person") {
    const pool = state.variant === "B"
      ? filterDiscoveryPeople(activeRadarPeople())
      : filterDiscoveryPeople(people);
    if (!pool.length) return;
    const index = pool.findIndex((person) => person.id === state.selectedId);
    state.selectedId = pool[(Math.max(index, 0) + 1) % pool.length].id;
  }
  if (action === "refresh") showToast(`已读取附近 ${activeRadarPeople().length} 个协作信号`);
  if (action === "greet") {
    const id = element.dataset.person;
    if (!state.greeted.includes(id)) {
      state.greeted.push(id);
      showToast(`已向 ${selectedPerson().name} 表达“想认识”`);
    } else {
      showToast("你已经表达过想认识，等待对方回应即可");
    }
    state.overlay = "person";
  }
  if (action === "direct-tap") {
    state.selectedId = element.dataset.person || state.selectedId;
    state.overlay = "tap";
  }
  if (action === "confirm-connect") {
    const id = element.dataset.person;
    if (!state.connected.includes(id)) state.connected.push(id);
    state.overlay = "success";
  }
  if (action === "invite-team") {
    const id = element.dataset.person;
    if (!state.invited.includes(id)) state.invited.push(id);
    state.overlay = "invite-sent";
  }
  if (action === "confirm-team-invite") {
    const id = element.dataset.person;
    if (!state.joined.includes(id)) state.joined.push(id);
    state.overlay = "joined";
  }
  if (action === "workspace-section") state.workspaceSection = element.dataset.section;
  if (action === "open-workspace-tasks") state.workspaceSection = "tasks";
  if (action === "trigger-project-sos") {
    state.workspaceSos = true;
    state.workspaceSection = "overview";
    showToast("项目 SOS 已发布到当前活动协作区");
  }
  if (action === "reassign-task") {
    state.assignmentOverrides[element.dataset.taskId] = currentUser.name;
    showToast("已在分工草案中改为由你负责；最终需团队确认");
  }
  if (action === "confirm-workspace-plan") {
    state.workspaceStarted = true;
    showToast("Demo：已模拟全员确认，项目进入执行状态");
  }
  if (action === "export-workspace") showToast(`已生成 ${element.dataset.target} 同步包（Demo）`);
  if (action === "view-connection") {
    state.overlay = null;
    state.tab = "connections";
  }
  if (action === "view-project") {
    state.overlay = null;
    state.tab = "collaboration";
    state.workspaceSection = "overview";
  }
  if (action === "toggle-visible") {
    if (state.live.enabled) {
      updateLiveVisibility(!state.visible);
      return;
    }
    state.visible = !state.visible;
    showToast(state.visible ? "已恢复活动内可见" : "已暂停附近展示");
  }
  if (action === "sync-card") showToast("原型：公开字段编辑器将在下一轮接入");
  if (action === "bind-platform") connectPlatform(element.dataset.platform);
  if (action === "remove-platform") disconnectPlatform(element.dataset.platform);
  render();
}

function finishOnboarding(published) {
  state.onboarding = false;
  state.onboardingStep = 0;
  state.visible = published;
  state.tab = published ? "discover" : state.tab;
  state.variant = "C";
  const url = new URL(location.href);
  url.searchParams.set("variant", "C");
  url.searchParams.delete("onboarding");
  history.replaceState({}, "", url);
}

function toggleTask(id) {
  if (state.acceptedTasks.includes(id)) state.acceptedTasks = state.acceptedTasks.filter((item) => item !== id);
  else state.acceptedTasks.push(id);
  showToast(state.acceptedTasks.includes(id) ? "任务已接受，形成有效协作连接" : "已取消接受");
  render();
}

let toastTimer;
function showToast(message) {
  state.toast = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = "";
    render();
  }, 1800);
}

window.addEventListener("popstate", () => {
  state.variant = readVariant();
  render();
});

window.addEventListener("keydown", (event) => {
  const tag = event.target?.tagName?.toLowerCase();
  if (["input", "textarea"].includes(tag) || event.target?.isContentEditable) return;
  if (event.key === "Escape" && state.overlay) {
    state.overlay = null;
    render();
  }
});

render();

async function loadLiveMe() {
  if (!state.live.enabled || state.live.meLoaded || state.live.meLoading) return;
  state.live.meLoading = true;
  try {
    const response = await fetch(`${liveConfig.apiBase}/api/me`, { headers: liveHeaders() });
    if (!response.ok) return;
    const payload = await response.json();
    const eventProfile = (payload.profiles || []).find((profile) => profile.event_id === liveConfig.eventId);
    state.live.platformLinks = payload.platform_links || [];
    state.visible = eventProfile?.visibility?.state === "VISIBLE";
    state.live.meLoaded = true;
    render();
  } catch {
    // The static prototype remains usable while a local API is offline.
  } finally {
    state.live.meLoading = false;
  }
}

async function updateLiveVisibility(nextVisible) {
  try {
    const response = await fetch(
      `${liveConfig.apiBase}/api/events/${encodeURIComponent(liveConfig.eventId)}/visibility`,
      {
        method: "PATCH",
        headers: liveHeaders(),
        body: JSON.stringify({ state: nextVisible ? "VISIBLE" : "PAUSED" }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || "公开状态更新失败");
    state.visible = payload.visibility?.state === "VISIBLE";
    showToast(state.visible ? "已恢复活动内可见" : "已暂停附近展示");
  } catch (error) {
    showToast(error.message);
  }
  render();
}

async function connectPlatform(platform) {
  if (!state.live.enabled) {
    showToast("开启 live=1 并连接后端后，可绑定真实平台链接");
    return;
  }
  const item = platformCatalog[platform];
  if (!item) return;
  const url = window.prompt(`粘贴${item.label}公开链接`, item.hint);
  if (!url || url === item.hint) return;
  try {
    const response = await fetch(`${liveConfig.apiBase}/api/me/platform-links/${platform}`, {
      method: "PUT",
      headers: liveHeaders(),
      body: JSON.stringify({ url }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || "链接绑定失败");
    state.live.platformLinks = [
      ...state.live.platformLinks.filter((link) => link.platform !== platform),
      payload.platform_link,
    ];
    showToast(
      payload.platform_link.verification_state === "PUBLIC_API_SYNCED"
        ? `${item.label}公开资料已同步`
        : `${item.label}链接已保存，未标记为平台验证`,
    );
  } catch (error) {
    showToast(error.message);
  }
  render();
}

async function disconnectPlatform(platform) {
  const item = platformCatalog[platform];
  if (!item || !state.live.enabled) return;
  if (!window.confirm(`移除${item.label}链接？这不会删除平台上的任何内容。`)) return;
  try {
    const response = await fetch(`${liveConfig.apiBase}/api/me/platform-links/${platform}`, {
      method: "DELETE",
      headers: liveHeaders(),
    });
    if (!response.ok) throw new Error("链接移除失败");
    state.live.platformLinks = state.live.platformLinks.filter((link) => link.platform !== platform);
    showToast(`${item.label}链接已移除`);
  } catch (error) {
    showToast(error.message);
  }
  render();
}

function liveHeaders() {
  const headers = { "content-type": "application/json" };
  if (liveConfig.accessToken) headers.authorization = `Bearer ${liveConfig.accessToken}`;
  else headers["x-demo-user-id"] = liveConfig.demoUserId;
  return headers;
}

async function publishLivePosition(position) {
  if (state.live.requestInFlight) return;
  state.live.requestInFlight = true;
  try {
    const presence = await fetch(
      `${liveConfig.apiBase}/api/events/${encodeURIComponent(liveConfig.eventId)}/presence`,
      {
        method: "PUT",
        headers: liveHeaders(),
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
        }),
      },
    );
    if (!presence.ok) {
      const payload = await presence.json().catch(() => ({}));
      throw new Error(payload.error?.message || `定位上报失败（${presence.status}）`);
    }
    const nearby = await fetch(
      `${liveConfig.apiBase}/api/events/${encodeURIComponent(liveConfig.eventId)}/nearby`,
      { headers: liveHeaders() },
    );
    if (!nearby.ok) throw new Error(`附近列表读取失败（${nearby.status}）`);
    const payload = await nearby.json();
    state.live.nearby = (payload.nearby || []).map(livePerson);
    if (state.live.nearby.length && !state.live.nearby.some((item) => item.id === state.selectedId)) {
      state.selectedId = state.live.nearby[0].id;
    }
    state.live.status = "connected";
    state.live.error = "";
    state.live.lastUpdatedAt = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch (error) {
    state.live.status = "error";
    state.live.error = safeLiveText(error.message, "真实定位暂不可用", 160);
    state.live.nearby = [];
  } finally {
    state.live.requestInFlight = false;
    render();
  }
}

function startLivePresence() {
  if (state.live.started) return;
  state.live.started = true;
  state.live.status = "requesting";
  if (!navigator.geolocation) {
    state.live.status = "error";
    state.live.error = "当前浏览器不支持定位";
    render();
    return;
  }
  state.live.watcherId = navigator.geolocation.watchPosition(
    publishLivePosition,
    (positionError) => {
      state.live.status = "error";
      state.live.error = positionError.code === positionError.PERMISSION_DENIED
        ? "定位权限未开启"
        : "暂时无法获取当前位置";
      state.live.nearby = [];
      render();
    },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 },
  );
  render();
}

function stopLivePresence() {
  if (!state.live.started) return;
  if (state.live.watcherId !== null) navigator.geolocation?.clearWatch(state.live.watcherId);
  state.live.started = false;
  state.live.watcherId = null;
  state.live.status = "idle";
  state.live.nearby = [];
  fetch(`${liveConfig.apiBase}/api/events/${encodeURIComponent(liveConfig.eventId)}/presence`, {
    method: "DELETE",
    headers: liveHeaders(),
    keepalive: true,
  }).catch(() => {});
}

function syncLivePresenceLifecycle() {
  if (!state.live.enabled) return;
  const shouldRun = !state.onboarding
    && state.live.meLoaded
    && state.tab === "discover"
    && state.variant === "B"
    && state.visible;
  if (shouldRun) startLivePresence();
  else stopLivePresence();
}

window.addEventListener("pagehide", stopLivePresence);

loadLiveMe();
