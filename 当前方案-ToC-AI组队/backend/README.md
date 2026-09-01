# COSPAN Backend

COSPAN 的 96 小时黑客松后端已经跑通一条完整、可复位的协作闭环：

> 活动身份与授权公开 → 手机前台附近发现 → NFC／QR 双向建联 → 项目邀请与确认入队 → 人工确认启动包与任务 → 项目 SOS → 审计记录。

它不是生产部署模板，也不包含群聊、完整 IM、资金托管或 Agent 自主执行。建联双方可以使用轻量一对一对话澄清合作意图，但发送消息不会自动创建项目、加入团队或分配任务。关键状态迁移全部由规则代码校验；Agent 只能给建议，不能替人接任务、加入团队或改写历史。

## 已实现能力

| 模块 | 当前能力 |
|---|---|
| 活动与身份 | 活动列表、加入活动、四态枚举、3–5 项能力、兴趣、投入时间、协作偏好、逐字段公开、暂停／恢复、个人 Event Log |
| 外部平台 | GitHub、作品站、即刻、小红书、抖音、LinkedIn 和其他 HTTPS 链接；GitHub 可同步公开摘要 |
| 附近发现 | 手机浏览器真实 Geolocation 心跳、2 分钟 TTL、离页主动撤销、仅返回距离分桶 |
| 缺口匹配 | 按项目未满角色缺口、能力、兴趣、投入时间、协作偏好和证据做确定性排序；返回两条依据、证据引用、待确认点和模板降级标识，不显示成功概率 |
| NFC／QR | 不透明卡片 Token、有限公开资料、受保护的双卡 `physical_mutual` 直连、普通连接请求箱、双方确认、撤回／拒绝／拉黑、幂等与限频 |
| 轻量对话 | 已建联双方的一对一文本消息、客户端幂等发送、双方独立已读游标、连接列表未读计数；对话仅用于决定是否合作，不替代 COSPAN Space |
| 项目与团队 | 创建项目与角色缺口、仅邀请已建联对象、受邀者确认入队、事务保护容量 |
| COSPAN Space | 三任务模板启动包、成员主动认领、任务状态机、全员确认后启动、项目动态 |
| 项目 SOS | 结构化求助、活动内响应、四类回报表达、活动级 SOS／外援／付费意向开关、支援者带原因退出、发布者解决／关闭／重开；不自动入队、不处理支付 |
| 登录与身份 | 体验群签名链接、邮箱验证码登录与绑定、手机号短信、微信 OAuth、Google OAuth；首次自动建号、活动隐藏资料、Bearer Session、一次性验证与地址/IP 限频 |
| 数据埋点 | 第一方 `analytics_events`、短信/资料/发现/建联/组队/Room 漏斗、来源归因、幂等去重、30 天原始事件保留、受保护汇总与 CSV 导出 |
| 演示可靠性 | 确定性种子数据、受保护 Demo Reset、HTTP 契约测试、真实浏览器端到端测试 |

完整接口见 [openapi.yaml](./openapi.yaml)。

## 运行

要求 Node.js 24 或更新版本。当前实现只使用 Node 内置 HTTP、测试和 SQLite 模块，不需要安装第三方 Node 依赖。

```bash
cd 当前方案-ToC-AI组队/backend
npm test
npm start
```

默认监听 `0.0.0.0:8787`，数据保存到 `data/demo.sqlite`。可通过环境变量覆盖：

