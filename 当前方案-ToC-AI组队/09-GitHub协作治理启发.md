---
artifact: github-collaboration-governance-research
version: "1.1"
created: 2026-08-29
updated: 2026-08-29
status: research-complete
product: AI组队与协作产品（工作名）
scope: 黑客松协作空间的归属、权限、变更治理与贡献记录
sources: GitHub 官方文档
---

# GitHub 协作治理机制及其对黑客松协作空间的启发

> 本文承接 [08-人类与Agent协作空间设计.md](./08-人类与Agent协作空间设计.md)。研究范围限定为 GitHub 官方文档，访问日期均为 **2026-08-29**。文中使用 **事实**、**产品推论**、**建议** 三种标签，避免把 GitHub 已有机制与本产品的设计判断混为一谈。

## 1. 结论先行

GitHub 最值得借鉴的不是“按 Commit 数量分配项目权力”，而是把下面几件事明确分开：

1. **资源归属与管理权限：** 仓库归个人还是组织，谁拥有 Read、Write、Maintain、Admin；
2. **工作责任：** Issue／PR 由谁负责，某类文件由谁担任 Code Owner；
3. **变更接受：** 哪些改动必须经过 PR、Review、状态检查才能进入受保护基线；
4. **贡献归属：** Commit 作者、共同作者、PR、Review 等活动分别记录；
5. **历史连续性：** 仓库转移会改变控制主体，但 Git 提交和贡献信息继续保留。

因此，对本产品最重要的结论是：

> **项目／方向发起归属、当前治理权限、任务责任和实际贡献必须分账记录，不能合并成一个“个人权重百分比”。**

这也意味着：

- `ProjectOriginator` 可以永久保留发起归属，但不因此永久拥有最高权限；
- `DirectionOriginator` 可以自荐或被提名为该方向 Leader，但不因发起归属自动获得优先权、Leader 或 Admin；
- Leader 负责维护当前协作基线，不拥有团队成员的任务接受权；
- 实际贡献以具体事件和交付物为证据，不按代码行数或活跃次数做总排名；
- 贡献增加不会自动升级权限，参与度下降也不会抹掉历史贡献；
- Agent 可以提出任务、变更和候选负责人，但不能批准自己的提案、改写历史或永久删除空间。

## 2. GitHub 实际如何分配“归属”与控制权

### 2.1 个人仓库与组织仓库

**事实：** GitHub 个人账号名下的仓库只有一个 Owner，Owner 拥有完整控制权，其他人为 Collaborator。如果需要更细粒度的访问控制，GitHub 建议将仓库转移至 Organization。Organization 则能把不同仓库角色授予成员、团队或外部协作者。

来源：

- [About repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories)（访问：2026-08-29）
- [Permission levels for a personal account repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository)（访问：2026-08-29）

**产品推论：** GitHub 的“Owner”是资源控制主体，不是“最初提出 Idea 的人”或“贡献最大的人”。当仓库归 Organization 时，项目也不会被建模成某一个成员的创意所有物。

**建议：** 本产品应保留 `ProjectOriginator`，因为黑客松中 0→1 Idea 的来源值得被看见；但不要用它代替 `SpaceAdmin`、`TeamLeader` 或贡献记录。

### 2.2 仓库转移：控制权会变，贡献历史不随之消失

**事实：** 转移仓库需要 Admin 权限。转移后，新 Owner 可以立即管理仓库内容、Issue、PR、Release、Project 和设置；Issue、PR、Wiki、Star、Watcher 以及 Git 提交与贡献信息会随仓库转移而保留。原 Owner 会成为新仓库的 Collaborator，转入 Organization 后适用该组织的权限规则。

来源：

- [Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)（访问：2026-08-29）

**产品推论：** 这是 GitHub 对本产品最直接的启发：**Governance 可以交接，Provenance 不应该被交接覆盖。** 当前 Leader 可以改变，历史发起人和历史贡献仍然保留。

**建议：** `LeadershipTerm` 发生交接时只新增一条任期记录，不修改 `ProjectOrigin`、`DirectionOrigin` 或已经确认的贡献事件。

