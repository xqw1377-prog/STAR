# P1-DATA-D0 · 事实分层合同（FACT LAYERING CONTRACT）· rev6

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
版本链：rev1–rev5 均已替代（rev5 终审以 R5-01…R5-20 裁定清单退回）。
rev6 逐项吸收 R5 裁定；条款号即裁定号，便于回执映射。

## 1. 层次与不可变边界（R5 §1）

```text
Layer A0 CollectionAttempt        一次物理请求一行，永不去重（R5-07）
Layer A1 AttemptOutcomeEvent      每 Attempt 最多一个；完成态恰一终态（R5-02）
Layer R  RawReceipt               由可留存响应字节形成；行不可变（R5-05）
Layer N  NormalizedFact           append-only；血缘完整（R5-09/R5-10）
Layer P  Evidence/Gate/Score      只消费具备 eligibility 的时点事实（R5-12）
```

缺失、过期、冲突、不可验证或来源被阻断的强制事实 ⇒ 一律 UNKNOWN，
不得静默降级为 PASS；历史回放按当时冻结的事实/规则/解析器/资格策略复现，
**不得读取当前缓存列**；数据健康只描述采集系统，不得直接改变门禁或机会分；
一切纠错/解决/处置/替代均为追加事件。

## 2. Layer A0/A1 — Attempt 与终态（R5-01/02/03）

**AttemptStarted（发请求前持久化）**：`id, query_identity, collection_run_id,
collection_plan_item_id, request_params_sanitized（脱敏快照：禁止 API key、
Authorization、签名、含凭证 URL，脱敏先于规范化）, attempt_origin ∈
{INITIAL, RETRY, CRASH_REPLAY, SCHEDULER_REISSUE}, retry_of_attempt_id,
started_at`。

**AttemptOutcomeEvent（append-only）**：`attempt_id UNIQUE NOT NULL`（R5-02：
每 Attempt **最多一个** OutcomeEvent——完成态恰一终态，IN_FLIGHT/UNRESOLVED 无事件；
重复同一终态=幂等命中；矛盾第二终态**不得覆盖**，进独立审计事件并触发采集器
异常状态；健康分母=Attempt，禁止双计）、
`outcome`（六类互斥终态，R5-03）、`response_bytes_received`（独立布尔）、
`error_code / http_status / latency_ms / completed_at`、错误体处置字段（R5-04）。

**Attempt 生命周期状态（阻断 2 修正语义）**：
- **每个 Attempt 最多一个 AttemptOutcomeEvent；完成的 Attempt 恰有一个终态；
  `IN_FLIGHT` / `UNRESOLVED` 可以没有 Outcome**（孤儿与"最多一个"不再矛盾）；
- `IN_FLIGHT` = 已 Start 且 `now ≤ lease_expires_at` 且无 Outcome；
- `UNRESOLVED` = `now > lease_expires_at` 且无 Outcome（**确定性时点谓词**：
  历史健康复现以窗口收盘时刻计算该谓词为准）；
- `lease_expires_at` 是 CollectionAttempt 的**冻结字段**（Start 时写入租约到期时刻）；
- 终态率分母 = 窗口内有终态的 Attempt；孤儿经 `unresolved_rate` 单列（DATA_HEALTH §3）；
- 崩溃后由 CRASH_REPLAY Start 以 retry 链指向孤儿；孤儿永不补写终态。

**终态枚举（R5-03 冻结）**：

```text
SUCCESS          收到可处理响应（全量）
PARTIAL          收到可处理响应（部分）
SOURCE_ERROR     HTTP 非成功响应（含收到错误体的情形）
TRANSPORT_ERROR  DNS / 连接失败 / TLS / 无响应断线
TIMEOUT          超时
ABORTED          调用方主动终止
```

`response_bytes_received` 是**独立布尔字段**，不是终态分类；
六类终态率之和恒为 1；`response_availability = response_bytes_received /
attempts` 正交单列，**禁止并入**终态率求和恒等式。

**错误响应字节（R5-04）**：所有收到的响应体均计 as-received SHA-256；
blob 仅当 `retention_class` 允许时保存，否则只存 hash、长度、MIME、状态码与
处置理由；日志/状态 API/错误提示不得输出私有 URL、认证头、查询密钥或原始错误体；
错误响应不派生 NormalizedFact，可参与健康与取证。

