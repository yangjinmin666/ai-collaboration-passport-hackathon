# RALLY Android Live 体验包

这个目录把 `prototype/mobile-demo` 的当前内容封装成 Android App。构建时会自动复制最新的 `index.html`、`styles.css`、`app.js` 和头像资源，因此 Web 原型仍是唯一界面源文件。

APK 默认进入 Live 模式，以 `https://49.233.197.225` 作为受信任 API 地址。用户用中国大陆手机号接收腾讯云短信验证码；未注册手机号验证成功后自动创建 RALLY 身份并进入 2026 AI Hardware Hackathon（`hackathon-2026`）的资料完善页，不需要工程账号或现场访问码。资料、附近定位、建联、项目邀请、入队、Room 任务和刷新恢复都读写真实后端。界面资源仍内置在 APK 中，但业务操作需要可访问的 HTTPS API。

## 构建并安装到真机

手机开启 USB 调试并允许当前电脑后运行：

```bash
./build-and-install.sh
```

如果同一个体验包需要指向另一个受信任演示环境，可在构建时覆盖：

```bash
RALLY_API_ORIGIN=https://49.233.197.225 ./build-and-install.sh
```

构建会拒绝 HTTP、带用户名密码、路径、查询参数或 fragment 的 API 地址，避免把 Bearer Token 发往未受信任端点。

生成的调试 APK 位于：

```text
app/build/outputs/apk/debug/app-debug.apk
```

安装包会申请网络、粗略定位和精确定位权限；只有用户进入“发现 · 附近”时才会触发系统定位授权。NFC 硬件通信仍使用模拟按钮或已实现的后端契约。
