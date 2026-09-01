# COSPAN｜合拍 微信小程序

这是 COSPAN 的原生微信小程序入口，面向中国现场活动和冷启动体验。它不是 H5 `web-view` 外壳，直接调用现有 COSPAN 腾讯云后端。

## 当前可体验的闭环

1. 微信一键登录，无需手输账号或现场访问码。
2. 完善活动角色、技能、兴趣、时间和协作需求，主动开启现场可见。
3. 查看缺口匹配与理由，向另一位参与者发起认识请求。
4. 对方确认后建立真实 Connection，可创建项目、发出入队邀请并确认加入。
5. 在 COSPAN Space 生成起步任务，成员亲自领取，全员确认计划后开始执行。
6. 可选前台定位心跳，只返回距离区间，切页或离开小程序时主动删除。

## 个人主体边界

当前小程序按“个人主体”设计：首版不依赖微信支付、企业认证、客服或受限社交类开放能力。发布前必须在微信公众平台选择个人主体可用、与实际功能一致的服务类目，并按当时审核要求提交隐私指引。

组队和建联必须由用户主动发起、双方确认；Agent 只提供匹配与任务建议，不代替用户加入团队、领取任务或发送内容。

## 开发者工具运行

1. 打开微信开发者工具，导入本目录。
2. `project.config.json` 当前使用 `touristappid`，可先预览页面结构；需要调用 `wx.login` 联调时，替换为你刚注册的真实小程序 AppID，并同步把腾讯云 `WECHAT_MINI_PROGRAM_APP_ID` / `WECHAT_MINI_PROGRAM_APP_SECRET` 换成同一小程序的配置。`touristappid` 不产生可迁移的真实用户；正式对外后不应再更换 AppID，否则 OpenID 主体会变化，需要单独的账号迁移方案。
3. 开发配置已关闭“校验合法域名”，开发 API 指向 `https://101.43.172.166`。这仅适合开发者工具；真机预览、体验版和正式版仍受微信合法请求域名和 TLS 限制。
4. 腾讯云后端设置 `WECHAT_MINI_PROGRAM_APP_ID` 和 `WECHAT_MINI_PROGRAM_APP_SECRET`，重启服务后确认 `/health` 返回 `wechat_mini_login=ready`。

正式发布时把 `miniprogram/config.js` 第一行的 `API_ENV` 从 `development` 改为 `production`，客户端就会使用 `https://api.cospan.cn`。同时在微信公众平台配置该 HTTPS `request` 合法域名。该域名需要可验证的证书，中国大陆部署通常还需要备案；公网 IP 不能作为正式小程序合法请求域名。

## 密钥安全

AppSecret 只存在服务器环境文件，不存在本目录。小程序只将 `wx.login` 一次性 `code` 发给 COSPAN 后端，服务器不向客户端返回微信 `session_key`。

## 测试

```bash
node --test test/*.test.cjs
```
