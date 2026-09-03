# P1-DATA-D0 · 事实分层合同（FACT LAYERING CONTRACT）· rev4

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
版本链：rev1→rev2→rev3 均已替代。rev4 闭合终审八项阻断：
#1 递交一致性、#2 Attempt 两阶段化、#3 fact 唯一键扩展、#4 冲突作用域拆分、
#5 处置状态机、#6 事实时间字段下移、#7 解释上下文完备性、#8 健康闭合（详见 DATA_HEALTH）。

## 1. 五层模型

```text
Layer A0 AttemptStarted（发请求前持久化，append-only）
Layer A1 AttemptOutcomeEvent（收到结果/超时/错误/中止，append-only）
Layer R  RawReceipt（SUCCESS/PARTIAL；由 OutcomeEvent 引用；不可变）
Layer N  NormalizedFact（append-only；单向 supersedes；每条事实自带时间语义）
Layer P  研究投影（interpretation_context 冻结；HISTORICAL/REINTERPRET 双模式）
```

**核心禁令**：Gate/Score/页面/API 不得直接解释 Layer A/R；无响应不形成 Receipt。

## 2. Layer A0 — AttemptStarted（阻断 #2：先持久化，再发请求）

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` | uuid | 行标识 |
| `observation_key` | char(64) | 查询身份（IDEMPOTENCY §2） |
| `collection_run_id` | uuid | 采集批次 |
| `collection_plan_item_id` | uuid·null | **采集计划项引用（阻断 #8）**：计划项声明目标 (project, expected_fact_kind)，使失败请求也可归因到 ProjectHealth |
| `request_params_sanitized` | jsonb | **脱敏快照**：禁止包含 API key、Authorization、签名、含凭证的 URL；脱敏在 canonical 化**之前**完成，`observation_key` 基于脱敏后形态计算（键稳定性不受影响） |
| `attempt_origin` | enum | `INITIAL` / `RETRY` / `CRASH_REPLAY` / `SCHEDULER_REISSUE` |
| `retry_of_attempt_id` | uuid·null | 重试链：指向所重试的 **AttemptStarted.id**（崩溃重放指向崩溃前已持久化的 Start 行——Start 先于请求存在，链条永不悬空） |
| `started_at` | timestamptz | 持久化时刻 |

约束：**在网络请求发出之前写入**；append-only；无唯一约束（绝不合并）。
一行 = 一次将要/已经发生的物理请求。

## 3. Layer A1 — AttemptOutcomeEvent（append-only，一次事件一行）

| 字段 | 类型 | 语义 |
|---|---|---|
| `attempt_started_id` | uuid | 指向 AttemptStarted |
| `outcome` | enum | `RESPONSE_RECEIVED` / `TIMEOUT` / `ERROR` / `ABORTED` |
| `error_code` / `http_status` / `latency_ms` | | 遥测 |
| `error_body_hash` / `error_body_ref` | char(64)·null / text·null | HTTP 错误响应若实际收到字节：哈希恒存；字节本体仅当 `retention_class=RAW_RETAINED` 时落 blob（受 §5 处置约束） |
| `receipt_id` | uuid·null | `RESPONSE_RECEIVED` 时**在写入本事件时即携带**——Receipt 引用只存在于 OutcomeEvent，**任何行都不回填** |
| `completed_at` | timestamptz | 完成/放弃时刻（健康滑窗边界） |

崩溃语义（阻断 #2）：请求期间崩溃 ⇒ Start 行存在、无 OutcomeEvent。
重启后 `CRASH_REPLAY` 的 Start 以 `retry_of_attempt_id` 指向该孤儿 Start——
"是否发出/是否到达来源端"永远如实表达为**未知**，不再声称可无损重建。

## 4. Layer R — RawReceipt

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` / `observation_key` / `collection_run_id` / `attempt_outcome_event_id` | | 标识与血缘（直指产出它的 OutcomeEvent） |
| `anchor_slot` / `anchor_time` | bigint·null / timestamptz·null | 链上/离线锚（至少其一） |
| `observed_at` / `ingested_at` | timestamptz | **Receipt 只保留这两种时间 + 锚**（阻断 #6：effective/scheduled 全部下移到事实层） |
| `payload_bytes_hash` | char(64) | 原始响应字节（as-received）SHA-256，必填 |
| `payload_ref` / `payload_inline` | text / bytea·null | **至少其一，必填**；blob 存放规则见 §5.2 |
| `status` | enum | `SUCCESS` / `PARTIAL` |
| `schema_version` / `parser_version_at_ingest` | text | 信封 `star-raw@3` / 信息性快照 |
| `retention_class` / `license_class` | enum / text | 来源注册表快照 |
| `relation` / `relates_to` | enum·null / uuid·null | `CONTESTS` / `SUPERSEDES`（仅同源回执间，见 IDEMPOTENCY §4） |
| `created_at` | timestamptz | 首次 ingest |

## 5. 不可变性与处置状态机（阻断 #5 完整冻结）

### §5.1 行级不可变

RawReceipt / AttemptStarted / AttemptOutcomeEvent / NormalizedFact 一律
**禁止 UPDATE / DELETE**（触发器 + repository 单入口）。

### §5.2 blob 存放与引用计数（防错误共享）

- blob 键 = `payload_bytes_hash`，但**存储命名空间包含 (source_id, retention_class)**：
  同字节跨许可范围**不得共享物理对象**；