### 2.3 Organization 的五级仓库角色

**事实：** GitHub 为 Organization 仓库提供五个由低到高的角色：

| GitHub 角色 | 官方建议用途 | 与“支配权”的关系 |
|---|---|---|
| Read | 查看和讨论项目的非代码贡献者 | 无写入权 |
| Triage | 管理 Issue、Discussion、PR，但不写代码 | 可协调信息，不可修改代码基线 |
| Write | 主动向项目推送代码的贡献者 | 有执行权，但不是 Admin |
| Maintain | 管理仓库但不能执行敏感、破坏性动作的项目管理者 | 接近运营／维护角色 |
| Admin | 完整访问，包括安全设置和删除仓库等敏感动作 | 资源级最高权限 |

GitHub 的原则是按职能授予满足工作所需的最小权限。Organization Owner 对组织拥有完整行政权限；GitHub 建议每个组织至少有两名 Owner，避免唯一 Owner 失联导致项目不可访问。

来源：

- [Repository roles for an organization](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization)（访问：2026-08-29）
- [Roles in an organization](https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/roles-in-an-organization)（访问：2026-08-29）
- [Maintaining ownership continuity for your organization](https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/maintaining-ownership-continuity-for-your-organization)（访问：2026-08-29）

**产品推论：** GitHub 不会因为某人的 Commit 多、创建了仓库或担任 Code Owner，就自动把他升级为 Admin。**贡献、责任与管理权限相互关联，但不自动互相推导。**

**建议：** 本产品不必复制五级角色，但必须保留“成员可以执行，不等于可以管理全局权限”和“Leader 可以协调，不等于可以删除历史”这两个边界。

## 3. GitHub 如何保护正式基线

### 3.1 Protected Branch：正式结果不能被随意覆盖

**事实：** GitHub 的保护分支可以要求：

- 必须通过 Pull Request；
- 必须获得指定数量的批准；
- 必须通过状态检查；
- 必须解决 Review 对话；
- 必须由 Code Owner 审批；
- 限定谁可以 Push；
- 要求签名提交、线性历史或 Merge Queue；
- 禁止 Force Push 和删除。

保护分支默认阻止 Force Push 和删除。Admin 默认可能绕过保护规则，但可以开启“不允许绕过”，让规则同样约束 Admin。

来源：

- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)（访问：2026-08-29）

**产品推论：** 本产品的 `PlanBaseline` 相当于受保护主分支。成员与 Agent 的新规划、改派和交付物都应先成为候选 Diff，而不是直接覆盖正式基线。

**建议：** 已接受任务、已验收成果、方向谱系和贡献记录都不能被 Agent 原地编辑。任何改动必须新增 `ChangeRequest`、显示前后差异，并保留旧版本。

### 3.2 Rulesets：保护规则可以叠加，并采用更严格结果

**事实：** GitHub Ruleset 可以作用于分支、Tag 或 Push。多个 Ruleset 可以同时作用于同一目标，并与 Branch Protection 叠加；没有优先级，规则会聚合，同一规则存在不同设置时采用最严格的版本。Ruleset 还可以配置特定角色、团队或 GitHub App 的绕过权限。

来源：

- [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)（访问：2026-08-29）

**产品推论：** “是否允许本次变更”不应只由 Leader 身份决定，而应同时考虑角色、对象范围、受影响成员、历史保护级别与 Agent 风险等级。

**建议：** 延续 `08-` 文档中的权限公式：

```text
有效权限
= 角色基础权限
∩ 当前对象范围
∩ 数据授权范围
∩ 变更等级与预算限制
```

### 3.3 Required Review：批准必须针对最新 Diff

**事实：** GitHub 可以要求 PR 获得指定数量的有效批准后才能合入；批准人可以是拥有 Write 权限的人或对应 Code Owner。新 Commit 改变 Diff 后，可以让旧批准失效；也可以要求最后一次可 Review 的 Push 必须由 Push 者以外的人批准。`Request changes` 可以阻塞合并。

来源：

- [Require pull request reviews before merging](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-pull-request-reviews-before-merging)（访问：2026-08-29）
- [Pull request reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews)（访问：2026-08-29）

