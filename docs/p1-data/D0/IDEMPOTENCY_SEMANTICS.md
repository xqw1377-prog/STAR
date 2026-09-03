# P1-DATA-D0 · 幂等与版本语义（IDEMPOTENCY SEMANTICS）· rev2

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
rev2 变更：Attempt/Receipt 双对象（裁定 #1）、CONTESTED 冻结为 UNKNOWN（#3）、
parser 策略冻结与双回放模式（#4）。

## 1. 五个正交的身份

| 身份 | 对象 | 载体 | 去重 |
|---|---|---|---|
| 采集身份 | 一次采集批次 | `collection_run_id` | — |
| 查询身份 | 确定性查询规格 | `observation_key` | 永不单独充当去重键（R0） |
| 尝试身份 | 一次物理请求 | 一行 `CollectionAttempt` | **绝不去重**（每次请求一行） |
| 回执身份 | 收到的一份额外响应字节 | 一行 `RawReceipt` | 按 `receipt_key` 幂等 |
| 事实身份 | parser 产物 | 一行 `NormalizedFact` | 按 (receipt, kind, subject) 幂等 |

**规则 R0**：`observation_key` 永不单独充当去重键；同一查询在后续 slot 的新观察
是正常新事实（§4 #4）。

**规则 R0a（UNKNOWN 重试身份）**：**Attempt 无键、无唯一约束、永不合并**。
同一 `observation_key` 上的超时/错误重试：

| 层 | 身份 | 重试时 |
|---|---|---|
| 查询 | `observation_key` | **不变**（仍是同一查询规格） |
| 尝试 | `CollectionAttempt.id` | **新行**（每次物理请求） |
| 回执 | `receipt_key` | **不存在**（无字节 ⇒ 无 RawReceipt） |
| 事实 | NormalizedFact | **不产生** |

废除「UNKNOWN 也是一回执、后续重试换新 receipt_key」：无响应不是观察，
不能占用回执身份。门禁维持 UNKNOWN（fail-closed），健康模型按 Attempt 计故障。

## 2. `observation_key` 计算规范（冻结，不变）

```text
observation_key = SHA-256(
  "star-obs-v1" ‖ 0x0A ‖ source_id ‖ 0x0A ‖ method_id ‖ 0x0A ‖ network ‖ 0x0A
  ‖ canonical(request_params) )        // RFC 8785 (JCS)
```

禁止入键：parser_version、collection_run_id、时间戳、鉴权材料、随机数。

## 3. `receipt_key` 计算规范（冻结；仅 SUCCESS/PARTIAL 回执存在）

```text
receipt_key = SHA-256(
  "star-rcpt-v1" ‖ 0x0A ‖ observation_key ‖ 0x0A
  ‖ anchor        // anchor_slot 十进制串；无 slot 时 "t:" + anchor_time UTC 纳秒
  ‖ 0x0A ‖ payload_bytes_hash )   // 原始响应字节（as-received）的 SHA-256
```

- 原文裁定 #1 的矛盾源（`error_code` 入键 + "重试是新回执"）已消除：
  error/timeout 不再产生回执，键只对真实字节存在；
- raw 层哈希只认字节；RFC 8785 仅用于请求侧；fact 层哈希命名空间 `star-fact-v1`。

## 4. 判定表

**Attempt 层（先判定，永远记录）**：

| A# | 结果 | 动作 |
|---|---|---|
| A1 | 收到响应字节 | 记 Attempt(outcome=RESPONSE_RECEIVED) → 进入回执判定 |
| A2 | 超时 | 记 Attempt(TIMEOUT)；**无回执**；门禁维持 UNKNOWN（fail-closed）；重试=新 Attempt |
| A3 | 传输/HTTP 错误 | 记 Attempt(ERROR)；**无回执**；重试=新 Attempt |
| A4 | 调度中止 | 记 Attempt(ABORTED)；无回执 |

**Receipt 层**（设已有回执 E，同 `observation_key`，新回执 N）：

