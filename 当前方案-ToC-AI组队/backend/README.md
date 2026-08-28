# Collaboration Passport Backend

96 小时黑客松 MVP 的前两条服务端竖切：NFC／QR 公开资料入口、双向确认建联，以及两台手机可轮询的请求箱。

## 当前边界

- NFC 只携带不透明 Token；打开卡片不会自动建立关系。
- 未登录访客只能读取仍在授权期内的有限公开资料。
- 公开资料逐字段受 `visibility_grants.public_fields_json` 控制，未授权字段不会出现在响应中。
- 发起连接时服务端再次校验接收方是否可见。
- 预置演示账号通过受保护入口换取随机 Bearer Token；数据库只保存 Token 哈希，并支持注销撤销。
- 只有接收方能接受或拒绝，发起方可撤回；双方都能拉黑，且已建联关系会同步进入 `BLOCKED`。
- incoming／outgoing 请求箱返回对方上下文、留言、状态和 `poll_after_ms=2500` 同步建议。
- 同一账号在同一活动内每分钟最多新建 5 个请求；拉黑后双向均不可重新发起。
- 被拒绝后同方向冷却 5 分钟；待处理请求在 24 小时或活动结束时自动过期（取较早者）。
- 重复触碰、发起和状态操作均保持幂等。
- 启动时自动升级旧版 demo 数据；历史重复 Connection 会保留最早记录，其余完整归档到 `archived_duplicate_connections`。
- 手机号和邮箱存在于演示种子数据中，但公开卡片接口永不返回。
- `x-demo-user-id` 仅作旧 Demo 兼容，默认关闭；Bearer 演示会话同样不能代替生产 Auth／OTP。

## 运行

要求 Node.js 24 或更新版本，当前实现只使用 Node 内置的 HTTP、测试与 SQLite 模块，无需安装第三方依赖。

```bash
cd 当前方案-ToC-AI组队/backend
npm test
npm start
```

默认监听 `0.0.0.0:8787`，数据保存到 `data/demo.sqlite`。可使用环境变量覆盖：

```bash
PORT=8788 HOST=127.0.0.1 DATABASE_PATH=:memory: \
DEMO_ACCESS_KEY='replace-with-a-private-demo-key' npm start
```

只有在可信的本地演示环境需要兼容旧调用时，才可显式设置
`ALLOW_INSECURE_DEMO_AUTH=1`。该开关允许客户端通过 `x-demo-user-id` 模拟任意预置用户，
不得用于公网或不可信局域网。

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

## 演示数据

| 用户 | 旧 Demo 身份值（需显式开启兼容） | 卡片 Token | 可见状态 |
|---|---|---|---|
| 周闻 | `user-zhou` | `cp_7mJ4Qv9N2xK8Rt5W` | Visible |
| 林澈 | `user-lin` | `cp_B3kP8sT6yH2nV9qL` | Visible |
| 苏晴 | `user-su` | `cp_F6wR1cZ8mN4jX2pD` | Paused |

活动 ID：`hackathon-2026`。

## 核心调用

为林澈的预置账号创建 12 小时演示会话：

```bash
curl -X POST http://127.0.0.1:8787/api/auth/demo-sessions \
  -H 'content-type: application/json' \
  -H 'x-demo-access-key: replace-with-a-private-demo-key' \
  -d '{"user_id":"user-lin"}'
```

后续请求使用 `Authorization: Bearer {access_token}`。路演两台手机应提前分别保留一个会话，不在台上走登录流程。

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
  -H 'authorization: Bearer {zhou_access_token}' \
  -d '{"recipient_id":"user-lin","event_id":"hackathon-2026","source":"nfc","message":"想聊聊 ESP32 与端侧 AI"}'
```

林澈的手机每 2.5 秒轮询 incoming 请求箱：

```bash
curl "http://127.0.0.1:8787/api/connections/requests?event_id=hackathon-2026&direction=incoming" \
  -H 'authorization: Bearer {lin_access_token}'
```

林澈接受请求（将 `{request_id}` 替换为上一步返回值）：

```bash
curl -X PATCH "http://127.0.0.1:8787/api/connections/requests/{request_id}" \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer {lin_access_token}' \
  -d '{"action":"accept"}'
```

`action` 还支持 `reject`、`cancel` 和 `block`；其中 `cancel` 仅发起方可操作，`accept`／`reject` 仅接收方可操作，`block` 双方均可操作。拉黑时可附带最长 64 字符的 `reason_code`；服务端会同时关闭双方待处理请求，并把已有 Connection 标记为 `BLOCKED`。

查询 Connection（只有双方可读）：

```bash
curl "http://127.0.0.1:8787/api/connections/{connection_id}" \
  -H 'authorization: Bearer {zhou_access_token}'
```

## 手机端接入契约

手机端在开发阶段使用：

```js
const API_BASE_URL = "http://127.0.0.1:8787";
```

真机联调时，把 `127.0.0.1` 换成本机局域网 IP。服务已开放开发期 CORS；上线前必须改为明确域名白名单，并把演示会话替换成 Supabase／Firebase 或等价的真实 Auth。

## 下一阶段

1. `Visible / Paused / Expired` 写接口与活动加入；
2. 项目、角色缺口、团队邀请与确认入队；
3. Demo Reset 和完整 Event Log 查询；
4. 将 SQLite 仓储替换为 Supabase/PostgreSQL，并接真实 Auth。