**产品推论：** 多人确认不能只保存“某人曾经同意过”。如果提案内容后来大幅改变，旧确认不应继续有效；提案者也不应成为自己最后一次重大修改的唯一验收者。

**建议：** `ApprovalRecord` 绑定 `proposal_version` 或内容 Hash。重大提案产生新版本后，受影响成员需要重新确认；Agent、提案最后修改者不能单独完成最终审批。

## 4. GitHub 如何区分责任人、审核者和贡献者

### 4.1 Assignee：工作责任不等于治理权

**事实：** GitHub Issue 和 PR 可以分配给一名或多名 Assignee，每项最多十人。Assignee 用来明确谁在处理具体工作。官方机制没有把 Assignee 自动升级为仓库管理者。

来源：

- [Assigning issues and pull requests to other GitHub users](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/assigning-issues-and-pull-requests-to-other-github-users)（访问：2026-08-29）

**产品推论：** 任务负责人只对一个工作项负责，不应获得项目级 Agent 调度、成员管理或历史删除权限。

**不能照搬：** GitHub Assignee 是一个可被他人设置的责任字段，官方流程没有本产品所要求的“被指派者接受后才生效”语义。黑客松成员是有兴趣、学习意愿和承诺边界的人，必须保留接受、拒绝和申请认领。

### 4.2 CODEOWNERS：按范围分配审核责任，而不是授予整个项目所有权

**事实：** `CODEOWNERS` 文件把代码路径分配给个人或团队。PR 修改对应文件时会自动请求这些人 Review；Code Owner 必须预先拥有 Write 权限，`CODEOWNERS` 本身不会赋予权限。保护分支可以要求 Code Owner 批准。一个规则列出多个 Code Owner 时，默认任意一位批准即可，并非所有人一致批准。

来源：

- [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)（访问：2026-08-29）

**产品推论：** 本产品可以建立 `ScopeOwner／ArtifactReviewer`：负责硬件、前端、路演或用户研究的成员，对自己范围内的交付物拥有优先 Review 责任，但不因此成为整个项目的 Owner 或 Leader。

**不能照搬：** CODEOWNERS 只表达“某路径由谁 Review”，不能表达 Idea 发起、当前兴趣、学习意愿、线下执行、方向选择或协调贡献，也不能作为 Leader 产生机制。

## 5. GitHub 如何记录贡献，以及它遗漏了什么

### 5.1 Commit 作者与共同作者

**事实：** Commit 保存具体修改、时间、创建修改的人以及 Commit Message。多人共同完成时，可以在 Commit Message 中添加一个或多个 `Co-authored-by: NAME <EMAIL>` Trailer。若要将共同作者计入 GitHub Contribution，使用的邮箱需要与其 GitHub 账号关联。

来源：