```bash
PORT=8788 \
HOST=127.0.0.1 \
DATABASE_PATH=:memory: \
AUTH_OTP_SECRET='replace-with-a-long-random-secret' \
AUTH_EMAIL_SECRET='replace-with-a-different-long-random-secret' \
RESEND_API_KEY='re_server-only-key' \
AUTH_EMAIL_FROM='COSPAN 合拍 <login@your-domain.example>' \
ANALYTICS_ADMIN_TOKEN='replace-with-an-independent-32-char-secret' \
RALLY_APP_VERSION='release-20260829' \
PUBLIC_APP_ORIGIN='https://rally.example.com' \
PUBLIC_API_ORIGIN='https://api.rally.example.com' \
AUTH_OAUTH_STATE_SECRET='replace-with-an-independent-random-secret' \
EXPERIENCE_INVITE_SECRET='replace-with-an-independent-random-secret' \
GOOGLE_OAUTH_CLIENT_ID='google-client-id' \
GOOGLE_OAUTH_CLIENT_SECRET='google-client-secret' \
WECHAT_OAUTH_APP_ID='wechat-app-id' \
WECHAT_OAUTH_APP_SECRET='wechat-app-secret' \
WECHAT_MINI_PROGRAM_APP_ID='wx-mini-program-app-id' \
WECHAT_MINI_PROGRAM_APP_SECRET='mini-program-app-secret' \
ANDROID_APP_SHA256_CERT_FINGERPRINT='AA:BB:...:FF' \
TENCENT_SMS_SECRET_ID='rally-sms-sub-user-secret-id' \
TENCENT_SMS_SECRET_KEY='rally-sms-sub-user-secret-key' \
TENCENT_SMS_SDK_APP_ID='1401184659' \
TENCENT_SMS_SIGN_NAME='approved-sign-name' \
TENCENT_SMS_TEMPLATE_ID='approved-template-id' \
TENCENT_SMS_REGION='ap-guangzhou' \
TOUCH_DEVICE_ACCESS_KEY='replace-with-a-separate-device-key' \
SOS_ENABLED=1 \
EXTERNAL_AID_ENABLED=1 \
PAID_AID_ENABLED=1 \
npm start
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

## 第一方数据埋点

演示版不依赖 GA、Firebase、PostHog 等第三方统计服务。手机 H5／Android WebView 将允许的页面曝光事件发送到同源 `POST /api/analytics/events`；短信、建联、入队、启动包和任务等成功结果由后端写入。`event_logs` 仍是业务审计记录，`analytics_events` 只用于漏斗和来源分析，二者不会混作同一用途。

客户端事件使用严格事件名和属性白名单。手机号、验证码、Token、姓名、资料正文、精确位置和腾讯云原始响应不能进入埋点。原始分析事件默认保留 30 天，Demo Reset 会同时清除分析事件；也可按内部 `user_id` 删除当前账户及已关联的登录前匿名事件，不会删除业务审计日志。

汇总和 CSV 导出必须提供独立管理密钥；该密钥只保存在服务器，不进入 APK 或普通用户界面：

```bash
curl 'http://127.0.0.1:8787/api/admin/analytics/summary?exhibition_id=hackathon-2026' \
  -H 'x-analytics-admin-token: replace-with-an-independent-32-char-secret'

curl 'http://127.0.0.1:8787/api/admin/analytics/export?exhibition_id=hackathon-2026' \
  -H 'x-analytics-admin-token: replace-with-an-independent-32-char-secret' \
  -o rally-analytics.csv

curl -X DELETE \
  'http://127.0.0.1:8787/api/admin/analytics/users/user_internal_id?exhibition_id=hackathon-2026' \
  -H 'x-analytics-admin-token: replace-with-an-independent-32-char-secret'
