# RALLY｜集结：组队与协作领域语言

本上下文描述从现场建联、组队到人类与 Agent 协作的核心概念。它用于避免把发起归属、当前治理权限和实际贡献混为同一个“权重”。

## 项目与方向

**项目发起人（Project Originator）**：
提出项目最初 0→1 Idea，并由相关成员确认其来源的人；可以是共同发起。该归属永久保留，但不等同于永久 Leader。
_Avoid_: 永久 Owner、永久 Leader、项目最高权重者

**方向（Direction Version）**：
团队在一个阶段正式采用的目标用户、核心问题和预期结果组合。方向以版本或分支演进，不原地覆盖上一方向。
_Avoid_: 直接改写项目 Idea、用当前方向覆盖历史方向

**方向发起人（Direction Originator）**：
首先提出某个被团队采用方向的人；可以是共同发起，并与最初项目发起人不同。
_Avoid_: 自动 Leader、项目发起人的替代者

**方向转型（Direction Transition）**：
团队确认从一个方向进入另一个方向的记录，明确属于连续 Pivot 还是独立 Fork。
_Avoid_: 无版本的 Idea 修改

**发起归属（Origin Attribution）**：
项目或方向 0→1 来源的受保护历史记录。它只能追加共同发起或更正说明，不能由 Agent 或普通编辑原地改写。
_Avoid_: 综合权重、贡献总分、Leader 权限

## 协作治理

**协作空间（Collaboration Space）**：
围绕一个明确项目和当前方向组织成员、Agent、任务、权限、交付物与历史的临时协作边界。
_Avoid_: 聊天群、通用项目管理平台

**团队 Leader（Team Leader）**：
在一个明确方向和阶段内负责目标、优先级、依赖与共享 Agent 调度的人。Leader 通过任期生效，可以交接，不覆盖项目或方向发起归属。
_Avoid_: 永久负责人、Idea 所有人

**启动协调人（Bootstrap Coordinator）**：
团队尚未形成时，由项目发起人临时承担的初始化角色，只负责邀请成员、补充上下文和生成首版草案；首个团队基线确认后结束或转为显式授予的 Leader 任期。
_Avoid_: Founding Leader、因发起贡献自动获得的长期治理权

**Leader 任期（Leadership Term）**：
某人在指定方向或阶段担任 Leader 的有时效治理记录，包含产生方式、开始、结束和交接。
_Avoid_: 用户表上的永久 leader 标记

**任务负责人（Task Owner）**：
明确接受一项任务并对其执行、局部协作和交付负责的人。
_Avoid_: 被 Agent 推荐但尚未接受的人

**实际贡献（Contribution Evidence）**：
经相关成员确认的任务、决策、交付物或援助结果。它与发起归属分别记录，不反向决定历史发起权。
_Avoid_: 工时排行、公开个人评分

## 人机协作

**分工建议（Assignment Proposal）**：
Agent 或成员提出的候选负责人、理由、风险和协作方式；它不是正式任命。
_Avoid_: 自动派活、正式负责人

**计划基线（Plan Baseline）**：
成员确认过的当前方向、任务、负责人、依赖和排期版本。Agent 只能针对它提出带 Diff 的变更请求，不能原地覆盖。
_Avoid_: Agent 可自由修改的任务列表

**变更请求（Change Request）**：
对计划基线、方向、权限或历史提出的结构化修改，包含影响范围、审批要求和回滚方案。
_Avoid_: Agent 直接重新规划并生效
