# RALLY Backend

RALLY 的 96 小时黑客松后端已经跑通一条完整、可复位的协作闭环：

> 活动身份与授权公开 → 手机前台附近发现 → NFC／QR 双向建联 → 项目邀请与确认入队 → 人工确认启动包与任务 → 项目 SOS → 审计记录。

它不是生产部署模板，也不包含聊天、资金托管或 Agent 自主执行。关键状态迁移全部由规则代码校验；Agent 只能给建议，不能替人接任务、加入团队或改写历史。

## 已实现能力

| 模块 | 当前能力 |
|---|---|
| 活动与身份 | 活动列表、加入活动、四态枚举、3–5 项能力、兴趣、投入时间、协作偏好、逐字段公开、暂停／恢复、个人 Event Log |
| 外部平台 | GitHub、作品站、即刻、小红书、抖音、LinkedIn 和其他 HTTPS 链接；GitHub 可同步公开摘要 |
| 附近发现 | 手机浏览器真实 Geolocation 心跳、2 分钟 TTL、离页主动撤销、仅返回距离分桶 |
| 缺口匹配 | 按项目未满角色缺口、能力、兴趣、投入时间、协作偏好和证据做确定性排序；返回两条依据、证据引用、待确认点和模板降级标识，不显示成功概率 |
| NFC／QR | 不透明卡片 Token、有限公开资料、受保护的双卡 `physical_mutual` 直连、普通连接请求箱、双方确认、撤回／拒绝／拉黑、幂等与限频 |
| 项目与团队 | 创建项目与角色缺口、仅邀请已建联对象、受邀者确认入队、事务保护容量 |
| RALLY Room | 三任务模板启动包、成员主动认领、任务状态机、全员确认后启动、项目动态 |
| 项目 SOS | 结构化求助、活动内响应、四类回报表达、活动级 SOS／外援／付费意向开关、支援者带原因退出、发布者解决／关闭／重开；不自动入队、不处理支付 |
| 演示可靠性 | 确定性种子数据、受保护 Demo Reset、48 个 HTTP 契约测试、真实浏览器端到端测试 |

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
DEMO_ACCESS_KEY='replace-with-a-private-demo-key' \
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

`demoUser` 只在 `ALLOW_INSECURE_DEMO_AUTH=1` 时有效。这个开关允许任意客户端模拟预置账号，只能用于可信本地环境，不得部署到公网。

`SOS_ENABLED`、`EXTERNAL_AID_ENABLED` 和 `PAID_AID_ENABLED` 可按活动关闭整个 SOS、外部支援或有偿悬赏意向。关闭有偿援助后，已有有偿 SOS 也会停止接受新响应。有偿字段只记录 `NOT_PROCESSED` 意向，必须包含金额、币种、交付标准和付款说明；RALLY 不托管、不代收、不担保。双卡握手使用独立的 `TOUCH_DEVICE_ACCESS_KEY`，不能与演示登录密钥复用，也不能写进公开手机前端；新建 Connection 会持久化 `consent_mode=physical_mutual`，与普通请求接受后的 `recipient_confirmed` 区分。

生产接入使用 `localStorage.rally_access_token` 的 Bearer Token。此时手机端会忽略 URL 查询参数中的 `apiBase` 并默认只访问同源 API，避免恶意分享链接把凭证转发到任意域名。若生产环境前后端确实分域，受信任的登录初始化代码必须先写入 `localStorage.rally_api_base`；不要通过分享 URL 配置带凭证的 API 地址。

## 身份与演示账号

生产请求应使用 Bearer Token。预置演示账号通过受保护入口创建可撤销会话，数据库只保存 Token 哈希：

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

### 4. 项目、入队与启动包

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

悬赏只记录意向，并固定返回 `payment_state: NOT_PROCESSED`。RALLY 不收款、不托管、不结算。外部支援者被接受后仍不会自动加入项目团队。

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
- 附近功能不提供后台持续追踪，不返回精确坐标，也不让硬件工牌承担扫描。
- 飞书、GitHub 等仍负责日常文档和代码执行；RALLY Room 只负责组队启动、首次分工、关键确认与记录。
