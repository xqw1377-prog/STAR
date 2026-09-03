# P1-DATA-D0 · 幂等与版本语义（IDEMPOTENCY SEMANTICS）· rev4

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
版本链：rev1→rev2→rev3 均已替代。rev4：Attempt 两阶段化（#2）、
fact 唯一键扩展与 fact_local_key（#3）、冲突两级作用域与策略内容哈希（#4）、
解释上下文完备化（#7，细则见 FACT_LAYERING §7）。

## 1. 五个正交的身份

| 身份 | 对象 | 载体 | 去重 |
|---|---|---|---|
| 采集身份 | 一次采集批次 | `collection_run_id` | — |
| 查询身份 | 确定性查询规格 | `observation_key` | 永不单独充当去重键（R0） |
| 尝试身份 | 一次物理请求 | `AttemptStarted` + `AttemptOutcomeEvent` 两行 | **绝不去重** |
| 回执身份 | 收到的一份额外响应字节 | `RawReceipt` | 按 `receipt_key` 幂等 |
| 事实身份 | parser 产物 | `NormalizedFact` | 按 §6 唯一键幂等 |

**规则 R0**：`observation_key` 永不单独充当去重键；后续 slot 的新观察是新事实。

**规则 R0a**：Attempt 两阶段、绝不去重——Start 行**先于请求**持久化（阻断 #2），
Outcome 事件一次一行；孤儿 Start（有 Start 无 Outcome）如实表达"结果未知"。

## 2. `observation_key` 计算规范（冻结）

```text
observation_key = SHA-256(
  "star-obs-v1" ‖ 0x0A ‖ source_id ‖ 0x0A ‖ method_id ‖ 0x0A ‖ network ‖ 0x0A
  ‖ canonical(request_params_sanitized) )     // RFC 8785 (JCS)
```

- **脱敏先于规范化**：request_params 在 canonical 化前剥离 API key、Authorization、
  签名与含凭证 URL（同步要求）；observation_key 基于脱敏后形态；
- 禁止入键：parser/attempt/run/任何时间戳/随机数。

## 3. `receipt_key` 计算规范（冻结；仅 SUCCESS/PARTIAL）

```text
receipt_key = SHA-256(
  "star-rcpt-v1" ‖ 0x0A ‖ observation_key ‖ 0x0A
  ‖ anchor        // anchor_slot 十进制串；无 slot 时 "t:" + anchor_time UTC 纳秒
  ‖ 0x0A ‖ payload_bytes_hash )   // 原始响应字节（as-received）SHA-256
```

raw 层哈希只认字节；fact 层规范化哈希命名空间 `star-fact-v1`，永不相混。

## 4. 判定表

**Attempt 层（两阶段）**：

| A# | 事件 | 动作 |
|---|---|---|
| A0 | 发请求前 | **持久化 AttemptStarted**（origin/retry 链/plan_item 引用随行） |
| A1 | 收到响应字节 | 记 Outcome(RESPONSE_RECEIVED, receipt_id=…) → 进入回执判定 |
| A2 | 超时 | 记 Outcome(TIMEOUT)；无回执；门禁维持 UNKNOWN；重试 = 新 Start(origin=RETRY) |
| A3 | 传输/HTTP 错误 | 记 Outcome(ERROR, error_body_hash…)；无回执；重试 = 新 Start |
| A4 | 调度中止 | 记 Outcome(ABORTED)；无回执 |
| A5 | 进程崩溃 | Start 存在、无 Outcome；重启补发 = 新 Start(origin=CRASH_REPLAY, retry_of=孤儿 Start)。原请求是否到达来源端**永远记为未知** |

**Receipt 层**（设同 `observation_key` 已有回执 E，新回执 N）：

| # | 条件 | 判定 | 动作 |
|---|---|---|---|
| 1 | `N.receipt_key == E.receipt_key` | 幂等命中 | 不重复入库；Attempt 照记；run 日志记 hit |
| 2 | 同 observation_key + 同 anchor + 字节 hash 不同 + 双方 SUCCESS | **回执冲突（CONTESTS）** | 插入 N（relation=CONTESTS, relates_to=E.id）；触发 R2 冻结；contradiction_count+1 |
| 3 | 同 observation_key + 同 anchor + 有一方 PARTIAL | 部分回执 | PARTIAL 保留（遥测/血缘），不派生事实；SUCCESS 到达时 relation=SUPERSEDES |
| 4 | 同 observation_key + 不同 anchor | 新观察 | 正常插入（R0） |