## 3. Layer R — RawReceipt（R5-01/05/06/07/08）

| 字段 | 冻结语义 |
|---|---|
| `creator_outcome_event_id` | **UNIQUE NOT NULL**：首次创建本回执的 Outcome（血缘锚点；**不承载完整多次尝试血缘**——那由 AttemptReceiptLink 承载） |
| `query_identity` / `observation_identity` | 见 §4（R5-07） |
| `anchor_slot` / `anchor_time` | **DB CHECK：至少一非空**（R5-06）；两者同在必须同一观察锚，不一致⇒隔离不产事实；锚点前进=新 Receipt，不被查询身份吞并 |
| `observed_at` / `ingested_at` | 回执仅此二时间 + 锚（事实时间在 Layer N） |
| `payload_hash` / `payload_ref` | **payload_inline 自本版删除（R5-05）**；`payload_ref` = **完整 scoped blob_key**；原始字节统一存 RawBlob（**合成夹具同样适用**）；Receipt 行不可变，Blob 按处置协议物理删除 |
| **blob 身份（阻断 3 冻结）** | `blob_key = SHA256(scope ‖ payload_hash)`，`scope = (source_id, retention_class)`；RawBlob 主键 = `blob_key`——相同字节跨许可范围天然生成不同物理对象，「不共享」可执行 |
| **悬空句柄语义（rev7）** | `payload_ref` 无 FK，为**设计性悬空内容句柄**：完整性 = 创建时同事务 + PURGE 唯一删除入口；读取经处置投影 `BYTES / PURGED / MISSING`（详见 ERD raw_receipt 节） |
| `status` | `SUCCESS` / `PARTIAL`（与终态对应） |
| 关系 | 行内**不设** relation 单槽；关系一律走 §5 ReceiptRelation（R5-08） |

**AttemptReceiptLink（阻断 1 修正：多 Attempt → 单 Receipt 的完整血缘）**：

append-only 链接表 `(id, outcome_event_id UNIQUE NOT NULL, receipt_id NOT NULL,
created_at)`——每次"收到可留存字节"都产生一条 Link；`receipt_key` 幂等命中时
**不新建 Receipt，但仍写入新 Link**，从而重试/崩溃重放/调度重发的多次 Attempt
全部挂到同一 Receipt，血缘不断裂。方向恒为
`CollectionAttempt → Outcome(≤1) → AttemptReceiptLink(SUCCESS/PARTIAL 才有，恰一条；其余终态零条) → RawReceipt(可被多 Link 引用)`。

**原子性（R5-01）**：收到可留存字节时，Outcome、（如新键）Receipt、AttemptReceiptLink
在**同一数据库事务**写入并一起提交；任何一步失败整体回滚；
**禁止循环外键、事后回填、先提交 Outcome 稍后补 Receipt**。

## 4. 身份与幂等（R5-07）

```text
attempt_id           物理请求身份，永不去重
query_identity       规范化请求身份（脱敏后 canonical；不含时间戳/run id/parser 版本）
observation_identity query_identity + 网络锚点
receipt_key          命名空间 + observation_identity + as-received payload hash
```

只有 `receipt_key` 完全相等才是幂等命中；重试、崩溃重放、调度重发各自产生
新 Attempt，但**可收敛到同一 Receipt**。

## 5. ReceiptRelation（R5-08）

append-only，行内单槽已删除；每条关系含独立 `id / created_at / 依据 /
创建者或规则引用`；至少支持 `SUPERSEDES / CONTESTS / DUPLICATES`；
同一 Receipt 可同时与多个 Receipt 建立关系。

## 6. 冲突资格（R5-09）

