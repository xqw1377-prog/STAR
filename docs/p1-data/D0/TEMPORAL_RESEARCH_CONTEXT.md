# P1-DATA-D0 · 时态研究上下文合同（TEMPORAL RESEARCH CONTEXT：Narrative 与 Lifecycle）· rev4

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
来源：外部审计 C3（Replay 使用当前 Narrative/Lifecycle = 前视泄漏）+
终审指令"Narrative 与 Lifecycle 也是时态事实，不能继续只存在于可变缓存列"。

## 1. 原则

研究判断的**一切输入**（代币事实、叙事指标、生命周期阶段）都必须是时态事实。
任何可变列（`projects.lifecycle`、`narratives.*`）只能是**当前投影缓存**，
不得作为 Replay 或评分的真源。

## 2. NarrativeSnapshot（Layer N 事实）

| 字段 | 说明 |
|---|---|
| `id` / `narrative_id` | 标识与叙事主体 |
| `payload` | 五维指标（novelty / velocity / breadth / onChainConfirm / survival）+ aliases |
| `observed_at` / `ingested_at` | 三重时间之二；快照类 ⇒ `effective_time_kind = OBSERVATION_BOUND`，`effective_at = observed_at` |
| `source` / `receipt_id` | 来源与 raw 血缘（Layer N 事实一视同仁：经 parser、可溯源、受处置规则约束） |
| `parser_id` / `parser_version` / `payload_hash` | 解释版本与确定性 |
| `supersedes_fact_id` | 单向替代链（旧行不改） |

唯一约束：`UNIQUE (narrative_id, observed_at, parser_id, parser_version)`
（同叙事同观察时刻同版本幂等）。评分取 cutoff 前最新 Snapshot（内核
`latestEvidenceByCheck` 同款截止+平局语义）。

## 3. LifecycleTransition（Layer N 事实，append-only）

| 字段 | 说明 |
|---|---|
| `id` / `project_id` | 标识 |
| `from_stage` / `to_stage` | 生命周期七态迁移 |
| `trigger_fact_ids` | 触发证据（指向 NormalizedFact/报告事实，可审计） |
| `observed_at` / `effective_time_kind` / `effective_at` | 事件可知则 CHAIN_EVENT，否则 OBSERVATION_BOUND/UNKNOWN |
| `ingested_at` / `source` / 血缘字段 | 同上 |

项目在任一 cutoff 的生命周期 = **该 cutoff 前最后一条 Transition 的 `to_stage`**。
`projects.lifecycle` 列 = 该推导的当前缓存。

## 4. 禁令与回放语义

- `evaluateProjectAsOf` / Replay / 评分**禁止读取** `projects.lifecycle`、
  `narratives.*` 当前列；只读上述两类时态事实按 cutoff 过滤后的结果
  （C3 修复的合同化）；
- `HISTORICAL` 回放固定三件套：**当时的 NarrativeSnapshot、当时的
  LifecycleTransition 序列、当时的 interpretation_context**（parser/规则/策略
  内容哈希，FACT_LAYERING §7）；三者齐备才可声称字节级复现；
- 当前列仅供 Desk 展示与运营查询，写入路径 = 投影刷新（可随时从时态事实重建）。

## 5. 验收测试（并入 D1-B）

- **T29 缓存不变性**：修改/删除当前缓存列（`projects.lifecycle`、`narratives.*`）
  后，任意历史 cutoff 的评估输出**字节级不变**；
- **T30 点时事实**：cutoff 后新增 NarrativeSnapshot / LifecycleTransition 不影响
  cutoff 输出；篡改 observed_at 至 cutoff 前 ⇒ 输出必须变化（区分度，独立于无前视不变量）。

## 6. 与外部审计的处置映射（登记，不在本轮实现）

| 审计项 | 定级 | 处置（按终审冻结顺序） |
|---|---|---|
| C1 Readiness 公式（现值 `READY ? score/100 : 0` 与 PRD 乘法公式不符） | High | **J0**：先冻结 `DecisionReadiness = GateBlocker × EvidenceCompleteness × OpportunityScore × LifecycleFit`（量纲/空值/CROWDING·TOO_LATE/Confidence 定义），再改实现 |
| C2 CROWDING 项目进入 Top-K | Critical | **J0**（lifecycleFit 与队列过滤规则一并冻结）+ D1-B（lifecycle 改为时态事实后，TOO_LATE 判定基于 cutoff 时点） |
| C3 Replay 读当前 Narrative/Lifecycle | Critical | **本合同**（D1-B 实现 T29/T30） |
| C4 ingested 早于 observed（采集前固定 ingestedAt） | Critical-for-real-source | **D1-B**：写入前时态校验（observed ≤ ingested 强制），真源阻断期间未污染真实事实 |
| C5 providerStatus 返回 RPC URL | Security P0 | **S0**：状态接口永不返回 URL/query/header/密钥 |
| C6 seed/collect 无鉴权 | Security P0 | **S0**：生产默认关闭写接口；本地需显式开关+独立 token；seed 标记 destructive 且限合成库；collect 限流+project 必填+来源门禁 |
| 其余（时区、伪 Confidence 口径、mint/freeze 理由污染、锁仓过期未检查、幂等、fixture 墙钟漂移） | 成立 | 时区/Confidence ⇒ J0；理由污染/锁仓过期 ⇒ J0/D1-B 规则细化；幂等 ⇒ rev4 已冻结（IDEM）；fixture 时钟 ⇒ D1-B 固定时钟注入 |

基线更正（登记）：`ffaf938` 载体干净、代码 diff 为零；审计所述"D0 文档未提交改动"
指向隔离中的本机 main（`5f0001a` 已 GOVERNANCE revert），不属于已审候选。
密钥轮换提示：本仓库无 `.env`、`STAR_RPC_URL` 默认公共主网（无密钥）、测试仅绑定
localhost；**未发现公网暴露证据**。若操作者曾在别处以含密钥 URL 暴露过本服务，
请自行轮换（S0 前置检查项）。
