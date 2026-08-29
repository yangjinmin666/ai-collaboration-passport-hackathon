# COSPAN Android Live 体验包

这个目录把 `prototype/mobile-demo` 的当前内容封装成 Android App。构建时会自动复制最新的 `index.html`、`styles.css`、`app.js` 和头像资源，因此 Web 原型仍是唯一界面源文件。

APK 默认进入 Live 模式，以 `https://101.43.172.166` 作为受信任 API 地址。当前体验包可使用 Google 或中国大陆手机号验证码登录；微信入口会引导用户从微信内打开 COSPAN 网页版，待 OpenSDK 接入后再开放原生一键登录。手机号登录不要求先填昵称，首次验证后再进入协作资料完善。资料、附近定位、建联、项目邀请、入队、Room 任务和刷新恢复都读写真实后端。界面资源仍内置在 APK 中，但业务操作需要可访问的 HTTPS API。

Google 授权会交给系统浏览器，完成后通过已验证的 `https://<app-domain>/auth/android` App Link 回到同一个 App 实例。App 只接受构建时固定的 HTTPS host、精确路径和白名单回调参数，再把短时一次性 ticket 交给内置页面；ticket 还必须匹配只保存在发起 WebView 内的 verifier 才能换 Session。Google 控制台仍登记后端 OAuth HTTPS 回调地址。未配置真实 Provider 凭证或 App Link 证书指纹时，Google 按钮显示不可用。

微信当前采用公众号网页授权，只支持用户从微信内打开 COSPAN 网页版。Android 原生一键微信登录需要微信 OpenSDK、开放平台移动应用 App ID、包名／签名校验与 Universal Link，当前体验包会显示“请从微信打开网页版”，不启动不兼容的系统浏览器授权。

## 构建并安装到真机

手机开启 USB 调试并允许当前电脑后运行：

```bash
./build-and-install.sh
```

如果同一个体验包需要指向另一个受信任演示环境，可在构建时覆盖：

```bash
RALLY_API_ORIGIN=https://101.43.172.166 ./build-and-install.sh
```

前端与 API 分域时同时设置 App Link 所属网页源：

```bash
RALLY_API_ORIGIN=https://api.rally.example.com \
RALLY_APP_ORIGIN=https://rally.example.com \
./build-and-install.sh
```

服务器的 `/etc/rally/rally.env` 还需配置当前 APK 签名证书的 `ANDROID_APP_SHA256_CERT_FINGERPRINT`。部署脚本会生成 `/.well-known/assetlinks.json`；调试签名和正式签名必须分别使用各自指纹。没有完成域名关联时不要开放 Android Google 登录。

构建会拒绝 HTTP、带用户名密码、路径、查询参数或 fragment 的 API 地址，避免把 Bearer Token 发往未受信任端点。

生成的调试 APK 位于：

```text
app/build/outputs/apk/debug/app-debug.apk
```

安装包会申请网络、粗略定位和精确定位权限；只有用户进入“发现 · 附近”时才会触发系统定位授权。NFC 硬件通信仍使用模拟按钮或已实现的后端契约。
