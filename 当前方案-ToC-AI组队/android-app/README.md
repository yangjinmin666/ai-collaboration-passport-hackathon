# RALLY Android 体验包

这个目录把 `prototype/mobile-demo` 的当前内容封装成可离线运行的 Android App。构建时会自动复制最新的 `index.html`、`styles.css`、`app.js` 和头像资源，因此 Web 原型仍是唯一界面源文件。

## 构建并安装到真机

手机开启 USB 调试并允许当前电脑后运行：

```bash
./build-and-install.sh
```

生成的调试 APK 位于：

```text
app/build/outputs/apk/debug/app-debug.apk
```

当前安装包默认进入离线静态体验模式，发现、连接、意图澄清、组队和 RALLY Room 流程都可直接操作；真实账号、附近定位后端和 NFC 硬件通信仍属于后续接入范围。
