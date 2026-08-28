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

const variantNames = {
  A: "发现 · 推荐",
  B: "发现 · 附近",
  C: "发现 · 名册",
};

const startsInOnboarding = new URLSearchParams(location.search).get("onboarding") === "1";

const state = {
  variant: readVariant(),
  onboarding: startsInOnboarding,
  onboardingStep: 0,
  collaborationStatus: "TEAM_RECRUITING",
  connectedSources: ["GitHub"],
  previewMode: "mobile",
  draftVersion: 0,
  recommendationIndex: 0,
  tab: "discover",
  selectedId: "lin",
  visible: !startsInOnboarding,
  stage: "browse",
  greeted: [],
  connected: [],
  invited: [],
  joined: [],
  acceptedTasks: [],
  toast: "",
  overlay: null,
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
  return people.find((person) => person.id === state.selectedId) || people[0];
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
  const phone = `
    <main class="prototype-stage">
      <section class="phone-shell" aria-label="即碰即协作手机端原型">
        <div class="phone-status"><span>09:41</span><span class="phone-island"></span><span>5G&nbsp;&nbsp;●</span></div>
        <div class="screen">
          ${state.onboarding ? renderOnboarding() : renderCurrentView()}
        </div>
        ${state.onboarding ? "" : renderAppNav()}
      </section>
      <aside class="prototype-notes">
        <p class="eyebrow">${state.onboarding ? "PASSPORT ASSEMBLY / 01" : `MOBILE PROTOTYPE / ${state.variant}`}</p>
        <h1>${state.onboarding ? "协作护照引导" : variantNames[state.variant]}</h1>
        <p>${state.onboarding ? "借鉴 Bonjour 的低负担资料搭建方式，但把流程重心改成当下协作意图、能力证据和用户授权。" : variantDescription()}</p>
        ${renderStateLedger()}
      </aside>
    </main>
  `;

  app.innerHTML = `${phone}${renderOverlay()}${renderToast()}`;
  bindEvents();
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
  if (state.tab === "projects") return renderProjects();
  if (state.tab === "profile") return renderProfile();
  if (state.variant === "B") return renderVariantB();
  if (state.variant === "C") return renderVariantC();
  return renderVariantA();
}

