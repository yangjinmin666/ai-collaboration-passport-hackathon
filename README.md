# COSPAN｜合拍

> **找到合拍的人，一起把事做成。**<br>
> **Meet the right people. Build together.**

面向黑客松和高密度共创现场的 To C 实时组队与人机协作产品。

用户通过可授权的 AI 协作护照表达当前状态、能力证据和团队需求；系统解释谁值得认识。主动卡对卡碰触可以建立真实相遇连接，被动 NFC／二维码作为跨手机生态的兼容入口。关系建立后进入 `COSPAN Space｜人机协作空间`，由编排 Agent 拆解目标、路由人类与 Agent 任务，并在人类确认后推进执行与交付。当前 MVP 先交付其中的组队启动、首次分工和关键记录薄闭环，日常沟通、文档与代码仍进入飞书、GitHub 等已有工具。

## 项目结构

- [`00-项目导航与方向决策.md`](./00-项目导航与方向决策.md)：项目总入口与冻结决策；
- [`当前方案-ToC-AI组队/`](./当前方案-ToC-AI组队/)：当前比赛主线；
- [`历史方案-ToB工厂协同/`](./历史方案-ToB工厂协同/)：早期工厂协同方案，仅作方向演变参考。

## 手机端 Demo

```bash
cd 当前方案-ToC-AI组队/prototype/mobile-demo
./run.sh
```

打开：

- `http://localhost:4173/?variant=A`
- `http://localhost:4173/?variant=B`
- `http://localhost:4173/?variant=C`
- `http://localhost:4173/?variant=A&workspace=1`（预置人机协作空间）

当前主演示入口为“发现 · 推荐”（A）。协作护照引导用于建立身份底层，不作为独立产品入口。

## 当前阶段

- 产品阶段：96 小时黑客松 MVP；
- 手机端是现场主入口与项目伴随端，宽屏是 COSPAN Space 主工作台，AI Passport 是可选现场终端；
- 当前差异：发现、理解、真实见面、建联、组队和人机协作启动的连续闭环；
- 潜在壁垒：经用户确认的能力证据、援助结果、项目结果与重复协作关系。

## 开源许可

本项目的原创代码和文档采用 [Apache License 2.0](./LICENSE)。原型头像素材不在 Apache License 2.0 授权范围内，
详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
