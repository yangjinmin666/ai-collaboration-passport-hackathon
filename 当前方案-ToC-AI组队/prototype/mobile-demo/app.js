/*
 * PROTOTYPE — throwaway mobile UI.
 * Three variants of the nearby-discovery experience, switchable via ?variant=.
 */

import { ApiError, RallyApiClient } from "./api-client.js";

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
    availability: "本场展会可投入 8 小时",
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
const emptyDirectionDraft = () => ({ projectTitle: "", audience: "", problem: "", outcome: "" });
const confirmedProjectDirection = () => ({
  projectTitle: "离线会议洞察终端",
  audience: "线下黑客松参与者",
  problem: "现场协作信息难以沉淀和继续",
  outcome: "让一次真实交流进入可确认的协作启动流程",
});

const variantNames = {
  A: "发现 · 推荐",
  B: "发现 · 附近",
  C: "发现 · 名册",
};

const initialParams = new URLSearchParams(location.search);
const startsInOnboarding = initialParams.get("onboarding") === "1";
const startsInWorkspace = initialParams.get("workspace") === "1" && !startsInOnboarding;
const requestedInitialTab = initialParams.get("view");
const initialTab = ["discover", "connections", "collaboration", "profile"].includes(requestedInitialTab)
  ? requestedInitialTab
  : "discover";
const storedAccessToken = localStorage.getItem("rally_access_token");
const storedSessionExpiry = localStorage.getItem("rally_session_expires_at");
const storedSwipeSoundEnabled = localStorage.getItem("rally_swipe_sound_enabled") !== "false";
const initialOAuthTicket = initialParams.get("oauth_ticket");
const initialOAuthError = initialParams.get("oauth_error");
const initialOAuthProvider = initialParams.get("oauth_provider");
const oauthVerifierStorageKey = "rally_oauth_client_verifier";
const oauthProviderStorageKey = "rally_oauth_client_provider";
const packagedApiBase = (() => {
  const value = document.querySelector('meta[name="rally-api-origin"]')?.content.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
})();
const packagedAppOrigin = (() => {
  const value = document.querySelector('meta[name="rally-app-origin"]')?.content.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
})();
const hostedLiveDefault = document.querySelector('meta[name="cospan-live-default"]')?.content.trim() === "1";

function shouldUseLiveMode() {
  if (initialParams.get("live") === "0") return false;
  if (initialParams.get("live") === "1" || packagedApiBase) return true;
  const loopbackNames = new Set(["127.0.0.1", "::1", "localhost"]);
  return hostedLiveDefault
    && location.protocol === "https:"
    && !loopbackNames.has(location.hostname.toLowerCase());
}

function resolveApiBase() {
  const explicitlyTrustedBase = packagedApiBase || localStorage.getItem("rally_api_base");
  const requestedBase = initialParams.get("apiBase");
  const candidate = storedAccessToken
    ? (explicitlyTrustedBase || location.origin)
    : (explicitlyTrustedBase || requestedBase || location.origin);
  try {
    const url = new URL(candidate, location.href);
    if (!["http:", "https:"].includes(url.protocol)) return location.origin;
    if (!storedAccessToken && !explicitlyTrustedBase && requestedBase) {
      const pageUrl = new URL(location.href);
      const loopbackNames = new Set(["127.0.0.1", "::1", "localhost"]);
      const sameHost = url.hostname === pageUrl.hostname;
      const bothLoopback = loopbackNames.has(url.hostname) && loopbackNames.has(pageUrl.hostname);
      const secureEnough = pageUrl.protocol !== "https:" || url.protocol === "https:";
      if ((!sameHost && !bothLoopback) || !secureEnough) return location.origin;
    }
    return url.href.replace(/\/$/, "");
  } catch {
    return location.origin;
  }
}

const liveConfig = {
  enabled: shouldUseLiveMode(),
  apiBase: resolveApiBase(),
  eventId: initialParams.get("event") || "hackathon-2026",
  demoUserId: initialParams.get("demoUser") || null,
  accessToken: storedAccessToken,
};
const api = new RallyApiClient({
  baseUrl: liveConfig.apiBase,
  getAccessToken: () => liveConfig.accessToken,
  demoUserId: liveConfig.demoUserId,
});
const exhibitionCatalog = Object.freeze({
  "hackathon-2026": Object.freeze({
    id: "hackathon-2026",
    name: "AI Hardware Hackathon 2026",
    directoryEnabled: true,
  }),
});
const currentExhibition = exhibitionCatalog[liveConfig.eventId] || null;
const discoveryContextStorageKey = "cospan_discovery_context";
const requestedDiscoveryScope = initialParams.get("scope");
const storedDiscoveryScope = localStorage.getItem(discoveryContextStorageKey);
const initialDiscoveryScope = currentExhibition
  ? ([requestedDiscoveryScope, storedDiscoveryScope].find((scope) => ["event", "nearby"].includes(scope)) || "event")
  : "nearby";
const platformCatalog = {
  xiaohongshu: { label: "小红书", hint: "粘贴小红书主页链接", mark: "小红书", tone: "red" },
  jike: { label: "即刻", hint: "粘贴即刻主页链接", mark: "J", tone: "jike" },
  github: { label: "GitHub", hint: "粘贴 GitHub 主页链接", mark: "GH", tone: "github" },
  linkedin: { label: "LinkedIn", hint: "粘贴 LinkedIn 主页链接", mark: "in", tone: "linkedin" },
  douyin: { label: "抖音", hint: "粘贴抖音主页链接", mark: "♪", tone: "douyin" },
  website: { label: "作品链接", hint: "粘贴作品或项目链接", mark: "↗", tone: "website" },
  other: { label: "其他链接", hint: "粘贴其他公开资料链接", mark: "+", tone: "other" },
};
const profileBlockCatalog = Object.freeze({
  project_link: Object.freeze({
    group: "work",
    category: "项目证据",
    label: "链接",
    mark: "↗",
    signature: "【项目证据·链接】",
    titleLabel: "证据标题",
    titleHint: "例如：开源工具或作品集",
    detailLabel: "为什么能证明你的能力",
    detailHint: "说清你负责的部分或结果",
    urlLabel: "公开链接",
    urlHint: "https://…",
    needsUrl: true,
  }),
  project_title: Object.freeze({
    group: "work",
    category: "项目证据",
    label: "标题",
    mark: "T",
    signature: "【项目证据·标题】",
    titleLabel: "证据标题",
    titleHint: "例如：COSPAN 现场协作终端",
    detailLabel: "一句话证据",
    detailHint: "你完成了什么，结果是什么",
  }),
  project_text: Object.freeze({
    group: "work",
    category: "项目证据",
    label: "文字",
    mark: "¶",
    signature: "【项目证据·文字】",
    titleLabel: "主题",
    titleHint: "例如：我如何组织黑客松协作",
    detailLabel: "证据正文",
    detailHint: "写下可被队友追问和核对的事实",
    needsDetail: true,
  }),
  project_image: Object.freeze({
    group: "work",
    category: "项目证据",
    label: "图片",
    mark: "▧",
    signature: "【项目证据·图片】",
    titleLabel: "图片标题",
    titleHint: "例如：硬件原型第二版",
    detailLabel: "图片说明",
    detailHint: "说明图片中的成果和你的贡献",
    urlLabel: "公开图片链接",
    urlHint: "https://…/prototype.jpg",
    needsUrl: true,
    isImage: true,
  }),
  project_demo: Object.freeze({
    group: "work",
    category: "项目证据",
    label: "Demo / App",
    mark: "▶",
    signature: "【项目证据·Demo】",
    titleLabel: "证据标题",
    titleHint: "例如：COSPAN Live 真机闭环",
    detailLabel: "你完成了什么",
    detailHint: "例如：双设备建联、组队与刷新恢复",
    urlLabel: "公开链接",
    urlHint: "https://…/demo",
    needsUrl: true,
  }),
  experience_highlight: Object.freeze({
    group: "experience",
    category: "经历",
    label: "高光",
    mark: "✦",
    signature: "【经历·高光】",
    titleLabel: "高光时刻",
    titleHint: "例如：48 小时完成首个真机闭环",
    detailLabel: "发生了什么",
    detailHint: "补充你承担的角色和可核对结果",
  }),
  experience_education: Object.freeze({
    group: "experience",
    category: "经历",
    label: "教育",
    mark: "△",
    signature: "【经历·教育】",
    titleLabel: "学习经历",
    titleHint: "例如：同济大学 · 工业设计",
    detailLabel: "与协作相关的方向",
    detailHint: "只写会影响合作判断的信息",
  }),
  experience_work: Object.freeze({
    group: "experience",
    category: "经历",
    label: "工作",
    mark: "▣",
    signature: "【经历·工作】",
    titleLabel: "工作经历",
    titleHint: "例如：AI 产品负责人",
    detailLabel: "职责与结果",
    detailHint: "说明你真正负责和交付过什么",
  }),
  experience_award: Object.freeze({
    group: "experience",
    category: "经历",
    label: "获奖",
    mark: "◇",
    signature: "【经历·获奖】",
    titleLabel: "奖项或认可",
    titleHint: "例如：Hackathon 最佳设计奖",
    detailLabel: "获奖作品与贡献",
    detailHint: "说明作品、年份和你的角色",
  }),
  social_github: Object.freeze({
    group: "social",
    category: "社交平台",
    label: "GitHub",
    mark: "GH",
    platform: "github",
    urlLabel: "GitHub 公开主页",
    urlHint: "https://github.com/…",
  }),
  social_x: Object.freeze({
    group: "social",
    category: "社交平台",
    label: "X",
    mark: "X",
    signature: "【社交平台·X】",
    storeAsEvidence: true,
    needsUrl: true,
    urlLabel: "X 公开主页",
    urlHint: "https://x.com/…",
  }),
  social_xiaohongshu: Object.freeze({
    group: "social",
    category: "社交平台",
    label: "小红书",
    mark: "RED",
    platform: "xiaohongshu",
    urlLabel: "小红书公开主页",
    urlHint: "粘贴公开主页链接",
  }),
  social_jike: Object.freeze({
    group: "social",
    category: "社交平台",
    label: "即刻",
    mark: "J",
    platform: "jike",
    urlLabel: "即刻公开主页",
    urlHint: "粘贴公开主页链接",
  }),
  social_more: Object.freeze({
    group: "social",
    category: "社交平台",
    label: "更多",
    mark: "•••",
    platform: "other",
    urlLabel: "其他公开主页",
    urlHint: "https://…",
  }),
});
const profileBlockGroups = Object.freeze([
  Object.freeze({
    id: "work",
    index: "01",
    title: "作品 / 项目证据",
    copy: "用可打开、可追问的成果说明你做过什么。",
  }),
  Object.freeze({
    id: "experience",
    index: "02",
    title: "经历",
    copy: "只保留会帮助队友判断合作方式的经历。",
  }),
  Object.freeze({
    id: "social",
    index: "03",
    title: "社交平台",
    copy: "链接只在你授权后展示，不读取私信或非公开内容。",
  }),
]);
const publicFieldCatalog = {
  display_name: "姓名",
  avatar: "头像",
  role: "当前角色",
  status: "协作状态",
  skills: "能力标签",
  interests: "兴趣方向",
  availability: "可投入时间",
  collaboration_preferences: "协作偏好",
  collaboration_need: "当前需求",
  evidence: "能力证据",
  platform_links: "外部平台链接",
};

function createOnboardingDraft() {
  return {
    platformLinks: {
      xiaohongshu: "",
      jike: "",
      github: "",
      linkedin: "",
    },
    projectUrl: "",
    projectTitle: "",
    projectSummary: "",
    status: "未组队",
    availability: "",
    displayName: "",
    role: "",
    skills: "",
    interests: "",
    vibe: "",
    preferences: ["快速原型"],
    avatar: "memoji-5",
    publicConfirmed: false,
  };
}

let liveOtpCountdownTimer = null;

const state = {
  variant: readVariant(initialDiscoveryScope),
  discoveryContext: initialDiscoveryScope,
  onboarding: startsInOnboarding,
  onboardingStep: 0,
  collaborationStatus: "IDEA_RECRUITING",
  connectedSources: ["GitHub"],
  previewMode: "mobile",
  draftVersion: 0,
  recommendationIndex: 0,
  workspaceSection: "overview",
  workspaceStarted: false,
  workspaceSos: false,
  assignmentOverrides: {},
  tab: startsInWorkspace ? "collaboration" : initialTab,
  selectedId: "lin",
  visible: liveConfig.enabled ? false : !startsInOnboarding,
  stage: "browse",
  greeted: startsInWorkspace ? ["lin"] : [],
  connected: startsInWorkspace ? ["lin"] : [],
  directionAlignments: startsInWorkspace
    ? { lin: { status: "known_project", draft: confirmedProjectDirection() } }
    : {},
  invited: startsInWorkspace ? ["lin"] : [],
  joined: startsInWorkspace ? ["lin"] : [],
  connectionFilter: "all",
  directConversation: {
    connectionId: null,
    data: null,
    loading: false,
    sending: false,
    error: "",
    draft: "",
    pendingClientMessageId: null,
    pendingMessageText: null,
    loadRevision: 0,
    demoMessages: startsInWorkspace ? {
      lin: [
        {
          id: "demo-message-lin-1",
          sender_id: "user-lin",
          type: "TEXT",
          text: "刚才聊到的端侧方案挺有意思，你想先验证哪一段？",
          created_at: "2026-08-29T14:18:00.000Z",
        },
        {
          id: "demo-message-zhou-1",
          sender_id: "user-zhou",
          type: "TEXT",
          text: "我想先把现场建联到开工的路径跑通。",
          created_at: "2026-08-29T14:20:00.000Z",
        },
      ],
    } : {},
  },
  swipeSoundEnabled: storedSwipeSoundEnabled,
  discoveryFilters: defaultDiscoveryFilters(),
  discoveryFilterDraft: defaultDiscoveryFilters(),
  platformDrafts: {},
  onboardingDraft: createOnboardingDraft(),
  profileBlockDraft: null,
  acceptedTasks: [],
  live: {
    enabled: liveConfig.enabled,
    authStatus: storedAccessToken || liveConfig.demoUserId
      ? "ready"
      : initialOAuthTicket
        ? "exchanging"
        : "required",
    sessionExpiresAt: storedSessionExpiry,
    currentUserId: null,
    started: false,
    watcherId: null,
    presenceGeneration: 0,
    presenceController: null,
    requestInFlight: false,
    status: liveConfig.enabled ? "idle" : "demo",
    nearby: [],
    discover: [],
    connectionRequests: [],
    teamInvitations: [],
    projects: [],
    activeProject: null,
    room: null,
    platformLinks: [],
    currentProfile: null,
    meLoaded: false,
    meLoading: Boolean(initialOAuthTicket),
    otpChallengeId: null,
    otpMaskedPhone: "",
    otpPhone: "",
    otpRetryAt: null,
    oauthProviders: {
      google: false,
      wechat: false,
    },
    androidOAuthProviders: {
      google: false,
      wechat: false,
    },
    oauthProvidersLoaded: false,
    error: "",
    syncError: "",
    syncInFlight: false,
    pendingOperations: new Set(),
    lastUpdatedAt: null,
  },
  toast: "",
  overlay: null,
  personDetailExpanded: false,
};

const app = document.querySelector("#app");

function readVariant(discoveryScope = state.discoveryContext) {
  const key = new URLSearchParams(location.search).get("variant")?.toUpperCase();
  const availableVariants = discoveryScope === "event" && currentExhibition?.directoryEnabled
    ? ["A", "B", "C"]
    : ["A", "B"];
  return availableVariants.includes(key) ? key : "A";
}

function setVariant(key) {
  if (!availableDiscoveryVariants().includes(key)) return;
  state.variant = key;
  writeAppHistory();
  render();
}

function appHistoryPayload() {
  return {
    variant: state.variant,
    discoveryScope: state.discoveryContext,
    tab: state.tab,
    overlay: state.overlay,
    conversationId: state.directConversation.connectionId,
    profileBlockType: state.profileBlockDraft?.type || null,
  };
}

function writeAppHistory({ replace = false } = {}) {
  const url = new URL(location.href);
  url.searchParams.set("variant", state.variant);
  url.searchParams.set("scope", state.discoveryContext);
  if (state.tab === "discover") url.searchParams.delete("view");
  else url.searchParams.set("view", state.tab);
  if (state.overlay) url.searchParams.set("overlay", state.overlay);
  else url.searchParams.delete("overlay");
  if (state.overlay === "conversation" && state.directConversation.connectionId) {
    url.searchParams.set("conversation", state.directConversation.connectionId);
  } else {
    url.searchParams.delete("conversation");
  }
  if (state.overlay === "profile-block-editor" && state.profileBlockDraft?.type) {
    url.searchParams.set("block", state.profileBlockDraft.type);
  } else {
    url.searchParams.delete("block");
  }
  const method = replace ? "replaceState" : "pushState";
  history[method]({ rally: appHistoryPayload() }, "", url);
}

function activeExhibition() {
  return state.discoveryContext === "event" ? currentExhibition : null;
}

function hasExhibitionDirectory() {
  return Boolean(activeExhibition()?.directoryEnabled);
}

function availableDiscoveryVariants() {
  return hasExhibitionDirectory() ? ["A", "B", "C"] : ["A", "B"];
}

function visibilityScopeLabel() {
  return activeExhibition() ? "展会内可见" : "附近可见";
}

function visibilityScopeDescription() {
  return activeExhibition()
    ? "只展示你主动选择的公开字段，展会结束后自动隐藏。"
    : "只在你主动开启附近发现时展示公开字段，关闭后立即隐藏。";
}

function visibilityRestoredMessage() {
  return activeExhibition() ? "已恢复展会内可见" : "已恢复附近可见";
}

function selectedPerson() {
  if (state.live.enabled) {
    return livePeople().find((person) => person.id === state.selectedId)
      || livePeople()[0]
      || null;
  }
  return people.find((person) => person.id === state.selectedId)
    || people[0];
}

function selectedParticipantProfile(person = selectedPerson()) {
  if (state.live.enabled) {
    return person?.participantProfile || {
      bio: "这位参与者没有授权公开个人简介。",
      location: "本场展会",
      availability: "投入时间未公开",
      collaboration: "协作偏好未公开",
      projects: [],
    };
  }
  return participantProfiles[person.id] || {
    bio: "这位参与者还没有填写公开的个人简介。",
    location: "本场展会",
    availability: "投入时间待确认",
    collaboration: "协作偏好待确认",
    projects: [],
  };
}

function directionAlignmentFor(personId = state.selectedId) {
  return state.directionAlignments[personId]
    || { status: "not_started", draft: emptyDirectionDraft() };
}