```

本地调试时可设置 `ANALYTICS_DEBUG_ENABLED=1` 后，使用受保护的 `GET /api/admin/analytics/events?limit=100` 查看最近事件。生产演示部署不设置该开关，该路由返回 404。

完整事件、字段、隐私和验收规则见 [13-数据埋点与漏斗规范.md](../13-数据埋点与漏斗规范.md)。

## 手机 Live 模式

先启动后端，再启动手机 Demo：

```bash
cd ../prototype/mobile-demo
./run.sh
```

本机演示地址：

```text
http://localhost:4173/?variant=B&live=1&apiBase=http://127.0.0.1:8787&demoUser=user-zhou
```

进入“发现 → 附近”后，浏览器会请求真实定位；切走发现页、暂停公开、锁页或关闭页面时会撤销心跳。浏览器定位要求 `localhost` 或 HTTPS 安全上下文。真机联调时，前后端都应使用同一局域网可访问地址；正式公网必须使用 HTTPS。

`demoUser` 只在 `ALLOW_INSECURE_DEMO_AUTH=1` 时有效。这个开关允许任意客户端模拟预置账号，只能用于可信本地自动化测试，不得部署到公网。真实用户入口不读取它。

`SOS_ENABLED`、`EXTERNAL_AID_ENABLED` 和 `PAID_AID_ENABLED` 可按活动关闭整个 SOS、外部支援或有偿悬赏意向。关闭有偿援助后，已有有偿 SOS 也会停止接受新响应。有偿字段只记录 `NOT_PROCESSED` 意向，必须包含金额、币种、交付标准和付款说明；COSPAN 不托管、不代收、不担保。双卡握手使用独立的 `TOUCH_DEVICE_ACCESS_KEY`，不能与演示登录密钥复用，也不能写进公开手机前端；新建 Connection 会持久化 `consent_mode=physical_mutual`，与普通请求接受后的 `recipient_confirmed` 区分。

生产接入使用 `localStorage.rally_access_token` 的 Bearer Token。此时手机端会忽略 URL 查询参数中的 `apiBase` 并默认只访问同源 API，避免恶意分享链接把凭证转发到任意域名。若生产环境前后端确实分域，受信任的登录初始化代码必须先写入 `localStorage.rally_api_base`；不要通过分享 URL 配置带凭证的 API 地址。

## 邮箱登录与账号绑定

冷启动默认路径是“签名体验链接无感进入 → 在我的设置绑定邮箱 → 换设备时用邮箱验证码恢复同一账号”。邮箱是私密登录凭据，不会进入公开资料、附近结果、NFC／QR 卡片或分析事件。

`POST /api/auth/email/challenges` 发送 10 分钟有效的 6 位验证码，`POST /api/auth/email/sessions` 验证后创建或恢复账号。已登录的体验账号通过 `POST /api/me/email/challenges` 与 `PUT /api/me/email` 绑定邮箱。同一邮箱不能被另一账号抢占，验证挑战最多错误 5 次；同邮箱 60 秒冷却、每小时 5 封，同客户端地址每小时 20 封。

当前发件通道使用 Resend HTTP API，服务器需要 `AUTH_EMAIL_SECRET`、`RESEND_API_KEY` 和经过域名验证的 `AUTH_EMAIL_FROM`。在 Resend 控制台按提示为发件子域名添加 SPF、DKIM，并为主域名配置 DMARC；API Key 只放在 `/etc/rally/rally.env`，不进入 Git、前端或 APK。`GET /health` 只有在密钥、发件人和通道都完整时才返回 `email_login=ready`。

```bash
curl -X POST http://127.0.0.1:8787/api/auth/email/challenges \
  -H 'content-type: application/json' \
  -d '{"email":"person@example.com"}'

curl -X POST http://127.0.0.1:8787/api/auth/email/sessions \
  -H 'content-type: application/json' \
  -d '{"challenge_id":"email_...","code":"123456"}'
```

## 手机号短信登录

公网入口只需要“手机号 → 6 位验证码”，登录页不要求昵称。`POST /api/auth/otp/challenges` 创建 5 分钟挑战并调用腾讯云 `SendSms 2021-01-11`，`POST /api/auth/otp/sessions` 一次性消费验证码并签发 Bearer Session。挑战响应中的 `delivery_mode` 会明确区分真实腾讯云发送（`tencent_cloud`）与不发送短信的固定路演模式（`fixed_demo`）；`GET /health` 通过 `sms_delivery` 暴露相同状态，不能再只凭 `sms_login=ready` 判断真实短信已经启用。新手机号会以“COSPAN 新朋友”创建身份和 2026 AI Hardware Hackathon（`hackathon-2026`）的隐藏资料，验证成功后再由用户填写昵称、协作资料和公开范围。已有手机号登录不会被未认证请求改名。

腾讯云验证码模板必须使用两个变量，顺序固定为 `{1}=6 位验证码`、`{2}=有效分钟数（5）`，例如：

```text
您的 COSPAN 验证码是{1}，{2}分钟内有效。请勿泄露给他人。
```

签名和模板必须是腾讯云已审核状态；短信 API 子用户只授予发送所需的最小权限。`TENCENT_SMS_SECRET_ID`、`TENCENT_SMS_SECRET_KEY` 和 `AUTH_OTP_SECRET` 只写入服务器 `/etc/rally/rally.env`，不要放进前端、APK、Git 或聊天记录。发送限制为同手机号 60 秒冷却、每小时 5 条，同客户端地址每小时 20 条；每个验证码最多错误 5 次。

运营商签名尚未完成报备时，可在仅监听环回地址的路演服务器上临时设置 `AUTH_OTP_FIXED_DEMO=1` 和六位 `AUTH_OTP_FIXED_DEMO_CODE`。此模式不会发送短信，也不会开启 `ALLOW_INSECURE_DEMO_AUTH`；路演结束后应从 `/etc/rally/rally.env` 删除这两个变量并切回已审核的腾讯云短信配置。

```bash
curl -X POST http://127.0.0.1:8787/api/auth/otp/challenges \
  -H 'content-type: application/json' \
  -d '{"phone":"13800138000"}'

