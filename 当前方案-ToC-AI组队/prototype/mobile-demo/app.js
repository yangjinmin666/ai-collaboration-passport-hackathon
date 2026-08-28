/*
 * PROTOTYPE — throwaway mobile UI.
 * Three variants of the nearby-discovery experience, switchable via ?variant=.
 */

const people = [
  {
    id: "lin",
    name: "林澈",
    monogram: "LC",
    role: "硬件构建者",
    skills: ["嵌入式", "IoT", "结构打样"],
    status: "未组队",
    proximity: "很近",
    signal: 3,
    fit: 92,
    glyph: "glyph-orbit",
    evidence: "做过 3 个 ESP32 端侧项目",
    reason: "你的项目缺硬件闭环；林澈能把模型能力落到真实设备。",
    caution: "现场可投入时间还没有确认",
  },
  {
    id: "su",
    name: "苏晴",
    monogram: "SQ",
    role: "交互设计师",
    skills: ["交互", "视觉", "路演"],
    status: "可交流",
    proximity: "附近",
    signal: 2,
    fit: 84,
    glyph: "glyph-grid",
    evidence: "两次黑客松最佳设计奖",
    reason: "她能补齐产品表达和现场演示，让技术原型更容易被理解。",
    caution: "目前优先寻找有社会议题的项目",
  },
  {
    id: "alan",
    name: "阿岚",
    monogram: "AL",
    role: "产品发起人",
    skills: ["产品", "用户研究", "商业"],
    status: "团队招人",
    proximity: "同场",
    signal: 1,
    fit: 76,
    glyph: "glyph-cross",
    evidence: "从 0 到 1 做过开发者社区",
    reason: "你们对开发者协作有共同兴趣，适合交换用户验证方法。",
    caution: "双方项目方向暂时不同",
  },
];

const variantNames = {
  A: "协作护照",
  B: "邻近雷达",
  C: "墨水名册",
};