function ensureDirectionAlignment(personId) {
  if (!state.directionAlignments[personId]) {
    const projectDirectionIsKnown = state.collaborationStatus === "TEAM_RECRUITING";
    state.directionAlignments[personId] = {
      status: projectDirectionIsKnown ? "known_project" : "not_started",
      draft: projectDirectionIsKnown ? confirmedProjectDirection() : emptyDirectionDraft(),
    };
  }
  return state.directionAlignments[personId];
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

function cleanProfileBlockField(value, maximumLength) {
  return String(value || "")
    .replace(/[｜\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function safePublicUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function parseProfileBlockEvidenceItem(value, evidenceIndex = -1) {
  if (typeof value !== "string") return null;
  const entry = Object.entries(profileBlockCatalog).find(([, item]) => (
    item.signature && value.startsWith(item.signature)
  ));
  if (!entry) return null;
  const [type, item] = entry;
  const [title = "", detail = "", url = ""] = value
    .slice(item.signature.length)
    .split("｜");
  if (!title.trim()) return null;
  return {
    source: "evidence",
    evidenceIndex,
    type,
    category: item.category,
    label: item.label,
    mark: item.mark,
    title: title.trim(),
    detail: detail.trim(),
    url: safePublicUrl(url),
    isImage: Boolean(item.isImage),
    serialized: value,
  };
}

function serializeProfileBlock(type, values) {
  const item = profileBlockCatalog[type];
  if (!item?.signature) return "";
  const title = cleanProfileBlockField(values.title, 40);
  const detail = cleanProfileBlockField(values.detail, 72);
  const url = item.needsUrl ? safePublicUrl(values.url) : "";
  return [`${item.signature}${title}`, detail, url]
    .filter((value, index, list) => value || index === 0 || list.slice(index + 1).some(Boolean))
    .join("｜");
}

function profileBlockEvidence(profile = state.live.currentProfile) {
  return (Array.isArray(profile?.evidence) ? profile.evidence : [])
    .map((item, index) => parseProfileBlockEvidenceItem(item, index))
    .filter(Boolean);
}

function plainProfileEvidence(profile = state.live.currentProfile) {
  return (Array.isArray(profile?.evidence) ? profile.evidence : [])
    .filter((item) => !parseProfileBlockEvidenceItem(item));
}

function platformPresentation(link) {
  let inferredPlatform = link?.platform;
  if (inferredPlatform === "other") {
    try {
      const hostname = new URL(link.url).hostname.replace(/^www\./, "");
      if (hostname === "x.com" || hostname === "twitter.com") inferredPlatform = "x";
    } catch {
      // Keep the generic label for a malformed legacy link.
    }
  }
  if (inferredPlatform === "x") return { label: "X", mark: "X" };
  const item = platformCatalog[inferredPlatform] || platformCatalog.other;
  return { label: item.label, mark: item.mark };
}

function publicProfileCardItems() {
  const profile = state.live.currentProfile;
  const evidenceItems = (Array.isArray(profile?.evidence) ? profile.evidence : []).map((value, index) => {
    const block = parseProfileBlockEvidenceItem(value, index);
    if (block) return block;
    return {
      source: "evidence",
      evidenceIndex: index,
      type: "plain_evidence",
      category: "能力证据",
      label: "证据",
      mark: "✓",
      title: value,
      detail: "",
      url: "",
      isImage: false,
      serialized: value,
    };
  });
  const platformItems = state.live.platformLinks.map((link) => {
    const presentation = platformPresentation(link);
    return {
      source: "platform",
      platform: link.platform,
      type: `social_${link.platform}`,
      category: "社交平台",
      label: presentation.label,
      mark: presentation.mark,
      title: presentation.label,
      detail: platformLinkSummary(link),
      url: safePublicUrl(link.url),
      isImage: false,
    };
  });
  return [...evidenceItems, ...platformItems];
}

function profileBlockAuthorizationField(item) {
  return item?.group === "social" && !item.storeAsEvidence
    ? "platform_links"
    : "evidence";
}

function profileBlockExistingAuthorizationCount(item) {
  return profileBlockAuthorizationField(item) === "platform_links"
    ? state.live.platformLinks.length
    : (state.live.currentProfile?.evidence || []).length;
}

function activeRadarPeople() {
  if (!state.live.enabled) return radarPeople;
  return state.live.nearby;
}

function discoveryPeople() {
  return state.live.enabled ? state.live.discover : rankedPeople;
}

function livePeople() {
  const candidates = [
    ...state.live.discover,
    ...state.live.nearby,
    ...state.live.connectionRequests.map((item) => item.counterpartPerson).filter(Boolean),
    ...state.live.teamInvitations.map((item) => item.counterpartPerson).filter(Boolean),
    ...state.live.projects.flatMap((project) => project.members || []).map((member) => livePerson({
      user_id: member.user_id,
      display_name: member.display_name,
      avatar: member.avatar,
      role: member.profile_role,
      status: "已加入项目",
    })),
  ];
  return [...new Map(candidates.map((person) => [person.userId, person])).values()];
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
  const role = safeLiveText(person.role, "已授权展会成员", 80);
  const status = safeLiveText(person.status, "展会中", 40);
  const avatar = typeof person.avatar === "string" && /^memoji-\d+$/.test(person.avatar)
    ? person.avatar
    : undefined;
  const skills = Array.isArray(person.skills)
    ? person.skills.slice(0, 12).map((skill) => safeLiveText(skill, "", 40)).filter(Boolean)
    : [];
  const evidenceItems = Array.isArray(person.evidence)
    ? person.evidence.slice(0, 8).map((item) => String(item || "").trim().slice(0, 160)).filter(Boolean)
    : [];
  const evidenceBlocks = evidenceItems.map((item, index) => (
    parseProfileBlockEvidenceItem(item, index)
  ));
  const platformLinks = Array.isArray(person.platform_links) ? person.platform_links : [];
  const signal = person.distance?.band === "under_50m"
    ? 3
    : person.distance?.band === "under_200m"
      ? 2
      : 1;
  return {
    id: preset?.id || localId,
    userId: String(person.user_id || `user-${localId}`),
    name: displayName,
    monogram: displayName.slice(0, 2).toUpperCase(),
    glyph: preset?.glyph || "glyph-orbit",
    avatar,
    role,
    status,
    skills,
    availability: safeLiveText(person.availability, "", 120),
    proximity: safeLiveText(person.distance?.label, "展会现场", 40),
    evidence: safeLiveText(
      evidenceBlocks[0]?.title || evidenceItems[0],
      "展会内授权公开资料",
      120,
    ),
    hasPublicEvidence: evidenceItems.length > 0 || platformLinks.length > 0,
    reason: safeLiveText(
      person.recommendation?.reasons?.join("；"),
      "对方正在同一展会现场，可以直接当面确认协作意图。",
      240,
    ),
    caution: safeLiveText(
      person.recommendation?.needs_confirmation,
      "具体投入时间和分工仍需当面确认",
      180,
    ),
    fit: safeLiveText(person.recommendation?.ranking_factors?.[0], "同场协作", 40),
    fitDetail: person.recommendation?.generated_by === "RULE_FALLBACK" ? "规则推荐" : "真实资料",
    pairLabel: "COSPAN × LIVE",
    teamRole: role,
    signal,
    participantProfile: {
      bio: safeLiveText(person.collaboration_need, "这位参与者没有授权公开个人简介。", 240),
      location: "本场展会",
      availability: safeLiveText(person.availability, "投入时间未公开", 120),
      collaboration: Array.isArray(person.collaboration_preferences) && person.collaboration_preferences.length
        ? person.collaboration_preferences.map((item) => safeLiveText(item, "", 60)).filter(Boolean).join("、")
        : "协作偏好未公开",
      projects: evidenceItems.map((item, index) => ({
        title: safeLiveText(evidenceBlocks[index]?.title, `公开证据 ${index + 1}`, 80),
        detail: safeLiveText(evidenceBlocks[index]?.detail || item, "已授权公开证据", 160),
        tags: skills.slice(0, 3),
      })),
    },
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
  const overlayFocus = captureOverlayFocus();
  const showsOnboarding = state.onboarding && liveAppReady();
  document.body.dataset.variant = state.variant;
  document.body.dataset.scope = state.discoveryContext;
  document.body.dataset.flow = showsOnboarding ? "onboarding" : "product";
  document.body.dataset.tab = state.tab;
  document.body.dataset.source = initialParams.get("source") === "android-app" ? "android-app" : "web";
  const phone = `
    <main class="prototype-stage">
      <section class="phone-shell" aria-label="COSPAN 合拍手机端原型">
        <div class="screen">
          ${showsOnboarding ? renderOnboarding() : renderCurrentView()}
        </div>
        ${showsOnboarding || !liveAppReady() ? "" : renderAppNav()}
      </section>
      <aside class="prototype-notes">
        <p class="eyebrow">${showsOnboarding ? "COSPAN / INTRO" : `COSPAN / MOBILE / ${state.variant}`}</p>
        <h1>${showsOnboarding ? "四步完成自我介绍" : variantNames[state.variant]}</h1>
        <p>${showsOnboarding ? "从公开主页和正在做的事开始，用最少输入组装一张可以被队友快速读懂的协作卡。" : variantDescription()}</p>
        ${renderStateLedger()}
      </aside>
    </main>
  `;

  app.innerHTML = `${phone}${renderOverlay()}${renderToast()}`;
  bindEvents();
  syncOverlayAccessibility(overlayFocus);
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
  const steps = [renderOnboardingSources, renderOnboardingProject, renderOnboardingVibe, renderOnboardingIdentity];
  return `<div class="onboarding-shell view-c">
    <header class="onboarding-header">
      <button class="onboarding-back" data-action="onboarding-back" aria-label="返回">${state.onboardingStep ? "←" : "×"}</button>
      <div class="onboarding-progress" aria-label="第 ${state.onboardingStep + 1} 步，共 4 步"><span style="width:${(state.onboardingStep + 1) * 25}%"></span></div>
      <strong>${state.onboardingStep + 1} / 4</strong>
    </header>
    ${state.live.error ? `<div class="onboarding-inline-error" role="alert">${escapeHtml(state.live.error)}</div>` : ""}
    ${steps[state.onboardingStep]()}
  </div>`;
}

function onboardingGuide(kicker, title, body) {
  return `<section class="passport-guide">
    <span class="guide-mark" aria-hidden="true"><img src="./assets/cospan-icon.svg" alt=""></span>
    <div><p>${kicker}</p><h2>${title}</h2><span>${body}</span></div>
  </section>`;
}

function renderOnboardingSources() {
  const sources = [
    ["xiaohongshu", "小红书", "RED", "粘贴公开主页链接"],
    ["jike", "即刻", "J", "粘贴公开主页链接"],
    ["github", "GitHub", "GH", "https://github.com/…"],
    ["linkedin", "LinkedIn", "in", "https://linkedin.com/in/…"],
  ];
  return `<form class="onboarding-step onboarding-form" data-onboarding-form data-onboarding-step="0">
    ${onboardingGuide("01 / PUBLIC TRAILS", "不用从头自我介绍。", "先放上你愿意公开的主页。都可以留空，COSPAN 不读取私信或非公开内容。")}
    <section class="onboarding-link-list" aria-label="公开主页">
      ${sources.map(([platform, label, mark, hint]) => `<label class="onboarding-link-row">
        <span class="onboarding-link-mark tone-${platform}" aria-hidden="true">${mark}</span>
        <span><b>${label}</b><input name="platform-${platform}" data-onboarding-platform="${platform}" type="url" inputmode="url" autocomplete="url" placeholder="${hint}" value="${escapeHtml(state.onboardingDraft.platformLinks[platform])}"></span>
      </label>`).join("")}
    </section>
    ${renderOnboardingFooter("下一步", "暂且跳过")}
  </form>`;
}

function renderOnboardingProject() {
  const statuses = ["未组队", "有 Idea 找人", "团队缺人", "已组队但可交流"];
  return `<form class="onboarding-step onboarding-form" data-onboarding-form data-onboarding-step="1">
    ${onboardingGuide("02 / NOW BUILDING", "你现在在做什么？", "产品、Demo、实验或还没做完的想法都算。没有公开链接也可以直接写。")}
    <section class="onboarding-fields">
      <label><span>作品或项目名称</span><input name="projectTitle" data-onboarding-field="projectTitle" maxlength="40" placeholder="例如：会场协作终端" value="${escapeHtml(state.onboardingDraft.projectTitle)}"></label>
      <label><span>公开链接 <em>选填</em></span><input name="projectUrl" data-onboarding-field="projectUrl" type="url" inputmode="url" placeholder="https://…" value="${escapeHtml(state.onboardingDraft.projectUrl)}"></label>
      <label><span>我做了什么</span><textarea name="projectSummary" data-onboarding-field="projectSummary" maxlength="72" placeholder="一句话说清你的角色和结果">${escapeHtml(state.onboardingDraft.projectSummary)}</textarea></label>
      <label><span>今天可以投入多久</span><input name="availability" data-onboarding-field="availability" maxlength="120" placeholder="例如：今天可投入 6 小时" value="${escapeHtml(state.onboardingDraft.availability)}"></label>
    </section>
    <section class="onboarding-status-pills" aria-label="当前协作状态">
      <span>当前协作状态</span>
      <div>${statuses.map((status) => `<button type="button" class="${state.onboardingDraft.status === status ? "selected" : ""}" data-action="choose-onboarding-status" data-status="${status}" aria-pressed="${state.onboardingDraft.status === status}">${status}</button>`).join("")}</div>
    </section>
    ${renderOnboardingFooter("下一步", "之后再放")}
  </form>`;
}

function renderOnboardingVibe() {
  const preferenceOptions = ["快速原型", "结对协作", "异步记录", "先聊清目标"];
  return `<form class="onboarding-step onboarding-form" data-onboarding-form data-onboarding-step="2">
    ${onboardingGuide("03 / YOUR VIBE", "让别人用一句话记住你。", "不用写简历。说清你是谁、会什么、对什么好奇，以及希望怎么一起做事。")}
    <section class="onboarding-fields">
      <label><span>你怎么介绍自己的角色</span><input name="role" data-onboarding-field="role" required maxlength="80" placeholder="例如：AI 产品设计师 / 独立开发者" value="${escapeHtml(state.onboardingDraft.role)}"></label>
      <label><span>你会什么 <em>3–5 项，用逗号分隔</em></span><input name="skills" data-onboarding-field="skills" required placeholder="产品，交互，AI coding" value="${escapeHtml(state.onboardingDraft.skills)}"></label>
      <label><span>你在关注什么</span><input name="interests" data-onboarding-field="interests" required placeholder="例如：Agent，硬件，创作者工具" value="${escapeHtml(state.onboardingDraft.interests)}"></label>
      <label><span>我的 builder's vibe 是</span><textarea name="vibe" data-onboarding-field="vibe" required maxlength="160" placeholder="我是怎样的人，在做什么，想认识怎样的队友？">${escapeHtml(state.onboardingDraft.vibe)}</textarea></label>
    </section>
    <section class="onboarding-preferences" aria-label="协作偏好"><span>我喜欢这样协作</span><div>${preferenceOptions.map((preference) => `<button type="button" class="${state.onboardingDraft.preferences.includes(preference) ? "selected" : ""}" data-action="toggle-onboarding-preference" data-preference="${preference}" aria-pressed="${state.onboardingDraft.preferences.includes(preference)}">${preference}</button>`).join("")}</div></section>
    ${renderOnboardingFooter("下一步", "暂且跳过")}
  </form>`;
}

function renderOnboardingIdentity() {
  const draft = state.onboardingDraft;
  const saving = state.live.pendingOperations.has("onboarding:save");
  const avatars = ["memoji-1", "memoji-2", "memoji-4", "memoji-5", "memoji-7", "memoji-9"];
  const skills = parseProfileList(draft.skills);
  return `<form class="onboarding-step onboarding-form onboarding-identity" data-onboarding-form data-onboarding-step="3">
    ${onboardingGuide("04 / READY", "最后，让队友知道怎么称呼你。", "选择一个头像，确认公开预览。开始发现后，左滑暂不看，右滑表达想认识。以后可以随时在“我的”里修改或暂停展示。")}
    <section class="onboarding-avatar-picker" aria-label="选择头像">
      <span class="memoji-avatar ${draft.avatar} onboarding-avatar-preview" aria-label="当前头像"></span>
      <div>${avatars.map((avatar) => `<button type="button" class="${draft.avatar === avatar ? "selected" : ""}" data-action="choose-onboarding-avatar" data-avatar="${avatar}" aria-label="选择头像 ${avatar.replace("memoji-", "")}" aria-pressed="${draft.avatar === avatar}"><span class="memoji-avatar ${avatar}"></span></button>`).join("")}</div>
    </section>
    <section class="onboarding-fields">
      <label><span>怎么称呼你</span><input name="displayName" data-onboarding-field="displayName" required autocomplete="name" maxlength="40" placeholder="输入你的名字或常用昵称" value="${escapeHtml(draft.displayName)}"></label>
    </section>
    <article class="onboarding-card-preview" data-onboarding-card-preview>
      <header><span class="memoji-avatar ${draft.avatar}"></span><div><strong>${escapeHtml(draft.displayName || "你的名字")}</strong><small>${escapeHtml(draft.role || "你的角色")}</small></div><em>${escapeHtml(draft.status)}</em></header>
      <p>${escapeHtml(draft.vibe || "你的一句话自我介绍会出现在这里。")}</p>
      <div>${skills.length ? skills.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("") : "<span>能力标签</span>"}</div>
      ${draft.projectTitle ? `<footer><span>NOW BUILDING</span><strong>${escapeHtml(draft.projectTitle)}</strong></footer>` : ""}
    </article>
    <label class="onboarding-public-confirm"><input name="publicConfirmed" data-onboarding-confirm type="checkbox" required ${draft.publicConfirmed ? "checked" : ""}><span>我确认将以上资料公开到本场展会；可以随时修改、暂停或撤回</span></label>
    ${renderOnboardingFooter(saving ? "正在保存…" : "完成介绍 · 开始发现", "返回修改", saving)}
  </form>`;
}

function renderOnboardingFooter(primaryLabel, secondaryLabel = "稍后设置", disabled = false) {
  return `<footer class="onboarding-footer"><button class="text-action" type="button" data-action="skip-onboarding">${secondaryLabel}</button><button class="primary-button" type="submit" ${disabled ? "disabled" : ""}>${primaryLabel}</button></footer>`;
}

function renderCurrentView() {
  if (!liveAppReady()) return renderLiveGate();
  if (state.tab === "connections") return renderConnections();
  if (state.tab === "collaboration") return renderCollaboration();
  if (state.tab === "profile") return renderProfile();
  if (state.variant === "B") return renderVariantB();
  if (state.variant === "C" && hasExhibitionDirectory()) return renderVariantC();
  return renderVariantA();
}

function liveAppReady() {
  return !state.live.enabled || (state.live.authStatus === "ready" && state.live.meLoaded);
}

function renderLiveGate() {
  if (state.live.authStatus === "required") {
    const verifyingCode = Boolean(state.live.otpChallengeId);
    const retrySeconds = otpRetrySeconds();
    const isAndroidApp = initialParams.get("source") === "android-app";
    const isWechatBrowser = /MicroMessenger/i.test(navigator.userAgent);
    const oauthButton = (provider, label, mark) => {
      const unsupportedAndroidWechat = isAndroidApp && provider === "wechat";
      const unsupportedExternalWechat = provider === "wechat" && !isWechatBrowser;
      const unsupportedEmbeddedGoogle = provider === "google" && isWechatBrowser;
      const serverEnabled = isAndroidApp
        ? state.live.androidOAuthProviders[provider]
        : state.live.oauthProviders[provider];
      const enabled = serverEnabled
        && !unsupportedAndroidWechat
        && !unsupportedExternalWechat
        && !unsupportedEmbeddedGoogle;
      if (!enabled) return "";
      return `<button class="live-oauth-button live-oauth-${provider}" type="button" data-action="start-oauth-login" data-provider="${provider}">
        <span aria-hidden="true">${mark}</span><b>${label}</b>
      </button>`;
    };
    const oauthOptions = [
      oauthButton("wechat", "微信登录", "微"),
      oauthButton("google", "Google 登录", "G"),
    ].filter(Boolean).join("");
    return `<div class="live-gate">
      <div class="live-gate-brand"><strong>COSPAN</strong><span>合拍 · 人与人先相遇，人与 Agent 再共创。</span></div>
      <section class="live-login-card">
        <p class="micro-label">${verifyingCode ? "VERIFY" : "WELCOME"}</p>
        <h2>${verifyingCode ? "输入验证码" : "手机号登录"}</h2>
        <p>${verifyingCode
          ? `验证码已发送至 ${escapeHtml(state.live.otpMaskedPhone)}，5 分钟内有效。`
          : "验证手机号后，用 4 个轻量步骤完成自我介绍。手机号不会出现在公开卡片上。"}</p>
        ${verifyingCode ? `
          <form data-live-otp-verify>
            <label><span>6 位验证码</span><input name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="请输入短信验证码"></label>
            <button class="primary-button full" type="submit" ${state.live.meLoading ? "disabled" : ""}>${state.live.meLoading ? "正在验证…" : "验证并进入 COSPAN"}</button>
          </form>
          <div class="live-otp-actions">
            <button type="button" data-action="edit-live-phone">更换手机号</button>
            <button type="button" data-action="resend-live-otp" ${retrySeconds > 0 || state.live.meLoading ? "disabled" : ""}>${retrySeconds > 0 ? `${retrySeconds} 秒后可重发` : "重新获取验证码"}</button>
          </div>
        ` : `
          ${oauthOptions ? `<div class="live-oauth-options" aria-label="第三方登录方式">${oauthOptions}</div><div class="live-login-divider"><span>或</span></div>` : ""}
          <form data-live-otp-request>
            <label><span>手机号</span><input name="phone" type="tel" required inputmode="tel" autocomplete="tel" placeholder="请输入中国大陆手机号" value="${escapeHtml(state.live.otpPhone)}"></label>
            <button class="primary-button full" type="submit" ${state.live.meLoading ? "disabled" : ""}>${state.live.meLoading ? "正在发送…" : "获取短信验证码"}</button>
          </form>
          <p class="live-login-consent">登录即表示你同意使用所选账号完成身份验证。</p>
        `}
        <details class="live-analytics-privacy" data-analytics-privacy-notice><summary>隐私与数据说明</summary><span>COSPAN 只记录改进登录、发现和组队所需的白名单事件，不收集验证码、Token、自由文本或精确位置；演示阶段不向第三方统计平台发送数据。</span></details>
        ${state.live.error ? `<div class="live-error" role="alert">${escapeHtml(state.live.error)}</div>` : ""}
      </section>
    </div>`;
  }
  return `<div class="live-gate">
    <div class="live-gate-brand"><strong>COSPAN</strong><span>合拍 · 人与人先相遇，人与 Agent 再共创。</span></div>
    <section class="live-login-card live-retry-card">
      <p class="micro-label">${state.live.meLoading ? "CONNECTING" : "CONNECTION ERROR"}</p>
      <h2>${state.live.meLoading ? "正在恢复现场状态" : "暂时无法连接"}</h2>
      <p>${state.live.meLoading ? "正在读取账号、公开授权与协作进度。" : state.live.error || "网络暂时不可用，请稍后重试。"}</p>
      ${state.live.meLoading ? `<span class="live-spinner" aria-label="加载中"></span>` : `<button class="primary-button full" data-action="retry-live">重新连接</button>`}
      ${liveConfig.accessToken ? `<button class="text-action" data-action="logout-live">退出当前账号</button>` : ""}
    </section>
  </div>`;
}

function commonHeader(title = "发现", utility = null) {
  const filterCount = activeDiscoveryFilterCount();
  const activeContext = activeExhibition();
  const contextLabel = activeContext?.name || "日常附近";
  const contextSwitcher = `<button class="context-switch-trigger is-${activeContext ? "event" : "nearby"}" data-action="open-context-switcher" aria-label="切换发现范围，当前为 ${contextLabel}" title="当前范围：${contextLabel}">
    <span class="context-switch-glyph" aria-hidden="true"><i></i><b></b></span>
    <span class="context-switch-copy"><small>当前范围</small><strong>${escapeHtml(contextLabel)}</strong></span>
  </button>`;
  const utilityButton = utility === "filters"
    ? `<button class="discovery-filter-trigger ${filterCount ? "is-filtered" : ""}" data-action="open-discovery-filters" aria-label="设置筛选偏好${filterCount ? `，已启用 ${filterCount} 项` : ""}">
        <span aria-hidden="true"><i></i><i></i><i></i></span>${filterCount ? `<b>${filterCount}</b>` : ""}
      </button>`
    : utility === "settings"
      ? `<button class="profile-settings-trigger" data-action="open-profile-settings" aria-label="打开设置">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm8.1 4.7v-2.4l-2.2-.7a7 7 0 0 0-.7-1.7l1.1-2-1.7-1.7-2 1.1a7 7 0 0 0-1.7-.7L12.2 3H9.8l-.7 2.2a7 7 0 0 0-1.7.7l-2-1.1-1.7 1.7 1.1 2a7 7 0 0 0-.7 1.7l-2.2.7v2.4l2.2.7a7 7 0 0 0 .7 1.7l-1.1 2 1.7 1.7 2-1.1a7 7 0 0 0 1.7.7l.7 2.2h2.4l.7-2.2a7 7 0 0 0 1.7-.7l2 1.1 1.7-1.7-1.1-2a7 7 0 0 0 .7-1.7l2.2-.7Z"/></svg>
        </button>`
      : "";
  const headerIdentity = title === "发现"
    ? `<div class="app-brand"><strong>COSPAN</strong><span>合拍 · 发现</span></div>`
    : `<div class="app-section-title"><strong>${escapeHtml(title)}</strong></div>`;
  return `
    <header class="app-header">
      <div class="app-header-start">${utilityButton}${headerIdentity}</div>
      ${contextSwitcher}
    </header>
  `;
}

function renderContextSwitcherSheet() {
  const activeContext = activeExhibition();
  const eventName = currentExhibition?.name || "尚未加入活动";
  const eventDisabled = !currentExhibition;
  return `<div class="overlay context-switcher-overlay">
    <button class="overlay-backdrop" data-action="close-context-switcher" aria-label="关闭发现范围选择"></button>
    <section class="bottom-sheet context-switcher-sheet" role="dialog" aria-modal="true" aria-label="管理当前发现范围">
      <header class="context-switcher-head">
        <div><p class="micro-label">发现范围</p><h3>你想在哪里发现人？</h3></div>
        <button data-action="close-context-switcher" aria-label="关闭发现范围选择">×</button>
      </header>
      <div class="context-options" role="radiogroup" aria-label="选择发现范围">
        <button class="context-option ${activeContext ? "selected" : ""}" data-action="select-discovery-context" data-context-scope="event" role="radio" aria-checked="${Boolean(activeContext)}" ${eventDisabled ? "disabled" : ""}>
          <span class="context-option-mark is-event" aria-hidden="true"><i></i><b></b></span>
          <span><strong>${escapeHtml(eventName)}</strong><small>本场推荐、附近和授权名册</small></span>
          <em aria-hidden="true">${activeContext ? "✓" : "→"}</em>
        </button>
        <button class="context-option ${activeContext ? "" : "selected"}" data-action="select-discovery-context" data-context-scope="nearby" role="radio" aria-checked="${!activeContext}">
          <span class="context-option-mark is-nearby" aria-hidden="true"><i></i><b></b></span>
          <span><strong>日常附近</strong><small>发现身边主动开放的人</small></span>
          <em aria-hidden="true">${activeContext ? "→" : "✓"}</em>
        </button>
      </div>
      <p class="context-switcher-note">切换只影响发现结果，不会退出活动或删除关系。</p>
      <button class="context-manage-button" data-action="manage-context-visibility"><span>管理公开范围</span><b aria-hidden="true">→</b></button>
    </section>
  </div>`;
}

function renderDiscoveryTabs() {
  const tabs = [["A", "推荐"], ["B", "附近"]];
  if (hasExhibitionDirectory()) tabs.push(["C", "名册"]);
  return `<nav class="discovery-tabs" aria-label="发现浏览方式">
    ${tabs.map(([key, label]) => `
      <button class="${state.variant === key ? "active" : ""}" data-discovery-view="${key}" aria-pressed="${state.variant === key}">${label}</button>
    `).join("")}
  </nav>`;
}

function renderVariantA() {
  const recommendationPool = filterDiscoveryPeople(discoveryPeople());
  const person = recommendedPerson(recommendationPool);
  if (!person) return renderDiscoveryEmpty("推荐");
  const currentIndex = state.recommendationIndex % recommendationPool.length;
  const nextPerson = recommendationPool[(currentIndex + 1) % recommendationPool.length];
  return `
    <div class="view view-a recommendation-view">
      ${commonHeader("发现", "filters")}
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
      <section class="recommendation-progress" aria-label="推荐浏览进度">
        ${recommendationPool.map((item, index) => `<i class="${index === currentIndex ? "active" : ""}" title="${item.name}"></i>`).join("")}
      </section>
    </div>
  `;
}

function renderDiscoveryEmpty(mode) {
  if (state.live.enabled && state.live.syncError) {
    return `<div class="view view-${state.variant.toLowerCase()}">
      ${commonHeader("发现", "filters")}
      ${renderDiscoveryTabs()}
      <section class="discovery-filter-empty" role="alert">
        <span class="empty-symbol">!</span>
        <p class="micro-label">LIVE SYNC INTERRUPTED</p>
        <h3>现场成员暂时无法同步</h3>
        <p>${state.live.syncError}</p>
        <button class="primary-button" data-action="sync-live-now">重新连接</button>
      </section>
    </div>`;
  }
  return `<div class="view view-${state.variant.toLowerCase()}">
    ${commonHeader("发现", "filters")}
    ${renderDiscoveryTabs()}
    <section class="discovery-filter-empty">
      <span class="empty-symbol">⌁</span>
      <p class="micro-label">STRICT FILTERS / 0 RESULT</p>
      <h3>当前筛选下暂无${mode}结果</h3>
      <p>COSPAN 不会自动放宽你的筛选条件。调整状态、职能或投入时间后再查看。</p>
      <button class="primary-button" data-action="open-discovery-filters">调整筛选</button>
    </section>
  </div>`;
}

function recommendedPerson(pool = filterDiscoveryPeople(discoveryPeople())) {
  if (!pool.length) return null;
  return pool[state.recommendationIndex % pool.length];
}

function advanceRecommendation(pool = filterDiscoveryPeople(discoveryPeople())) {
  if (!pool.length) return;
  state.recommendationIndex = (state.recommendationIndex + 1) % pool.length;
  state.selectedId = recommendedPerson(pool).id;
}

function interestConfirmationCopy() {
  return "已表达想认识，线下碰卡后才会交换联系方式";
}

function expressRecommendationInterest(personId) {
  const person = (state.live.enabled ? livePeople() : people).find((item) => item.id === personId) || recommendedPerson();
  if (!person) return;
  if (state.live.enabled) {
    sendLiveConnectionRequest(person);
    return;
  }
  if (!state.greeted.includes(person.id)) state.greeted.push(person.id);
  showToast(interestConfirmationCopy());
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
        ? ["○ 真实定位暂不可用", state.live.error || "请检查定位权限或稍后重试"]
        : ["● 手机前台发现", "仅在打开本页时更新，离开后停止"];
  return `
    <div class="view view-b">
      ${commonHeader("发现", "filters")}
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
      </section>` : `<section class="radar-ticket"><p class="ticket-reason">${activeDiscoveryFilterCount() ? "附近暂时没有同时满足当前筛选条件的人，COSPAN 没有自动放宽条件。" : "暂未发现仍在展会内公开位置的协作者。定位只在本页前台开启，并会在离开后立即停止。"}</p>${activeDiscoveryFilterCount() ? `<button class="secondary-button full" data-action="open-discovery-filters">调整筛选</button>` : ""}</section>`}
    </div>
  `;
}

function renderVariantC() {
  if (!hasExhibitionDirectory()) return renderVariantA();
  const directoryPeople = filterDiscoveryPeople(discoveryPeople());
  if (!directoryPeople.length) return renderDiscoveryEmpty("名册");
  return `
    <div class="view view-c">
      ${commonHeader("发现", "filters")}
      ${renderDiscoveryTabs()}
      <section class="directory-summary">
        <div><h3>展会名册</h3><span>${directoryPeople.length} 人</span></div>
        <p>仅展示已授权加入本场展会的成员</p>
      </section>
      <section class="ledger-list" aria-label="按项目缺口优先排序的展会成员">
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
      <button class="ledger-scan" data-action="refresh"><span>↻</span>刷新展会名册</button>
    </div>
  `;
}

function renderConnections() {
  if (state.live.enabled) return renderLiveConnections();
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
  const connectedAction = (person) => {
    if (state.joined.includes(person.id)) return `<button class="primary-button full" data-tab="collaboration">查看共同项目</button>`;
    if (state.invited.includes(person.id)) return `<button class="primary-button full" data-action="resume-team-invite" data-person="${person.id}">查看项目邀请</button>`;
    const alignment = directionAlignmentFor(person.id);
    if (alignment.status === "known_project") return `<button class="primary-button full" data-action="resume-project-invite" data-person="${person.id}">邀请加入现有项目</button>`;
    if (alignment.status === "confirmed") return `<button class="primary-button full" data-action="resume-project-creation" data-person="${person.id}">创建项目并邀请入队</button>`;
    if (alignment.status === "pending_partner") return `<button class="primary-button full" data-action="resume-direction" data-person="${person.id}">${state.live.enabled ? "继续项目创建" : "查看方向确认进度"}</button>`;
    return `<button class="primary-button full" data-action="resume-direction" data-person="${person.id}">继续意图澄清</button>`;
  };
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
            <div class="connection-context"><span>认识于</span><strong>${currentExhibition?.name || "线下协作现场"}</strong><small>刚刚 · ${person.pairLabel}</small></div>
            <div class="connection-card-actions"><button class="primary-button" data-action="open-conversation" data-connection-id="demo-${person.id}" data-person="${person.id}">打开对话</button>${connectedAction(person)}</div>
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

function uniqueRequestsByCounterpart(requests) {
  return [...new Map(requests.map((item) => [item.counterpartPerson.userId, item])).values()];
}

function renderLiveConnections() {
  const accepted = uniqueRequestsByCounterpart(
    state.live.connectionRequests.filter((item) => item.status === "ACCEPTED" && item.connection_id),
  );
  const incoming = state.live.connectionRequests.filter(
    (item) => item.status === "REQUESTED" && item.direction === "incoming",
  );
  const outgoing = state.live.connectionRequests.filter(
    (item) => item.status === "REQUESTED" && item.direction === "outgoing",
  );
  const visibleAccepted = state.connectionFilter === "pending" ? [] : accepted;
  const visibleIncoming = state.connectionFilter === "connected" ? [] : incoming;
  const visibleOutgoing = state.connectionFilter === "connected" ? [] : outgoing;
  const filters = [["all", "全部"], ["pending", "待回应"], ["connected", "已建联"]];
  return `<div class="view utility-view">
    ${commonHeader("连接")}
    <section class="connection-hero">
      <div class="connection-summary"><strong>${accepted.length}</strong><span>位已建联</span>${incoming.length ? `<em>${incoming.length} 个待你回应</em>` : ""}</div>
      <p>请求与连接状态来自服务端；回到前台会立即刷新，弱网恢复后不会重复建联。</p>
      ${state.live.syncError ? `<div class="inline-sync-error" role="alert"><span>${state.live.syncError}</span><button data-action="sync-live-now">重试</button></div>` : ""}
    </section>
    <div class="filter-row" role="group" aria-label="连接状态筛选">
      ${filters.map(([id, label]) => `<button class="${state.connectionFilter === id ? "active" : ""}" data-action="filter-connections" data-filter="${id}" aria-pressed="${state.connectionFilter === id}">${label}</button>`).join("")}
    </div>
    <section class="connection-list">
      ${visibleIncoming.map((request) => {
        const person = request.counterpartPerson;
        return `<article class="connection-card incoming-request-card">
          <div class="connection-card-head">${glyph(person, "md")}<div><h4>${person.name}</h4><p>${person.role}</p></div><span class="source-chip">想认识你</span></div>
          <div class="connection-context"><span>来自</span><strong>${currentExhibition?.name || "COSPAN 现场"}</strong><small>${safeLiveText(request.message, "对方希望和你聊聊协作可能", 180)}</small></div>
          <div class="request-actions"><button class="primary-button" data-action="resolve-connection" data-request-id="${request.id}" data-resolution="accept" ${liveBusyAttributes(`connection-request:${request.id}`)}>接受</button><button class="secondary-button" data-action="resolve-connection" data-request-id="${request.id}" data-resolution="reject" ${liveBusyAttributes(`connection-request:${request.id}`)}>拒绝</button><button class="text-action" data-action="resolve-connection" data-request-id="${request.id}" data-resolution="block" ${liveBusyAttributes(`connection-request:${request.id}`)}>拉黑</button></div>
        </article>`;
      }).join("")}
      ${visibleAccepted.map((request) => {
        const person = request.counterpartPerson;
        return `<article class="connection-card">
          <div class="connection-card-head">${glyph(person, "md")}<div><h4>${person.name}</h4><p>${person.role}</p></div><span class="source-chip">已建联</span></div>
          <div class="connection-context"><span>认识于</span><strong>${currentExhibition?.name || "COSPAN 现场"}</strong><small>${request.source === "nfc" ? "碰卡建联" : "双方确认"}</small></div>
          ${request.last_message ? `<p class="connection-message-preview"><span>${escapeHtml(request.last_message.text)}</span>${request.unread_count ? `<b>${request.unread_count} 条新消息</b>` : ""}</p>` : ""}
          <div class="connection-card-actions"><button class="primary-button" data-action="open-conversation" data-connection-id="${escapeHtml(request.connection_id)}" data-person="${person.id}" aria-label="打开与 ${escapeHtml(person.name)} 的对话${request.unread_count ? `，${request.unread_count} 条未读` : ""}">打开对话${request.unread_count ? `<b>${request.unread_count}</b>` : ""}</button><button class="secondary-button" data-action="resume-direction" data-person="${person.id}">继续项目协作</button></div>
        </article>`;
      }).join("")}
      ${visibleOutgoing.map((request) => {
        const person = request.counterpartPerson;
        return `<article class="pending-row">${glyph(person, "sm")}<div><strong>${person.name}</strong><span>招呼已发出 · 等待回应</span></div><button class="text-action" data-action="resolve-connection" data-request-id="${request.id}" data-resolution="cancel" ${liveBusyAttributes(`connection-request:${request.id}`)}>撤回</button></article>`;
      }).join("")}
      ${visibleIncoming.length || visibleAccepted.length || visibleOutgoing.length ? "" : `<div class="empty-state"><span class="empty-symbol">◎</span><h4>当前没有连接记录</h4><p>在发现页表达“想认识”，或在线下通过受信设备碰卡建联。</p><button class="primary-button" data-tab="discover">去发现</button></div>`}
    </section>
  </div>`;
}

function renderCollaboration() {
  if (state.live.enabled) return renderLiveCollaboration();
  const joinedPeople = people.filter((person) => state.joined.includes(person.id));
  if (!joinedPeople.length) return renderCollaborationLobby();
  return renderWorkspace(joinedPeople);
}

function renderLiveCollaboration() {
  const project = state.live.activeProject;
  const pendingInvitations = state.live.teamInvitations.filter(
    (item) => item.direction === "incoming" && item.status === "PENDING",
  );
  if (!project) {
    return `<div class="view utility-view collaboration-lobby">
      ${commonHeader("协作")}
      ${pendingInvitations.length ? `<section class="collaboration-inbox"><div><p class="micro-label">TEAM INVITATIONS</p><h3>入队邀请</h3></div>${pendingInvitations.map((invitation) => `<article class="team-invitation-row">${glyph(invitation.counterpartPerson, "sm")}<span><strong>${safeLiveText(invitation.project?.title, "未命名项目", 100)}</strong><small>${safeLiveText(invitation.counterpart?.display_name, "展会成员", 40)} 邀请你担任${safeLiveText(invitation.role_need?.title, "协作成员", 80)}</small></span><div><button class="primary-button" data-action="resolve-team-invitation" data-invitation-id="${invitation.id}" data-resolution="accept" ${liveBusyAttributes(`team-invitation:${invitation.id}`)}>确认入队</button><button class="text-action" data-action="resolve-team-invitation" data-invitation-id="${invitation.id}" data-resolution="decline" ${liveBusyAttributes(`team-invitation:${invitation.id}`)}>拒绝</button></div></article>`).join("")}</section>` : ""}
      <section class="collaboration-empty">
        <span class="collaboration-empty-mark">＋</span><p class="micro-label">COSPAN SPACE</p>
        <h3>${pendingInvitations.length ? "先处理入队邀请" : "还没有进行中的人机协作空间"}</h3>
        <p>项目与成员状态来自服务端。完成连接、方向确认与入队后，两台设备都能恢复同一个协作空间。</p>
        <button class="primary-button" data-tab="connections">查看连接</button>
      </section>
    </div>`;
  }

  const room = state.live.room;
  const pack = room?.starter_pack;
  const canGenerate = new Set(["ORIGINATOR", "LEADER"]).has(project.my_membership?.membership_role);
  const members = room?.members || project.members || [];
  const launchStage = !pack ? 1 : pack.status === "CONFIRMED" ? 3 : 2;
  const launchLabel = !pack
    ? "等待生成启动计划"
    : pack.status === "CONFIRMED"
      ? "计划已确认，进入执行"
      : "当前确认分工";
  return `<div class="view utility-view workspace-view live-workspace-view" data-live-project-id="${escapeHtml(project.id)}">
    ${commonHeader("协作")}
    <section class="workspace-project-head live-project-summary">
      <div class="workspace-project-top">
        <div class="workspace-live"><i></i>${pack?.status === "CONFIRMED" ? "执行中" : "后端实时同步"}</div>
        <span class="workspace-room-label">COSPAN SPACE / LIVE</span>
      </div>
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.summary)}</p>
      <div class="workspace-project-meta">
        <div class="workspace-avatar-stack" aria-label="${members.length} 位项目成员">${members.map((member) => `<span>${escapeHtml((member.display_name || "成员").slice(0, 2).toUpperCase())}</span>`).join("")}</div>
        <span><strong>${members.length} 位成员</strong><small>${pack ? `计划 V${pack.version}` : "等待启动计划"}</small></span>
        <b>${room?.agent_daily_budget ? `Agent ${room.agent_daily_budget.used}/${room.agent_daily_budget.cap}` : "实时 Room"}</b>
      </div>
      <div class="workspace-launch-summary" role="progressbar" aria-label="项目启动进度" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${launchStage}">
        <div><span>启动进度</span><strong>${launchStage} / 3 · ${launchLabel}</strong></div>
        <small>${pack ? `${room.confirmation_progress.confirmed} / ${room.confirmation_progress.required} 位成员已确认` : "项目成员到齐后，由发起人生成首版计划"}</small>
        <i aria-hidden="true"><b style="width:${launchStage / 3 * 100}%"></b></i>
      </div>
      ${state.live.syncError ? `<div class="inline-sync-error"><span>${escapeHtml(state.live.syncError)}</span><button data-action="sync-live-now">重试</button></div>` : ""}
    </section>
    <div class="workspace-mobile-content">
      ${renderLivePlanPanel(project, room, canGenerate, false)}
    </div>
    ${renderLiveDesktopWorkspace(project, room, canGenerate)}
  </div>`;
}

function liveRoomMember(room, userId) {
  return room?.members?.find((member) => member.user_id === userId) || null;
}

function liveMemberName(room, userId) {
  return liveRoomMember(room, userId)?.display_name || "待认领";
}

function liveMembershipLabel(role) {
  return ({ ORIGINATOR: "项目发起人", LEADER: "团队 Leader", MEMBER: "项目成员" })[role] || "项目成员";
}

function liveTaskStatusLabel(status) {
  return ({ PROPOSED: "待认领", ACCEPTED: "已接受", IN_PROGRESS: "进行中", BLOCKED: "已阻塞", DONE: "已完成" })[status] || status;
}

function liveTaskAction(task, room) {
  const mine = task.confirmed_owner_id === state.live.currentUserId;
  if (!task.confirmed_owner_id) return ["claim", "我来负责"];
  if (mine && task.status === "ACCEPTED" && room?.starter_pack?.status === "CONFIRMED") {
    return ["start", "开始任务"];
  }
  if (mine && task.status === "IN_PROGRESS") return ["complete", "标记完成"];
  return null;
}

function renderLiveTaskRows(room, desktop = false) {
  return (room?.tasks || []).map((task, index) => {
    const action = liveTaskAction(task, room);
    const mine = task.confirmed_owner_id === state.live.currentUserId;
    const taskMarker = desktop ? ` data-live-task-id="${escapeHtml(task.id)}"` : "";
    const actionControl = action
      ? `<button data-action="live-task-action" data-task-id="${escapeHtml(task.id)}" data-resolution="${action[0]}" ${liveBusyAttributes(`task:${task.id}`)}>${action[1]}</button>`
      : mine
        ? "<em>我负责</em>"
        : "";
    return `<article${taskMarker}><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.acceptance_criteria)}</small><em>${escapeHtml(task.mode)} · ${escapeHtml(liveTaskStatusLabel(task.status))} · 负责人：${escapeHtml(liveMemberName(room, task.confirmed_owner_id))}</em></span>${actionControl}</article>`;
  }).join("");
}

function renderLivePlanPanel(project, room, canGenerate, desktop) {
  const pack = room?.starter_pack;
  const memberCount = room?.members?.length || project.members?.length || 0;
  if (!pack) {
    return `<section class="launch-pack live-empty-pack">
      <p class="micro-label">STARTER PACK / LIVE</p>
      <h3>${memberCount < 2 ? "等待成员确认入队" : "团队已就绪，可以生成启动计划"}</h3>
      <p>${memberCount < 2 ? "邀请已发出，对方确认前不会成为成员或被分配任务。" : "Agent 先生成可修改的建议；任务仍需成员主动认领并由全员确认。"}</p>
      ${canGenerate && memberCount >= 2 ? `<button class="primary-button full" data-action="generate-live-pack" ${liveBusyAttributes(`starter-pack:${project.id}`)}>生成启动计划</button>` : ""}
    </section>`;
  }
  return `<section class="${desktop ? "agent-proposal" : "launch-pack live-task-pack"}" data-live-pack-id="${escapeHtml(pack.id)}">
    <header><div><p class="micro-label">PLAN BASELINE V${pack.version} · LIVE</p><h3>${desktop ? "实时分工与任务" : "人机协作启动计划"}</h3></div><span class="source-chip">${pack.generated_by === "TEMPLATE_FALLBACK" ? "模板降级" : "模型生成"}</span></header>
    <p>所有任务和负责人均来自后端 Room；认领和确认会写回协作基线，刷新后继续恢复。</p>
    <aside class="workspace-risk"><span>先确认的风险</span><strong>${escapeHtml(pack.risk?.summary || "先锁定最小可行交付边界")}</strong></aside>
    <div class="live-task-list">${renderLiveTaskRows(room, desktop)}</div>
    <footer class="live-plan-confirmation"><span>${room.confirmation_progress.confirmed} / ${room.confirmation_progress.required} 位成员已确认</span><button class="primary-button" data-action="confirm-live-plan" ${pack.status === "CONFIRMED" ? "disabled" : liveBusyAttributes(`plan-confirmation:${project.id}`)}>${pack.status === "CONFIRMED" ? "计划已确认" : "确认当前计划"}</button></footer>
  </section>`;
}

function liveActivityTitle(activity, room) {
  const actor = liveMemberName(room, activity.actor_id);
  const labels = {
    project_created: "项目已创建",
    team_invitation_created: "已发出项目邀请",
    team_invitation_accepted: `${actor} 确认加入项目`,
    starter_pack_generated: "Agent 已生成启动计划",
    task_claimed: `${actor} 已认领任务`,
    task_started: `${actor} 已开始任务`,
    task_completed: `${actor} 已完成任务`,
    task_blocked: `${actor} 将任务标记为阻塞`,
    plan_confirmation_recorded: `${actor} 已确认当前计划`,
    plan_confirmed: "全员已确认当前计划",
    plan_reopened_for_member: "新成员加入，计划已重新开放确认",
    agent_run_started: `${actor} 已触发 Agent`,
    agent_run_completed: "Agent 运行已完成，等待人类审阅",
    agent_run_reviewed: `${actor} 已审阅 Agent 结果`,
    agent_run_cancelled: `${actor} 已取消 Agent 运行`,
    project_sos_created: `${actor} 已发布项目 SOS`,
  };
  return labels[activity.event_type] || "协作空间状态已更新";
}

function renderLiveActivityTimeline(room) {
  const activity = (room?.activity || []).slice(0, 8);
  if (!activity.length) return `<div class="workspace-timeline"><article><i></i><span><strong>等待第一条协作记录</strong><small>关键变化会由后端写入这里</small></span></article></div>`;
  return `<div class="workspace-timeline">${activity.map((item, index) => `<article class="${index === 0 ? "is-current" : ""}"><i></i><span><strong>${escapeHtml(liveActivityTitle(item, room))}</strong><small>${escapeHtml(item.source || "live")} · ${escapeHtml(new Date(item.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }))}</small></span></article>`).join("")}</div>`;
}

function renderLiveAgentRuns(room) {
  const runs = room?.agent_runs || [];
  if (!runs.length) return `<article class="workspace-risk"><span>Agent 运行</span><p>当前没有运行记录；计划确认后，HUMAN_AGENT 任务可由负责人触发简报。</p></article>`;
  return `<div class="workspace-timeline">${runs.slice(0, 4).map((run) => `<article><i></i><span><strong>${run.agent_kind === "PLANNER" ? "启动计划 Agent" : "调研简报 Agent"} · ${escapeHtml(run.status)}</strong><small>${escapeHtml(run.model || "模型待记录")} · ${Number(run.total_tokens || 0)} tokens</small></span></article>`).join("")}</div>`;
}

function renderLiveDesktopWorkspace(project, room, canGenerate) {
  if (!room) return `<section class="workspace-desktop-grid" aria-label="桌面协作工作台"><main class="desktop-workspace-panel desktop-agent-panel"><div class="live-spinner"></div><p>正在从后端恢复协作空间…</p></main></section>`;
  const budget = room.agent_daily_budget || { used: 0, cap: 0 };
  return `<section class="workspace-desktop-grid" aria-label="桌面协作工作台">
    <aside class="desktop-workspace-panel desktop-members-panel">
      <header><p class="micro-label">TEAM / LIVE</p><h3>成员与权限</h3><span>来自项目成员关系</span></header>
      <div class="workspace-members">${room.members.map((member) => {
        const person = livePerson({ user_id: member.user_id, display_name: member.display_name, avatar: member.avatar, role: member.profile_role, status: liveMembershipLabel(member.membership_role) });
        return `<article>${glyph(person, "sm")}<span><strong>${escapeHtml(member.display_name)}</strong><small>${escapeHtml(liveMembershipLabel(member.membership_role))} · ${escapeHtml(member.profile_role || "协作成员")}</small></span><em>${member.user_id === state.live.currentUserId ? "当前账号" : "已加入"}</em></article>`;
      }).join("")}</div>
      <aside class="workspace-governance"><span>权限边界</span><p>只有项目发起人或 Leader 能生成启动计划；任务必须由本人认领，计划必须由全员确认。</p></aside>
      <section class="workspace-handoff"><div><span>真实 Room</span><p>成员、任务、确认进度与活动记录均由后端保存，刷新和跨设备可恢复。</p></div></section>
    </aside>
    <main class="desktop-workspace-panel desktop-agent-panel">
      <header><p class="micro-label">AGENT ROUTING / LIVE</p><h3>分工与执行</h3><span>建议不会自动生效</span></header>
      ${renderLivePlanPanel(project, room, canGenerate, true)}
    </main>
    <aside class="desktop-workspace-panel desktop-records-panel">
      <header><p class="micro-label">PROJECT MEMORY / LIVE</p><h3>记录与决策</h3><span>受保护的后端审计记录</span></header>
      ${renderLiveActivityTimeline(room)}
      <aside class="record-policy"><b>Agent 预算：${budget.used} / ${budget.cap}</b><p>Agent 输出保持待审阅状态，不能替成员确认计划或接受任务。</p></aside>
      ${renderLiveAgentRuns(room)}
    </aside>
  </section>`;
}

function renderCollaborationLobby() {
  const connectedPeople = people.filter((person) => state.connected.includes(person.id));
  const pendingPeople = people.filter((person) => state.greeted.includes(person.id) && !state.connected.includes(person.id));
  return `
    <div class="view utility-view collaboration-lobby">
      ${commonHeader("协作")}
      <section class="collaboration-empty">
        <span class="collaboration-empty-mark">＋</span>
        <p class="micro-label">COSPAN SPACE</p>
        <h3>还没有进行中的人机协作空间</h3>
        <p>完成建联并确认入队后，COSPAN 会创建共享空间；当前薄闭环只提供固定启动建议，成员确认后再进入后续人与 Agent 的协作执行。</p>
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
        <div class="workspace-project-top">
          <div class="workspace-live"><i></i>${state.workspaceStarted ? "执行中" : "等待首次分工"}</div>
          <span class="workspace-room-label">人机协作空间</span>
        </div>
        <h3>离线会议洞察终端</h3>
        <p>让线下讨论自动沉淀为可检索的决策、分歧与行动项。</p>
        <div class="workspace-project-meta">
          <div class="workspace-avatar-stack" aria-label="${memberCount} 位项目成员"><span>ZW</span><span>YK</span>${joinedPeople.map((person) => `<span>${person.monogram}</span>`).join("")}</div>
          <span><strong>${memberCount} 位成员</strong><small>成员已到齐</small></span><b>剩余 68h</b>
        </div>
        <div class="workspace-launch-summary" role="progressbar" aria-label="项目启动进度" aria-valuemin="1" aria-valuemax="3" aria-valuenow="${state.workspaceStarted ? "3" : "2"}">
          <div><span>启动进度</span><strong>${state.workspaceStarted ? "3 / 3 · 已进入执行" : "2 / 3 · 当前确认分工"}</strong></div>
          <small>${state.workspaceStarted ? "首次分工已确认，可继续执行" : "团队确认后进入执行阶段"}</small>
          <i aria-hidden="true"><b style="width:${state.workspaceStarted ? "100" : "66.666"}%"></b></i>
        </div>
      </section>
      <nav class="workspace-tabs" aria-label="协作空间内容">
        ${[["overview", "概览"], ["tasks", "任务"], ["records", "记录"]].map(([id, label]) => {
          const active = state.workspaceSection === id;
          return `<button class="${active ? "active" : ""}" data-action="workspace-section" data-section="${id}" ${active ? 'aria-current="page"' : ""}>${label}</button>`;
        }).join("")}
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
          <p>${memberCount} 位成员完成首次分工。COSPAN 只保留关键确认与贡献记录，日常执行继续使用团队已有工具。</p>
          <div><button class="secondary-button" data-action="open-workspace-tasks">查看我的任务</button><button class="secondary-button" data-action="trigger-project-sos">发起项目 SOS</button></div>
        </section>
      ` : `
        <section class="workspace-next-action">
          <header><div><p class="micro-label">当前行动</p><h3>确认首次分工</h3></div><span>约 1 分钟</span></header>
          <p>Agent 已根据成员能力生成 V1 建议。先查看负责人和交付边界，再由团队确认是否开始。</p>
          <div class="workspace-action-facts" aria-label="分工建议摘要">
            <span><b>${tasks.length}</b> 项建议</span>
            <span><b>${new Set(tasks.map((task) => taskOwner(task))).size}</b> 位负责人</span>
            <span><b>V1</b> 可调整</span>
          </div>
          <button class="primary-button full" data-action="open-workspace-tasks">查看分工建议</button>
          <small class="workspace-human-note">最终由团队确认，Agent 不会自动开始任务</small>
        </section>
      `}

      ${state.workspaceSos ? `<article class="workspace-sos-live"><span>SOS 已发布</span><strong>需要一位熟悉端侧数据同步的开发者</strong><small>已向当前展会中明确开放协作的成员展示</small></article>` : ""}

      <section class="workspace-activity-preview">
        <header><div><h3>最近动态</h3><p>只记录会影响协作的关键变化</p></div><button data-action="workspace-section" data-section="records">查看全部</button></header>
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

function renderPlatformMark(platform, item) {
  if (platform === "github") {
    return `<span class="platform-mark platform-mark-${item.tone}" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.2c-3.22.7-3.9-1.36-3.9-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.75 0c2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>
    </span>`;
  }
  return `<span class="platform-mark platform-mark-${item.tone}" aria-hidden="true"><b>${item.mark}</b></span>`;
}

function platformLinkSummary(link) {
  if (!link) return "";
  const metadata = link.metadata || {};
  if (metadata.username) {
    return [`@${metadata.username}`, Number.isInteger(metadata.public_repos) ? `${metadata.public_repos} 个公开仓库` : "", Number.isInteger(metadata.followers) ? `${metadata.followers} 关注者` : ""].filter(Boolean).join(" · ");
  }
  try {
    return `${new URL(link.url).hostname.replace(/^www\./, "")} · 已保存`;
  } catch {
    return "链接已保存";
  }
}

function renderPlatformConnectRow(platform, item, linkedPlatforms) {
  const linked = linkedPlatforms.find((link) => link.platform === platform);
  const draft = state.platformDrafts[platform];
  const value = draft ?? linked?.url ?? "";
  return `<form class="platform-connect-row ${linked ? "is-linked" : ""}" data-platform-form data-platform="${platform}">
    ${renderPlatformMark(platform, item)}
    <div class="platform-input-column">
      <label class="platform-input-shell">
        <span class="sr-only">${item.label}公开主页链接</span>
        <input type="url" name="platform-url" value="${escapeHtml(value)}" placeholder="${escapeHtml(item.hint)}" aria-label="${item.label}公开主页链接" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false">
        <button class="platform-save-button" type="submit" aria-label="${linked ? "更新" : "保存"}${item.label}链接">${linked ? "更新" : "保存"}</button>
      </label>
      ${linked ? `<div class="platform-link-receipt"><a href="${escapeHtml(linked.url)}" target="_blank" rel="noopener noreferrer">✓ ${escapeHtml(platformLinkSummary(linked))}</a><button type="button" data-action="remove-platform" data-platform="${platform}">移除</button></div>` : ""}
    </div>
  </form>`;
}

function renderPublicProfileCardItem(item, index, authorizedFields) {
  const authorized = authorizedFields.has(item.source === "platform" ? "platform_links" : "evidence");
  const authorizationLabel = authorized
    ? (state.visible ? "已授权公开" : "已授权 · 当前暂停")
    : "未公开";
  const safeUrl = safePublicUrl(item.url);
  const visual = item.isImage && safeUrl
    ? `<img src="${escapeHtml(safeUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="public-block-mark" aria-hidden="true">${escapeHtml(item.mark)}</span>`;
  const content = `<span class="public-block-kicker">PROOF ${String(index + 1).padStart(2, "0")} · ${escapeHtml(item.category)}</span>
    <strong>${escapeHtml(item.title)}</strong>
    ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ""}
    <em class="${authorized ? "is-authorized" : ""}">${authorizationLabel}</em>`;
  return `<article class="public-profile-block ${item.isImage ? "is-image" : ""}" data-public-profile-block>
    ${visual}
    <div>${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${content}</a>` : content}</div>
  </article>`;
}

function renderPublicProfileCard() {
  const profile = state.live.currentProfile;
  const items = publicProfileCardItems();
  const authorizedFields = new Set(profile?.visibility?.public_fields || []);
  const canAdd = state.live.enabled && Boolean(profile);
  return `<section class="public-profile-card" data-public-profile-card>
    <header class="public-profile-card-head">
      <div><p class="micro-label">OUTWARD COLLABORATION CARD</p><h3>对外协作卡</h3></div>
      <span>${items.length} BLOCK${items.length === 1 ? "" : "S"}</span>
    </header>
    <div class="public-profile-identity">
      ${glyph(currentUser, "md")}
      <div><strong>${escapeHtml(currentUser.name)}</strong><span>${escapeHtml(currentUser.role)}</span></div>
      <em>${state.visible ? (activeExhibition() ? "本场展会公开" : "附近公开") : "当前暂停"}</em>
    </div>
    <div class="public-profile-blocks">
      ${items.length
        ? items.map((item, index) => renderPublicProfileCardItem(item, index, authorizedFields)).join("")
        : `<div class="public-profile-empty"><span>＋</span><strong>还没有协作证据 Block</strong><p>添加作品、经历或公开平台，让队友看到可追问的真实证据。</p></div>`}
    </div>
    <footer class="public-profile-card-actions">
      <button class="profile-add-block" data-action="open-profile-block-library" aria-label="添加内容" ${canAdd ? "" : "disabled"}><span>＋</span>添加内容</button>
      <button class="profile-edit-foundation" data-action="${canAdd ? "open-profile-editor" : "profile-placeholder"}" data-label="基础协作资料">编辑基础资料</button>
    </footer>
    <p class="public-profile-boundary">只有标记为“已授权公开”的 Block 才会出现在推荐、附近、名册与 NFC / QR 卡片中。</p>
  </section>`;
}

function renderProfile() {
  const linkedPlatforms = state.live.platformLinks;
  return `
    <div class="view utility-view profile-view">
      ${commonHeader("我的", "settings")}
      <section class="profile-intro">
        ${glyph(currentUser, "xl")}
        <div><h3>${currentUser.name}</h3><p>${currentUser.role}</p><span class="passport-id">PASSPORT P·0087</span></div>
      </section>
      <section class="visibility-panel">
        <div><p class="micro-label">DISCOVERABILITY</p><h3>${state.visible ? visibilityScopeLabel() : "已暂停展示"}</h3><p>${visibilityScopeDescription()}</p></div>
        <button class="toggle ${state.visible ? "on" : ""}" data-action="toggle-visible" aria-pressed="${state.visible}" ${state.live.enabled ? liveBusyAttributes("visibility") : ""}><i></i></button>
      </section>
      ${renderPublicProfileCard()}
      <section class="device-preview">
        <div class="device-preview-head">
          <div><p class="micro-label">DEMO BADGE</p><h3>4.3″ 竖向现场工牌</h3></div>
          <span class="sync-chip"><b>● 已同步</b><small>ESP32-8048S043</small><small>480 × 800</small></span>
        </div>
        <div class="demo-badge ${state.visible ? "" : "is-hidden"}" data-orientation="portrait">
          <header class="demo-display-top">
            <span class="demo-display-brand">COSPAN <b>合拍</b></span>
            <span class="demo-display-event">AI HARDWARE HACKATHON 2026</span>
            <em>${state.visible ? `● ${collaborationStatusLabel()}` : "○ 已暂停"}</em>
          </header>
          <div class="demo-display-main">
            <section class="badge-identity">
              <span class="badge-glyph">ZW</span>
              <div><small>PASSPORT P·0087</small><strong>周闻</strong><span>AI · 后端 · Agent</span></div>
            </section>
            <section class="badge-intent">
              <span>CURRENT COLLABORATION INTENT</span>
              <b>${collaborationNeedLabel()}</b>
              <p>现场组队 · 可聊到 22:00</p>
            </section>
            <aside class="demo-display-connect">
              <svg class="demo-display-qr" viewBox="0 0 29 29" role="img" aria-label="扫码建联入口" shape-rendering="crispEdges">
                <rect width="29" height="29" fill="#fff"/>
                <g fill="currentColor">
                  <path d="M2 2h7v7H2zm18 0h7v7h-7zM2 20h7v7H2z"/>
                  <path d="M12 2h2v2h-2zm3 0h2v1h-2zm-3 4h1v3h-1zm3-2h3v2h-3zm-4 7h2v2h-2zm4-3h2v4h-2zm3 2h2v2h-2zm4 1h3v2h-3zM10 14h3v2h-3zm5 0h2v3h-2zm4 0h2v2h-2zm4 1h4v2h-4zM11 18h2v3h-2zm4 1h4v2h-4zm6-1h2v3h-2zm4 1h2v2h-2zM11 23h2v4h-2zm3-1h2v2h-2zm3 2h2v3h-2zm3-2h3v2h-3zm4 2h3v3h-3z"/>
                </g>
                <g fill="#fff"><path d="M3 3h5v5H3zm18 0h5v5h-5zM3 21h5v5H3z"/></g>
                <g fill="currentColor"><path d="M4 4h3v3H4zm18 0h3v3h-3zM4 22h3v3H4z"/></g>
              </svg>
              <strong>扫码建联</strong>
              <small>或碰卡快速连接</small>
            </aside>
          </div>
          <footer class="demo-display-foot"><span>◉ NFC READY</span><span>现场公开 · 随时可暂停</span><code>P0087</code></footer>
        </div>
        <button class="secondary-button full" data-action="sync-card">编辑卡片公开内容</button>
      </section>
      <section class="platform-links-panel">
        <header><div><p class="micro-label">AUTHORIZED EVIDENCE</p><h3>连接你的外部平台</h3></div><span>${linkedPlatforms.length}/${Object.keys(platformCatalog).length} 已连接</span></header>
        <p>粘贴公开主页或作品链接。GitHub 可同步公开摘要，其他平台只保存你主动提交的地址。</p>
        <div class="platform-connect-list">${Object.entries(platformCatalog).map(([platform, item]) => renderPlatformConnectRow(platform, item, linkedPlatforms)).join("")}</div>
      </section>
      <section class="profile-fields"><button data-action="restart-onboarding"><span>重新组装协作护照</span><b>4 步 ›</b></button><button data-action="${state.live.enabled ? "open-profile-block-library" : "profile-placeholder"}" data-label="能力与项目证据"><span>能力与项目证据</span><b>${state.live.enabled ? `${profileBlockEvidence().length} Block ›` : "5 项 ›"}</b></button></section>
      ${state.live.enabled && liveConfig.accessToken ? `<button class="profile-logout-button" data-action="logout-live">退出当前账号</button>` : ""}
    </div>
  `;
}

function renderAppNavIcon(id) {
  const paths = {
    discover: `
      <circle cx="12" cy="12" r="8.25"></circle>
      <path d="m15.4 8.6-2.05 4.75L8.6 15.4l2.05-4.75 4.75-2.05Z"></path>
    `,
    connections: `
      <path d="m9.25 14.75-1.4 1.4a3.4 3.4 0 0 1-4.8-4.8l2.3-2.3a3.4 3.4 0 0 1 4.8 0"></path>
      <path d="m14.75 9.25 1.4-1.4a3.4 3.4 0 1 1 4.8 4.8l-2.3 2.3a3.4 3.4 0 0 1-4.8 0"></path>
      <path d="m8.75 15.25 6.5-6.5"></path>
    `,
    collaboration: `
      <path d="m7.65 7.75 2.4 2.4m6.3-2.4-2.4 2.4M12 14.7v1.05"></path>
      <circle cx="6" cy="6.1" r="2.35"></circle>
      <circle cx="18" cy="6.1" r="2.35"></circle>
      <circle cx="12" cy="18.1" r="2.35"></circle>
      <path d="m12 8 3.35 3.35L12 14.7l-3.35-3.35Z" fill="currentColor" stroke="none"></path>
    `,
    profile: `
      <circle cx="12" cy="12" r="8.25"></circle>
      <circle cx="12" cy="9.25" r="2.5"></circle>
      <path d="M6.75 18.4a5.8 5.8 0 0 1 10.5 0"></path>
    `,
  };
  const iconKind = id === "collaboration" ? "orchestration" : id;
  return `<svg data-nav-icon="${iconKind}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[id]}</svg>`;
}