curl -X POST http://127.0.0.1:8787/api/auth/otp/sessions \
  -H 'content-type: application/json' \
  -d '{"challenge_id":"otp_...","code":"123456"}'
```

## 微信与 Google 登录

`GET /api/auth/oauth/providers` 返回当前可用入口。某个平台的 App ID／Secret 或 OAuth 公共地址未配置完整时，该入口会明确显示“服务器尚未配置”，不会伪装可用。

服务器配置中的 `PUBLIC_APP_ORIGIN` 是允许返回的网页源，`PUBLIC_API_ORIGIN` 是 OAuth Provider 能从公网访问的 API 源，`AUTH_OAUTH_STATE_SECRET` 必须使用独立高熵密钥。Provider 控制台登记的回调地址固定为：

```text
Google: https://<api-domain>/api/auth/oauth/google/callback
微信:   https://<api-domain>/api/auth/oauth/wechat/callback
```

网页完成授权后返回同源页面；Android 的 Google 登录返回 `https://<app-domain>/auth/android`，由通过 `assetlinks.json` 验证的 HTTPS App Link 唯一交给 COSPAN。发起端还会生成只保存在本机的 verifier，并把 SHA-256 challenge 绑定进签名 state 和临时 ticket；回调 URL 只携带两分钟有效、只能消费一次的 ticket，前端必须同时提交原 verifier 才能换 Bearer Session。长期 Token 不进入 URL。Google 授权在系统浏览器中完成，避免嵌入式 WebView 被 Provider 拒绝。OAuth 提供的昵称仅作新账号初始值，用户可在资料编辑器修改；邮箱和手机号不会自动公开，也不会仅凭相同邮箱自动合并已有账号。

Android App Link 只有在服务器设置 `ANDROID_APP_SHA256_CERT_FINGERPRINT` 后启用。部署脚本会据此生成 `/.well-known/assetlinks.json`；值必须是当前 APK 签名证书的 32 组大写十六进制 SHA-256 指纹。调试包与正式包签名不同，上线时必须替换为正式签名指纹。没有这项配置时，API 的 `android_enabled` 为 `false`，体验包会禁用 Google 按钮，避免把未验证 HTTPS 回调当成安全可用。

当前微信实现是公众号网页授权（`snsapi_userinfo`），用于用户在微信内打开 COSPAN 网页版的场景。Android 原生一键微信登录需要另外接入微信 OpenSDK、应用签名与 Universal Link；在这套配置完成前，体验包会明确提示“请从微信打开网页版”，不会把系统浏览器流程伪装成可用的原生微信登录。

## 微信小程序登录

小程序使用 `wx.login` 获取一次性 `code`，再调用 `POST /api/auth/wechat-mini/sessions` 换取 COSPAN Bearer Session。服务器通过微信 `jscode2session` 完成校验，以“AppID + OpenID”作为稳定的小程序登录主体，避免 UnionID 后续变为可用时重复建号；COSPAN 内部 UUID 仍是业务主键。`session_key` 不返回客户端，也不作为 COSPAN Session。

`WECHAT_MINI_PROGRAM_APP_ID` 和 `WECHAT_MINI_PROGRAM_APP_SECRET` 只写入腾讯云服务器环境文件。AppSecret 不能进入小程序代码、Git、聊天或截图。小程序与公众号网页 OAuth 的 App ID / Secret 不是同一组配置。

## 体验群免输码链接