function commonHeader(title = "发现") {
  return `
    <header class="app-header">
      <h2>${title}</h2>
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
  const person = recommendedPerson();
  const nextPerson = rankedPeople[(state.recommendationIndex + 1) % rankedPeople.length];
  return `
    <div class="view view-a">
      ${commonHeader("发现")}
      ${renderDiscoveryTabs()}
      <section class="recommendation-intro">
        <div><span>为你的项目推荐</span><strong>${collaborationNeedLabel()}</strong></div>
        <em>${state.recommendationIndex + 1} / ${rankedPeople.length}</em>
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
        ${rankedPeople.map((item, index) => `<i class="${index === state.recommendationIndex ? "active" : ""}" title="${item.name}"></i>`).join("")}
      </section>
      <section class="recommendation-boundary">
        <span>线上只表达意愿</span>
        <p>线下碰卡后才会直接交换双方授权信息并建联。</p>
      </section>
    </div>
  `;
}

function recommendedPerson() {
  return rankedPeople[state.recommendationIndex % rankedPeople.length];
}

function advanceRecommendation() {
  state.recommendationIndex = (state.recommendationIndex + 1) % rankedPeople.length;
  state.selectedId = recommendedPerson().id;
}

function expressRecommendationInterest(personId) {
  const person = people.find((item) => item.id === personId) || recommendedPerson();
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
  const person = selectedPerson();
  return `
    <div class="view view-b">
      ${commonHeader("发现")}
      ${renderDiscoveryTabs()}
      <div class="mobile-discovery-note"><span>● 手机前台发现</span><small>仅在打开本页时更新，离开后停止</small></div>
      <section class="radar-copy">
        <span class="status-pill ${state.visible ? "status-open" : "status-paused"}"><i></i>${state.visible ? "附近可见" : "已暂停展示"}</span>
        <h3>附近有 ${radarPeople.length} 位协作者</h3>
        <p>已根据你正在补齐的能力排序。点击头像，看看为什么值得聊。</p>
      </section>
      <section class="radar-field" aria-label="附近人员扫描区">
        <div class="radar-sweep"></div>
        <button class="radar-self" data-tab="profile" aria-label="打开我的身份">${glyph(currentUser, "sm")}</button>
        ${radarPeople.map((item, index) => `
          <button class="radar-person ${state.selectedId === item.id ? "active" : ""}" style="${radarPosition(index, radarPeople.length)}" data-person="${item.id}" aria-label="选择 ${item.name}">
            ${glyph(item, "sm")}
            <span class="radar-person-name">${item.name}</span>
          </button>
        `).join("")}
      </section>
      <section class="radar-ticket">
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
      </section>
    </div>
  `;
}

function renderVariantC() {
  return `
    <div class="view view-c">
      ${commonHeader("发现")}
      ${renderDiscoveryTabs()}
      <section class="directory-copy"><span class="status-pill status-open"><i></i>本场活动</span><h3>活动名册</h3><p>查看明确授权参加当前活动的成员，名册仍属于你手机上的发现页。</p></section>
      <section class="ledger-status">
        <div><span>可见成员</span><strong>${String(people.length).padStart(2, "0")} 人</strong></div>
        <div><span>当前筛选</span><strong>全部角色</strong></div>
        <div><span>排序方式</span><strong>项目缺口</strong></div>
      </section>
      <div class="ledger-rule"><span>按当前缺口优先</span><b>EVENT DIRECTORY</b></div>
      <section class="ledger-list">
        ${people.map((person) => `
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
  return `
    <div class="view utility-view">
      ${commonHeader("连接")}
      <section class="connection-hero">
        <div class="connection-summary"><strong>${connectedPeople.length}</strong><span>位已建联</span>${pendingPeople.length ? `<em>${pendingPeople.length} 个待回应</em>` : ""}</div>
        <p>${connectedPeople.length ? "认识原因、碰卡来源和后续项目都会保存在这里。" : "线上表达想认识，或在见面后直接碰卡建联。"}</p>
      </section>
      <div class="filter-row"><button class="active">全部</button><button>待回应</button><button>已建联</button></div>
      <section class="connection-list">
        ${connectedPeople.length ? connectedPeople.map((person) => `
          <article class="connection-card">
            <div class="connection-card-head">${glyph(person, "md")}<div><h4>${person.name}</h4><p>${person.role}</p></div><span class="source-chip">碰卡建联</span></div>
            <div class="connection-context"><span>认识于</span><strong>AI Hardware Hackathon</strong><small>刚刚 · ${person.pairLabel}</small></div>
            <button class="primary-button full" data-tab="projects">查看共同项目</button>
          </article>
        `).join("") : `
          <div class="empty-state"><span class="empty-symbol">◎</span><h4>还没有正式连接</h4><p>你可以先在线表达“想认识”，也可以在现实交流后直接碰卡建联。</p><button class="primary-button" data-tab="discover">去发现</button></div>
        `}
        ${pendingPeople.map((person) => `<article class="pending-row">${glyph(person, "sm")}<div><strong>${person.name}</strong><span>招呼已发出 · 等待见面</span></div><em>待回应</em></article>`).join("")}
      </section>
    </div>
  `;
}

function renderProjects() {
  const joinedPeople = people.filter((person) => state.joined.includes(person.id));
  const joined = joinedPeople.length > 0;
  const latestMember = joinedPeople.at(-1);
  const taskAccepted = state.acceptedTasks.includes("hardware-choice");
  return `
    <div class="view utility-view">
      ${commonHeader("项目")}
      <section class="project-card">
        <div class="project-kicker"><span>PROJECT 01</span><em>${2 + joinedPeople.length} 人协作</em></div>
        <h3>离线会议洞察终端</h3>
        <p>让线下讨论自动沉淀为可检索的决策、分歧与行动项。</p>
        <div class="team-line">
          <span class="team-avatar">${currentUser.monogram}</span><span class="team-avatar">YK</span>${joined ? joinedPeople.map((person) => `<span class="team-avatar new" title="${person.name} · ${person.teamRole}">${person.monogram}</span>`).join("") : `<span class="team-gap">＋ 待补位</span>`}
        </div>
      </section>
      ${joined ? `
        <section class="launch-pack">
          <div class="section-heading"><div><p class="micro-label">AI LAUNCH PACK</p><h3>把关系变成第一步</h3></div><span class="ai-badge">AI 建议</span></div>
          <div class="role-coverage"><span>角色覆盖</span><div><b>AI / 后端</b><b>产品</b>${joinedPeople.map((person) => `<b class="new-role">${person.teamRole}</b>`).join("")}<i>按项目缺口继续补位</i></div></div>
          <article class="risk-note"><strong>需要先确认</strong><p>${latestMember.name}：${latestMember.caution}。</p></article>
          <div class="task-list">
            ${renderTask("hardware-choice", `确认${latestMember.teamRole}交付边界`, latestMember.name, taskAccepted)}
            ${renderTask("data-link", "定义端侧数据上报接口", "周闻", state.acceptedTasks.includes("data-link"))}
            ${renderTask("demo-check", "冻结 90 秒演示验收脚本", "全员", state.acceptedTasks.includes("demo-check"))}
          </div>
        </section>
      ` : `
        <section class="project-empty"><p class="micro-label">OPEN ROLE</p><h3>还缺一名硬件构建者</h3><p>完成一次线下建联后，可以从连接中邀请对方加入。</p><button class="primary-button full" data-tab="discover">寻找附近的人</button></section>
      `}
    </div>
  `;
}

function renderTask(id, title, owner, accepted) {
  return `<button class="task-item ${accepted ? "accepted" : ""}" data-task="${id}"><span>${accepted ? "✓" : "○"}</span><div><strong>${title}</strong><small>建议负责人：${owner}</small></div><em>${accepted ? "已接受" : "接受"}</em></button>`;
}

function renderProfile() {
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
      <section class="profile-fields"><button data-action="restart-onboarding"><span>重新组装协作护照</span><b>4 步 ›</b></button><button><span>能力与项目证据</span><b>5 项 ›</b></button><button><span>设备与隐私</span><b>已连接 ›</b></button></section>
    </div>
  `;
}

function renderAppNav() {
  const items = [
    ["discover", "⌁", "发现"],
    ["connections", "◎", "连接"],
    ["projects", "▱", "项目"],
    ["profile", "◉", "我的"],
  ];
  return `<nav class="app-nav">${items.map(([id, icon, label]) => `<button class="${state.tab === id ? "active" : ""}" data-tab="${id}"><span>${icon}</span><small>${label}</small>${id === "connections" && state.connected.length ? `<i>${state.connected.length}</i>` : ""}</button>`).join("")}</nav>`;
}

function renderOverlay() {
  if (!state.overlay) return "";
  const person = selectedPerson();
  if (state.overlay === "person") {
    const greeted = state.greeted.includes(person.id);
    return `<div class="overlay"><button class="overlay-backdrop" data-action="close-overlay" aria-label="关闭"></button><section class="bottom-sheet person-sheet">
      <div class="sheet-handle"></div>
      <div class="person-sheet-head">${glyph(person, "lg")}<div><span class="status-pill">${person.status}</span><h3>${person.name}</h3><p>${person.role} · ${person.proximity}</p></div><strong class="large-fit">${person.fit}<small>${person.fitDetail}</small></strong></div>
      <div class="skill-line">${person.skills.map((skill) => `<span>${skill}</span>`).join("")}</div>
      <article class="ai-reason"><p class="micro-label">WHY THIS PERSON</p><h4>为什么值得当面认识</h4><p>${person.reason}</p><div><span>项目证据</span><strong>${person.evidence}</strong></div><div class="caution"><span>先确认</span><strong>${person.caution}</strong></div></article>
      <div class="sheet-actions"><button class="secondary-button" data-action="greet" data-person="${person.id}">${greeted ? "已表达想认识" : "想认识"}</button><button class="primary-button" data-action="direct-tap" data-person="${person.id}">模拟碰卡直连</button></div>
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
      <button class="primary-button full" data-action="view-project">查看 AI 启动包</button>
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
      render();
    });
  });
  document.querySelectorAll("[data-tab]").forEach((element) => element.addEventListener("click", () => {
    state.tab = element.dataset.tab;
    state.overlay = null;
    render();
  }));
  document.querySelectorAll("[data-action]").forEach((element) => element.addEventListener("click", () => handleAction(element.dataset.action, element)));
  document.querySelectorAll("[data-task]").forEach((element) => element.addEventListener("click", () => toggleTask(element.dataset.task)));
  document.querySelectorAll("[data-discovery-view]").forEach((element) => element.addEventListener("click", () => setVariant(element.dataset.discoveryView)));
  bindRecommendationSwipe();
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
  }
  if (action === "dismiss-recommendation") dismissRecommendation();
  if (action === "like-recommendation") expressRecommendationInterest(element.dataset.person);
  if (action === "next-person") {
    const pool = state.variant === "B" ? radarPeople : people;
    const index = pool.findIndex((person) => person.id === state.selectedId);
    state.selectedId = pool[(Math.max(index, 0) + 1) % pool.length].id;
  }
  if (action === "refresh") showToast(`已读取附近 ${people.length} 个协作信号`);
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
  if (action === "view-connection") {
    state.overlay = null;
    state.tab = "connections";
  }
  if (action === "view-project") {
    state.overlay = null;
    state.tab = "projects";
  }
  if (action === "toggle-visible") {
    state.visible = !state.visible;
    showToast(state.visible ? "已恢复活动内可见" : "已暂停附近展示");
  }
  if (action === "sync-card") showToast("原型：公开字段编辑器将在下一轮接入");
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
