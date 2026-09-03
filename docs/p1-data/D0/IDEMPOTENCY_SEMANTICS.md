# P1-DATA-D0 · 幂等与版本语义（IDEMPOTENCY SEMANTICS）

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03

## 1. 两个正交的键

幂等不是一句话——请求身份与回执身份必须分开：

- **`observation_key`**：识别"这一次查询"（与响应无关）
- **`receipt_key`**：识别"这一次查询收到的一份响应实例"

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
  payload_hash                // status=SUCCESS/PARTIAL：响应体 SHA-256
                               // status=ERROR/UNKNOWN：error_code
)
```

同一查询、同一链上锚、同一响应字节（或同一错误码）→ 同一 receipt。
**不同 payload 天然产生不同 receipt**，因此"重复"与"冲突"的判定不靠比较键碰撞，
而靠 §4 的判定表在 `observation_key + anchor` 粒度上做归并。

## 4. 判定表（重复 / 修订 / 冲突 / 新观察）

设已有行 E（同 `observation_key`），新到响应 N：

| # | 条件 | 判定 | 动作 |
|---|---|---|---|
| 1 | `N.receipt_key == E.receipt_key` | **幂等命中** | 不插入 raw；仅在采集批次日志（sidecar `collection_run` 表）记录 run 与 hit；raw 行零改动 |
| 2 | 同 `observation_key` + 同 `anchor` + `payload_hash` 不同 + 双方 SUCCESS | **冲突（CONTESTED）** | 插入新 raw，`relation='CONTESTS'`、`relates_to=E.id`；E 不动；数据健康 `contradiction_count +1`；对应 NormalizedFact 两版并存，投影按内核平局规则取晚者并携带 conflict 标记 |
| 3 | 同 `observation_key` + 同 `anchor` + 一方 PARTIAL | **修订（SUPERSEDES）** | 插入新 raw，`relation='SUPERSEDES'`、`relates_to=E.id`；新 fact 的 `superseded_by` 链完整保留；旧 fact 不删 |
| 4 | 同 `observation_key` + 不同 `anchor`（slot 前进） | **新观察** | 正常插入，无 relation；这是链上状态的正常推进，不是重复 |
| 5 | `status=UNKNOWN`（超时等） | **未定回执** | 插入 raw（payload_hash=null，error_code=TIMEOUT）；**不产生任何 NormalizedFact**；门禁维持 UNKNOWN（fail-closed）；后续重试是新的 receipt |
| 6 | `status=ERROR`（明确失败） | **失败回执** | 插入 raw；仅进健康遥测；同样不产生 fact |

## 5. 血缘与版本

- 每个 NormalizedFact 必须指向恰好一个 `receipt_id`；
- 同一 observation 的 receipt 链（CONTESTS/SUPERSEDES）构成完整历史，
  任何时点的投影都可从 `observed_at ≤ cutoff` 的 receipt 链重建；
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