国内短信资质仍在审核时，可以用签名体验群链接让真实用户当天进入。链接打开后会在当前浏览器创建独立 COSPAN 身份、隐藏活动资料和正常 Bearer Session，后续资料、定位、建联、项目与任务都写入同一真实数据库；用户不需要输入现场访问码。它不绑定手机号，也不替代正式短信／OAuth 身份验证，只用于受控体验群。

服务器必须配置独立的 32 字符以上 `EXPERIENCE_INVITE_SECRET`。生成一个默认 7 天、最多 50 台设备使用的链接：

```bash
cd backend
node scripts/create-experience-link.js
```

可通过 `EXPERIENCE_INVITE_MAX_USES`、`EXPERIENCE_INVITE_VALID_HOURS` 和 `EXPERIENCE_INVITE_CAMPAIGN_ID` 调整人数、有效期和批次。同一浏览器重复打开同一链接会恢复同一身份，不重复占用名额；不同设备达到上限后返回 `EXPERIENCE_INVITE_FULL`。链接本身是临时登录凭据，只发到目标体验群，不放公开网页、截图或分析日志。

## 本地演示账号

预置演示账号只供自动化和可信本地联调；公网用户不可见这个入口。数据库只保存 Session Token 哈希：

```bash
curl -X POST http://127.0.0.1:8787/api/auth/demo-sessions \
  -H 'content-type: application/json' \
  -H 'x-demo-access-key: replace-with-a-private-demo-key' \
  -d '{"user_id":"user-zhou"}'
```

种子活动 ID 为 `hackathon-2026`。预置用户包括：

| 用户 | ID | 初始状态 |
|---|---|---|
| 周闻 | `user-zhou` | 已加入、Visible |
| 林澈 | `user-lin` | 已加入、Visible |
| 苏晴 | `user-su` | 已加入、Paused |
| 米娅 | `user-mia` | 尚未加入，用于 Join 流程 |

## 关键调用示例

以下示例为本地演示便捷使用 `x-demo-user-id`，运行服务时需显式设置 `ALLOW_INSECURE_DEMO_AUTH=1`。生产客户端应改用 `Authorization: Bearer {access_token}`。

### 1. 保存外部平台链接

```bash
curl -X PUT http://127.0.0.1:8787/api/me/platform-links/github \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-zhou' \
  -d '{"url":"https://github.com/example"}'
```

GitHub 通过公开 API 尝试读取 `username`、昵称、头像、简介、公开仓库数和关注者数。读取失败时仍保存为 `USER_PROVIDED`，不伪装成平台验证。小红书、抖音、即刻等只保存用户提交的 HTTPS 链接，不做爬虫，也不读取私密资料。

这些链接只有在活动的 `public_fields` 明确包含 `platform_links` 时，才会出现在发现页或 NFC 公共资料中。

### 2. 发布并查询附近位置

```bash
curl -X PUT http://127.0.0.1:8787/api/events/hackathon-2026/presence \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-zhou' \
  -d '{"latitude":31.2304,"longitude":121.4737,"accuracy_m":18}'

curl http://127.0.0.1:8787/api/events/hackathon-2026/nearby \
  -H 'x-demo-user-id: user-zhou'

curl -X DELETE http://127.0.0.1:8787/api/events/hackathon-2026/presence \
  -H 'x-demo-user-id: user-zhou'
```

精确经纬度只短时保存在服务端，不返回给任何其他用户。客户端只能看到 `50 米内`、`200 米内`、`500 米内` 或 `活动现场`。

### 3. NFC／QR 建联

读取有限公开资料：

```bash
curl 'http://127.0.0.1:8787/c/cp_B3kP8sT6yH2nV9qL?event=hackathon-2026&src=nfc'
```

发起与接受连接：

```bash
curl -X POST http://127.0.0.1:8787/api/connections/requests \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-zhou' \
  -d '{"recipient_id":"user-lin","event_id":"hackathon-2026","source":"nfc"}'

curl -X PATCH http://127.0.0.1:8787/api/connections/requests/{request_id} \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-lin' \
  -d '{"action":"accept"}'
```

打开卡片不会自动建立关系；只有接收方确认才创建 Connection。

### 4. 建联后的轻量对话

只有处于 `ACTIVE` 状态的 Connection 双方可以读取或发送消息。第三方访问返回 `403`；关系被拉黑后返回 `409`。`client_message_id` 用于弱网重试时避免重复发送，已读游标由双方分别维护。