**规则 R1**：parser 只接受 SUCCESS 回执。

**规则 R2（CONTESTED 冻结）**：未解决的 CONTESTS 上，受影响 fact_kind：
`Gate=UNKNOWN · score=null · readiness=RESEARCH_REQUIRED`，**禁止晚者胜**。

### §4.1 回执冲突的解决（同源；阻断 #4）

`observation_key` 含 source_id ⇒ 同键冲突**必同源**，SOURCE_PRIORITY 在此无意义。
解决依据仅两种，经 append-only `contest_resolution_event`：

| 字段 | 说明 |
|---|---|
| `contested_relation` | 指向 CONTESTS 关系 |
| `basis` | `FINALIZED_SLOT`（后续已定局锚点的证词）/ `MANUAL_AUDIT`（人工审计引用） |
| **`basis_version`** | **不可变策略内容哈希**（非可复用版本字符串）：FINALIZED_SLOT ⇒ 所依据定局规则的 artifact hash；MANUAL_AUDIT ⇒ 审计规程 artifact hash |
| `resolved_receipt_id` | 胜出回执 |
| `authorization_ref` | 授权引用 |

事件 append-only；一经写入不受后续策略演进影响。

### §4.2 事实冲突（跨源；阻断 #4）

不同来源产出的标准事实互相矛盾 ⇒ Layer N 的 append-only **`fact_relations`**
（`relation=CONTRADICTS`，双侧 fact id）。解释投影处理 CONTRADICTS 对时可应用
**版本化 source-priority policy**；所用的策略**内容哈希**进入 interpretation_context
（FACT_LAYERING §7），保证历史可复现。回执层绝不使用该机制。

## 5. 血缘与版本（阻断 #2/#3/#7）

- fact 必指向恰好一个 SUCCESS 回执（R1）；
- 替代 = 新行 `supersedes_fact_id` 单向引用（R2b，旧行永不修改）；
- **规则 R3（解释上下文冻结）**：每次评估记录完整 interpretation_context
  （FACT_LAYERING §7：parser 四元组映射 {version+artifact_hash}、契约/规则/策略
  内容哈希、fact_ids）；回放 HISTORICAL（冻结 context 字节级复现；blob 已 PURGE
  ⇒ `REPLAY_SOURCE_PURGED`，只读已存结论）/ REINTERPRET（重释带标记，不覆盖）；
- parser 升级 = 对既有 raw **重放**生成新 fact 行（禁止重采集）；重放确定性：
  同 raw 字节 + 同 (parser_id, parser_version) ⇒ 同 payload_hash（T04）。

## 6. 唯一约束（阻断 #3）

- RawReceipt：`UNIQUE(receipt_key)` + `INSERT … ON CONFLICT DO NOTHING`；
- NormalizedFact：`UNIQUE(receipt_id, fact_kind, subject, parser_id, parser_version)`；
  同回执多同类事实时追加 `fact_local_key` 列入键（FACT_LAYERING §6）；
- CollectionAttempt（Start/Outcome）：**无唯一约束**；并发重复请求产生多行属正确行为，
  在途重复由采集租约软优化；
- 处置/解决事件：append-only，无 UPDATE 路径即无并发写冲突。

## 7. 验收映射

闭合 DATA-007/008。D1 测试（rev4 对齐，阶段清单见 D0_ACCEPTANCE）：
T01（不可变+授权 PURGE+HOLD）、T02（同回执零新增）、T03a（血缘链）、
T05（JCS 向量）、T06（并发唯一约束）、T14（Attempt 不去重）、
**T23（两阶段：Start 先存、崩溃孤儿、Outcome 携带 receipt、零回填）**、
**T24（purge worker 崩溃恢复三分支收敛）**、**T25（blob 引用计数/跨范围隔离）**、
T03b（溯源）、T04（重放确定性）、T15（回执冲突冻结/解决——仅 FINALIZED_SLOT/MANUAL_AUDIT）、
**T26（跨源 fact_relations + 策略哈希复现）**、T16（HISTORICAL/REINTERPRET/PURGED）。
