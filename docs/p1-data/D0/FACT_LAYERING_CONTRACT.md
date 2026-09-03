# P1-DATA-D0 · 事实分层合同（FACT LAYERING CONTRACT）· rev5

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
版本链：rev1–rev4 均已替代。rev5 闭合 rev4 终审十项落表矛盾（§3.1 原子事务、§3.2 五态结局、payload 仅引用、§6 部分唯一索引、§5.5 关系表、§7 工件注册表）。前序（rev4 八阻断）内容保留。
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
| `outcome` | enum（rev5 五态，闭合矛盾 2） | `SUCCESS_RESPONSE`（收到可处理响应体）/ `HTTP_ERROR`（收到错误响应，可有体）/ `TRANSPORT_ERROR`（未收到任何响应字节）/ `TIMEOUT` / `ABORTED` —— 五态**完备分割**：占比之和恒为 1 |
| `error_code` / `http_status` / `latency_ms` | | 遥测 |
| `error_body_hash` / `error_body_ref` | char(64)·null / text·null | `HTTP_ERROR` 收到字节：哈希恒存；字节本体仅当 `retention_class=RAW_RETAINED` 时落 blob（受 §5 处置约束；`TRANSPORT_ERROR`/`TIMEOUT` 无体） |
| `receipt_id` | uuid·null | `SUCCESS_RESPONSE` 时**在同一事务内**与 RawReceipt 一并落库（见 §3.1）；**任何行都不回填** |
| `completed_at` | timestamptz | 完成/放弃时刻（健康滑窗边界） |

### §3.1 回执与结局事件的原子落库（闭合矛盾 1）

`SUCCESS_RESPONSE` 时，AttemptOutcomeEvent（含 receipt_id）与 RawReceipt
（含 attempt_outcome_event_id）在**同一数据库事务**内插入；两向外键声明为
`DEFERRABLE INITIALLY DEFERRED`，事务提交时同时满足。因此：
不存在"回执无事件"或"事件无回执"的中间态，也不需要任何回填。
崩溃 ⇒ 事务整体未提交 ⇒ 只有 Start 行（孤儿语义不变）。

### §3.2 崩溃语义（阻断 #2，保留）

请求期间崩溃 ⇒ Start 行存在、无 OutcomeEvent。
重启后 `CRASH_REPLAY` 的 Start 以 `retry_of_attempt_id` 指向该孤儿 Start——
"是否发出/是否到达来源端"永远如实表达为**未知**，不再声称可无损重建。

## 4. Layer R — RawReceipt

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` / `observation_key` / `collection_run_id` / `attempt_outcome_event_id` | | 标识与血缘（直指产出它的 OutcomeEvent） |
| `anchor_slot` / `anchor_time` | bigint·null / timestamptz·null | 链上/离线锚（至少其一） |
| `observed_at` / `ingested_at` | timestamptz | **Receipt 只保留这两种时间 + 锚**（阻断 #6：effective/scheduled 全部下移到事实层） |
| `payload_bytes_hash` | char(64) | 原始响应字节（as-received）SHA-256，必填 |
| `payload_ref` | text | **必填（rev5，闭合矛盾 3）**：payload 字节一律存 §5.2 blob 仓，行内不再允许 `payload_inline`（行不可 UPDATE，内联字节将无法被 PURGE 清除；小载荷同样走 blob） |
| `status` | enum | `SUCCESS` / `PARTIAL` |
| `schema_version` / `parser_version_at_ingest` | text | 信封 `star-raw@3` / 信息性快照 |
| `retention_class` / `license_class` | enum / text | 来源注册表快照 |
| （rev5 矛盾 5：行内不再携带 relation 单槽） | 多重冲突/替代关系经 append-only **`receipt_relation`** 表表达：`(id, receipt_id, relation ∈ {CONTESTS, SUPERSEDES}, related_receipt_id, created_at)`——一个回执可参与任意多条关系；解决事件引用关系行（IDEMPOTENCY §4.1） |
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

**唯一约束（阻断 #3 + rev5 矛盾 4：两个部分唯一索引，杜绝多 NULL）**：
```sql
CREATE UNIQUE INDEX uq_fact_single   ON normalized_fact (receipt_id, fact_kind, subject, parser_id, parser_version)
  WHERE fact_local_key IS NULL;      -- 单事实：同键仅一行
CREATE UNIQUE INDEX uq_fact_localkey ON normalized_fact (receipt_id, fact_kind, subject, parser_id, parser_version, fact_local_key)
  WHERE fact_local_key IS NOT NULL;  -- 多事实：local_key 为主
```
（PostgreSQL 默认 UNIQUE 对 NULL 不去重，普通约束无法保证单事实幂等——故用部分索引。）

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
  fact_ids: [ … ],                       // 本次评估实际引用的全部 fact id
  artifact_refs: {                       // rev5（闭合矛盾 9）：每个 hash 配可取回引用
    parser_map[i].artifact_ref, contract_artifact_ref,
    rule_artifact_ref, policy_artifact_ref
  }
}
```

**artifact 注册表（append-only、内容寻址）**：parser/rule/policy/contract 工件本体
存入 `artifact_registry(id, kind, version, content_hash, content_ref, created_at)`；
内容可随时取回并以 content_hash 验证——**仅有哈希不足以重演**的批评成立，
rev5 起解释上下文的每个哈希都必须能在注册表取回工件。工件同样受 §5 处置规则约束。

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