冲突 Receipt 可解析以供诊断，但其派生 Fact 标记 **CONTESTED**；
CONTESTED Fact **不具备 gate eligibility**：强制门禁 UNKNOWN、score=null、
readiness=RESEARCH_REQUIRED。解决仅经追加 **ContestResolutionEvent**
（`basis ∈ {FINALIZED_SLOT, SOURCE_PRIORITY, MANUAL_AUDIT}, basis_version
（不可变策略内容哈希——SOURCE_PRIORITY 即所引优先级策略工件的内容哈希）,
resolved_receipt_id, 授权/规则引用, 时间`）。
**禁止投影期即时套用优先级选赢家**：source priority 只能作为已追加的
ContestResolutionEvent 的冻结依据存在；事件追加前，冲突 Fact 保持不可用、
Gate=UNKNOWN。解决事件不改旧 Receipt 或旧 Fact，资格投影按事件链重算。
**跨源事实冲突**（fact_relation CONTRADICTS）同构处理：经追加
**FactResolutionEvent**（→ fact_relation；basis ∈ SOURCE_PRIORITY / MANUAL_AUDIT；
basis_version = 策略工件内容哈希）解除资格冻结，事件前同样 Gate=UNKNOWN。
矛盾第二终态等终态异常一律入 append-only 终态异常审计事件。

## 7. Layer N — NormalizedFact（R5-10）

- **`fact_local_key` NOT NULL**：单值事实固定 `singleton`；复数事实用稳定、
  确定性领域键（pool 地址/账户/解锁序号）；禁止"多事实时才必填"的运行时条件；
- 主体泛化：`subject_type + subject_id`；
- **唯一约束（统一）**：`receipt_id + fact_kind + subject_type + subject_id +
  parser_version + fact_local_key`；不依赖 SQL 对 NULL 唯一性的数据库差异；
- 事实时间：`effective_at / effective_time_kind / scheduled_at` 逐事实独立
  （CHAIN_EVENT / OBSERVATION_BOUND / UNKNOWN；scheduled 仅未来安排，
  不得作为已发生事实进门禁）；
- 替代 = `supersedes_fact_id` 单向引用，旧行永不修改。

## 8. ArtifactRegistry 与解释上下文（R5-11）

append-only **ArtifactRegistry**：保存规则、parser、门禁策略、来源优先级、
证据资格策略的 `artifact_hash / 类型 / 版本 / 存储引用 / created_at`。
InterpretationContext **同时冻结 hash 与 artifact reference**；
缺少任一必需 artifact 时 HISTORICAL 回放必须失败并返回
**`REPLAY_ARTIFACT_MISSING`**，不得自动使用最新版。

## 9. EvidenceEligibilityPolicy 与健康分离（R5-12）

版本化 **EvidenceEligibilityPolicy**（纳入 InterpretationContext）：
按 `asOf、来源 SLA、事实时态、冲突状态、来源许可` 判定 Fact 能否进入门禁。
缺失/过期/不可用/冲突/被阻断的强制事实 ⇒ 门禁 UNKNOWN。Data Health 只做
展示/调度/告警，不得传入 interpretCheck 或评分函数。

## 10. PURGE 两阶段协议与两种范围（R5-14/15）

- 两阶段：`PURGE_REQUESTED → PURGE_EXECUTED`；全序 `(created_at, event_id)`；
- 请求必含 `actor、reason/legal basis、authorization_ref、scope、idempotency_key`；
- `LEGAL_HOLD` 在执行时刻之前或执行事务内出现 ⇒ `PURGE_CANCELLED`，Blob 不删；
  执行检查与 Blob 删除位于**同一受控事务/锁边界**，禁止检查—执行竞态；
- 引用计数不为零或存在 HOLD ⇒ 共享 Blob 不得删除；
- **两种范围（R5-15）**：
  - `RAW_ONLY`：删原始 Blob；保留不含原始内容的 Fact 与历史结论；
    fact-level HISTORICAL 复算可行，raw parser replay 返回 `RAW_SOURCE_PURGED`；
  - `LICENSE_ERASURE`：按法律/许可范围删除受限原始与派生内容载荷；
    仅留非内容 hash、处置审计与墓碑记录；相关历史评估返回 `REPLAY_SOURCE_PURGED`；
    **派生载荷擦除（rev7）**：fact 行 append-only 不动，载荷字节外置
    （normalized_fact.fact_payload_ref，同 blob 协议），擦除 = 追加
    `fact_erasure_event(LICENSE_ERASED)` + 外置 blob 按 PURGE 协议删除（同事务）；
    读取投影 `resolveFactPayload → PAYLOAD | ERASED`（ERASED ⇒ 事实不可用 ⇒ 门禁 UNKNOWN）；
- **禁止在原 payload hash 对应位置写墓碑字节**。