const state = {
  variant: readVariant(),
  onboarding: new URLSearchParams(location.search).get("onboarding") === "1",
  onboardingStep: 0,
  collaborationStatus: "TEAM_RECRUITING",
  connectedSources: ["GitHub"],
  previewMode: "mobile",
  tab: "discover",
  selectedId: "lin",
  visible: true,
  stage: "browse",
  greeted: [],
  connected: [],
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

function cycleVariant(direction) {
  const keys = ["A", "B", "C"];
  const index = keys.indexOf(state.variant);
  setVariant(keys[(index + direction + keys.length) % keys.length]);
}

function selectedPerson() {
  return people.find((person) => person.id === state.selectedId) || people[0];
}

function glyph(person, size = "md") {
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
      <section class="phone-shell" aria-label="AI 协作护照手机端原型">
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

  app.innerHTML = `${phone}${renderOverlay()}${renderToast()}${renderSwitcher()}`;
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
  return `<div class="onboarding-step">
    ${onboardingGuide("AI DRAFT / REVIEW", "这是草稿，不是 AI 对你的定义。", "我们把证据、Now Building 和当前需求拼成协作护照；你决定哪些内容对外出现。")}
    <section class="draft-passport">
      <div class="draft-head"><span class="draft-avatar">ZW</span><div><h3>周闻</h3><p>AI / 后端构建者</p></div><button data-action="draft-refresh">重组</button></div>
      <div class="draft-section"><span>NOW BUILDING</span><strong>离线会议洞察终端</strong><small>Agent 将现场对话转成可执行决策</small></div>
      <div class="draft-section"><span>能力证据</span><div class="draft-tags"><b>Agent</b><b>API</b><b>端侧 AI</b><b>GitHub 已连接</b></div></div>
      <div class="draft-section"><span>当前协作状态</span><strong>${collaborationStatusLabel()}</strong><small>正在寻找：硬件构建者 × 1</small></div>
      <div class="draft-section vibe-section"><span>BUILDER'S VIBE</span><p>先跑通真实闭环，再把系统做漂亮；喜欢和能快速落地的人一起工作。</p></div>
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
  if (state.previewMode === "eink") return `<div class="onboarding-eink"><div><span>● 团队补位中</span><em>至 22:00</em></div><h3>周闻 / ZW</h3><p>AI · 后端 · Agent</p><section><span>当前缺口</span><strong>硬件构建者 × 1</strong></section><footer><b>碰卡直接建联</b><span>P·0087</span></footer></div>`;
  if (state.previewMode === "passport") return `<article class="onboarding-full-passport"><header><span class="draft-avatar">ZW</span><div><h3>周闻</h3><p>AI / 后端构建者</p></div></header><p class="passport-vibe">“先跑通真实闭环，再把系统做漂亮。”</p><div><span>NOW BUILDING</span><strong>离线会议洞察终端</strong></div><div><span>项目证据</span><strong>GitHub · 7 commits this week</strong></div><div><span>正在寻找</span><strong>硬件构建者 × 1</strong></div></article>`;
  return `<article class="onboarding-discovery-card"><div class="discovery-card-meta"><span>团队补位中</span><em>同场</em></div><h3>周闻</h3><p>AI / 后端构建者</p><div class="draft-tags"><b>Agent</b><b>API</b><b>端侧 AI</b></div><section><span>为什么值得认识</span><strong>正在为真实设备寻找硬件闭环能力</strong><small>需要确认：今天可投入时间</small></section></article>`;
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
      <div>
        <p class="micro-label">2026 AI HARDWARE HACKATHON</p>
        <h2>${title}</h2>
      </div>
      <button class="mini-avatar" data-tab="profile" aria-label="打开我的身份">ZW</button>
    </header>
  `;
}

function renderVariantA() {
  const visibilityLabel = state.visible ? "活动内可见" : "已暂停展示";
  return `
    <div class="view view-a">
      ${commonHeader("协作护照")}
      <section class="my-passport">
        <div class="passport-topline">
          <span class="status-pill ${state.visible ? "status-open" : "status-paused"}"><i></i>${visibilityLabel}</span>
          <span class="passport-id">P·0087</span>
        </div>
        <div class="passport-main">
          ${glyph({ monogram: "ZW", glyph: "glyph-sun" }, "lg")}
          <div>
            <p class="passport-name">周闻</p>
            <p class="passport-role">AI / 后端构建者</p>
            <div class="passport-tags"><span>Agent</span><span>API</span><span>端侧 AI</span></div>
          </div>
        </div>
        <div class="passport-mission">
          <span>我的项目正在寻找</span>
          <strong>硬件构建者 × 1</strong>
        </div>
        <button class="passport-sync" data-tab="profile"><span>墨水屏已同步</span><b>查看公开面</b></button>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div><p class="micro-label">NEARBY / 04</p><h3>附近的互补搭档</h3></div>
          <button class="text-action" data-action="refresh">重新扫描</button>
        </div>
        <div class="people-stack">
          ${people.map(renderPassportPerson).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderPassportPerson(person, index) {
  return `
    <button class="person-row ${state.selectedId === person.id ? "selected" : ""}" data-person="${person.id}">
      <span class="row-index">0${index + 1}</span>
      ${glyph(person, "sm")}
      <span class="person-copy">
        <span class="person-title"><strong>${person.name}</strong><em>${person.proximity}</em></span>
        <span>${person.role} · ${person.status}</span>
        <span class="reason-preview">${person.reason}</span>
      </span>
      <span class="fit-mark"><strong>${person.fit}</strong><small>匹配</small></span>
    </button>
  `;
}

function renderVariantB() {
  const person = selectedPerson();
  return `
    <div class="view view-b">
      ${commonHeader("邻近雷达")}
      <section class="radar-copy">
        <span class="status-pill ${state.visible ? "status-open" : "status-paused"}"><i></i>${state.visible ? "附近可见" : "已暂停展示"}</span>
        <h3>你缺的能力，<br>现在就在同一个房间。</h3>
        <p>根据项目缺口和现场信号，优先显示 3 位值得当面认识的人。</p>
      </section>
      <section class="radar-field" aria-label="附近人员雷达">
        <div class="radar-ring ring-one"></div><div class="radar-ring ring-two"></div><div class="radar-ring ring-three"></div>
        <div class="radar-sweep"></div>
        <button class="radar-self" data-tab="profile">ZW</button>
        ${people.map((item, index) => `
          <button class="radar-person radar-person-${index + 1} ${state.selectedId === item.id ? "active" : ""}" data-person="${item.id}" aria-label="选择 ${item.name}">
            ${glyph(item, index === 0 ? "md" : "sm")}
            <span>${item.name}</span>
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
      <header class="ledger-header">
        <div><p>AI COLLABORATION REGISTER</p><h2>附近名册</h2></div>
        <button class="ledger-id" data-tab="profile">ZW / 0087</button>
      </header>
      <section class="ledger-status">
        <div><span>公开状态</span><strong>${state.visible ? "团队招人" : "已暂停"}</strong></div>
        <div><span>当前缺口</span><strong>硬件 × 1</strong></div>
        <div><span>扫描范围</span><strong>同场 / 04</strong></div>
      </section>
      <div class="ledger-rule"><span>按互补度排序</span><b>LIVE REGISTER</b></div>
      <section class="ledger-list">
        ${people.map((person, index) => `
          <button class="ledger-person" data-person="${person.id}">
            <span class="ledger-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="ledger-main">
              <span class="ledger-name">${person.name}<em>${person.status}</em></span>
              <span>${person.skills.join(" / ")}</span>
              <span class="ledger-reason">${person.reason}</span>
            </span>
            <span class="ledger-fit">${person.fit}<small>/100</small></span>
          </button>
        `).join("")}
      </section>
      <button class="ledger-scan" data-action="refresh"><span>◉</span>重新读取附近信号</button>
      <div class="connection-stamp ${state.connected.length ? "is-stamped" : ""}">
        <span>${state.connected.length ? "CONNECTED" : "READY TO CONNECT"}</span>
        <b>${state.connected.length ? "AI × HARDWARE" : "PHYSICAL HANDSHAKE"}</b>
      </div>
    </div>
  `;
}

function renderConnections() {
  const lin = people[0];
  return `
    <div class="view utility-view">
      ${commonHeader("连接")}
      <section class="connection-hero">
        <p class="micro-label">RELATIONSHIP GRAPH</p>
        <h3>${state.connected.length ? "一次碰触，已经有了下一步。" : "真正的连接需要双方确认。"}</h3>
        <p>${state.connected.length ? "关系来源、匹配理由和后续项目会被一起保存。" : "向附近的人打招呼，见面后通过 AI Passport 完成建联。"}</p>
      </section>
      <div class="filter-row"><button class="active">全部</button><button>待回应</button><button>已建联</button></div>
      <section class="connection-list">
        ${state.connected.includes("lin") ? `
          <article class="connection-card">
            <div class="connection-card-head">${glyph(lin, "md")}<div><h4>${lin.name}</h4><p>${lin.role}</p></div><span class="source-chip">碰卡建联</span></div>
            <div class="connection-context"><span>认识于</span><strong>AI Hardware Hackathon</strong><small>刚刚 · 互补：AI × Hardware</small></div>
            <button class="primary-button full" data-tab="projects">查看共同项目</button>
          </article>
        ` : `
          <div class="empty-state"><span class="empty-symbol">◎</span><h4>还没有正式连接</h4><p>先发现附近的人，打招呼后在线下完成一次双方确认。</p><button class="primary-button" data-tab="discover">去发现</button></div>
        `}
        ${state.greeted.includes("su") && !state.connected.includes("su") ? `<article class="pending-row">${glyph(people[1], "sm")}<div><strong>苏晴</strong><span>招呼已发出 · 等待见面</span></div><em>待回应</em></article>` : ""}
      </section>
    </div>
  `;
}

function renderProjects() {
  const joined = state.joined.includes("lin");
  const taskAccepted = state.acceptedTasks.includes("hardware-choice");
  return `
    <div class="view utility-view">
      ${commonHeader("项目")}
      <section class="project-card">
        <div class="project-kicker"><span>PROJECT 01</span><em>${joined ? "3 / 4 人" : "2 / 4 人"}</em></div>
        <h3>离线会议洞察终端</h3>
        <p>让线下讨论自动沉淀为可检索的决策、分歧与行动项。</p>
        <div class="team-line">
          <span class="team-avatar">ZW</span><span class="team-avatar">YK</span>${joined ? `<span class="team-avatar new">LC</span>` : `<span class="team-gap">＋ 硬件</span>`}
        </div>
      </section>
      ${joined ? `
        <section class="launch-pack">
          <div class="section-heading"><div><p class="micro-label">AI LAUNCH PACK</p><h3>把关系变成第一步</h3></div><span class="ai-badge">AI 建议</span></div>
          <div class="role-coverage"><span>角色覆盖</span><div><b>AI / 后端</b><b>产品</b><b class="new-role">硬件</b><i>设计待补</i></div></div>
          <article class="risk-note"><strong>需要先确认</strong><p>林澈今天可投入 6 小时，建议把硬件闭环缩成一台可演示设备。</p></article>
          <div class="task-list">
            ${renderTask("hardware-choice", "确定传感器与主控选型", "林澈", taskAccepted)}
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
      ${commonHeader("我的协作身份")}
      <section class="profile-intro">
        ${glyph({ monogram: "ZW", glyph: "glyph-sun" }, "xl")}
        <div><h3>周闻</h3><p>AI / 后端构建者</p><span class="passport-id">PASSPORT P·0087</span></div>
      </section>
      <section class="visibility-panel">
        <div><p class="micro-label">DISCOVERABILITY</p><h3>${state.visible ? "活动内可见" : "已暂停展示"}</h3><p>只展示你主动选择的公开字段，活动结束后自动隐藏。</p></div>
        <button class="toggle ${state.visible ? "on" : ""}" data-action="toggle-visible" aria-pressed="${state.visible}"><i></i></button>
      </section>
      <section class="device-preview">
        <div class="device-preview-head"><div><p class="micro-label">AI PASSPORT / E-INK</p><h3>墨水屏公开面</h3></div><span class="sync-chip">● 已同步</span></div>
        <div class="eink-card ${state.visible ? "" : "is-hidden"}">
          <div class="eink-top"><span>${state.visible ? "● 团队招人" : "○ 已暂停"}</span><em>87%</em></div>
          <div class="eink-identity"><span class="eink-glyph">ZW</span><div><strong>周闻</strong><small>AI / 后端 / Agent</small></div></div>
          <div class="eink-need"><span>正在寻找</span><b>硬件构建者 × 1</b></div>
          <div class="fake-qr" aria-label="二维码预览">${Array.from({ length: 36 }, (_, i) => `<i class="${[0,1,2,5,6,7,8,11,12,13,17,18,19,22,24,25,29,30,31,34,35].includes(i) ? "black" : ""}"></i>`).join("")}</div>
          <p>碰我建联 · P0087</p>
        </div>
        <button class="secondary-button full" data-action="sync-card">编辑卡片公开内容</button>
      </section>
      <section class="profile-fields"><button><span>能力与项目证据</span><b>5 项 ›</b></button><button><span>设备与隐私</span><b>已连接 ›</b></button></section>
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
      <div class="person-sheet-head">${glyph(person, "lg")}<div><span class="status-pill">${person.status}</span><h3>${person.name}</h3><p>${person.role} · ${person.proximity}</p></div><strong class="large-fit">${person.fit}<small>匹配</small></strong></div>
      <div class="skill-line">${person.skills.map((skill) => `<span>${skill}</span>`).join("")}</div>
      <article class="ai-reason"><p class="micro-label">WHY THIS PERSON</p><h4>为什么值得当面认识</h4><p>${person.reason}</p><div><span>项目证据</span><strong>${person.evidence}</strong></div><div class="caution"><span>先确认</span><strong>${person.caution}</strong></div></article>
      <div class="sheet-actions"><button class="secondary-button" data-action="close-overlay">再看看</button><button class="primary-button" data-action="greet" data-person="${person.id}">${greeted ? "模拟碰卡" : "打个招呼"}</button></div>
    </section></div>`;
  }
  if (state.overlay === "tap") {
    return `<div class="overlay handshake-overlay"><section class="handshake-card">
      <button class="close-x" data-action="close-overlay" aria-label="关闭">×</button>
      <p class="micro-label">PHYSICAL HANDSHAKE</p><h3>把两张 AI Passport<br>靠在一起</h3>
      <div class="tap-visual"><div class="tap-passport passport-left"><span>ZW</span></div><div class="tap-waves"><i></i><i></i><i></i></div><div class="tap-passport passport-right"><span>${person.monogram}</span></div></div>
      <p class="handshake-copy">检测到 ${person.name}。双方确认后，关系来源和匹配理由会一起保存。</p>
      <button class="primary-button full pulse-button" data-action="confirm-connect" data-person="${person.id}">双方已确认 · 完成建联</button>
      <button class="text-action" data-action="close-overlay">取消本次握手</button>
    </section></div>`;
  }
  if (state.overlay === "success") {
    return `<div class="overlay success-overlay"><section class="success-card">
      <div class="success-mark">✓</div><p class="micro-label">CONNECTION STAMP</p><h3>你和 ${person.name}<br>已经建立协作关系</h3>
      <div class="stamp"><span>CONNECTED</span><strong>AI × HARDWARE</strong><small>HACKATHON 01 · JUST NOW</small></div>
      <p>下一步不是交换联系方式，而是邀请对方进入一个明确项目。</p>
      <button class="primary-button full" data-action="invite-team" data-person="${person.id}">邀请加入「离线会议洞察终端」</button>
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

function renderSwitcher() {
  if (state.overlay) return "";
  return `<div class="prototype-switcher" aria-label="原型方向切换">
    <button data-variant-step="-1" aria-label="上一个方向">←</button>
    <span><small>PROTOTYPE</small><strong>${state.variant} — ${variantNames[state.variant]}</strong></span>
    <button data-variant-step="1" aria-label="下一个方向">→</button>
  </div>`;
}

function renderStateLedger() {
  return `<div class="state-ledger"><span>当前状态</span><strong>${stageLabel()}</strong><small>刷新后重置 · 硬件事件为模拟</small></div>`;
}

function stageLabel() {
  if (state.acceptedTasks.length) return "已开始协作";
  if (state.joined.length) return "已加入项目";
  if (state.connected.length) return "已碰卡建联";
  if (state.greeted.length) return "已发送招呼";
  return "发现附近的人";
}

function variantDescription() {
  if (state.variant === "B") return "把空间关系放在第一位。用户先感知“人就在附近”，再查看为什么值得认识。";
  if (state.variant === "C") return "把墨水屏语言直接延伸到手机：高对比、名册化、强调身份记录与连接盖章。";
  return "把个人公开身份和团队缺口放在第一位，附近的人是围绕当前项目出现的候选搭档。";
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
  document.querySelectorAll("[data-variant-step]").forEach((element) => element.addEventListener("click", () => cycleVariant(Number(element.dataset.variantStep))));
}

function handleAction(action, element) {
  if (action === "close-overlay") state.overlay = null;
  if (action === "open-person") {
    state.selectedId = element.dataset.person || state.selectedId;
    state.overlay = "person";
  }
  if (action === "next-person") {
    const index = people.findIndex((person) => person.id === state.selectedId);
    state.selectedId = people[(index + 1) % people.length].id;
  }
  if (action === "refresh") showToast("已读取附近 4 个协作信号");
  if (action === "greet") {
    const id = element.dataset.person;
    if (!state.greeted.includes(id)) {
      state.greeted.push(id);
      showToast(`已向 ${selectedPerson().name} 打招呼`);
      state.overlay = "person";
    } else {
      state.overlay = "tap";
    }
  }
  if (action === "confirm-connect") {
    const id = element.dataset.person;
    if (!state.connected.includes(id)) state.connected.push(id);
    state.overlay = "success";
  }
  if (action === "invite-team") {
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
  if (event.key === "ArrowLeft") cycleVariant(-1);
  if (event.key === "ArrowRight") cycleVariant(1);
  if (event.key === "Escape" && state.overlay) {
    state.overlay = null;
    render();
  }
});

render();