- 同命名空间内允许同哈希多 Receipt 共享，配 **append-only 引用计数台账**
  `blob_refcount_event`（`+1 receipt / −1 purge / RECONCILE`）；物理删除仅当计数归零；
- 对账：purge worker 每次执行前后核对台账计数与实际引用数。

### §5.3 处置事件完整枚举（append-only `raw_disposition_event`）

```text
PURGE_REQUEST → PURGE_EXECUTED | PURGE_CANCELLED
QUARANTINE
HOLD
RELEASE（target_event_id 必填：指向被释放的那条 HOLD/QUARANTINE 事件）
```

（枚举即流程 vocabulary，二者一致；不再混用两套词。）

### §5.4 per-receipt 串行租约与可恢复状态机

- 同一 receipt 的处置操作持有 **per-receipt 租约**（DB 侧原子取得），
  租约期内事件串行追加，消除检查-执行竞态；
- **purge worker 状态机**：`IDLE → LEASED → BLOB_DELETING → RECORDING_EXECUTED → IDLE`。
  崩溃恢复规则（重启收敛）：
  1. 发现未闭合 `PURGE_REQUEST`（无 EXECUTED/CANCELLED）→ 核对 blob：
     blob 已不存在 ⇒ 幂等补写 `PURGE_EXECUTED`（删除已完成）；
     blob 存在且期间出现过 HOLD ⇒ 写 `PURGE_CANCELLED`；
     blob 存在且无 HOLD ⇒ 重新取得租约，从 BLOB_DELETING 续跑；
  2. 台账与 blob 对账差异 ⇒ 记 `blob_refcount_event(RECONCILE)` 修正事件，
     不直接改历史；
- **HOLD 优先级**：租约取得时与 BLOB_DELETING 前各检查一次活动 HOLD；
  任何时刻存在活动 HOLD ⇒ PURGE 必然 CANCELLED；
  先到事件在全序中胜出（全序 = (created_at, event_id)，IDEMPOTENCY §4.1 不变）。

## 6. Layer N — NormalizedFact（阻断 #3/#6）

| 字段 | 说明 |
|---|---|
| `id` / `receipt_id`（SUCCESS 回执）/ `fact_kind` / `subject_mint` / `subject_project` | 基础血缘 |
| **`fact_local_key`** | text·null；**同一回执可产出多条同 kind/subject 事实**（如多池、多锁仓账户、多解锁日）：此时必填，取值 = 载荷内天然判别键（pool 地址 / 账户 / 解锁序号）的确定性函数；单条时为 null |
| `effective_at` / `effective_time_kind` / `scheduled_at` | **每条事实独立的时间语义**（阻断 #6）：`CHAIN_EVENT`（事件时间可知，effective_at 非空）/ `OBSERVATION_BOUND`（快照，effective_at=observed_at，"至少此刻为真"）/ `UNKNOWN`（effective_at=null）；未来计划（锁仓解锁日等）= `scheduled_at`，不得作为已发生事实进入 Evidence |
| `payload` / `payload_hash` | 标准载荷（`star-fact-v1` 命名空间） |
| `parser_id` / `parser_version` | 产出方标识与版本 |
| `derived_at` | parser 运行时间 |
| `supersedes_fact_id` | uuid·null；新行单向引用旧行；旧行永不修改 |

**唯一约束（阻断 #3）**：
`UNIQUE (receipt_id, fact_kind, subject, parser_id, parser_version)`；
当 `fact_local_key` 非空时改为
`UNIQUE (receipt_id, fact_kind, subject, parser_id, parser_version, fact_local_key)`。
parser 升级（parser_version 变化）产生新行，不与旧版本冲突；同版本重放幂等。

## 7. Layer P — 解释上下文与回放（阻断 #7）

每次评估冻结 `interpretation_context`：

```text
{
  contract_schema_hash,                 // 数据契约正文的内容哈希
  rule_artifact_hash,                   // 门禁规则工件哈希
  source_priority_policy_hash,          // 来源优先级策略内容哈希（阻断 #4/#7）
  parser_map: {                          // 完整映射，键为四元组：
    "(source_id, method_id, parser_id, fact_kind)":
      { version, artifact_hash }         // 每条含版本 + 工件内容哈希
  },
  fact_ids: [ … ]                        // 本次评估实际引用的全部 fact id
}
```

回放双模式（不变）+ **PURGED 语义（阻断 #7 末项）**：
- `HISTORICAL`：按冻结 context 重算；若所依赖 blob 已被合法 PURGE，
  **不得声称可从 raw 重算**——返回 `REPLAY_SOURCE_PURGED`，
  只能读取当时已保存的结论快照（Layer P 本就持久化）；
- `REINTERPRET`：当前 parser 重释，输出带 `reinterpreted=true`，不覆盖历史。

## 8. 冲突的两级作用域（阻断 #4 概览，细则见 IDEMPOTENCY）

- **回执冲突**（同源同查询同锚不同字节）：CONTESTS → 冻结 UNKNOWN；
  解决依据仅 `FINALIZED_SLOT` / `MANUAL_AUDIT`（SOURCE_PRIORITY 不适用——同 observation_key 必同源）；
- **事实冲突**（不同来源的标准事实互相矛盾）：Layer N `fact_relations`
  （append-only，`CONTRADICTS` 关系）表达；解释时可应用**版本化的**
  source-priority policy（内容哈希入 interpretation_context）。

## 9. 明确不做

不新增页面、不接真实来源、不改六门禁与阈值、不引入钱包/签名/交易/AURORA；
一切处置走 §5 授权事件。