function renderAppNav() {
  const items = [
    ["discover", "发现"],
    ["connections", "连接"],
    ["collaboration", "协作"],
    ["profile", "我的"],
  ];
  const unreadConversationCount = state.live.connectionRequests.reduce(
    (byConnection, request) => {
      if (!request.connection_id) return byConnection;
      const unreadCount = Number(request.unread_count || 0);
      byConnection.set(
        request.connection_id,
        Math.max(byConnection.get(request.connection_id) || 0, unreadCount),
      );
      return byConnection;
    },
    new Map(),
  );
  const connectionCount = state.live.enabled
    ? [...unreadConversationCount.values()].reduce((total, count) => total + count, 0)
    : (state.connected.length || state.greeted.length);
  return `<nav class="app-nav" aria-label="主导航">${items.map(([id, label]) => `<button class="${state.tab === id ? "active" : ""}" data-tab="${id}" aria-label="${label}" ${state.tab === id ? 'aria-current="page"' : ""}><span>${renderAppNavIcon(id)}</span><small>${label}</small>${id === "connections" && connectionCount ? `<i>${connectionCount}</i>` : ""}</button>`).join("")}</nav>`;
}

function renderDiscoveryFilterChip(group, value, label) {
  const selected = state.discoveryFilterDraft[group].includes(value);
  return `<button class="discovery-filter-chip ${selected ? "selected" : ""}" data-action="toggle-discovery-filter" data-group="${group}" data-value="${value}" aria-pressed="${selected}">${label}</button>`;
}

