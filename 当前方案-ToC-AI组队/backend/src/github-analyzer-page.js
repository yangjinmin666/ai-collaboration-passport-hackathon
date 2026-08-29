export const GITHUB_ANALYZER_PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RALLY · GitHub 能力标签测试</title>
  <style>
    :root { color-scheme: dark; --ink:#f4f4f0; --muted:#a7a79e; --line:#30302d; --panel:#181816; --accent:#d9ff43; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:#0d0d0c; color:var(--ink); font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }
    body::before { content:""; position:fixed; inset:0; pointer-events:none; background:radial-gradient(circle at 75% 8%,rgba(217,255,67,.09),transparent 30%); }
    main { width:min(820px,calc(100% - 32px)); margin:0 auto; padding:72px 0 96px; position:relative; }
    header { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:56px; }
    .brand { font-weight:800; letter-spacing:.14em; }
    .status { color:var(--muted); font-size:13px; display:flex; align-items:center; gap:8px; }
    .dot { width:7px; height:7px; border-radius:50%; background:var(--accent); box-shadow:0 0 16px var(--accent); }
    h1 { max-width:650px; margin:0 0 14px; font-size:clamp(36px,7vw,68px); line-height:1.03; letter-spacing:-.055em; }
    .intro { color:var(--muted); max-width:580px; margin:0 0 38px; font-size:17px; }
    form { display:grid; grid-template-columns:1fr auto; gap:10px; padding:8px; border:1px solid var(--line); border-radius:18px; background:var(--panel); box-shadow:0 24px 70px rgba(0,0,0,.25); }
    input { min-width:0; border:0; outline:0; padding:15px 16px; background:transparent; color:var(--ink); font:inherit; font-size:16px; }
    input::placeholder { color:#77776f; }
    button { border:0; border-radius:12px; padding:0 24px; min-height:52px; background:var(--accent); color:#111; font:700 15px inherit; cursor:pointer; transition:transform .15s,opacity .15s; }
    button:hover { transform:translateY(-1px); }
    button:disabled { opacity:.55; cursor:wait; transform:none; }
    .hint { min-height:24px; margin:11px 4px 30px; color:var(--muted); font-size:13px; }
    .result { display:none; border-top:1px solid var(--line); padding-top:30px; }
    .result.visible { display:block; animation:rise .3s ease-out; }
    .meta { display:flex; justify-content:space-between; gap:16px; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.1em; margin-bottom:18px; }
    .tags { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:25px; }
    .tag { border:1px solid #4a4a43; border-radius:999px; padding:9px 14px; background:#1d1d1a; font-weight:650; }
    .summary { margin:0; font-size:clamp(24px,4vw,36px); line-height:1.25; letter-spacing:-.03em; }
    .error { color:#ff8d75; }
    .history { margin-top:52px; }
    .history h2 { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.12em; }
    .history-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px; padding:14px 0; border-bottom:1px solid #232321; }
    .history-item span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#c5c5bd; }
    .history-item span:last-child { color:var(--muted); font-size:13px; }
    @keyframes rise { from { opacity:0; transform:translateY(8px); } }
    @media (max-width:600px) { main{padding-top:34px} header{margin-bottom:44px} form{grid-template-columns:1fr} button{height:52px} }
  </style>
</head>
<body>
  <main>
    <header><div class="brand">RALLY / 集结</div><div class="status"><i class="dot"></i>分析服务已就绪</div></header>
    <h1>GitHub 能力标签测试台</h1>
    <p class="intro">粘贴公开 GitHub 个人主页，查看这名选手适合在黑客松中承担什么角色。</p>
    <form id="form">
      <input id="url" name="github_url" type="url" inputmode="url" autocomplete="url" required placeholder="https://github.com/username" aria-label="GitHub 个人主页链接">
      <button id="submit" type="submit">开始分析</button>
    </form>
    <div class="hint" id="hint">仅分析公开仓库，不读取私有数据。</div>
    <section class="result" id="result" aria-live="polite">
      <div class="meta"><span id="result-label">能力画像</span><span id="elapsed"></span></div>
      <div class="tags" id="tags"></div>
      <p class="summary" id="summary"></p>
    </section>
    <section class="history" id="history" hidden><h2>本次测试记录</h2><div id="history-list"></div></section>
  </main>
  <script>
    const form = document.querySelector('#form');
    const input = document.querySelector('#url');
    const button = document.querySelector('#submit');
    const result = document.querySelector('#result');
    const tags = document.querySelector('#tags');
    const summary = document.querySelector('#summary');
    const elapsed = document.querySelector('#elapsed');
    const hint = document.querySelector('#hint');
    const history = document.querySelector('#history');
    const historyList = document.querySelector('#history-list');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const githubUrl = input.value.trim();
      button.disabled = true; button.textContent = '分析中…';
      hint.textContent = '正在读取公开仓库并生成能力画像…';
      result.classList.remove('visible'); summary.classList.remove('error');
      const started = performance.now();
      try {
        const response = await fetch('/api/analyze-github', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({github_url:githubUrl}) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || '分析失败，请稍后再试。');
        tags.replaceChildren(...body.tags.map((value) => { const node=document.createElement('span'); node.className='tag'; node.textContent=value; return node; }));
        summary.textContent = body.summary;
        elapsed.textContent = ((performance.now()-started)/1000).toFixed(1)+' 秒';
        result.classList.add('visible'); hint.textContent = '可以继续粘贴其他 GitHub 链接进行对比。';
        history.hidden = false;
        const item=document.createElement('div'); item.className='history-item';
        const link=document.createElement('span'); link.textContent=githubUrl;
        const values=document.createElement('span'); values.textContent=body.tags.slice(0,2).join(' · ');
        item.append(link,values); historyList.prepend(item);
      } catch (error) {
        tags.replaceChildren(); summary.textContent=error.message; summary.classList.add('error'); elapsed.textContent=''; result.classList.add('visible'); hint.textContent='请检查链接或服务配置后重试。';
      } finally { button.disabled=false; button.textContent='开始分析'; }
    });
  </script>
</body>
</html>`;
