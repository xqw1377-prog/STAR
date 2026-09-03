# P1-DATA-D0 · 幂等与版本语义（IDEMPOTENCY SEMANTICS）· rev6

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
版本链：rev1–rev5 均已替代。rev6 对齐 R5-01/02/03/07/08/09/10
（六终态、单向链、统一唯一约束、关系表）。结构与字段细则以
FACT_LAYERING_CONTRACT（rev6）为准，本文件只冻结键与判定语义。

## 1. 四个正交身份（R5-07）

```text
attempt_id           物理请求身份：永不去重（每次请求一行）
query_identity       规范化请求身份：脱敏后 canonical（RFC 8785），
                     不含时间戳、run id、parser 版本
observation_identity query_identity + 网络锚点
receipt_key          命名空间 + observation_identity + as-received payload hash
```

**R0**：query_identity 永不单独充当去重键；只有 `receipt_key` 完全相等才是
幂等命中。重试、崩溃重放、调度重发各自产生新 Attempt，**可收敛到同一 Receipt**。

## 2. Attempt 层判定（R5-01/02/03）

| A# | 事件 | 动作 |
|---|---|---|
| A0 | 发请求前 | 持久化 AttemptStarted（origin/retry 链/plan_item/脱敏参数） |
| A1 | 收到可处理响应 | 同事务写入 Outcome(SUCCESS 或 PARTIAL)、（新键时）RawReceipt、**AttemptReceiptLink**；幂等命中 ⇒ 不新建 Receipt 但**必写新 Link**（多 Attempt→单 Receipt 血缘） |
| A2 | HTTP 非成功响应 | Outcome(SOURCE_ERROR, response_bytes_received, error_body_hash…)；无 Receipt |
| A3 | DNS/连接/TLS/断线 | Outcome(TRANSPORT_ERROR)；无 Receipt |
| A4 | 超时 | Outcome(TIMEOUT)；无 Receipt；门禁维持 UNKNOWN（fail-closed） |
| A5 | 调用方终止 | Outcome(ABORTED)；无 Receipt |
| A6 | 进程崩溃 | Start 存在、无 Outcome（孤儿）；重启 CRASH_REPLAY 指向孤儿 Start；结果如实未知 |

每 Attempt **最多一个** OutcomeEvent（完成态恰一终态；IN_FLIGHT/UNRESOLVED 无事件；`attempt_id UNIQUE`）；重复同一终态=幂等命中；
矛盾第二终态不得覆盖（审计事件 + 采集器异常状态）。

## 3. Receipt 层判定

设同 observation_identity 已有回执 E，新回执 N：

| # | 条件 | 判定 | 动作 |
|---|---|---|---|
| 1 | N.receipt_key == E.receipt_key | 幂等命中 | 不重复入库；Attempt 照记；run 日志记 hit |
| 2 | 同 observation_identity + 同 anchor + payload hash 不同 + 双方 SUCCESS | 冲突 | 双方入库；经 ReceiptRelation(CONTESTS) 关联；R2 冻结生效 |
| 3 | 同 observation_identity + 同 anchor + 有一方 PARTIAL | 部分回执 | PARTIAL 保留（遥测/血缘）；**不派生事实**；SUCCESS 到达时经 ReceiptRelation(SUPERSEDES) 关联 |
| 4 | anchor 前进 | 新观察 | 正常入库（R0） |

同键同锚同字节的重复收敛（DUPLICATES 关系可表达历史发现的双入库）。

## 4. 规则

- **R1（parser 输入门）**：仅 `status=SUCCESS` 的 Receipt 可入 parser；
  PARTIAL/SOURCE_ERROR/TRANSPORT_ERROR/TIMEOUT/ABORTED 一律不派生事实；
- **R2（CONTESTED 冻结）**：未解决冲突 ⇒ Gate=UNKNOWN、score=null、
  readiness=RESEARCH_REQUIRED；**禁止晚者胜**；解决仅经 ContestResolutionEvent
  （basis ∈ FINALIZED_SLOT / SOURCE_PRIORITY / MANUAL_AUDIT；SOURCE_PRIORITY 仅作
  已追加解决事件的冻结依据，禁止投影期即时选赢家；basis_version = 不可变策略内容哈希）；
- **R2b**：fact 替代 = `supersedes_fact_id` 单向引用，旧行永不修改；
- **R3（解释上下文冻结）**：InterpretationContext 冻结 parser/规则/策略/资格
  工件的 hash 与 artifact 引用（缺件 ⇒ REPLAY_ARTIFACT_MISSING）；
  HISTORICAL 字节级复现；REINTERPRET 带标记不覆盖历史；
- parser 升级 = 对既有 raw 重放生成新 fact 行（禁重采集）；
  同 raw 字节 + 同 (parser_id, parser_version) ⇒ 同 payload_hash。

## 5. 唯一约束（R5-10）

- RawReceipt：`UNIQUE(receipt_key)` + `ON CONFLICT DO NOTHING`；
- AttemptOutcomeEvent：`UNIQUE(attempt_id)`；
- AttemptReceiptLink：`UNIQUE(outcome_event_id)`（每 Outcome 恰一条 Link；Receipt 可被多 Link 引用）；
- CollectionAttempt：`lease_expires_at` NOT NULL（UNRESOLVED 确定性时点谓词）；
- NormalizedFact：`UNIQUE(receipt_id, fact_kind, subject_type, subject_id,
  parser_version, fact_local_key)`（fact_local_key NOT NULL，单值=singleton）；
- Start/Outcome 无去重键；处置/解决/关系事件 append-only。

## 6. 验收映射

闭合 DATA-007/008。测试全目录与阶段归属见 D0_ACCEPTANCE
（本文件相关：T02/T05/T06/T14/T23、R5-T01/T02/T06/T07/T08/T10）。