| # | 条件 | 判定 | 动作 |
|---|---|---|---|
| 1 | `N.receipt_key == E.receipt_key` | 幂等命中 | 不插入新回执；Attempt 照记；collection_run 日志记 hit |
| 2 | 同 observation_key + 同 anchor + payload_bytes_hash 不同 + 双方 SUCCESS | **冲突（CONTESTED）** | 插入 N（relation=CONTESTS, relates_to=E.id）；E 不动；触发 **R2 冻结**（见下）；健康 contradiction_count+1 |
| 3 | 同 observation_key + 同 anchor + 有一方 PARTIAL | 部分回执 | PARTIAL 保留（遥测/血缘），**不派生事实**；等 SUCCESS（新回执 relation=SUPERSEDES 指向 PARTIAL） |
| 4 | 同 observation_key + 不同 anchor | 新观察 | 正常插入；链上状态推进，不是重复 |

**规则 R1**：parser 只接受 `status=SUCCESS` 回执。

**规则 R2（裁定 #3，CONTESTED 冻结）**：存在**未解决** CONTESTS 关系的
(observation_key, anchor) 上，受影响 fact_kind 的投影：

```text
Gate    → UNKNOWN
score   → null
readiness → RESEARCH_REQUIRED
```

**晚者胜被禁止**——内核平局规则不适用于冲突回执。
冲突经 append-only 的 `contest_resolution_event` 解决后才能恢复解释：

| 字段 | 说明 |
|---|---|
| `contested_relation` | 指向 CONTESTS 关系 |
| `basis` | `FINALIZED_SLOT`（后续锚定证词）/ `SOURCE_PRIORITY`（注册表法定真源优先级）/ `MANUAL_AUDIT`（人工审计引用） |
| `resolved_receipt_id` | 胜出回执 |
| `authorization_ref` | 授权引用 |

解决事件本身 append-only；解决前的一切评估按 R2 冻结输出。

## 5. 血缘与版本（裁定 #2/#4）

- 每个 NormalizedFact 指向恰好一个 SUCCESS 回执（R1）；
- **替代 = 新行单向引用旧行**（`supersedes_fact_id`）；旧行永不修改（R2b）；
- **规则 R3（parser 策略冻结）**：每次评估记录冻结的 `interpretation_context`
  （contract_version、parser_versions map、rule_version、fact_ids）。
  回放双模式：**HISTORICAL**（按当次冻结 context 重放，原结论可复现）与
  **REINTERPRET**（按当前 parser 重释，输出必须带 `reinterpreted=true`，不覆盖历史）。
  禁止静默混用；Replay Lab 默认 HISTORICAL；
- parser 升级 = 对既有 raw **重放**生成新 fact 行（禁止重新采集）；
  同 raw 字节 + 同 parser_version ⇒ 同 payload_hash（确定性，P1D-T04）。

## 6. 并发采集兜底

- RawReceipt：`UNIQUE(receipt_key)` + `INSERT … ON CONFLICT DO NOTHING`
  （冲突方读回既有行记幂等命中）；
- CollectionAttempt：**无唯一约束**（设计使然）；并发重复请求产生多行 Attempt
  属正确行为，由采集租约做软优化；
- NormalizedFact：`UNIQUE(receipt_id, fact_kind, subject)` 幂等。

## 7. 验收映射

闭合 DATA-007/008。D1 证明测试（rev2 增补）：
T01（不可变 + 授权 PURGE 路径 + HOLD 阻断）、T02（同回执零新增）、
T03（冲突并存 + R2 冻结）、T04（重放确定性）、T05（JCS 向量）、T06（并发唯一约束）、
**T14（Attempt 永不去重：N 次超时 → N 行 Attempt、0 行 Receipt）**、
**T15（CONTESTED → UNKNOWN/null/RESEARCH_REQUIRED；解决事件后恢复）**、
**T16（HISTORICAL 字节级复现；REINTERPRET 带标记且不覆盖）**。