function renderDiscoveryFilterSheet() {
  const draft = state.discoveryFilterDraft;
  const sourcePeople = discoveryPeople();
  const previewCount = filterDiscoveryPeople(sourcePeople, draft).length;
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
        <div><strong>${sourcePeople.length}</strong><i>→</i><strong>${previewCount}</strong><em>人符合</em></div>
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

function renderProfileSettingsSheet() {
  const activeContext = activeExhibition();
  const settings = [
    ["device", "设备与隐私", "1 台 AI Passport 已连接", "⌁"],
    ["authorization", "数据与授权", "管理公开字段和平台链接权限", "◎"],
    ["activity", "展会与账号", activeContext?.name || "当前为日常附近", "R"],
  ];
  return `<div class="overlay profile-settings-overlay">
    <button class="overlay-backdrop" data-action="close-profile-settings" aria-label="关闭设置"></button>
    <section class="bottom-sheet profile-settings-sheet" aria-label="我的设置">
      <header class="profile-settings-head">
        <button data-action="close-profile-settings" aria-label="返回我的页面">←</button>
        <div><p class="micro-label">COSPAN SETTINGS</p><h3>设置</h3></div>
      </header>
      <p class="profile-settings-copy">管理设备、隐私和展会账号。这些次级选项不会打断你的协作身份编辑。</p>
      <div class="profile-settings-list"><button class="settings-sound-toggle" data-action="toggle-swipe-sound" aria-pressed="${state.swipeSoundEnabled}">
        <span class="settings-row-mark" aria-hidden="true">SFX</span>
        <span><strong>滑动声效</strong><small>${state.swipeSoundEnabled ? "左右滑动使用 COSPAN 方向声纹" : "已关闭，仅保留视觉反馈"}</small></span>
        <i class="settings-toggle ${state.swipeSoundEnabled ? "on" : ""}" aria-hidden="true"><b></b></i>
      </button>${settings.map(([id, label, detail, mark]) => `<button data-action="profile-setting-detail" data-setting="${id}" data-label="${label}">
        <span class="settings-row-mark" aria-hidden="true">${mark}</span>
        <span><strong>${label}</strong><small>${detail}</small></span>
        <b>›</b>
      </button>`).join("")}</div>
      <aside class="settings-privacy-note"><b>默认最小公开</b><span>${activeContext ? "COSPAN 只展示你在本场展会主动授权的字段，展会结束后自动隐藏。" : "COSPAN 只在你主动开启附近发现时展示授权字段，关闭后立即隐藏。"}</span></aside>
    </section>
  </div>`;
}

function renderProfileBlockPickerButton(type, item) {
  return `<button data-action="choose-profile-block" data-block-type="${type}" aria-label="${escapeHtml(item.label)}">
    <span aria-hidden="true">${escapeHtml(item.mark)}</span>
    <strong>${escapeHtml(item.label)}</strong>
  </button>`;
}

function renderProfileBlockLibrary() {
  return `<div class="overlay profile-block-overlay">
    <button class="overlay-backdrop" data-action="close-profile-block-library" aria-label="关闭添加内容面板"></button>
    <section class="bottom-sheet profile-block-library" data-profile-block-library aria-label="添加协作证据内容">
      <header class="profile-block-sheet-head">
        <button data-action="close-profile-block-library" aria-label="返回我的页面">←</button>
        <div><p class="micro-label">ADD A COSPAN BLOCK</p><h3>添加内容</h3></div>
      </header>
      <aside class="profile-block-intro"><span>只放真实、可追问的协作证据</span><p>像搭积木一样补充对外卡片；每项都会先预览，再由你明确授权公开。</p></aside>
      <div class="profile-block-groups">
        ${profileBlockGroups.map((group) => {
          const items = Object.entries(profileBlockCatalog).filter(([, item]) => item.group === group.id);
          return `<section class="profile-block-picker-group" data-block-group="${group.id}">
            <header><span>${group.index}</span><div><h4>${group.title}</h4><p>${group.copy}</p></div></header>
            <div class="profile-block-picker-grid">${items.map(([type, item]) => renderProfileBlockPickerButton(type, item)).join("")}</div>
          </section>`;
        }).join("")}
      </div>
      <p class="profile-block-library-boundary">COSPAN 不读取平台私信、草稿或非公开资料；保存后仍可在“编辑协作资料”撤回对应公开字段。</p>
    </section>
  </div>`;
}

function renderProfileBlockEditor() {
  const type = state.profileBlockDraft?.type;
  const item = profileBlockCatalog[type];
  if (!item) return renderProfileBlockLibrary();
  const isSocial = item.group === "social";
  const authorizationField = profileBlockAuthorizationField(item);
  const authorizationLabel = publicFieldCatalog[authorizationField];
  const authorizationAlreadyOpen = new Set(
    state.live.currentProfile?.visibility?.public_fields || [],
  ).has(authorizationField);
  const existingAuthorizationCount = profileBlockExistingAuthorizationCount(item);
  const title = isSocial ? item.label : item.titleHint;
  const detail = isSocial ? "公开主页链接" : item.detailHint;
  return `<div class="overlay profile-block-overlay">
    <button class="overlay-backdrop" data-action="close-profile-block-library" aria-label="关闭 Block 编辑"></button>
    <section class="bottom-sheet profile-block-editor" aria-label="编辑 ${escapeHtml(item.label)} Block">
      <header class="profile-block-sheet-head">
        <button data-action="back-profile-block-library" aria-label="返回内容类型选择">←</button>
        <div><p class="micro-label">${escapeHtml(item.category.toUpperCase())} / PREVIEW</p><h3>${escapeHtml(item.label)}</h3></div>
      </header>
      <form data-profile-block-form data-block-type="${type}">
        <article class="profile-block-live-preview ${item.isImage ? "is-image" : ""}" data-profile-block-preview>
          <span class="public-block-mark" aria-hidden="true">${escapeHtml(item.mark)}</span>
          <div>
            <span data-preview-kicker>PROOF · ${escapeHtml(item.category)}</span>
            <strong data-preview-title>${escapeHtml(title)}</strong>
            <p data-preview-detail>${escapeHtml(detail)}</p>
            <a data-preview-link hidden target="_blank" rel="noopener noreferrer"></a>
          </div>
          ${item.isImage ? `<img data-preview-image hidden alt="图片 Block 预览" referrerpolicy="no-referrer">` : ""}
        </article>
        ${isSocial ? "" : `<label><span>${escapeHtml(item.titleLabel)}</span><input name="title" required maxlength="40" placeholder="${escapeHtml(item.titleHint)}" aria-label="${escapeHtml(item.titleLabel)}"></label>
        <label><span>${escapeHtml(item.detailLabel)}</span><textarea name="detail" maxlength="72" ${item.needsDetail ? "required" : ""} placeholder="${escapeHtml(item.detailHint)}" aria-label="${escapeHtml(item.detailLabel)}"></textarea></label>`}
        ${item.needsUrl || isSocial ? `<label><span>${escapeHtml(item.urlLabel)}</span><input name="url" type="url" required maxlength="180" placeholder="${escapeHtml(item.urlHint)}" aria-label="${escapeHtml(item.urlLabel)}" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false"></label>` : ""}
        <aside class="profile-block-authorization">
          <span aria-hidden="true">✓</span>
          <div><strong>${authorizationAlreadyOpen ? `沿用已开启的“${authorizationLabel}”公开` : `保存将开启“${authorizationLabel}”公开`}</strong><p>${authorizationAlreadyOpen
            ? "该类内容已经获得字段级授权；暂停展示或取消字段勾选后立即停止对外显示。"
            : existingAuthorizationCount
              ? `现有 ${existingAuthorizationCount} 条同类内容也会一起公开；这是当前字段级授权模型的边界。`
              : "该 Block 将公开到推荐、附近、名册与 NFC / QR 卡片。"}</p></div>
          ${authorizationAlreadyOpen ? "" : `<label class="profile-block-public-confirm"><input name="confirm-public-field" type="checkbox" required><span>我确认开启“${authorizationLabel}”字段，并公开上述范围</span></label>`}
        </aside>
        <button class="primary-button full" type="submit" ${liveBusyAttributes(isSocial && !item.storeAsEvidence ? `platform:${item.platform}` : "profile-block:add")}>保存到对外协作卡</button>
      </form>
    </section>
  </div>`;
}

function renderLiveProfileEditor() {
  const profile = state.live.currentProfile;
  if (!profile) return "";
  const selectedFields = new Set(profile.visibility?.public_fields || []);
  const arrayValue = (value) => escapeHtml((value || []).join("，"));
  return `<div class="overlay profile-settings-overlay">
    <button class="overlay-backdrop" data-action="close-profile-editor" aria-label="关闭资料编辑"></button>
    <section class="bottom-sheet live-profile-editor" aria-label="编辑公开协作资料">
      <header class="profile-settings-head"><button data-action="close-profile-editor" aria-label="返回我的页面">←</button><div><p class="micro-label">PROFILE / AUTHORIZATION</p><h3>编辑协作资料</h3></div></header>
      <form data-live-profile-form>
        <label><span>怎么称呼你</span><input name="display-name" required autocomplete="name" maxlength="40" value="${escapeHtml(currentUser.name)}"></label>
        <label><span>当前角色</span><input name="role" required maxlength="80" value="${escapeHtml(profile.role)}"></label>
        <label><span>协作状态</span><select name="status">${["未组队", "有 Idea 找人", "团队缺人", "已组队但可交流"].map((status) => `<option ${profile.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
        <label><span>能力标签（3–5 项，用逗号分隔）</span><input name="skills" required value="${arrayValue(profile.skills)}"></label>
        <label><span>兴趣方向</span><input name="interests" required value="${arrayValue(profile.interests)}"></label>
        <label><span>可投入时间</span><input name="availability" required maxlength="120" value="${escapeHtml(profile.availability)}"></label>
        <label><span>协作偏好</span><input name="preferences" required value="${arrayValue(profile.collaboration_preferences)}"></label>
        <label><span>当前协作需求</span><textarea name="need" maxlength="160">${escapeHtml(profile.collaboration_need)}</textarea></label>
        <label><span>其他能力证据（每行一项）</span><textarea name="evidence">${escapeHtml(plainProfileEvidence(profile).join("\n"))}</textarea></label>
        <fieldset><legend>对外公开字段</legend><p>未勾选字段不会出现在推荐、附近、名册或 NFC/QR 页面。</p><div class="public-field-grid">${Object.entries(publicFieldCatalog).map(([field, label]) => `<label><input type="checkbox" name="public-fields" value="${field}" ${selectedFields.has(field) ? "checked" : ""}><span>${label}</span></label>`).join("")}</div></fieldset>
        <aside class="settings-privacy-note"><b>实际公开预览</b><span data-public-fields-preview>${[...selectedFields].map((field) => publicFieldCatalog[field]).filter(Boolean).join("、") || "当前没有公开字段"}</span></aside>
        <button class="primary-button full" type="submit" ${liveBusyAttributes("profile:update")}>保存资料与公开范围</button>
      </form>
    </section>
  </div>`;
}

function renderDirectionSummary() {
  const { projectTitle, audience, problem, outcome } = directionAlignmentFor().draft;
  return `<dl class="direction-summary">${projectTitle ? `<div><dt>项目名称</dt><dd>${escapeHtml(projectTitle)}</dd></div>` : ""}<div><dt>服务谁</dt><dd>${escapeHtml(audience)}</dd></div><div><dt>解决什么</dt><dd>${escapeHtml(problem)}</dd></div><div><dt>验证结果</dt><dd>${escapeHtml(outcome)}</dd></div></dl>`;
}

function directConversationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function directConversationSourceLabel(context) {
  if (context?.consent_mode === "physical_mutual") return "双方碰卡确认";
  return ({ nfc: "碰卡建联", qr: "扫码建联", link: "双方在线确认" })[context?.source]
    || "双方确认建联";
}

function directConversationPerson(conversation = state.directConversation.data) {
  if (!state.live.enabled) return selectedPerson();
  const counterpart = conversation?.counterpart;
  if (!counterpart) return selectedPerson();
  return livePerson({
    user_id: counterpart.id,
    display_name: counterpart.display_name,
    avatar: counterpart.avatar,
    role: counterpart.role,
    status: "已建联",
  });
}

function directConversationMessagesMarkup(direct, person) {
  const messages = direct.data?.messages || [];
  const currentUserId = state.live.currentUserId || "user-zhou";
  if (!messages.length) {
    return direct.loading
      ? ""
      : `<div class="conversation-empty"><span>·</span><strong>从一句具体的话开始</strong><p>可以先问对方想验证什么。发消息不会自动创建项目或分配任务。</p></div>`;
  }
  return messages.map((message) => {
    const mine = message.sender_id === currentUserId;
    return `<article class="conversation-message ${mine ? "is-mine" : "is-theirs"}" data-message-id="${escapeHtml(message.id)}"><span>${mine ? "我" : escapeHtml(person.name)} · ${directConversationTime(message.created_at)}</span><p>${escapeHtml(message.text)}</p></article>`;
  }).join("");
}

function updateFocusedConversationMessages() {
  const messageList = document.querySelector(".conversation-message-list");
  const person = directConversationPerson();
  if (!messageList || !person) return false;
  messageList.innerHTML = directConversationMessagesMarkup(state.directConversation, person);
  const scroll = document.querySelector("[data-conversation-scroll]");
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
  return true;
}

function renderDirectConversation() {
  const direct = state.directConversation;
  const conversation = direct.data;
  const person = directConversationPerson(conversation);
  if (!person) return "";
  const context = conversation?.context || {
    event_name: currentExhibition?.name || "线下协作现场",
    source: "nfc",
    consent_mode: "physical_mutual",
    connected_at: new Date().toISOString(),
  };
  const collaborationAction = state.joined.includes(person.id)
    ? `<button class="secondary-button" data-tab="collaboration">进入共同协作</button>`
    : `<button class="secondary-button" data-action="conversation-intent" data-person="${person.id}">澄清合作意图</button>`;
  return `<div class="overlay direct-conversation-overlay">
    <section class="direct-conversation" aria-label="与 ${escapeHtml(person.name)} 的对话">
      <header class="direct-conversation-head">
        <button data-action="close-conversation" aria-label="返回连接列表">←</button>
        ${glyph(person, "sm")}
        <div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role || "已建立协作连接")}</span></div>
        <em><i></i>已建联</em>
      </header>
      <div class="direct-conversation-scroll" data-conversation-scroll>
        <section class="conversation-context-rail">
          <i aria-hidden="true"></i>
          <div><span>CONNECTED AT</span><strong>${escapeHtml(context.event_name)}</strong><small>${directConversationSourceLabel(context)} · ${directConversationTime(context.connected_at)}</small></div>
        </section>
        <aside class="conversation-next-step">
          <div><span>下一步由你们决定</span><strong>先聊清楚，再决定要不要开工。</strong></div>
          ${collaborationAction}
        </aside>
        ${direct.loading && !conversation ? `<div class="conversation-loading"><i></i><span>正在恢复对话…</span></div>` : ""}
        ${direct.error ? `<div class="conversation-error" role="alert"><span>${escapeHtml(direct.error)}</span><button data-action="retry-conversation">${direct.pendingClientMessageId ? (direct.pendingMessageText === direct.draft.trim() ? "重新发送" : "发送当前内容") : "重试"}</button></div>` : ""}
        <section class="conversation-message-list" aria-live="polite">
          ${directConversationMessagesMarkup(direct, person)}
        </section>
      </div>
      <form class="direct-conversation-composer" data-conversation-form>
        <textarea name="message" rows="1" maxlength="1000" placeholder="聊聊你们想解决的问题…" aria-label="输入消息" ${direct.sending ? "disabled" : ""}>${escapeHtml(direct.draft)}</textarea>
        <button type="submit" aria-label="发送消息" ${direct.sending ? "disabled" : ""}>${direct.sending ? "…" : "↑"}</button>
      </form>
    </section>
  </div>`;
}

function renderOverlay() {
  if (!state.overlay) return "";
  if (state.overlay === "context-switcher") return renderContextSwitcherSheet();
  if (state.overlay === "filters") return renderDiscoveryFilterSheet();
  if (state.overlay === "profile-settings") return renderProfileSettingsSheet();
  if (state.overlay === "profile-editor") return renderLiveProfileEditor();
  if (state.overlay === "profile-block-library") return renderProfileBlockLibrary();
  if (state.overlay === "profile-block-editor") return renderProfileBlockEditor();
  if (state.overlay === "conversation") return renderDirectConversation();
  const person = selectedPerson();
  if (!person) return "";
  const directionAlignment = directionAlignmentFor(person.id);
  if (state.overlay === "person") {
    const greeted = state.greeted.includes(person.id);
    const profile = selectedParticipantProfile(person);
    const expandedClass = state.personDetailExpanded ? "is-expanded" : "is-preview";
    return `<div class="overlay person-overlay ${expandedClass}"><button class="overlay-backdrop" data-action="close-overlay" aria-label="关闭"></button><section class="bottom-sheet person-sheet ${expandedClass}" data-person-sheet-surface aria-label="${person.name} 的个人资料">
      <div class="person-sheet-drag-zone" data-person-sheet-drag role="button" tabindex="0" aria-label="${state.personDetailExpanded ? "下滑收起完整资料" : "上滑查看完整资料"}">
        <div class="sheet-handle"></div>
        ${state.personDetailExpanded ? `<div class="person-sheet-nav"><span>个人资料</span><small>顶部下滑收起 · 左右滑返回</small></div>` : ""}
      </div>
      <div class="person-sheet-content">
        <div class="person-sheet-head">${glyph(person, "lg")}<div><span class="status-pill">${person.status}</span><h3>${person.name}</h3><p>${person.role} · ${person.proximity}</p></div><strong class="large-fit">${person.fit}<small>${person.fitDetail}</small></strong></div>
        <div class="skill-line">${person.skills.map((skill) => `<span>${skill}</span>`).join("")}</div>
        <article class="participant-bio">
          <header><span>本人简介</span><em>原文</em></header>
          <p>${profile.bio}</p>
        </article>
        <button class="person-expand-cue" data-action="expand-person">
          <span>${state.personDetailExpanded ? "完整资料" : "继续上滑"}</span><strong>${state.personDetailExpanded ? "过往项目与协作信息" : "查看过往项目与全部资料"}</strong><i>${state.personDetailExpanded ? "—" : "↑"}</i>
        </button>
        <div class="person-full-profile" data-person-full-profile>
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
        </div>
      </div>
      <div class="sheet-actions person-sheet-actions"><button class="secondary-button" data-action="greet" data-person="${person.id}">${greeted ? "已表达想认识" : "想认识"}</button><button class="primary-button" data-action="direct-tap" data-person="${person.id}">${state.live.enabled ? "等待真实碰卡" : "模拟碰卡直连"}</button></div>
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
    const projectDirectionIsKnown = ["known_project", "confirmed"].includes(directionAlignment.status);
    return `<div class="overlay success-overlay"><section class="success-card">
      <div class="success-mark">✓</div><p class="micro-label">CONNECTION STAMP</p><h3>你和 ${person.name}<br>已经建立协作关系</h3>
      <div class="stamp"><span>CONNECTED</span><strong>${person.pairLabel}</strong><small>HACKATHON 01 · JUST NOW</small></div>
      <p>${projectDirectionIsKnown ? "碰卡只建立关系。当前项目方向已经明确，可以向对方发出独立的入队邀请。" : "碰卡只建立关系。项目方向还未确定，先由你们说清楚想服务谁、解决什么问题。"}</p>
      <button class="primary-button full" data-action="${projectDirectionIsKnown ? "invite-team" : "enter-intent-clarification"}" data-person="${person.id}">${projectDirectionIsKnown ? "邀请加入「离线会议洞察终端」" : "进入意图澄清"}</button>
      <button class="secondary-button full" data-action="view-connection">稍后处理</button>
    </section></div>`;
  }
  if (state.overlay === "intent-clarification") {
    return `<div class="overlay success-overlay"><section class="success-card intent-card">
      <p class="micro-label">INTENT ALIGNMENT</p><h3>先对齐意图，<br>再决定做不做项目</h3>
      <div class="intent-people">
        <article><span>周闻</span><strong>把线下真实交流变成可继续的协作</strong><small>边界：不做完整项目管理工具</small></article>
        <article><span>${person.name}</span><strong>${person.caution}</strong><small>兴趣：${person.reason}</small></article>
      </div>
      <aside class="intent-ai-note"><span>AI 整理</span><strong>重合点：都希望缩短现场从认识到开工的路径</strong><p>AI 只整理重合点和待确认问题，不替你们决定方向。</p></aside>
      <button class="primary-button full" data-action="draft-direction">共同填写方向草案</button>
      <button class="secondary-button full" data-action="view-connection">暂不形成项目</button>
    </section></div>`;
  }
  if (state.overlay === "direction-review" && directionAlignment.status !== "pending_partner") {
    return `<div class="overlay success-overlay"><section class="success-card intent-card direction-card">
      <p class="micro-label">DIRECTION DRAFT</p><h3>由人写下<br>共同想验证的方向</h3>
      <p>这不是 AI 生成的项目结论。三个字段都由你们讨论后填写，确认前不会创建项目或任务。</p>
      <form class="direction-form" data-direction-form>
        ${state.live.enabled ? `<label><span>项目名称</span><input name="projectTitle" required maxlength="80" value="${escapeHtml(directionAlignment.draft.projectTitle)}" placeholder="例如：现场协作实验"></label>` : ""}
        <label><span>服务谁</span><input name="audience" required value="${escapeHtml(directionAlignment.draft.audience)}" placeholder="例如：线下黑客松参与者"></label>
        <label><span>解决什么问题</span><input name="problem" required value="${escapeHtml(directionAlignment.draft.problem)}" placeholder="例如：现场组队方向难收敛"></label>
        <label><span>验证什么结果</span><input name="outcome" required value="${escapeHtml(directionAlignment.draft.outcome)}" placeholder="例如：15 分钟内确认方向"></label>
        <button class="primary-button full" type="submit">确认我的方向草案</button>
      </form>
      <button class="text-action direction-back" data-action="enter-intent-clarification">返回查看双方意图</button>
    </section></div>`;
  }
  if (state.overlay === "direction-review") {
    if (state.live.enabled) {
      return `<div class="overlay success-overlay"><section class="success-card intent-card direction-card">
        <p class="micro-label">PROJECT DIRECTION</p><h3>用这份方向<br>发起真实项目</h3>
        ${renderDirectionSummary()}
        <div class="direction-confirmations"><span>${escapeHtml(currentUser.name)} · 已填写</span><span>${person.name} · 通过入队邀请确认</span></div>
        <p>项目与邀请将写入服务器；对方只有在自己的设备确认入队后，才会成为项目成员。</p>
        <button class="primary-button full" data-action="invite-team" data-person="${person.id}">使用此方向创建项目并邀请</button>
        <button class="secondary-button full" data-action="view-connection">稍后继续</button>
      </section></div>`;
    }
    return `<div class="overlay success-overlay"><section class="success-card intent-card direction-card">
      <p class="micro-label">WAITING FOR BOTH</p><h3>方向草案等待<br>${person.name} 确认</h3>
      ${renderDirectionSummary()}
      <div class="direction-confirmations"><span>周闻 · 已确认</span><span>${person.name} · 待确认</span></div>
      <p>此刻仍然只有协作关系，没有项目、团队成员或任务。</p>
      <button class="primary-button full" data-action="confirm-partner-direction" data-person="${person.id}">模拟${person.name}确认方向</button>
      <button class="secondary-button full" data-action="view-connection">稍后继续</button>
    </section></div>`;
  }
  if (state.overlay === "direction-confirmed") {
    return `<div class="overlay success-overlay"><section class="success-card intent-card direction-card">
      <div class="success-mark">✓</div><p class="micro-label">DIRECTION CONFIRMED</p><h3>方向已由双方确认</h3>
      ${renderDirectionSummary()}
      <p>现在才可以创建项目关系；任务和负责人仍要等成员入队后共同确认。</p>
      <button class="primary-button full" data-action="invite-team" data-person="${person.id}">创建项目并邀请入队</button>
      <button class="secondary-button full" data-action="view-connection">稍后创建</button>
    </section></div>`;
  }
  if (state.overlay === "invite-sent") {
    return `<div class="overlay success-overlay"><section class="success-card team-success">
      <div class="success-mark">→</div><p class="micro-label">INVITATION SENT</p><h3>已邀请 ${person.name}<br>加入项目</h3>
      <p>对方确认前不会被写入团队，也不会被分配任务。</p>
      ${state.live.enabled ? `<button class="primary-button full" data-action="sync-live-now">等待对方在自己的设备确认</button>` : `<button class="primary-button full" data-action="confirm-team-invite" data-person="${person.id}">模拟对方确认加入</button>`}
      <button class="secondary-button full" data-action="view-connection">稍后处理</button>
    </section></div>`;
  }
  if (state.overlay === "joined") {
    return `<div class="overlay success-overlay"><section class="success-card team-success">
      <div class="success-mark">＋</div><p class="micro-label">TEAM UPDATED</p><h3>${person.name} 已加入项目</h3>
      <p>AI 已根据三位成员的能力，生成角色覆盖、一个风险提示和三个启动任务。</p>
      <button class="primary-button full" data-action="view-project">进入人机协作空间</button>
    </section></div>`;
  }
  return "";
}

function renderToast() {
  return state.toast ? `<div class="toast" role="status">${state.toast}</div>` : "";
}

function overlayFocusableElements() {
  const overlay = app.querySelector(".overlay");
  if (!overlay) return [];
  return [...overlay.querySelectorAll([
    "button:not([disabled])",
    "a[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(","))].filter((element) => (
    !element.classList.contains("overlay-backdrop")
    && element.getClientRects().length > 0
  ));
}

function captureOverlayFocus() {
  const overlay = app.querySelector(".overlay");
  const active = document.activeElement;
  if (!overlay || !active || !overlay.contains(active)) return null;
  return {
    overlayClassName: overlay.className,
    action: active.dataset?.action || "",
    name: active.getAttribute?.("name") || "",
    ariaLabel: active.getAttribute?.("aria-label") || "",
    selectionStart: Number.isInteger(active.selectionStart) ? active.selectionStart : null,
    selectionEnd: Number.isInteger(active.selectionEnd) ? active.selectionEnd : null,
  };
}

function syncOverlayAccessibility(previousFocus = null) {
  const stage = app.querySelector(".prototype-stage");
  const overlay = app.querySelector(".overlay");
  const focusable = overlayFocusableElements();
  if (!state.overlay || !stage || !overlay) return;
  stage.inert = true;
  stage.setAttribute("aria-hidden", "true");
  requestAnimationFrame(() => {
    if (!overlay.isConnected) return;
    if (overlay.contains(document.activeElement)) return;
    const restoresSameOverlay = previousFocus?.overlayClassName === overlay.className;
    const restored = restoresSameOverlay
      ? focusable.find((element) => (
        (previousFocus.name && element.getAttribute("name") === previousFocus.name)
        || (previousFocus.action && element.dataset.action === previousFocus.action)
        || (previousFocus.ariaLabel && element.getAttribute("aria-label") === previousFocus.ariaLabel)
      ))
      : null;
    const target = restored || focusable[0];
    target?.focus({ preventScroll: true });
    if (restored && previousFocus.selectionStart !== null && typeof restored.setSelectionRange === "function") {
      restored.setSelectionRange(previousFocus.selectionStart, previousFocus.selectionEnd);
    }
  });
}

function trapOverlayFocus(event) {
  const focusable = overlayFocusableElements();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && (document.activeElement === first || !app.querySelector(".overlay")?.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderStateLedger() {
  return `<div class="state-ledger"><span>当前状态</span><strong>${stageLabel()}</strong><small>刷新后重置 · 硬件事件为模拟</small></div>`;
}

function stageLabel() {
  if (state.onboarding) return `正在组装协作护照 · ${state.onboardingStep + 1}/4`;
  if (state.acceptedTasks.length) return "已开始协作";
  if (state.joined.length) return "已加入项目";
  if (state.invited.length) return "项目邀请待确认";
  if (["known_project", "confirmed"].includes(directionAlignmentFor().status)) return "项目方向已确认";
  if (directionAlignmentFor().status === "pending_partner") return "方向草案待双方确认";
  if (state.connected.length) return "已碰卡建联";
  if (state.greeted.length) return "已发送招呼";
  return `正在浏览${variantNames[state.variant]}`;
}

function variantDescription() {
  if (state.variant === "B") return "手机端发现的附近模式：只在前台开启时更新，再进入统一人物详情。";
  if (state.variant === "C") return "特殊展会开启的名册模式：浏览本场展会中已授权可见的完整成员。";
  return "手机端发现的推荐模式：围绕当前项目缺口解释谁值得先聊。";
}

function updateProfileBlockPreview(form) {
  const item = profileBlockCatalog[form.dataset.blockType];
  const preview = form.querySelector("[data-profile-block-preview]");
  if (!item || !preview) return;
  const title = item.group === "social"
    ? item.label
    : cleanProfileBlockField(form.elements.namedItem("title")?.value, 40) || item.titleHint;
  const url = safePublicUrl(form.elements.namedItem("url")?.value);
  let detail = item.group === "social"
    ? "公开主页链接"
    : cleanProfileBlockField(form.elements.namedItem("detail")?.value, 72) || item.detailHint;
  if (item.group === "social" && url) {
    try {
      detail = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      detail = "公开主页链接";
    }
  }
  const previewTitle = preview.querySelector("[data-preview-title]");
  const previewDetail = preview.querySelector("[data-preview-detail]");
  const previewLink = preview.querySelector("[data-preview-link]");
  const previewImage = preview.querySelector("[data-preview-image]");
  if (previewTitle) previewTitle.textContent = title;
  if (previewDetail) previewDetail.textContent = detail;
  if (previewLink) {
    previewLink.hidden = !url;
    previewLink.href = url || "#";
    previewLink.textContent = url ? "打开公开链接 ↗" : "";
  }
  if (previewImage) {
    previewImage.hidden = !url;
    if (url) previewImage.src = url;
    else previewImage.removeAttribute("src");
  }
}

function syncOnboardingForm(form) {
  form.querySelectorAll("[data-onboarding-field]").forEach((input) => {
    state.onboardingDraft[input.dataset.onboardingField] = input.value;
  });
  form.querySelectorAll("[data-onboarding-platform]").forEach((input) => {
    state.onboardingDraft.platformLinks[input.dataset.onboardingPlatform] = input.value;
  });
  const publicConfirmation = form.querySelector("[data-onboarding-confirm]");
  if (publicConfirmation) state.onboardingDraft.publicConfirmed = publicConfirmation.checked;
}

function updateOnboardingIdentityPreview(form) {
  const preview = form.querySelector("[data-onboarding-card-preview]");
  if (!preview) return;
  const name = preview.querySelector("header strong");
  if (name) name.textContent = state.onboardingDraft.displayName.trim() || "你的名字";
}

function bindEvents() {
  document.querySelector("[data-live-otp-request]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) requestLiveOtp(event.currentTarget);
  });
  document.querySelector("[data-live-otp-verify]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) verifyLiveOtp(event.currentTarget);
  });
  document.querySelector("[data-live-profile-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) updateLiveProfile(event.currentTarget);
  });
  const conversationForm = document.querySelector("[data-conversation-form]");
  const conversationInput = conversationForm?.elements.namedItem("message");
  conversationInput?.addEventListener("input", () => {
    state.directConversation.draft = conversationInput.value;
  });
  conversationForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendDirectConversationMessage(event.currentTarget);
  });
  const conversationScroll = document.querySelector("[data-conversation-scroll]");
  if (conversationScroll) {
    requestAnimationFrame(() => {
      conversationScroll.scrollTop = conversationScroll.scrollHeight;
    });
  }
  const onboardingForm = document.querySelector("[data-onboarding-form]");
  onboardingForm?.querySelectorAll("input, textarea, select").forEach((input) => {
    input.addEventListener("input", () => {
      syncOnboardingForm(onboardingForm);
      updateOnboardingIdentityPreview(onboardingForm);
    });
    input.addEventListener("change", () => syncOnboardingForm(onboardingForm));
  });
  onboardingForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    syncOnboardingForm(onboardingForm);
    if (!onboardingForm.reportValidity()) return;
    if (state.onboardingStep === 3) {
      saveLiveOnboarding();
      return;
    }
    state.live.error = "";
    state.onboardingStep = Math.min(3, state.onboardingStep + 1);
    document.querySelector(".screen")?.scrollTo({ top: 0, behavior: "smooth" });
    render();
  });
  const profileBlockForm = document.querySelector("[data-profile-block-form]");
  profileBlockForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) saveProfileBlock(event.currentTarget);
  });
  profileBlockForm?.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("input", () => updateProfileBlockPreview(profileBlockForm));
  });
  const liveProfileForm = document.querySelector("[data-live-profile-form]");
  liveProfileForm?.querySelectorAll('input[name="public-fields"]').forEach((input) => {
    input.addEventListener("change", () => {
      const selectedLabels = [...liveProfileForm.querySelectorAll('input[name="public-fields"]:checked')]
        .map((field) => publicFieldCatalog[field.value])
        .filter(Boolean);
      const preview = liveProfileForm.querySelector("[data-public-fields-preview]");
      if (preview) preview.textContent = selectedLabels.join("、") || "当前没有公开字段";
    });
  });
  document.querySelectorAll("[data-person]:not([data-action])").forEach((element) => {
    element.addEventListener("click", () => {
      state.selectedId = element.dataset.person;
      state.overlay = "person";
      state.personDetailExpanded = false;
      writeAppHistory();
      render();
    });
  });
  document.querySelectorAll("button[data-tab]").forEach((element) => element.addEventListener("click", () => {
    state.tab = element.dataset.tab;
    state.overlay = null;
    writeAppHistory();
    render();
  }));
  document.querySelectorAll("[data-action]").forEach((element) => element.addEventListener("click", () => handleAction(element.dataset.action, element)));
  document.querySelectorAll("[data-task]").forEach((element) => element.addEventListener("click", () => toggleTask(element.dataset.task)));
  document.querySelectorAll("[data-discovery-view]").forEach((element) => element.addEventListener("click", () => setVariant(element.dataset.discoveryView)));
  document.querySelectorAll("[data-platform-form]").forEach((form) => {
    const input = form.querySelector("input[name='platform-url']");
    input?.addEventListener("input", () => {
      state.platformDrafts[form.dataset.platform] = input.value;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      connectPlatform(form.dataset.platform, input?.value || "");
    });
  });
  document.querySelectorAll("[data-direction-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const draft = {
        projectTitle: state.live.enabled
          ? String(formData.get("projectTitle") || "").trim()
          : (directionAlignmentFor(state.selectedId).draft.projectTitle || "离线会议洞察终端"),
        audience: String(formData.get("audience") || "").trim(),
        problem: String(formData.get("problem") || "").trim(),
        outcome: String(formData.get("outcome") || "").trim(),
      };
      const emptyField = Object.entries(draft).find(([, value]) => !value);
      if (emptyField) {
        const invalidInput = form.elements.namedItem(emptyField[0]);
        invalidInput.setCustomValidity("请填写具体内容，不能只输入空格");
        invalidInput.reportValidity();
        invalidInput.addEventListener("input", () => invalidInput.setCustomValidity(""), { once: true });
        return;
      }
      const alignment = ensureDirectionAlignment(state.selectedId);
      alignment.draft = draft;
      alignment.status = "pending_partner";
      state.overlay = "direction-review";
      writeAppHistory();
      render();
    });
  });
  bindRecommendationSwipe();
  bindPersonSheetGesture();
}

function bindPersonSheetGesture() {
  const dragZone = document.querySelector("[data-person-sheet-drag]");
  const sheet = document.querySelector(".person-sheet");
  if (!dragZone || !sheet) return;

  let startY = 0;
  let startX = 0;
  let startHeight = 0;
  let startedFromHandle = false;
  let deltaY = 0;
  let deltaX = 0;
  let gestureAxis = null;
  let dragging = false;

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove("is-dragging");
    if (gestureAxis === "horizontal") {
      if (Math.abs(deltaX) > 64) {
        closePersonDetailWithSwipe(sheet, Math.sign(deltaX));
      } else {
        settlePersonSheetHorizontal(sheet);
      }
      return;
    }
    if (gestureAxis !== "vertical") return;
    if (!state.personDetailExpanded && deltaY < -42) {
      transitionPersonDetail(true);
    } else if (state.personDetailExpanded && deltaY > 52) {
      transitionPersonDetail(false);
    } else {
      settlePersonSheet(sheet, startHeight, state.personDetailExpanded ? 0 : 32);
    }
  };

  const start = (event) => {
    startedFromHandle = Boolean(event.target.closest?.("[data-person-sheet-drag]"));
    if (!startedFromHandle && event.target.closest?.("button, a, input, select, textarea")) return;
    startX = event.clientX;
    startY = event.clientY;
    startHeight = sheet.getBoundingClientRect().height;
    deltaX = 0;
    deltaY = 0;
    gestureAxis = null;
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
    deltaX = event.clientX - startX;
    deltaY = event.clientY - startY;
    if (!gestureAxis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 8) {
      gestureAxis = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      if (gestureAxis === "vertical" && !state.personDetailExpanded) {
        sheet.classList.add("is-revealing-profile");
      }
      if (gestureAxis === "vertical" && state.personDetailExpanded && !startedFromHandle) {
        dragging = false;
        sheet.classList.remove("is-dragging");
        return;
      }
    }
    if (gestureAxis === "horizontal") {
      sheet.style.setProperty("--sheet-drag-x", `${deltaX}px`);
      return;
    }
    if (gestureAxis !== "vertical") return;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const minimumHeight = Math.min(startHeight, Math.max(360, viewportHeight * .48));
    const targetHeight = Math.max(
      minimumHeight,
      Math.min(viewportHeight, startHeight - deltaY),
    );
    sheet.style.height = `${targetHeight}px`;
    sheet.style.maxHeight = `${targetHeight}px`;
    if (state.personDetailExpanded) {
      const radius = Math.max(0, Math.min(deltaY * .32, 32));
      sheet.style.setProperty("--sheet-live-radius", `${radius}px`);
    }
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

function settlePersonSheetHorizontal(sheet) {
  const currentX = getComputedStyle(sheet).getPropertyValue("--sheet-drag-x").trim() || "0px";
  const animation = sheet.animate([
    { transform: `translate3d(${currentX}, 0, 0)` },
    { transform: "translate3d(0, 0, 0)" },
  ], { duration: 180, easing: "cubic-bezier(.2,.85,.25,1)" });
  animation.finished.finally(() => sheet.style.removeProperty("--sheet-drag-x"));
}

function closePersonDetailWithSwipe(sheet, direction = -1) {
  const currentX = getComputedStyle(sheet).getPropertyValue("--sheet-drag-x").trim() || "0px";
  const animation = sheet.animate([
    { transform: `translate3d(${currentX}, 0, 0)`, opacity: 1 },
    { transform: `translate3d(${direction < 0 ? -105 : 105}%, 0, 0)`, opacity: .82 },
  ], { duration: 220, easing: "cubic-bezier(.4,0,.6,1)" });
  animation.finished.finally(() => {
    state.overlay = null;
    state.personDetailExpanded = false;
    render();
  });
}

function settlePersonSheet(sheet, targetHeight, targetRadius) {
  const currentHeight = sheet.getBoundingClientRect().height;
  const currentRadius = parseFloat(getComputedStyle(sheet).borderTopLeftRadius) || 0;
  const animation = sheet.animate([
    { height: `${currentHeight}px`, maxHeight: `${currentHeight}px`, borderRadius: `${currentRadius}px ${currentRadius}px 0 0` },
    { height: `${targetHeight}px`, maxHeight: `${targetHeight}px`, borderRadius: `${targetRadius}px ${targetRadius}px 0 0` },
  ], {
    duration: 220,
    easing: "cubic-bezier(.2,.85,.25,1)",
  });
  animation.finished.finally(() => {
    sheet.classList.remove("is-revealing-profile");
    sheet.style.removeProperty("height");
    sheet.style.removeProperty("max-height");
    sheet.style.removeProperty("--sheet-live-radius");
  });
}

function transitionPersonDetail(expanded) {
  const oldSheet = document.querySelector(".person-sheet");
  const oldRect = oldSheet?.getBoundingClientRect();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  state.personDetailExpanded = expanded;
  render();
  if (!oldRect || reducedMotion) return;

  const nextSheet = document.querySelector(".person-sheet");
  const nextRect = nextSheet?.getBoundingClientRect();
  if (!nextSheet || !nextRect || typeof nextSheet.animate !== "function") return;
  const startRadius = expanded ? 32 : 0;
  const endRadius = expanded ? 0 : 32;
  nextSheet.animate([
    {
      height: `${oldRect.height}px`,
      maxHeight: `${oldRect.height}px`,
      borderRadius: `${startRadius}px ${startRadius}px 0 0`,
      opacity: .96,
    },
    {
      height: `${nextRect.height}px`,
      maxHeight: `${nextRect.height}px`,
      borderRadius: `${endRadius}px ${endRadius}px 0 0`,
      opacity: 1,
    },
  ], {
    duration: expanded ? 390 : 340,
    easing: "cubic-bezier(.2,.9,.22,1)",
  });
}

const swipeCueProfiles = Object.freeze({
  left: Object.freeze({ sweepStart: 680, sweepEnd: 430, airStart: 1500, airEnd: 850, settle: 360 }),
  right: Object.freeze({ sweepStart: 520, sweepEnd: 760, airStart: 950, airEnd: 1600, settle: 1040 }),
});

let swipeAudioContext = null;
let swipeNoiseBuffer = null;

function getSwipeAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (swipeAudioContext && swipeAudioContext.state !== "closed") return swipeAudioContext;
  swipeAudioContext = null;
  swipeNoiseBuffer = null;
  try {
    swipeAudioContext = new AudioContextClass({ latencyHint: "interactive" });
  } catch {
    swipeAudioContext = new AudioContextClass();
  }
  return swipeAudioContext;
}

function disposeSwipeAudio() {
  const context = swipeAudioContext;
  swipeAudioContext = null;
  swipeNoiseBuffer = null;
  if (!context || context.state === "closed") return;
  const closing = context.close?.();
  closing?.catch(() => {});
}

function suspendSwipeAudio() {
  if (swipeAudioContext?.state !== "running") return;
  const suspending = swipeAudioContext.suspend?.();
  suspending?.catch(() => {});
}

function primeSwipeAudio() {
  if (!state.swipeSoundEnabled) return;
  const context = getSwipeAudioContext();
  if (context?.state === "suspended") context.resume().catch(() => {});
}

function getSwipeNoiseBuffer(context) {
  if (swipeNoiseBuffer) return swipeNoiseBuffer;
  const frameCount = Math.max(1, Math.floor(context.sampleRate * .12));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
  }
  swipeNoiseBuffer = buffer;
  return buffer;
}

function scheduleSwipeCue(context, direction) {
  const profile = swipeCueProfiles[direction];
  if (!profile) return;
  const startAt = context.currentTime + .005;
  const endAt = startAt + .15;

  const master = context.createGain();
  master.gain.setValueAtTime(.0001, startAt);
  master.gain.exponentialRampToValueAtTime(.035, startAt + .012);
  master.gain.exponentialRampToValueAtTime(.0001, endAt);
  master.connect(context.destination);

  const sweep = context.createOscillator();
  sweep.type = "sine";
  sweep.frequency.setValueAtTime(profile.sweepStart, startAt);
  sweep.frequency.exponentialRampToValueAtTime(profile.sweepEnd, startAt + .115);
  sweep.connect(master);
  sweep.start(startAt);
  sweep.stop(endAt);

  const air = context.createBufferSource();
  const airFilter = context.createBiquadFilter();
  const airGain = context.createGain();
  air.buffer = getSwipeNoiseBuffer(context);
  airFilter.type = "bandpass";
  airFilter.Q.setValueAtTime(.8, startAt);
  airFilter.frequency.setValueAtTime(profile.airStart, startAt);
  airFilter.frequency.exponentialRampToValueAtTime(profile.airEnd, startAt + .11);
  airGain.gain.setValueAtTime(.13, startAt);
  airGain.gain.exponentialRampToValueAtTime(.0001, startAt + .12);
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(master);
  air.start(startAt);
  air.stop(startAt + .12);

  const settleAt = startAt + .082;
  const settle = context.createOscillator();
  const settleGain = context.createGain();
  settle.type = "sine";
  settle.frequency.setValueAtTime(profile.settle, settleAt);
  settle.frequency.exponentialRampToValueAtTime(profile.settle * .92, endAt);
  settleGain.gain.setValueAtTime(.0001, settleAt);
  settleGain.gain.exponentialRampToValueAtTime(direction === "right" ? .28 : .18, settleAt + .008);
  settleGain.gain.exponentialRampToValueAtTime(.0001, endAt);
  settle.connect(settleGain);
  settleGain.connect(master);
  settle.start(settleAt);
  settle.stop(endAt);
}

function playSwipeCue(direction) {
  if (!state.swipeSoundEnabled) return;
  const context = getSwipeAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    context.resume().then(() => scheduleSwipeCue(context, direction)).catch(() => {});
    return;
  }
  scheduleSwipeCue(context, direction);
}

function bindRecommendationSwipe() {
  const card = document.querySelector("[data-swipe-card]");
  if (!card) return;

  let startX = 0;
  let deltaX = 0;
  let dragging = false;
  let completing = false;

  const resetCard = () => {
    card.classList.remove("is-dragging", "is-positive", "is-negative");
    card.style.removeProperty("--swipe-x");
    card.style.removeProperty("--swipe-rotate");
    card.style.removeProperty("--swipe-progress");
  };

  const completeSwipe = (direction) => {
    if (completing) return;
    completing = true;
    card.classList.remove("is-dragging");
    card.classList.add(direction === "right" ? "is-swiping-right" : "is-swiping-left");
    playSwipeCue(direction);
    window.setTimeout(() => {
      if (direction === "right") expressRecommendationInterest(card.dataset.personId);
      else dismissRecommendation();
      render();
    }, 190);
  };

  card.addEventListener("pointerdown", (event) => {
    primeSwipeAudio();
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
      writeAppHistory();
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
      writeAppHistory();
      render();
    }
  });
}

function handleAction(action, element) {
  const navigationBefore = JSON.stringify(appHistoryPayload());
  if (action === "open-context-switcher") state.overlay = "context-switcher";
  if (action === "close-context-switcher") state.overlay = null;
  if (action === "select-discovery-context") {
    const requestedScope = element.dataset.contextScope;
    if (!["event", "nearby"].includes(requestedScope)) return;
    if (requestedScope === "event" && !currentExhibition) {
      showToast("当前没有可进入的活动");
      return;
    }
    state.discoveryContext = requestedScope;
    localStorage.setItem(discoveryContextStorageKey, requestedScope);
    if (requestedScope === "nearby" && state.variant === "C") state.variant = "B";
    state.recommendationIndex = 0;
    state.overlay = null;
    showToast(requestedScope === "event"
      ? `已进入 ${currentExhibition.name}`
      : "已回到日常附近 · 活动身份仍保留");
  }
  if (action === "manage-context-visibility") {
    state.tab = "profile";
    state.overlay = null;
    showToast(`在这里管理${activeExhibition() ? "本场活动" : "日常附近"}的公开状态`);
  }
  if (action === "edit-live-phone") {
    resetLiveOtpChallenge();
    render();
    return;
  }
  if (action === "resend-live-otp") {
    requestLiveOtp(null, {
      phone: state.live.otpPhone,
    });
    return;
  }
  if (action === "start-oauth-login") {
    startOAuthLogin(element.dataset.provider);
    return;
  }
  if (action === "retry-live") {
    loadLiveMe({ force: true });
    return;
  }
  if (action === "logout-live") {
    logoutLive();
    return;
  }
  if (action === "sync-live-now") {
    refreshLiveState();
    return;
  }
  if (action === "open-conversation") {
    openDirectConversation(element);
    return;
  }
  if (action === "close-conversation") {
    state.overlay = null;
    state.directConversation.error = "";
    writeAppHistory();
    if (state.live.enabled) refreshLiveState();
    else render();
    return;
  }
  if (action === "retry-conversation") {
    if (state.directConversation.pendingClientMessageId && state.directConversation.draft.trim()) {
      const form = document.querySelector("[data-conversation-form]");
      if (form) sendDirectConversationMessage(form);
    } else {
      loadDirectConversation();
    }
    return;
  }
  if (action === "conversation-intent") {
    state.selectedId = element.dataset.person || state.selectedId;
    state.overlay = "intent-clarification";
    writeAppHistory();
    render();
    return;
  }
  if (action === "resolve-connection") {
    resolveLiveConnectionRequest(element.dataset.requestId, element.dataset.resolution);
    return;
  }
  if (action === "resolve-team-invitation") {
    resolveLiveTeamInvitation(element.dataset.invitationId, element.dataset.resolution);
    return;
  }
  if (action === "generate-live-pack") {
    generateLiveStarterPack();
    return;
  }
  if (action === "live-task-action") {
    updateLiveTask(element.dataset.taskId, element.dataset.resolution);
    return;
  }
  if (action === "confirm-live-plan") {
    confirmLivePlan();
    return;
  }
  if (action === "choose-status") {
    state.collaborationStatus = element.dataset.status;
  }
  if (action === "choose-onboarding-status") {
    state.onboardingDraft.status = element.dataset.status;
    state.collaborationStatus = {
      "未组队": "SEEKING_TEAM",
      "有 Idea 找人": "IDEA_RECRUITING",
      "团队缺人": "TEAM_RECRUITING",
      "已组队但可交流": "TEAMED_OPEN",
    }[element.dataset.status] || state.collaborationStatus;
  }
  if (action === "toggle-onboarding-preference") {
    const preference = element.dataset.preference;
    state.onboardingDraft.preferences = state.onboardingDraft.preferences.includes(preference)
      ? state.onboardingDraft.preferences.filter((item) => item !== preference)
      : [...state.onboardingDraft.preferences, preference].slice(0, 5);
  }
  if (action === "choose-onboarding-avatar") {
    state.onboardingDraft.avatar = element.dataset.avatar;
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
    state.live.error = "";
    if (state.onboardingStep > 0) state.onboardingStep -= 1;
    else finishOnboarding(false);
  }
  if (action === "skip-onboarding") {
    state.live.error = "";
    if (state.onboardingStep === 3) state.onboardingStep = 2;
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
  if (action === "open-profile-settings") state.overlay = "profile-settings";
  if (action === "close-profile-settings") state.overlay = null;
  if (action === "toggle-swipe-sound") {
    state.swipeSoundEnabled = !state.swipeSoundEnabled;
    localStorage.setItem("rally_swipe_sound_enabled", String(state.swipeSoundEnabled));
    if (!state.swipeSoundEnabled) disposeSwipeAudio();
    showToast(state.swipeSoundEnabled ? "滑动声效已开启" : "滑动声效已关闭");
  }
  if (action === "open-profile-editor") state.overlay = "profile-editor";
  if (action === "close-profile-editor") state.overlay = null;
  if (action === "open-profile-block-library") {
    if (!state.live.currentProfile) {
      showToast("Live 账号资料加载完成后即可添加内容");
      return;
    }
    state.profileBlockDraft = null;
    state.overlay = "profile-block-library";
  }
  if (action === "close-profile-block-library") {
    state.profileBlockDraft = null;
    state.overlay = null;
  }
  if (action === "back-profile-block-library") {
    state.profileBlockDraft = null;
    state.overlay = "profile-block-library";
  }
  if (action === "choose-profile-block") {
    const type = element.dataset.blockType;
    if (profileBlockCatalog[type]) {
      state.profileBlockDraft = { type };
      state.overlay = "profile-block-editor";
    }
  }
  if (action === "profile-setting-detail" || action === "profile-placeholder") {
    showToast(`${element.dataset.label}将在下一轮接入`);
  }
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
    const firstResult = filterDiscoveryPeople(discoveryPeople())[0];
    if (firstResult) state.selectedId = firstResult.id;
    state.overlay = null;
    showToast(activeDiscoveryFilterCount() ? `已应用筛选 · ${filterDiscoveryPeople(discoveryPeople()).length} 人符合` : "已显示本场全部成员");
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
    saveLiveOnboarding();
    return;
  }
  if (action === "restart-onboarding") {
    hydrateOnboardingDraft();
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
      : filterDiscoveryPeople(discoveryPeople());
    if (!pool.length) return;
    const index = pool.findIndex((person) => person.id === state.selectedId);
    state.selectedId = pool[(Math.max(index, 0) + 1) % pool.length].id;
  }
  if (action === "refresh") showToast(`已读取附近 ${activeRadarPeople().length} 个协作信号`);
  if (action === "greet") {
    const id = element.dataset.person;
    if (state.live.enabled) {
      const person = livePeople().find((item) => item.id === id);
      if (person) sendLiveConnectionRequest(person);
      return;
    }
    if (!state.greeted.includes(id)) {
      state.greeted.push(id);
      showToast(interestConfirmationCopy());
    } else {
      showToast("你已经表达过想认识，等待对方回应即可");
    }
    state.overlay = "person";
  }
  if (action === "direct-tap") {
    if (state.live.enabled) {
      refreshLiveState();
      showToast("请完成真实碰卡；连接事件会自动同步");
      return;
    }
    state.selectedId = element.dataset.person || state.selectedId;
    state.overlay = "tap";
  }
  if (action === "resume-direction") {
    state.selectedId = element.dataset.person || state.selectedId;
    const status = directionAlignmentFor().status;
    state.overlay = status === "pending_partner"
      ? "direction-review"
      : status === "confirmed"
        ? "direction-confirmed"
        : "intent-clarification";
  }
  if (action === "resume-project-creation") {
    state.selectedId = element.dataset.person || state.selectedId;
    state.overlay = "direction-confirmed";
  }
  if (action === "resume-project-invite") {
    state.selectedId = element.dataset.person || state.selectedId;
    state.overlay = "success";
  }
  if (action === "resume-team-invite") {
    state.selectedId = element.dataset.person || state.selectedId;
    state.overlay = "invite-sent";
  }
  if (action === "confirm-connect") {
    const id = element.dataset.person;
    if (!state.connected.includes(id)) state.connected.push(id);
    ensureDirectionAlignment(id);
    state.overlay = "success";
  }
  if (action === "enter-intent-clarification") state.overlay = "intent-clarification";
  if (action === "draft-direction") {
    const alignment = ensureDirectionAlignment(state.selectedId);
    if (alignment.status === "not_started") alignment.status = "drafting";
    state.overlay = "direction-review";
  }
  if (action === "confirm-partner-direction") {
    const alignment = ensureDirectionAlignment(state.selectedId);
    if (alignment.status !== "pending_partner") {
      showToast("请先确认你的方向草案");
      return;
    }
    alignment.status = "confirmed";
    state.overlay = "direction-confirmed";
  }
  if (action === "invite-team") {
    const id = element.dataset.person;
    const directionStatus = directionAlignmentFor(id).status;
    const liveDraftIsReady = state.live.enabled && directionStatus === "pending_partner";
    if (!liveDraftIsReady && !["known_project", "confirmed"].includes(directionStatus)) {
      showToast("先由双方确认项目方向");
      return;
    }
    if (state.live.enabled) {
      const person = livePeople().find((item) => item.id === id);
      if (person) createAndInviteLiveProject(person);
      return;
    }
    state.collaborationStatus = "TEAM_RECRUITING";
    if (!state.invited.includes(id)) state.invited.push(id);
    state.overlay = "invite-sent";
  }
  if (action === "confirm-team-invite") {
    if (state.live.enabled) {
      showToast("请由对方在自己的设备确认入队");
      return;
    }
    const id = element.dataset.person;
    if (!state.joined.includes(id)) state.joined.push(id);
    state.overlay = "joined";
  }
  if (action === "workspace-section") state.workspaceSection = element.dataset.section;
  if (action === "open-workspace-tasks") state.workspaceSection = "tasks";
  if (action === "trigger-project-sos") {
    state.workspaceSos = true;
    state.workspaceSection = "overview";
    showToast("项目 SOS 已发布到当前展会协作区");
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
    showToast(state.visible ? visibilityRestoredMessage() : "已暂停附近展示");
  }
  if (action === "sync-card") {
    if (state.live.enabled) state.overlay = "profile-editor";
    else showToast("原型：Live 模式可编辑真实公开字段");
  }
  if (action === "bind-platform") connectPlatform(element.dataset.platform);
  if (action === "remove-platform") disconnectPlatform(element.dataset.platform);
  if (JSON.stringify(appHistoryPayload()) !== navigationBefore) writeAppHistory();
  render();
}

function liveProfileNeedsIntroduction(profile = state.live.currentProfile) {
  return Boolean(profile) && (
    profile.role === "待完善协作资料"
    || !Array.isArray(profile.skills)
    || profile.skills.length < 3
    || !Array.isArray(profile.interests)
    || profile.interests.length < 1
    || !Array.isArray(profile.collaboration_preferences)
    || profile.collaboration_preferences.length < 1
  );
}

function hydrateOnboardingDraft() {
  const profile = state.live.currentProfile;
  if (!profile) return;
  const platformLinks = Object.fromEntries(
    Object.keys(state.onboardingDraft.platformLinks).map((platform) => [
      platform,
      state.live.platformLinks.find((link) => link.platform === platform)?.url || "",
    ]),
  );
  const displayName = /^(?:COSPAN|RALLY) 新朋友$/.test(currentUser.name) ? "" : currentUser.name;
  state.onboardingDraft = {
    ...createOnboardingDraft(),
    platformLinks,
    status: profile.status || "未组队",
    availability: profile.availability === "待补充" ? "" : profile.availability || "",
    displayName,
    role: profile.role === "待完善协作资料" ? "" : profile.role || "",
    skills: Array.isArray(profile.skills) ? profile.skills.join("，") : "",
    interests: Array.isArray(profile.interests) ? profile.interests.join("，") : "",
    vibe: profile.collaboration_need || "",
    preferences: Array.isArray(profile.collaboration_preferences)
      && profile.collaboration_preferences.length
      ? [...profile.collaboration_preferences]
      : ["快速原型"],
    avatar: /^memoji-(?:[1-9]|1[0-2])$/.test(currentUser.avatar)
      ? currentUser.avatar
      : "memoji-5",
  };
}

async function saveLiveOnboarding() {
  if (state.live.pendingOperations.has("onboarding:save")) return;
  const draft = state.onboardingDraft;
  const displayName = draft.displayName.trim();
  const role = draft.role.trim();
  const skills = parseProfileList(draft.skills);
  const interests = parseProfileList(draft.interests);
  const preferences = draft.preferences.filter(Boolean).slice(0, 5);
  const vibe = draft.vibe.trim();
  if (!displayName) {
    state.onboardingStep = 3;
    state.live.error = "请先填写希望队友怎么称呼你";
    render();
    return;
  }
  if (!role || skills.length < 3 || interests.length < 1 || !vibe || preferences.length < 1) {
    state.onboardingStep = 2;
    state.live.error = "请补充角色、至少 3 项能力、关注方向和一句自我介绍";
    render();
    return;
  }
  const publicUrls = {};
  for (const [platform, rawUrl] of Object.entries(draft.platformLinks)) {
    if (!rawUrl.trim()) continue;
    const url = safePublicUrl(rawUrl);
    if (!url) {
      state.onboardingStep = 0;
      state.live.error = `请检查${platformCatalog[platform]?.label || "公开主页"}链接，需使用 HTTPS`;
      render();
      return;
    }
    publicUrls[platform] = url;
  }
  const projectUrl = draft.projectUrl.trim() ? safePublicUrl(draft.projectUrl) : "";
  if (draft.projectUrl.trim() && !projectUrl) {
    state.onboardingStep = 1;
    state.live.error = "项目链接需使用有效的 HTTPS 地址";
    render();
    return;
  }
  const projectTitle = cleanProfileBlockField(draft.projectTitle, 40);
  const projectSummary = cleanProfileBlockField(draft.projectSummary, 72);
  const evidence = [...(state.live.currentProfile?.evidence || [])];
  if (projectTitle || projectSummary || projectUrl) {
    const serialized = serializeProfileBlock(projectUrl ? "project_link" : "project_title", {
      title: projectTitle || "正在做的项目",
      detail: projectSummary || "欢迎当面交流这个项目",
      url: projectUrl,
    });
    if (serialized && !evidence.includes(serialized)) evidence.push(serialized);
  }
  const profileInput = {
    display_name: displayName,
    role,
    status: draft.status,
    skills,
    interests,
    availability: draft.availability.trim() || "本场活动期间可沟通",
    collaboration_preferences: preferences,
    collaboration_need: vibe,
    evidence: evidence.slice(0, 12),
  };
  if (!state.live.enabled) {
    Object.assign(currentUser, { name: displayName, avatar: draft.avatar, role, skills });
    finishOnboarding(true);
    showToast("自我介绍已完成");
    render();
    return;
  }
  state.live.error = "";
  try {
    await runLiveMutation("onboarding:save", async () => {
      await api.patch(
        `/api/events/${encodeURIComponent(liveConfig.eventId)}/profile`,
        profileInput,
      );
      for (const [platform, url] of Object.entries(publicUrls)) {
        await api.put(`/api/me/platform-links/${encodeURIComponent(platform)}`, { url });
      }
      for (const link of state.live.platformLinks) {
        if (
          Object.prototype.hasOwnProperty.call(draft.platformLinks, link.platform)
          && !draft.platformLinks[link.platform].trim()
        ) {
          await api.delete(`/api/me/platform-links/${encodeURIComponent(link.platform)}`);
        }
      }
      const publicFields = [
        "display_name",
        "avatar",
        "role",
        "status",
        "skills",
        "interests",
        "availability",
        "collaboration_preferences",
        "collaboration_need",
        ...(evidence.length ? ["evidence"] : []),
        ...(Object.keys(publicUrls).length ? ["platform_links"] : []),
      ];
      await api.patch(
        `/api/events/${encodeURIComponent(liveConfig.eventId)}/visibility`,
        { state: "VISIBLE", public_fields: publicFields },
      );
    });
    if (state.live.currentUserId) {
      localStorage.setItem(`cospan_profile_avatar_${state.live.currentUserId}`, draft.avatar);
    }
    state.visible = true;
    finishOnboarding(true);
    showToast("自我介绍已保存，开始发现队友");
    await loadLiveMe({ force: true });
    currentUser.avatar = draft.avatar;
  } catch (error) {
    handleLiveFailure(error, "自我介绍保存失败");
    showToast(state.live.error);
  }
  render();
}

function finishOnboarding(published) {
  state.onboarding = false;
  state.onboardingStep = 0;
  if (!state.live.enabled || published) state.visible = published;
  state.live.error = "";
  state.tab = "discover";
  state.variant = "A";
  const url = new URL(location.href);
  url.searchParams.set("variant", state.variant);
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

function handlePlatformBack() {
  if (state.overlay) {
    state.overlay = null;
    state.profileBlockDraft = null;
    writeAppHistory({ replace: true });
    render();
    return true;
  }
  if (state.onboarding) {
    if (state.onboardingStep > 0) state.onboardingStep -= 1;
    else finishOnboarding(false);
    render();
    return true;
  }
  if (state.tab !== "discover") {
    state.tab = "discover";
    writeAppHistory({ replace: true });
    render();
    return true;
  }
  return false;
}

window.RallyApp = Object.freeze({ handleBack: handlePlatformBack });

window.addEventListener("popstate", (event) => {
  const snapshot = event.state?.rally;
  const urlScope = new URL(location.href).searchParams.get("scope");
  const historyScope = [snapshot?.discoveryScope, urlScope]
    .find((scope) => ["event", "nearby"].includes(scope));
  state.discoveryContext = currentExhibition && historyScope === "event" ? "event" : "nearby";
  state.variant = availableDiscoveryVariants().includes(snapshot?.variant)
    ? snapshot.variant
    : readVariant();
  state.tab = ["discover", "connections", "collaboration", "profile"].includes(snapshot?.tab)
    ? snapshot.tab
    : (new URL(location.href).searchParams.get("view") || "discover");
  state.overlay = typeof snapshot?.overlay === "string" ? snapshot.overlay : null;
  if (state.overlay === "conversation") {
    state.directConversation.connectionId = snapshot?.conversationId
      || new URL(location.href).searchParams.get("conversation")
      || state.directConversation.connectionId;
  }
  const historyBlockType = snapshot?.profileBlockType
    || new URL(location.href).searchParams.get("block");
  state.profileBlockDraft = state.overlay === "profile-block-editor" && profileBlockCatalog[historyBlockType]
    ? { type: historyBlockType }
    : null;
  render();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Tab" && state.overlay) {
    trapOverlayFocus(event);
    return;
  }
  const tag = event.target?.tagName?.toLowerCase();
  if (["input", "textarea"].includes(tag) || event.target?.isContentEditable) return;
  if (event.key === "Escape" && state.overlay) {
    state.overlay = null;
    state.profileBlockDraft = null;
    writeAppHistory({ replace: true });
    render();
  }
});

render();
writeAppHistory({ replace: true });

function clearOAuthCallbackParameters() {
  const url = new URL(location.href);
  url.searchParams.delete("oauth_ticket");
  url.searchParams.delete("oauth_provider");
  url.searchParams.delete("oauth_error");
  history.replaceState(history.state, "", url);
}

async function loadOAuthProviders() {
  if (!state.live.enabled) return;
  try {
    const payload = await api.get("/api/auth/oauth/providers", {
      authenticate: false,
      retryDelaysMs: [],
    });
    for (const provider of ["wechat", "google"]) {
      state.live.oauthProviders[provider] = payload.providers?.[provider]?.enabled === true;
      state.live.androidOAuthProviders[provider] = payload.providers?.[provider]?.android_enabled === true;
    }
  } catch {
    state.live.oauthProviders.wechat = false;
    state.live.oauthProviders.google = false;
    state.live.androidOAuthProviders.wechat = false;
    state.live.androidOAuthProviders.google = false;
  } finally {
    state.live.oauthProvidersLoaded = true;
    render();
  }
}

function encodeOAuthBytes(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createOAuthClientBinding(provider) {
  if (!globalThis.crypto?.subtle) throw new Error("OAUTH_SECURE_CONTEXT_REQUIRED");
  const verifierBytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(verifierBytes);
  const verifier = encodeOAuthBytes(verifierBytes);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  sessionStorage.setItem(oauthVerifierStorageKey, verifier);
  sessionStorage.setItem(oauthProviderStorageKey, provider);
  return encodeOAuthBytes(new Uint8Array(digest));
}

function clearOAuthClientBinding() {
  sessionStorage.removeItem(oauthVerifierStorageKey);
  sessionStorage.removeItem(oauthProviderStorageKey);
}

async function startOAuthLogin(provider) {
  if (!["wechat", "google"].includes(provider)) return;
  if (initialParams.get("source") === "android-app" && provider === "wechat") {
    state.live.error = "Android 体验包的微信一键登录需要接入微信 OpenSDK；请先从微信内打开 COSPAN 网页版";
    render();
    return;
  }
  if (!state.live.oauthProviders[provider]) {
    state.live.error = `${provider === "wechat" ? "微信" : "Google"}登录尚未在服务器配置`;
    render();
    return;
  }
  let codeChallenge;
  try {
    codeChallenge = await createOAuthClientBinding(provider);
  } catch {
    state.live.error = "当前环境无法建立安全登录校验，请使用 HTTPS 后重试";
    render();
    return;
  }
  const returnTo = initialParams.get("source") === "android-app"
    ? `${packagedAppOrigin || liveConfig.apiBase}/auth/android`
    : (() => {
        const url = new URL(location.href);
        url.searchParams.delete("oauth_ticket");
        url.searchParams.delete("oauth_provider");
        url.searchParams.delete("oauth_error");
        url.hash = "";
        return url.href;
      })();
  const startUrl = new URL(`${liveConfig.apiBase}/api/auth/oauth/${provider}/start`);
  startUrl.searchParams.set("return_to", returnTo);
  startUrl.searchParams.set("code_challenge", codeChallenge);
  location.assign(startUrl.href);
}

async function finishLiveAuthentication(payload, successMessage) {
  liveConfig.accessToken = payload.access_token;
  state.live.sessionExpiresAt = payload.expires_at;
  state.live.authStatus = "ready";
  localStorage.setItem("rally_access_token", payload.access_token);
  localStorage.setItem("rally_session_expires_at", payload.expires_at);
  localStorage.setItem("rally_api_base", liveConfig.apiBase);
  resetLiveOtpChallenge();
  clearLiveOtpIdentity();
  state.live.meLoading = false;
  state.tab = "discover";
  await loadLiveMe({ force: true });
  if (payload.is_new_user) {
    hydrateOnboardingDraft();
    state.onboarding = true;
    state.onboardingStep = 0;
    state.overlay = null;
    showToast(`${successMessage}，用 4 步完成自我介绍`);
  }
}

async function exchangeOAuthTicket(ticket) {
  state.live.authStatus = "exchanging";
  state.live.meLoading = true;
  state.live.error = "";
  render();
  try {
    const verifier = sessionStorage.getItem(oauthVerifierStorageKey);
    const expectedProvider = sessionStorage.getItem(oauthProviderStorageKey);
    if (
      typeof verifier !== "string"
      || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)
      || expectedProvider !== initialOAuthProvider
    ) {
      throw new ApiError("OAuth client binding is missing.", {
        status: 400,
        code: "INVALID_OAUTH_TICKET",
      });
    }
    const payload = await api.post("/api/auth/oauth/sessions", { ticket, verifier }, {
      authenticate: false,
    });
    const providerName = payload.provider === "wechat" ? "微信" : "Google";
    await finishLiveAuthentication(payload, `${providerName}登录成功`);
  } catch (error) {
    state.live.authStatus = "required";
    state.live.meLoading = false;
    state.live.error = error instanceof ApiError && error.code === "INVALID_OAUTH_TICKET"
      ? "登录回执已失效，请重新选择登录方式"
      : "第三方登录暂时没有完成，请重试";
  } finally {
    clearOAuthClientBinding();
    clearOAuthCallbackParameters();
    render();
  }
}

async function initializeLiveAuthentication() {
  if (!state.live.enabled) return;
  const hasOAuthCallbackParameters = initialParams.has("oauth_ticket")
    || initialParams.has("oauth_provider")
    || initialParams.has("oauth_error");
  if (hasOAuthCallbackParameters) clearOAuthCallbackParameters();
  await loadOAuthProviders();
  if (initialOAuthTicket && !storedAccessToken) {
    await exchangeOAuthTicket(initialOAuthTicket);
    return;
  }
  if (initialOAuthError && !storedAccessToken) {
    clearOAuthClientBinding();
    state.live.authStatus = "required";
    state.live.meLoading = false;
    state.live.error = initialOAuthError === "cancelled"
      ? "你已取消第三方登录"
      : "第三方平台暂时没有完成登录，请重试";
    clearOAuthCallbackParameters();
    render();
    return;
  }
  await loadLiveMe();
}

function otpRetrySeconds() {
  if (!state.live.otpRetryAt) return 0;
  return Math.max(0, Math.ceil((state.live.otpRetryAt - Date.now()) / 1000));
}

function stopLiveOtpCountdown() {
  if (liveOtpCountdownTimer) window.clearInterval(liveOtpCountdownTimer);
  liveOtpCountdownTimer = null;
}

function startLiveOtpCountdown() {
  stopLiveOtpCountdown();
  if (otpRetrySeconds() <= 0) return;
  liveOtpCountdownTimer = window.setInterval(() => {
    if (state.live.authStatus !== "required" || !state.live.otpChallengeId) {
      stopLiveOtpCountdown();
      return;
    }
    render();
    if (otpRetrySeconds() <= 0) stopLiveOtpCountdown();
  }, 1000);
}

function resetLiveOtpChallenge() {
  stopLiveOtpCountdown();
  state.live.otpChallengeId = null;
  state.live.otpMaskedPhone = "";
  state.live.otpRetryAt = null;
  state.live.error = "";
}

function clearLiveOtpIdentity() {
  state.live.otpPhone = "";
}

function clearLiveSession() {
  liveConfig.accessToken = null;
  localStorage.removeItem("rally_access_token");
  localStorage.removeItem("rally_session_expires_at");
  state.overlay = null;
  state.profileBlockDraft = null;
  writeAppHistory({ replace: true });
  state.live.authStatus = "required";
  state.live.sessionExpiresAt = null;
  state.live.meLoaded = false;
  state.live.currentUserId = null;
  state.live.currentProfile = null;
  resetLiveOtpChallenge();
  clearLiveOtpIdentity();
  state.live.discover = [];
  state.live.nearby = [];
  state.live.connectionRequests = [];
  state.live.teamInvitations = [];
  state.live.projects = [];
  state.live.activeProject = null;
  state.live.room = null;
  stopLivePolling();
  stopLivePresence();
}

function handleLiveFailure(error, fallback = "网络暂时不可用") {
  if (error instanceof ApiError && error.isAuthenticationError) {
    clearLiveSession();
    state.live.error = "登录已过期，请重新登录";
    return;
  }
  state.live.error = safeLiveText(error?.message, fallback, 180);
}

async function runLiveMutation(resourceKey, operation) {
  if (state.live.pendingOperations.has(resourceKey)) {
    return api.runExclusive(resourceKey, operation);
  }
  state.live.pendingOperations.add(resourceKey);
  render();
  try {
    return await api.runExclusive(resourceKey, operation);
  } finally {
    state.live.pendingOperations.delete(resourceKey);
    render();
  }
}

function liveBusyAttributes(resourceKey) {
  return state.live.pendingOperations.has(resourceKey) ? 'disabled aria-busy="true"' : "";
}

async function requestLiveOtp(form, savedValues = null) {
  if (state.live.meLoading) return;
  const formData = form ? new FormData(form) : null;
  const phone = String(savedValues?.phone ?? formData?.get("phone") ?? "").trim();
  state.live.meLoading = true;
  state.live.error = "";
  render();
  try {
    const payload = await api.post("/api/auth/otp/challenges", {
      phone,
    }, {
      authenticate: false,
    });
    state.live.otpChallengeId = payload.challenge_id;
    state.live.otpMaskedPhone = payload.masked_phone;
    state.live.otpPhone = phone;
    state.live.otpRetryAt = Date.now() + Number(payload.retry_after_seconds || 60) * 1000;
    startLiveOtpCountdown();
  } catch (error) {
    if (error instanceof ApiError && error.code === "OTP_RATE_LIMITED") {
      state.live.error = "验证码请求太频繁，请稍后再试";
    } else if (error instanceof ApiError && error.code === "OTP_DELIVERY_FAILED") {
      state.live.error = "短信暂时没有发送成功，请重新获取";
    } else if (error instanceof ApiError && error.code === "INVALID_OTP_REQUEST") {
      state.live.error = "请输入有效的中国大陆手机号";
    } else {
      handleLiveFailure(error, "验证码发送失败，请稍后重试");
    }
  } finally {
    state.live.meLoading = false;
    render();
  }
}

async function verifyLiveOtp(form) {
  if (state.live.meLoading || !state.live.otpChallengeId) return;
  const code = String(new FormData(form).get("code") || "").trim();
  state.live.meLoading = true;
  state.live.error = "";
  render();
  try {
    const payload = await api.post("/api/auth/otp/sessions", {
      challenge_id: state.live.otpChallengeId,
      code,
    }, { authenticate: false });
    await finishLiveAuthentication(payload, "手机号验证成功");
  } catch (error) {
    if (error instanceof ApiError && error.code === "INVALID_OTP") {
      state.live.error = "验证码错误、已过期或尝试次数已用完";
    } else {
      handleLiveFailure(error, "验证码校验失败，请稍后重试");
    }
  } finally {
    state.live.meLoading = false;
    render();
  }
}

async function logoutLive() {
  try {
    if (liveConfig.accessToken) {
      stopLivePresence();
      await api.delete(`/api/events/${encodeURIComponent(liveConfig.eventId)}/presence`, {
        keepalive: true,
      });
      await api.delete("/api/auth/session");
    }
  } catch {
    // Local session data is still removed if the server is temporarily unavailable.
  }
  clearLiveSession();
  state.live.error = "";
  render();
}

function parseProfileList(value, { maximumItems = 5 } = {}) {
  return String(value || "")
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximumItems);
}

function profileInputWithEvidence(profile, evidence) {
  return {
    role: profile.role,
    status: profile.status,
    skills: profile.skills || [],
    interests: profile.interests || [],
    availability: profile.availability,
    collaboration_preferences: profile.collaboration_preferences || [],
    collaboration_need: profile.collaboration_need || "",
    evidence,
  };
}

async function saveProfileBlock(form) {
  const type = form.dataset.blockType;
  const item = profileBlockCatalog[type];
  const profile = state.live.currentProfile;
  if (!item || !profile || !state.live.enabled) return;
  const formData = new FormData(form);
  const url = safePublicUrl(formData.get("url"));
  if ((item.needsUrl || item.group === "social") && !url) {
    showToast("请填写有效的 HTTPS 公开链接");
    return;
  }
  const currentPublicFields = new Set(profile.visibility?.public_fields || []);
  const authorizationField = profileBlockAuthorizationField(item);
  if (!currentPublicFields.has(authorizationField) && !formData.get("confirm-public-field")) {
    showToast(`请先确认开启“${publicFieldCatalog[authorizationField]}”公开`);
    return;
  }
  currentPublicFields.add(authorizationField);
  try {
    if (item.group === "social" && !item.storeAsEvidence) {
      const payload = await runLiveMutation(`platform:${item.platform}`, async () => {
        const platformPayload = await api.put(
          `/api/me/platform-links/${encodeURIComponent(item.platform)}`,
          { url },
        );
        await api.patch(
          `/api/events/${encodeURIComponent(liveConfig.eventId)}/visibility`,
          {
            state: state.visible ? "VISIBLE" : "PAUSED",
            public_fields: [...currentPublicFields],
          },
        );
        return platformPayload;
      });
      state.live.platformLinks = [
        ...state.live.platformLinks.filter((link) => link.platform !== item.platform),
        payload.platform_link,
      ];
    } else {
      const serialized = serializeProfileBlock(type, {
        title: item.storeAsEvidence ? item.label : formData.get("title"),
        detail: item.storeAsEvidence ? "公开主页" : formData.get("detail"),
        url,
      });
      if (!serialized || !cleanProfileBlockField(
        item.storeAsEvidence ? item.label : formData.get("title"),
        40,
      )) {
        showToast("请补充这个 Block 的证据标题");
        return;
      }
      if (serialized.length > 160) {
        showToast("这个 Block 过长，请缩短说明或公开链接");
        return;
      }
      const evidence = [...(profile.evidence || []), serialized];
      if (evidence.length > 12) {
        showToast("对外卡片最多保存 12 条能力证据");
        return;
      }
      await runLiveMutation("profile-block:add", async () => {
        await api.patch(
          `/api/events/${encodeURIComponent(liveConfig.eventId)}/profile`,
          profileInputWithEvidence(profile, evidence),
        );
        await api.patch(
          `/api/events/${encodeURIComponent(liveConfig.eventId)}/visibility`,
          {
            state: state.visible ? "VISIBLE" : "PAUSED",
            public_fields: [...currentPublicFields],
          },
        );
      });
      state.live.currentProfile = {
        ...profile,
        evidence,
      };
    }
    state.live.currentProfile = {
      ...state.live.currentProfile,
      visibility: {
        ...state.live.currentProfile.visibility,
        public_fields: [...currentPublicFields],
      },
    };
    state.profileBlockDraft = null;
    state.overlay = null;
    writeAppHistory({ replace: true });
    showToast(state.visible
      ? `${item.label} 已添加并公开`
      : `${item.label} 已保存，恢复展示后公开`);
    await loadLiveMe({ force: true });
  } catch (error) {
    handleLiveFailure(error, "Block 保存失败");
    showToast(state.live.error);
  }
  render();
}

async function updateLiveProfile(form) {
  const formData = new FormData(form);
  const skills = parseProfileList(formData.get("skills"));
  const interests = parseProfileList(formData.get("interests"));
  const preferences = parseProfileList(formData.get("preferences"));
  if (skills.length < 3 || interests.length < 1 || preferences.length < 1) {
    showToast("至少填写 3 项能力、1 项兴趣和 1 项协作偏好");
    return;
  }
  const profileInput = {
    display_name: String(formData.get("display-name") || "").trim(),
    role: String(formData.get("role") || "").trim(),
    status: String(formData.get("status") || ""),
    skills,
    interests,
    availability: String(formData.get("availability") || "").trim(),
    collaboration_preferences: preferences,
    collaboration_need: String(formData.get("need") || "").trim(),
    evidence: [
      ...(state.live.currentProfile?.evidence || []).filter((item) => (
        parseProfileBlockEvidenceItem(item)
      )),
      ...parseProfileList(formData.get("evidence"), { maximumItems: 12 }),
    ].slice(0, 12),
  };
  const publicFields = formData.getAll("public-fields").map(String);
  try {
    await runLiveMutation("profile:update", async () => {
      await api.patch(
        `/api/events/${encodeURIComponent(liveConfig.eventId)}/profile`,
        profileInput,
      );
      await api.patch(
        `/api/events/${encodeURIComponent(liveConfig.eventId)}/visibility`,
        {
          state: state.visible ? "VISIBLE" : "PAUSED",
          public_fields: publicFields,
        },
      );
    });
    state.overlay = null;
    writeAppHistory({ replace: true });
    showToast("协作资料与公开范围已保存");
    await loadLiveMe({ force: true });
  } catch (error) {
    handleLiveFailure(error, "资料保存失败");
    showToast(state.live.error);
  }
  render();
}

function buildDemoDirectConversation(person, connectionId) {
  return {
    connection_id: connectionId,
    status: "ACTIVE",
    counterpart: {
      id: `user-${person.id}`,
      display_name: person.name,
      avatar: person.avatar,
      role: person.role,
    },
    context: {
      event_id: currentExhibition?.id || "offline-collaboration",
      event_name: currentExhibition?.name || "线下协作现场",
      source: "nfc",
      consent_mode: "physical_mutual",
      connected_at: "2026-08-29T14:16:00.000Z",
    },
    messages: state.directConversation.demoMessages[person.id] || [],
    unread_count: 0,
    last_read_message_id: null,
    has_more: false,
  };
}

function openDirectConversation(element) {
  const connectionId = element.dataset.connectionId;
  const personId = element.dataset.person || state.selectedId;
  if (!connectionId || !personId) return;
  state.selectedId = personId;
  state.directConversation.connectionId = connectionId;
  state.directConversation.error = "";
  state.directConversation.draft = "";
  state.directConversation.sending = false;
  state.directConversation.pendingClientMessageId = null;
  state.directConversation.pendingMessageText = null;
  state.overlay = "conversation";
  if (state.live.enabled) {
    state.directConversation.data = null;
    state.directConversation.loading = true;
    writeAppHistory();
    render();
    loadDirectConversation();
    return;
  }
  state.directConversation.loading = false;
  state.directConversation.data = buildDemoDirectConversation(selectedPerson(), connectionId);
  writeAppHistory();
  render();
}

async function loadDirectConversation({ silent = false } = {}) {
  const connectionId = state.directConversation.connectionId;
  if (!state.live.enabled || !connectionId) return;
  const loadRevision = state.directConversation.loadRevision + 1;
  state.directConversation.loadRevision = loadRevision;
  const isCurrentLoad = () => (
    state.overlay === "conversation"
    && state.directConversation.connectionId === connectionId
    && state.directConversation.loadRevision === loadRevision
  );
  if (!silent) state.directConversation.loading = true;
  state.directConversation.error = "";
  if (!silent) render();
  try {
    const payload = await api.get(
      `/api/connections/${encodeURIComponent(connectionId)}/conversation`,
    );
    if (!isCurrentLoad()) return;
    let conversation = payload.conversation;
    const lastMessage = conversation.messages.at(-1);
    if (conversation.unread_count > 0 && lastMessage) {
      const marked = await api.patch(
        `/api/connections/${encodeURIComponent(connectionId)}/conversation`,
        { last_read_message_id: lastMessage.id },
      );
      if (!isCurrentLoad()) return;
      conversation = marked.conversation;
      state.live.connectionRequests = state.live.connectionRequests.map((request) => (
        request.connection_id === connectionId
          ? { ...request, unread_count: 0 }
          : request
      ));
    }
    state.directConversation.data = conversation;
    const counterpartId = localPersonId(conversation.counterpart.id);
    if (counterpartId) state.selectedId = counterpartId;
    state.directConversation.error = "";
  } catch (error) {
    if (!isCurrentLoad()) return;
    if (error instanceof ApiError && error.isAuthenticationError) handleLiveFailure(error);
    else state.directConversation.error = safeLiveText(error?.message, "对话暂时无法同步", 160);
  } finally {
    if (isCurrentLoad()) {
      state.directConversation.loading = false;
      const composerHasFocus = document.activeElement?.closest?.("[data-conversation-form]");
      if (composerHasFocus && !state.directConversation.error) {
        updateFocusedConversationMessages();
        document.querySelector(".conversation-loading")?.remove();
      } else {
        render();
      }
    }
  }
}

async function sendDirectConversationMessage(form) {
  const input = form.elements.namedItem("message");
  const text = String(input?.value || "").trim();
  if (!text) {
    input?.setCustomValidity("请输入一句具体的话");
    input?.reportValidity();
    input?.addEventListener("input", () => input.setCustomValidity(""), { once: true });
    return;
  }
  const person = selectedPerson();
  if (!state.live.enabled) {
    const message = {
      id: `demo-message-${Date.now()}`,
      sender_id: "user-zhou",
      type: "TEXT",
      text,
      created_at: new Date().toISOString(),
    };
    const messages = [...(state.directConversation.demoMessages[person.id] || []), message];
    state.directConversation.demoMessages[person.id] = messages;
    state.directConversation.data = {
      ...state.directConversation.data,
      messages,
    };
    state.directConversation.draft = "";
    render();
    return;
  }

  const connectionId = state.directConversation.connectionId;
  if (!connectionId || state.directConversation.sending) return;
  const fallbackUuid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const replaysPendingMessage = state.directConversation.pendingClientMessageId
    && state.directConversation.pendingMessageText === text;
  const clientMessageId = replaysPendingMessage
    ? state.directConversation.pendingClientMessageId
    : `client-${globalThis.crypto?.randomUUID?.() || fallbackUuid}`;
  state.directConversation.pendingClientMessageId = clientMessageId;
  state.directConversation.pendingMessageText = text;
  state.directConversation.sending = true;
  state.directConversation.error = "";
  render();
  try {
    const payload = await api.post(
      `/api/connections/${encodeURIComponent(connectionId)}/messages`,
      { text, client_message_id: clientMessageId },
    );
    if (state.directConversation.connectionId !== connectionId) return;
    const messages = state.directConversation.data?.messages || [];
    if (!messages.some((message) => message.id === payload.message.id)) {
      state.directConversation.data = {
        ...state.directConversation.data,
        messages: [...messages, payload.message],
      };
    }
    state.directConversation.draft = "";
    state.directConversation.pendingClientMessageId = null;
    state.directConversation.pendingMessageText = null;
    await loadDirectConversation({ silent: true });
  } catch (error) {
    if (state.directConversation.connectionId !== connectionId) return;
    if (error instanceof ApiError && error.isAuthenticationError) handleLiveFailure(error);
    else state.directConversation.error = safeLiveText(error?.message, "消息发送失败，可以重试", 160);
  } finally {
    if (state.directConversation.connectionId === connectionId) {
      state.directConversation.sending = false;
      render();
    }
  }
}

async function loadLiveMe({ force = false } = {}) {
  if (!state.live.enabled || state.live.authStatus !== "ready" || state.live.meLoading) return;
  if (state.live.meLoaded && !force) return;
  state.live.meLoading = true;
  state.live.error = "";
  render();
  try {
    const payload = await api.get("/api/me");
    const eventProfile = (payload.profiles || []).find((profile) => profile.event_id === liveConfig.eventId);
    state.live.platformLinks = payload.platform_links || [];
    state.live.currentProfile = eventProfile || null;
    state.visible = eventProfile?.visibility?.state === "VISIBLE";
    state.live.currentUserId = payload.user?.id || null;
    const localAvatar = state.live.currentUserId
      ? localStorage.getItem(`cospan_profile_avatar_${state.live.currentUserId}`)
      : null;
    Object.assign(currentUser, {
      id: String(payload.user?.id || currentUser.id).replace(/^user-/, ""),
      name: safeLiveText(payload.user?.display_name, currentUser.name, 40),
      avatar: /^memoji-(?:[1-9]|1[0-2])$/.test(localAvatar || "")
        ? localAvatar
        : /^memoji-\d+$/.test(payload.user?.avatar || "")
          ? payload.user.avatar
          : currentUser.avatar,
      role: safeLiveText(eventProfile?.role, currentUser.role, 80),
      skills: Array.isArray(eventProfile?.skills) ? eventProfile.skills : currentUser.skills,
    });
    const needsIntroduction = liveProfileNeedsIntroduction(eventProfile);
    state.live.meLoaded = true;
    if (needsIntroduction && !state.onboarding) {
      hydrateOnboardingDraft();
      state.onboarding = true;
      state.onboardingStep = 0;
      state.overlay = null;
    }
    await refreshLiveState();
    startLivePolling();
  } catch (error) {
    state.live.meLoaded = false;
    handleLiveFailure(error, "无法读取当前账号");
  } finally {
    state.live.meLoading = false;
    render();
  }
}

function normalizeConnectionRequest(request) {
  const counterpartPerson = livePerson({
    user_id: request.counterpart?.id,
    display_name: request.counterpart?.display_name,
    avatar: request.counterpart?.avatar,
    role: request.counterpart?.role,
    status: request.counterpart?.status,
  });
  return { ...request, counterpartPerson };
}

async function sendLiveConnectionRequest(person) {
  if (!person?.userId) return;
  try {
    const analyticsAttribution = globalThis.__rallyDiscoveryAttribution?.(person.userId);
    const payload = await runLiveMutation(`connection:${person.userId}`, () => api.post(
      "/api/connections/requests",
      {
        recipient_id: person.userId,
        event_id: liveConfig.eventId,
        source: "link",
        message: "想和你当面聊聊当前的协作方向",
        ...(analyticsAttribution ?? {}),
      },
    ));
    if (payload.connection) showToast(`你和 ${person.name} 已经建联`);
    else showToast(payload.idempotent_replay ? "招呼已存在，等待对方回应" : interestConfirmationCopy());
    await refreshLiveState();
    advanceRecommendation(filterDiscoveryPeople(discoveryPeople()));
  } catch (error) {
    handleLiveFailure(error, "连接请求发送失败");
    showToast(state.live.error);
  }
  render();
}

async function resolveLiveConnectionRequest(requestId, action) {
  if (!requestId || !new Set(["accept", "reject", "cancel", "block"]).has(action)) return;
  if (action === "block" && !window.confirm("拉黑后双方将不能继续发送连接请求，确认拉黑？")) return;
  try {
    await runLiveMutation(`connection-request:${requestId}`, () => api.patch(
      `/api/connections/requests/${encodeURIComponent(requestId)}`,
      { action, ...(action === "block" ? { reason_code: "USER_REQUEST" } : {}) },
    ));
    const labels = { accept: "已接受连接", reject: "已拒绝请求", cancel: "已撤回请求", block: "已拉黑并关闭请求" };
    showToast(labels[action]);
    await refreshLiveState();
  } catch (error) {
    handleLiveFailure(error, "连接状态更新失败");
    showToast(state.live.error);
  }
  render();
}

async function createAndInviteLiveProject(person) {
  try {
    let project = state.live.activeProject;
    let roleNeeds = project?.role_needs || [];
    if (!project) {
      const originConnectionId = state.live.connectionRequests.find((request) => (
        request.status === "ACCEPTED"
        && request.connection_id
        && request.counterpartPerson?.userId === person.userId
      ))?.connection_id;
      const direction = directionAlignmentFor(person.id).draft;
      const hasDirection = direction.audience && direction.problem && direction.outcome;
      const created = await runLiveMutation("project:create", () => api.post("/api/projects", {
        event_id: liveConfig.eventId,
        ...(originConnectionId ? { origin_connection_id: originConnectionId } : {}),
        title: cleanProfileBlockField(direction.projectTitle, 80) || "现场协作项目",
        summary: hasDirection
          ? `为${direction.audience}解决${direction.problem}，验证${direction.outcome}`
          : "把线下讨论自动沉淀为可执行任务",
        role_need: {
          title: person.teamRole || "协作成员",
          skills: person.skills.slice(0, 5),
          capacity: 3,
        },
      }));
      project = { ...created.project, role_needs: created.role_needs };
      roleNeeds = created.role_needs;
    }
    const roleNeed = roleNeeds.find((item) => item.remaining_capacity > 0 && item.status === "OPEN");
    if (!roleNeed) throw new ApiError("当前项目没有可用的入队角色", { status: 409, code: "ROLE_NEED_FILLED" });
    const payload = await runLiveMutation(`team-invitation:${project.id}:${person.userId}`, () => api.post(
      `/api/projects/${encodeURIComponent(project.id)}/invitations`,
      { invitee_id: person.userId, role_need_id: roleNeed.id },
    ));
    state.overlay = "invite-sent";
    writeAppHistory();
    showToast(payload.idempotent_replay ? "入队邀请仍在等待确认" : `已邀请 ${person.name} 加入项目`);
    await refreshLiveState();
  } catch (error) {
    handleLiveFailure(error, "项目邀请发送失败");
    showToast(state.live.error);
  }
  render();
}

async function resolveLiveTeamInvitation(invitationId, action) {
  if (!invitationId || !new Set(["accept", "decline"]).has(action)) return;
  try {
    await runLiveMutation(`team-invitation:${invitationId}`, () => api.patch(
      `/api/team-invitations/${encodeURIComponent(invitationId)}`,
      { action },
    ));
    showToast(action === "accept" ? "已确认入队，人机协作空间正在恢复" : "已拒绝入队邀请");
    await refreshLiveState();
    if (action === "accept") {
      state.tab = "collaboration";
      writeAppHistory();
    }
  } catch (error) {
    handleLiveFailure(error, "入队邀请更新失败");
    showToast(state.live.error);
  }
  render();
}

async function generateLiveStarterPack() {
  const projectId = state.live.activeProject?.id;
  if (!projectId) return;
  try {
    await runLiveMutation(`starter-pack:${projectId}`, () => api.post(
      `/api/projects/${encodeURIComponent(projectId)}/starter-pack`,
      {},
    ));
    showToast("启动计划已生成，等待成员认领与确认");
    await refreshLiveState();
  } catch (error) {
    handleLiveFailure(error, "启动计划生成失败");
    showToast(state.live.error);
  }
}

function liveClientSurface() {
  return window.matchMedia("(min-width: 851px)").matches ? "desktop" : "mobile";
}

async function updateLiveTask(taskId, action) {
  if (!taskId || !new Set(["claim", "start", "complete", "block"]).has(action)) return;
  try {
    await runLiveMutation(`task:${taskId}`, () => api.patch(
      `/api/tasks/${encodeURIComponent(taskId)}`,
      { action },
      { headers: { "x-cospan-surface": liveClientSurface() } },
    ));
    const labels = { claim: "任务已认领", start: "任务已开始", complete: "任务已完成", block: "任务已标记阻塞" };
    showToast(labels[action]);
    await refreshLiveState();
  } catch (error) {
    handleLiveFailure(error, "任务状态更新失败");
    showToast(state.live.error);
  }
}

async function confirmLivePlan() {
  const projectId = state.live.activeProject?.id;
  if (!projectId) return;
  try {
    const payload = await runLiveMutation(`plan-confirmation:${projectId}`, () => api.post(
      `/api/projects/${encodeURIComponent(projectId)}/plan-confirmations`,
      {},
      { headers: { "x-cospan-surface": liveClientSurface() } },
    ));
    showToast(payload.starter_pack.status === "CONFIRMED" ? "全员已确认当前计划" : "已记录你的确认，等待其他成员");
    await refreshLiveState();
  } catch (error) {
    handleLiveFailure(error, "计划确认失败");
    showToast(state.live.error);
  }
}

function normalizeTeamInvitation(invitation) {
  return {
    ...invitation,
    counterpartPerson: livePerson({
      user_id: invitation.counterpart?.id,
      display_name: invitation.counterpart?.display_name,
      avatar: invitation.counterpart?.avatar,
      role: invitation.role_need?.title,
      status: invitation.status === "PENDING" ? "等待入队确认" : "项目成员",
    }),
  };
}

function localPersonId(userId) {
  return String(userId || "").replace(/^user-/, "");
}

async function refreshLiveState() {
  if (!state.live.enabled || !state.live.meLoaded || state.live.syncInFlight) return;
  state.live.syncInFlight = true;
  try {
    const eventId = encodeURIComponent(liveConfig.eventId);
    const [discover, incoming, outgoing, incomingInvitations, outgoingInvitations, projects] = await Promise.all([
      api.get(`/api/events/${eventId}/discover`),
      api.get(`/api/connections/requests?event_id=${eventId}&direction=incoming`),
      api.get(`/api/connections/requests?event_id=${eventId}&direction=outgoing`),
      api.get(`/api/team-invitations?event_id=${eventId}&direction=incoming`),
      api.get(`/api/team-invitations?event_id=${eventId}&direction=outgoing`),
      api.get(`/api/projects?event_id=${eventId}`),
    ]);
    state.live.discover = (discover.people || []).map(livePerson);
    state.live.connectionRequests = [
      ...(incoming.requests || []).map(normalizeConnectionRequest),
      ...(outgoing.requests || []).map(normalizeConnectionRequest),
    ];
    state.live.teamInvitations = [
      ...(incomingInvitations.invitations || []),
      ...(outgoingInvitations.invitations || []),
    ].map(normalizeTeamInvitation);
    state.live.projects = projects.projects || [];
    state.live.activeProject = state.live.projects[0] || null;
    const connectedIds = state.live.connectionRequests
      .filter((item) => item.status === "ACCEPTED" && item.connection_id)
      .map((item) => item.counterpartPerson.id);
    const pendingIds = state.live.connectionRequests
      .filter((item) => item.status === "REQUESTED" && item.direction === "outgoing")
      .map((item) => item.counterpartPerson.id);
    state.connected = [...new Set(connectedIds)];
    state.greeted = [...new Set([...connectedIds, ...pendingIds])];
    state.invited = state.live.teamInvitations
      .filter((item) => item.status === "PENDING" && item.direction === "outgoing")
      .map((item) => item.counterpartPerson.id);
    state.joined = state.live.activeProject
      ? state.live.activeProject.members
        .filter((member) => member.user_id !== state.live.currentUserId)
        .map((member) => localPersonId(member.user_id))
      : [];
    if (state.live.activeProject) {
      const room = await api.get(`/api/projects/${encodeURIComponent(state.live.activeProject.id)}/room`);
      state.live.room = room;
    } else {
      state.live.room = null;
    }
    if (!livePeople().some((person) => person.id === state.selectedId)) {
      state.selectedId = state.live.discover[0]?.id || livePeople()[0]?.id || "";
    }
    state.live.syncError = "";
  } catch (error) {
    if (error instanceof ApiError && error.isAuthenticationError) handleLiveFailure(error);
    else state.live.syncError = safeLiveText(error?.message, "同步暂时中断", 160);
  } finally {
    state.live.syncInFlight = false;
    const composerHasFocus = state.overlay === "conversation"
      && document.activeElement?.closest?.("[data-conversation-form]");
    if (!composerHasFocus) render();
  }
}

let livePollTimer = null;
function startLivePolling() {
  if (livePollTimer || !state.live.meLoaded) return;
  livePollTimer = window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (state.overlay === "conversation" && state.directConversation.connectionId) {
      loadDirectConversation({ silent: true });
    } else {
      refreshLiveState();
    }
  }, 2500);
}

function stopLivePolling() {
  if (livePollTimer) window.clearInterval(livePollTimer);
  livePollTimer = null;
}

async function updateLiveVisibility(nextVisible) {
  try {
    const payload = await runLiveMutation("visibility", () => api.patch(
      `/api/events/${encodeURIComponent(liveConfig.eventId)}/visibility`,
      { state: nextVisible ? "VISIBLE" : "PAUSED" },
    ));
    state.visible = payload.visibility?.state === "VISIBLE";
    showToast(state.visible ? visibilityRestoredMessage() : "已暂停附近展示");
  } catch (error) {
    handleLiveFailure(error, "公开状态更新失败");
    showToast(state.live.error);
  }
  render();
}

async function connectPlatform(platform, suppliedUrl = "") {
  const item = platformCatalog[platform];
  if (!item) return;
  const url = suppliedUrl.trim();
  if (!url) {
    showToast(`请先粘贴${item.label}公开链接`);
    render();
    return;
  }
  state.platformDrafts[platform] = url;
  if (!state.live.enabled) {
    showToast("当前是静态演示；开启 Live 模式后即可保存真实链接");
    render();
    return;
  }
  try {
    const payload = await runLiveMutation(`platform:${platform}`, () => api.put(
      `/api/me/platform-links/${encodeURIComponent(platform)}`,
      { url },
    ));
    state.live.platformLinks = [
      ...state.live.platformLinks.filter((link) => link.platform !== platform),
      payload.platform_link,
    ];
    delete state.platformDrafts[platform];
    showToast(
      payload.platform_link.verification_state === "PUBLIC_API_SYNCED"
        ? `${item.label}公开资料已同步`
        : `${item.label}链接已保存，未标记为平台验证`,
    );
  } catch (error) {
    handleLiveFailure(error, "链接绑定失败");
    showToast(state.live.error);
  }
  render();
}

async function disconnectPlatform(platform) {
  const item = platformCatalog[platform];
  if (!item || !state.live.enabled) return;
  if (!window.confirm(`移除${item.label}链接？这不会删除平台上的任何内容。`)) return;
  try {
    await runLiveMutation(`platform:${platform}`, () => api.delete(
      `/api/me/platform-links/${encodeURIComponent(platform)}`,
    ));
    state.live.platformLinks = state.live.platformLinks.filter((link) => link.platform !== platform);
    delete state.platformDrafts[platform];
    showToast(`${item.label}链接已移除`);
  } catch (error) {
    handleLiveFailure(error, "链接移除失败");
    showToast(state.live.error);
  }
  render();
}

async function publishLivePosition(position, generation = state.live.presenceGeneration) {
  if (!state.live.started || generation !== state.live.presenceGeneration) return;
  if (state.live.requestInFlight) return;
  state.live.requestInFlight = true;
  const controller = new AbortController();
  state.live.presenceController = controller;
  try {
    await api.put(
      `/api/events/${encodeURIComponent(liveConfig.eventId)}/presence`,
      {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
      },
      { signal: controller.signal },
    );
    if (!state.live.started || generation !== state.live.presenceGeneration) {
      await api.delete(`/api/events/${encodeURIComponent(liveConfig.eventId)}/presence`, {
        keepalive: true,
      });
      return;
    }
    const payload = await api.get(
      `/api/events/${encodeURIComponent(liveConfig.eventId)}/nearby`,
    );
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
    if (error?.name === "AbortError") return;
    if (error instanceof ApiError && error.isAuthenticationError) handleLiveFailure(error);
    state.live.status = "error";
    state.live.error = safeLiveText(error.message, "真实定位暂不可用", 160);
    state.live.nearby = [];
  } finally {
    if (state.live.presenceController === controller) state.live.presenceController = null;
    state.live.requestInFlight = false;
    render();
  }
}

function startLivePresence() {
  if (state.live.started) return;
  state.live.started = true;
  state.live.presenceGeneration += 1;
  const generation = state.live.presenceGeneration;
  state.live.status = "requesting";
  if (!navigator.geolocation) {
    state.live.status = "error";
    state.live.error = "当前浏览器不支持定位";
    render();
    return;
  }
  state.live.watcherId = navigator.geolocation.watchPosition(
    (position) => publishLivePosition(position, generation),
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
  state.live.presenceGeneration += 1;
  state.live.presenceController?.abort();
  state.live.presenceController = null;
  state.live.watcherId = null;
  state.live.status = "idle";
  state.live.nearby = [];
  api.delete(`/api/events/${encodeURIComponent(liveConfig.eventId)}/presence`, {
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

window.addEventListener("pagehide", () => {
  disposeSwipeAudio();
  stopLivePolling();
  stopLivePresence();
});

window.addEventListener("beforeunload", () => {
  disposeSwipeAudio();
  stopLivePolling();
  stopLivePresence();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshLiveState();
    syncLivePresenceLifecycle();
  } else {
    suspendSwipeAudio();
    stopLivePresence();
  }
});

initializeLiveAuthentication();
