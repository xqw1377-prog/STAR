# P1-DATA-D0 · 幂等与版本语义（IDEMPOTENCY SEMANTICS）

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03

## 1. 四个正交的身份（先分层，再谈键）

| 身份 | 对象 | 载体 | 生命周期 |
|---|---|---|---|
| 采集身份 | 一次采集批次 | `collection_run_id` | 批次开始→结束 |
| 查询身份 | 一个确定性的查询规格 | `observation_key` | 永久稳定（与响应无关） |
| 观察事实 | 该查询在某链上锚处收到的一份响应 | 一行 RawObservation | 追加后不可变 |
| 回执身份 | 该响应实例的指纹 | `receipt_key` | 由 observation+anchor+payload 决定 |

**规范性规则 R0**：`observation_key` **永不单独充当去重键**。
同一查询在后续 slot 的新观察（§4 #4）是正常的新事实，不是重复；
去重只发生在 `receipt_key` **完全相等**时（§4 #1）。
Layer R 唯一约束建在 `receipt_key` 上；`observation_key` 建普通索引供重放与审计。

## 2. `observation_key` 计算规范（冻结）

```text
observation_key = SHA-256(
  "star-obs-v1"              ‖ 0x0A
  source_id                   ‖ 0x0A
  method_id                   ‖ 0x0A
  network                     ‖ 0x0A
  canonical(request_params)
)
```

- `canonical(json)`：RFC 8785（JCS）——键排序、无空白、UTF-8、数值最简形式。
  D1 引入 JCS 实现并以向量测试锁定（P1D-T05）。
- **禁止**进入键的内容：parser_version、collection_run_id、时间戳、鉴权材料、
  随机数。同一查询永远同一键，与谁发起、何时发起、用哪版 parser 无关。

## 3. `receipt_key` 计算规范（冻结）

```text
receipt_key = SHA-256(
  "star-rcpt-v1"             ‖ 0x0A
  observation_key             ‖ 0x0A
  anchor    // anchor_slot 十进制字符串；无 slot 时 "t:" + anchor_time 的 UTC 纳秒
  ‖ 0x0A
  payload_bytes_hash          // status=SUCCESS/PARTIAL：原始响应字节（as-received，
                               // 未规范化）的 SHA-256 —— 与 RawObservation.payload_hash 同源
                               // status=ERROR/UNKNOWN：error_code
)
```

**raw 层哈希只认字节**：RFC 8785 仅用于 §2 的请求参数规范化，
**禁止**用于响应载荷——payload 的规范化（如 JCS）只发生在 parser 输出层
（NormalizedFact.payload_hash，命名空间 `"star-fact-v1"`，与 receipt 键永不互转）。
同一查询、同一链上锚、同一响应字节（或同一错误码）→ 同一 receipt。
**不同 payload 天然产生不同 receipt**，因此"重复"与"冲突"的判定不靠比较键碰撞，
而靠 §4 的判定表在 `observation_key + anchor` 粒度上做归并。

## 4. 判定表（重复 / 修订 / 冲突 / 新观察）

设已有行 E（同 `observation_key`），新到响应 N：

| # | 条件 | 判定 | 动作 |
|---|---|---|---|
| 1 | `N.receipt_key == E.receipt_key` | **幂等命中** | 不插入 raw；仅在采集批次日志（sidecar `collection_run` 表）记录 run 与 hit；raw 行零改动 |
| 2 | 同 `observation_key` + 同 `anchor` + `payload_bytes_hash` 不同 + 双方 SUCCESS | **冲突（CONTESTED）** | 插入新 raw，`relation='CONTESTS'`、`relates_to=E.id`；E 不动；数据健康 `contradiction_count +1`；对应 NormalizedFact 两版并存，投影按内核平局规则取晚者并携带 conflict 标记 |
| 3 | 同 `observation_key` + 同 `anchor` + 有一方 PARTIAL | **部分回执** | 插入/保留 PARTIAL 回执（供健康遥测与血缘），`relation` 如实记录；**PARTIAL 不派生任何 NormalizedFact**——事实必须等到同 (observation, anchor) 的 SUCCESS 回执 |
| 4 | 同 `observation_key` + 不同 `anchor`（slot 前进） | **新观察** | 正常插入，无 relation；这是链上状态的正常推进，不是重复（规范性规则 R0） |
| 5 | `status=UNKNOWN`（超时等） | **未定回执** | 插入 raw（payload_hash=null，error_code=TIMEOUT）；**不产生任何 NormalizedFact**；门禁维持 UNKNOWN（fail-closed）；后续重试是新的 receipt |
| 6 | `status=ERROR`（明确失败） | **失败回执** | 插入 raw；仅进健康遥测；同样不产生 fact |

**Parser 输入门（规范性规则 R1）**：parser 只接受 `status=SUCCESS` 的回执作为输入。
UNKNOWN / ERROR / PARTIAL 回执保留于 Layer R 供健康模型消费（DATA_HEALTH_MODEL §3），
但任何路径都不得从它们派生事实——这是 §4 表 #3/#5/#6 的实现侧保证。

## 5. 血缘与版本

- 每个 NormalizedFact 必须指向恰好一个 `receipt_id`（且该回执 `status=SUCCESS`，规则 R1）；
- receipt 间关系仅两种：`CONTESTS`（同锚双 SUCCESS 字节不同，#2）与
  `SUPERSEDES`（PARTIAL→SUCCESS 补全，#3）；同一 observation 的 receipt 链
  构成完整历史，任何时点的投影都可从 `observed_at ≤ cutoff` 的 receipt 链重建；
- **parser 升级**：`parser_version` 从 `vN` → `vN+1` 时，
  对既有 raw **重放**（replay）生成新版本 fact 行，**禁止重新采集**
  （同 observation_key 不再发请求）；新旧 fact 并存，
  投影按策略（D1 默认：最新 parser 版本）选择，回放历史版本永远可行；
- 重放确定性：同 raw 字节 + 同 parser_version ⇒ 同 `payload_hash`
  （D1 测试 P1D-T04 以 fixture 全量重放两次断言逐字节一致）。

## 6. 并发采集兜底

- 数据库层：`UNIQUE (receipt_key)` 硬约束
  （status ∈ {SUCCESS, PARTIAL, ERROR, UNKNOWN} 全部参与——
  错误回执同样幂等，避免错误风暴膨胀）；
- 写入路径：`INSERT … ON CONFLICT (receipt_key) DO NOTHING`，
  冲突方读回既有行并按 §4 表 #1 记为幂等命中；
- 采集调度：同一 `observation_key` 的在途请求由 `collection_run` 侧的
  in-flight 租约避免重复发起（软优化，正确性由唯一约束兜底）。

## 7. 与既有验收目录的映射

- 本合同落地后闭合 `DATA-007`（重复原始事件幂等）与
  `DATA-008`（派生态可从不可变 raw 重建：gates/scores = Layer P，
  可随时由 Layer N/R 全量重算）。
- D1 证明测试：`P1D-T02`（同回执重采零新增）、`P1D-T03`（冲突双版本并存且投影带标记）、
  `P1D-T04`（parser 重放确定性）、`P1D-T06`（并发插入唯一约束）。
