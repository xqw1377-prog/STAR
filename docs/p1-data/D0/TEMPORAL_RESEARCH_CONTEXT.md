# P1-DATA-D0 · 时态研究上下文合同（TEMPORAL RESEARCH CONTEXT：Narrative 与 Lifecycle)· rev5

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
来源：外部审计 C3（Replay 使用当前 Narrative/Lifecycle = 前视泄漏）+
终审指令"Narrative 与 Lifecycle 也是时态事实，不能继续只存在于可变缓存列"。

## 1. 原则（R5 §1）

研究判断的一切输入都必须是时态事实；可变列只是当前投影缓存，
不得作为 Replay 或评分真源（R5-18）。

## 2. NarrativeSnapshot —— 统一事实身份（R5-16）

NarrativeSnapshot 作为 **Layer N 时态事实，遵循 NormalizedFact 身份与血缘规则**：
`subject_type='narrative'`，fact_kind 专类，payload=五维指标+aliases，
`fact_local_key`（NOT NULL，快照序号/来源内标识），
唯一身份**必须包含 receipt/source 血缘与稳定 local key**——
**禁止仅以 narrative_id + observed_at + parser_version 去重**。
多来源同一时点快照**并存**；冲突按 R5-09（CONTESTED ⇒ 无资格 ⇒ UNKNOWN）处理。
**禁止用 latestEvidenceByCheck 直接选择 NarrativeSnapshot**：
叙事指标选择使用独立的 narrative subject + fact kind 选择器（同一时态截止与平局语义，
独立入口防止与代币证据语义串扰）。

## 3. LifecycleTransition —— 合法、连续、可冲突的状态机事实（R5-17）

- **冻结合法状态图及其版本**（ArtifactRegistry 工件）：规范序
  `SEED → IGNITION → VERIFIED → ACCELERATION → CROWDING → DISTRIBUTION → DEAD`，
  任意前向跳转合法，禁止后退，DEAD 终态；**非法边拒绝入事实层**；
- 连续性：`from_stage` 必须等于该 cutoff 前已解析的有效 stage；**断链进入 CONTESTED**；
- **排序键固定为 `(effective_at, observed_at, ingested_at, id)`**，各字段含义不可互换；
- 同一前态下相互冲突的并发迁移 ⇒ **lifecycle UNKNOWN，不得晚者胜**；
- **触发依据通过关系表引用 Fact**，禁止仅保存无法校验的 JSON id 数组；
- CROWDING / TOO_LATE 的可决策阻断属 J0，但必须消费此时态状态，
  **而不是 projects.lifecycle 缓存列**。

## 4. 历史 cutoff 双重约束（R5-18）

- HISTORICAL 只使用"**cutoff 前已观察/摄入且 cutoff 时已生效**"的事实：
  `effective_time_kind=CHAIN_EVENT` 用链上生效时间；
  `OBSERVATION_BOUND` 只表示"最晚于观察时已成立"；
  `UNKNOWN` **不得被推断为更早生效**；
- `scheduled_at` 仅描述未来安排，不能作为已发生事实进入门禁；
- 修改或删除当前 `projects.lifecycle`、`narratives.*` 缓存**不得改变任一历史
  cutoff 输出**（T29 缓存不变性，R5-T18 扩展为逐案例）。

## 5. 验收测试（并入 D1-B；全量目录见 D0_ACCEPTANCE）

T29（缓存篡改不变性）、T30（点时事实与区分度）、R5-T16（多源快照并存
fail-closed）、R5-T17（非法边/断链/并发冲突→拒绝或 UNKNOWN）、
R5-T18（逐案例缓存不变性）。

## 6. 与外部审计的处置映射

（rev5 起登记于 AUDIT_DISPOSITION.md，rev6 保留并按 R5 §4 对齐：C3→D1-B、
C1/C2→J0、C4→D1-B、C5/C6→S0；基线更正与密钥核查结论沿用。）