```bash
curl http://127.0.0.1:8787/api/connections/{connection_id}/conversation \
  -H 'x-demo-user-id: user-zhou'

curl -X POST http://127.0.0.1:8787/api/connections/{connection_id}/messages \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-zhou' \
  -d '{"text":"想先聊清楚我们要验证的问题。","client_message_id":"client-demo-0001"}'

curl -X PATCH http://127.0.0.1:8787/api/connections/{connection_id}/conversation \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-lin' \
  -d '{"last_read_message_id":"msg_..."}'
```

对话属于连接详情层，不新增独立聊天导航。双方决定合作后，再进入项目邀请与 COSPAN Space 执行流程。

### 5. 项目、入队与启动包

```bash
curl -X POST http://127.0.0.1:8787/api/projects \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-zhou' \
  -d '{
    "event_id":"hackathon-2026",
    "title":"离线会议洞察终端",
    "summary":"把线下讨论沉淀为可执行任务",
    "role_need":{"title":"硬件构建者","skills":["嵌入式"],"capacity":1}
  }'

curl -X POST http://127.0.0.1:8787/api/projects/{project_id}/starter-pack \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-zhou' \
  -d '{}'

curl -X PATCH http://127.0.0.1:8787/api/tasks/{task_id} \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-lin' \
  -d '{"action":"claim"}'

curl -X POST http://127.0.0.1:8787/api/projects/{project_id}/plan-confirmations \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-lin' \
  -d '{}'
```

启动包默认由固定模板生成并标记 `TEMPLATE_FALLBACK`。建议负责人不会自动成为任务 Owner；任务必须由成员本人认领，全员确认后计划才进入 `CONFIRMED`。

### 5. 项目 SOS

```bash
curl -X POST http://127.0.0.1:8787/api/projects/{project_id}/sos \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-zhou' \
  -d '{
    "category":"部署/API",
    "problem":"手机端无法稳定收到设备上报",
    "context":"Node 24 + 同一活动 Wi-Fi",
    "attempts":["固定端口"],
    "required_skills":["网络调试"],
    "estimated_minutes":30,
    "location_label":"路演区 B12",
    "deadline":"2026-08-29T23:00:00.000Z",
    "resolution_criteria":"连续完成 10 次上报",
    "reward_intent":{
      "type":"PAID_INTENT",
      "currency":"CNY",
      "amount":200,
      "delivery_standard":"完成抓包定位并让 10 次上报全部通过",
      "payment_note":"发布者线下验收后自行结算"
    }
  }'
```

悬赏只记录意向，并固定返回 `payment_state: NOT_PROCESSED`。COSPAN 不收款、不托管、不结算。外部支援者被接受后仍不会自动加入项目团队。

## 测试

后端 HTTP 契约测试：

```bash
npm test
```

手机静态交互、字号与触控验收：

```bash
cd ../prototype/mobile-demo
python3 smoke_test.py
```

真实 Node 后端＋真实浏览器 Geolocation＋平台链接端到端验收：

```bash
python3 live_e2e_test.py
```

端到端脚本会验证定位已连接、后端能发现另一位用户、离开附近页后位置被删除，以及外部链接的保存、手机展示和删除。

## 安全与生产化边界

- 当前 CORS 为 `*`，只为本地 Demo；公网部署前必须改成明确域名白名单。
- `x-demo-user-id` 是不安全的本地兼容机制，生产环境必须关闭。
- Demo Reset 必须配置独立密钥，且不能暴露在前端包中。
- SQLite 适合单机 Demo；服务器化前应迁移到 PostgreSQL／Supabase 等托管数据库，并使用正式 Auth／OTP。
- GitHub Token 只从服务器环境变量读取，不进入响应或日志；可不配置 Token，接口会安全降级。
- OAuth App Secret 和 state 密钥只放服务器环境；OAuth ticket 短时且一次性，Bearer Token 不进入回调 URL；Google 授权不得在内嵌 WebView 中完成。
- 附近功能不提供后台持续追踪，不返回精确坐标，也不让硬件工牌承担扫描。
- 飞书、GitHub 等仍负责日常文档和代码执行；COSPAN Space 只负责组队启动、首次分工、关键确认与记录。
