# Collaboration Passport Backend

96 小时黑客松 MVP 的第一条服务端竖切：NFC／QR 公开资料入口，以及需要双方确认的唯一建联关系。

## 当前边界

- NFC 只携带不透明 Token；打开卡片不会自动建立关系。
- 未登录访客只能读取仍在授权期内的有限公开资料。
- 公开资料逐字段受 `visibility_grants.public_fields_json` 控制，未授权字段不会出现在响应中。
- 发起连接时服务端再次校验接收方是否可见。
- 只有接收方能接受请求；接受后才创建 `Connection`。
- 重复触碰、重复发起、重复接受均保持幂等。
- 启动时自动升级旧版 demo 数据；历史重复 Connection 会保留最早记录，其余完整归档到 `archived_duplicate_connections`。
- 手机号和邮箱存在于演示种子数据中，但公开卡片接口永不返回。
- `x-demo-user-id` 只用于黑客松预登录演示，不能作为生产鉴权。

## 运行

要求 Node.js 24 或更新版本，当前实现只使用 Node 内置的 HTTP、测试与 SQLite 模块，无需安装第三方依赖。

```bash
cd 当前方案-ToC-AI组队/backend
npm test
npm start
```

默认监听 `0.0.0.0:8787`，数据保存到 `data/demo.sqlite`。可使用环境变量覆盖：

```bash
PORT=8788 HOST=127.0.0.1 DATABASE_PATH=:memory: npm start
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

## 演示数据

| 用户 | Demo 身份 Header | 卡片 Token | 可见状态 |
|---|---|---|---|
| 周闻 | `user-zhou` | `cp_7mJ4Qv9N2xK8Rt5W` | Visible |
| 林澈 | `user-lin` | `cp_B3kP8sT6yH2nV9qL` | Visible |
| 苏晴 | `user-su` | `cp_F6wR1cZ8mN4jX2pD` | Paused |

活动 ID：`hackathon-2026`。

## 核心调用

读取林澈的 NFC 公开资料（这也是写入 NDEF 的路径形式）：

```bash
curl "http://127.0.0.1:8787/c/cp_B3kP8sT6yH2nV9qL?event=hackathon-2026&src=nfc"
```

QR 使用同一路径，只将 `src` 改为 `qr`；旧的
`/api/cards/{token}/profile?event_id=...&source=...` 暂作兼容别名。

周闻向林澈发起请求：

```bash
curl -X POST http://127.0.0.1:8787/api/connections/requests \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-zhou' \
  -d '{"recipient_id":"user-lin","event_id":"hackathon-2026","source":"nfc"}'
```

林澈接受请求（将 `{request_id}` 替换为上一步返回值）：

```bash
curl -X PATCH "http://127.0.0.1:8787/api/connections/requests/{request_id}" \
  -H 'content-type: application/json' \
  -H 'x-demo-user-id: user-lin' \
  -d '{"action":"accept"}'
```

查询 Connection（只有双方可读）：

```bash
curl "http://127.0.0.1:8787/api/connections/{connection_id}" \
  -H 'x-demo-user-id: user-zhou'
```

## 手机端接入契约

手机端在开发阶段使用：

```js
const API_BASE_URL = "http://127.0.0.1:8787";
```

真机联调时，把 `127.0.0.1` 换成本机局域网 IP。服务已开放开发期 CORS；上线前必须改为明确域名白名单，并把 Demo Header 替换成真实会话。

## 下一阶段

1. `Visible / Paused / Expired` 写接口与活动加入；
2. 请求箱、拒绝、撤回、拉黑和短轮询；
3. 项目、角色缺口、团队邀请与确认入队；
4. Demo Reset 和完整 Event Log 查询；
5. 将 SQLite 仓储替换为 Supabase/PostgreSQL，并接真实 Auth。