- [Commits](https://docs.github.com/en/pull-requests/reference/commits)（访问：2026-08-29）
- [Creating a commit with multiple authors](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors)（访问：2026-08-29）

**产品推论：** 一项成果不应强制只有一个“贡献者”。至少要允许区分主要执行者、共同贡献者、Reviewer、提供关键建议者和最终验收者。

### 5.2 Contributors Graph 与个人贡献图不是完整贡献账本

**事实：** GitHub Contributors Graph 只展示前 100 名 Commit 贡献者，Merge Commit 和空 Commit 不计入；未合并到默认分支、邮箱未关联账号的 Commit 也可能不出现在图中。个人 Profile 的 Contribution 还可能包括 Issue、PR、PR Review、Discussion 和 Commit，但必须满足 GitHub 的显示条件。

来源：

- [Viewing a project's contributors](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors)（访问：2026-08-29）
- [Profile contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference)（访问：2026-08-29）
- [Troubleshooting missing contributions](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/troubleshooting-missing-contributions)（访问：2026-08-29）

**产品推论：** GitHub 统计的是满足平台规则的活动或 Commit，不是贡献质量、项目影响或治理权。它会系统性低估：

- Idea 与方向提出；
- 产品判断和用户研究；
- 视觉设计、演示表达和现场路演；
- 硬件组装、焊接和设备调试；
- 协调排期、解除阻塞和帮助他人；
- 没有合入主分支但形成有效认知的实验；
- 对 Agent 产出的审查、纠错和风险承担。

**建议：** 本产品记录“发生了什么以及证据在哪里”，而不是计算“谁贡献了 37%”。可量化的次数仅用于筛选记录，不直接展示为价值排名，更不能自动换算为 Leader、Admin、奖金或权益。

### 5.3 审计日志：记录谁在何时做了什么

**事实：** GitHub Organization Audit Log 会记录执行者、动作、时间、仓库以及受影响对象等信息，并支持按 Actor、Operation、Repository、Action 和时间检索。

来源：

- [Reviewing the audit log for your organization](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)（访问：2026-08-29）

**产品推论：** 贡献归属争议的解决基础不是 Agent 事后生成一个分数，而是可靠的事件流：谁提出、谁确认、谁接受、谁提交、谁共同完成、谁 Review、谁验收，以及每一步对应哪个版本。

## 6. Fork、归档与删除对方向治理的启发

### 6.1 Fork：保留来源，同时允许独立协作

**事实：** GitHub Fork 是从上游仓库复制产生的独立仓库，有自己的设置和权限，但保持与上游的连接；Fork 与 Branch 不同，Fork 是独立协作空间，可以拥有自己的成员、Issue、PR、Action 和 Project。

来源：

- [Forks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-permissions-and-visibility-of-forks)（访问：2026-08-29）

**产品推论：** 当方向 B 与方向 A 的目标用户、问题和预期结果已经实质不同，建立 B 的独立 Direction Fork 比原地覆盖 A 更诚实。B 可以有自己的发起人、Leader、成员、任务和成果，同时保留 `forked_from=A`。

**不能照搬：** GitHub Fork 的可见性与权限受仓库网络规则影响，本产品的 Direction Fork 需要成员逐项授权，不应自动复制所有私密资料、Agent 上下文和参与者权限。

### 6.2 归档优先于永久删除

**事实：** GitHub 仓库归档后，Issue、PR、代码、Commit、分支、评论和权限等会变成只读；仓库可以再解除归档。永久删除仓库则只要求 Organization Owner 或 Repository Admin 操作，不要求所有协作者共同批准。部分删除的仓库可在 90 天内恢复，但恢复不会恢复团队权限。

来源：

- [Archiving repositories](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories)（访问：2026-08-29）
- [Deleting a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository)（访问：2026-08-29）
- [Restoring a deleted repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/restoring-a-deleted-repository)（访问：2026-08-29）

**产品推论：** GitHub 值得借鉴的是“先归档、可恢复、保护分支默认不可删除”，而不是“一个 Admin 可以删除全部历史”。本产品还承载多人的协作护照与非代码贡献证据，永久删除的影响跨越单个管理员，因此需要比 GitHub 更强的共识机制。

## 7. 与上一版模型的冲突及修正

`08-` 文档 v0.5 曾包含以下设计；结合“只记录贡献、不涉及权益”的最新约束后，前两项已在 v0.6 修正，后两项作为有意比 GitHub 更严格的保护继续保留：

| 上一版模型／保留规则 | GitHub 官方机制 | 是否冲突 | 最终处理 |
|---|---|---|---|
| `ProjectOriginator` 默认成为首任 `FoundingLeader` | 个人仓库创建者是唯一 Owner；组织仓库归 Organization。GitHub 不单独保存“Idea 发起人→首任 Leader”的治理规则 | **与纯贡献记录目标冲突** | 改为单人阶段的 `BootstrapCoordinator`；首个团队基线前必须由成员显式授予 Coordinator／Maintainer 权限 |
| `DirectionOriginator` 是新方向 Leader 的优先候选 | CODEOWNERS 只按代码路径指定审核责任；GitHub 没有方向发起人或 Leader 候选机制 | **与权限按职能授予冲突** | 保留方向发起署名；可以自荐或被提名，但不因发起归属自动获得治理优先权 |
| 2–5 人团队重大独立方向变更需要全员确认 | GitHub PR 通常要求一定数量的 Review 或 Code Owner 批准，并不会识别“产品方向变更”，也不默认要求所有 Collaborator 一致 | **有意比 GitHub 更严格** | 仅对“用 B 替换当前 Active Direction”要求全员确认；不能一致时建立 B Fork，避免一票永久阻塞探索 |
| 永久删除共享历史需要全员确认 | GitHub 允许一个 Organization Owner 或 Repository Admin 删除仓库，部分仓库可在 90 天内恢复 | **明确冲突** | 保留本产品的强化规则；普通用户只见归档／退出，硬删除要求全员确认、冷静期、再次认证和恢复快照，Agent 永无硬删除权 |

这四处差异并不说明当前模型错误。它说明 GitHub 优先解决“代码仓库由谁管理、什么代码可以合入”，而本产品还要解决“0→1 Idea 如何保留来源、跨职能贡献如何被看见，以及多人共享历史如何避免被单方抹除”。

真正需要修正的只有一点：

> **不能因为我们尊重项目发起人，就把发起归属、首任协调权、长期 Leader、Admin 和最终贡献混成同一种权力。**

## 8. 适合 2–5 人、96 小时黑客松的精简治理方案

### 8.1 四种运行角色

| 角色 | 核心权限 | 明确禁止 |
|---|---|---|
| `SpaceAdmin` | 成员访问、授权恢复、空间安全设置；建议项目发起人＋一名备份管理员 | 不因 Admin 身份替成员接受任务，不单方改写贡献和方向来源 |
| `Coordinator／Maintainer` | 首个团队基线前由成员显式确认；维护当前目标、排期、任务基线，确认候选负责人，批准共享 Agent 调用 | 不能替被指派者承诺，不能单方覆盖受保护历史 |
| `Member` | 提议任务、表达“我想做”、接受／拒绝自己的任务、提交产出、参与 Review | 不能修改他人已接受任务，不能调度项目级共享 Agent |
| `Agent` | 拆解目标、生成候选分工、解释风险、产出草稿、运行获授权检查 | 不能任命 Leader、确认归属、替人接受任务、批准自己的产出或永久删除 |

`TaskOwner` 和 `Reviewer` 不必做成永久空间角色，而是每个 `WorkItem／Artifact` 上的对象级责任。

### 8.2 最小审批规则

| 动作 | 最小生效条件 |
|---|---|
| 创建任务草稿 | 任一成员或 Agent 可提出 |
| 确认任务负责人 | Coordinator 选择候选＋候选人本人接受 |
| 成员主动认领任务 | 成员申请＋Coordinator 确认对基线影响；本人接受动作已经包含在申请中 |
| 提交成果 | Task Owner 或共同执行者提交，生成新 Artifact Version |
| 成果进入正式空间 | 至少一名非最后提交者 Review；关键模块优先由 Scope Owner Review |
| 改派已接受任务 | Coordinator＋原负责人释放＋新负责人接受；受影响下游成员确认 |
| 用完全独立的 B 替换 A | 所有有效自然人成员确认；无法一致则创建 B Fork |
| 归档空间 | Coordinator 发起，成员收到通知；可恢复 |
| 永久删除共享历史 | 所有有效自然人成员确认＋冷静期＋再次认证＋可恢复快照；Agent 无权参与表决 |

### 8.3 精简贡献记录：记录事实，不计算总分

每一条贡献记录至少包含：

| 字段 | 含义 |
|---|---|
| `event_type` | `ORIGIN_PROPOSED`、`DIRECTION_ADOPTED`、`TASK_ACCEPTED`、`ARTIFACT_SUBMITTED`、`CO_AUTHORED`、`REVIEWED`、`DECISION_ACCEPTED`、`BLOCKER_RESOLVED` |
| `actor` | 做出动作的人或 Agent |
| `contribution_role` | 发起者、主要执行者、共同贡献者、Reviewer、协调者、支持者 |
| `subject` | 对应的 Direction、WorkItem、Artifact、Decision 或 ChangeRequest |
| `evidence_ref` | Git Commit／PR、Figma、文档版本、照片、测试记录、演示视频或现场确认 |
| `version_or_hash` | 贡献所对应的具体版本，避免内容改变后仍沿用旧确认 |
| `confirmed_by` | 谁确认这条归属或验收结果；自报能力不自动成为已确认贡献 |
| `occurred_at` | 发生时间 |
| `visibility` | 仅团队、写入个人协作护照、用户明确授权后公开 |

面向用户的展示应是可理解的事实：

```text
周闻 · 项目最初发起人
林澈 · 方向 B 发起人（3/3 成员确认采用）
周闻 · 主负责 NFC 建联接口 · 交付版本 v3
林澈、陈也 · 共同完成手机端交互
陈也 · Review 并验收演示版本
林澈 · 发现并解除设备配网阻塞
```

不要展示：

```text
周闻 42% · 林澈 35% · 陈也 23%
```

原因是：发起、执行、Review、协调、硬件现场操作和方向判断不可用同一个客观换算率比较；本项目又不涉及股权或投资，没有必要制造虚假的精确度。

## 9. 96 小时 Demo 应做到什么

本期不需要开发 GitHub 级别的完整权限系统。只需要通过一条演示链证明治理原则：

1. 创建项目时记录项目发起人；单人阶段由其作为 Bootstrap Coordinator，成员入队后显式确认 Coordinator；
2. Agent 生成三项任务和候选负责人，界面明确标记“建议”；
3. Coordinator 可以调整候选人，但成员必须自己接受任务；
4. 成员点击“我想做”，即使经验不足，也可以选择结对或 Agent 辅助；
5. Task Owner 提交一个交付物，另一名成员 Review 后进入正式成果；
6. 页面展示“提出—确认—接受—执行—共同贡献—Review—验收”的事件链；
7. Agent 尝试重排时只生成 Diff 卡片，不改变当前负责人；
8. 完全独立方向 B 无法一致时，界面演示“保留 A，并 Fork B”；
9. 删除历史时只展示多人确认与归档，不执行真实硬删除。

现场路演可以用一句话解释：

> **我们借鉴 GitHub 的不是 Commit 排名，而是它把权限、责任、Review 和贡献历史分开的方式；再把这套机制扩展到 Idea、设计、硬件、路演以及人与 Agent 的跨职能协作。**

## 10. 最终产品原则

1. **发起归属永久保留，治理任期允许交接；**
2. **贡献以具体成果和事件为证据，不生成公开综合排名；**
3. **贡献不会自动换算为权限，权限也不会覆盖贡献历史；**
4. **任务分配必须由人选择，并由执行者本人承诺；**
5. **所有正式成果先 Review、后进入基线；**
6. **方向发生实质分裂时优先 Fork，不原地抹掉旧方向；**
7. **低风险动作保持顺畅，跨成员、跨任务、不可逆动作自动升级；**
8. **Agent 只能建议、执行获授权的可审查任务，不能确权、投票或销毁历史。**

## 11. 官方来源汇总

以下来源均为 GitHub 官方文档，访问日期均为 2026-08-29：

1. [About repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories)
2. [Permission levels for a personal account repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository)
3. [Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)
4. [Repository roles for an organization](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization)
5. [Roles in an organization](https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/roles-in-an-organization)
6. [Maintaining ownership continuity for your organization](https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/maintaining-ownership-continuity-for-your-organization)
7. [Assigning issues and pull requests to other GitHub users](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/assigning-issues-and-pull-requests-to-other-github-users)
8. [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
9. [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
10. [Pull request reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews)
11. [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
12. [Commits](https://docs.github.com/en/pull-requests/reference/commits)
13. [Creating a commit with multiple authors](https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors)
14. [Viewing a project's contributors](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors)
15. [Profile contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference)
16. [Troubleshooting missing contributions](https://docs.github.com/en/account-and-profile/how-tos/contribution-settings/troubleshooting-missing-contributions)
17. [Reviewing the audit log for your organization](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-security-settings-for-your-organization/reviewing-the-audit-log-for-your-organization)
18. [Forks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-permissions-and-visibility-of-forks)
19. [Archiving repositories](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories)
20. [Deleting a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository)
21. [Restoring a deleted repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/restoring-a-deleted-repository)
