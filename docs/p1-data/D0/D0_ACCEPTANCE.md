# P1-DATA-D0 · 验收矩阵（D0 ACCEPTANCE）· rev3

```text
P1-DATA-D0 rev1 = CHANGES-REQUIRED
P1-DATA-D0 rev2 = AUTHORIZED / DOCS-ONLY
```

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03  
本提交只含 `docs/p1-data/D0/**`。`c83e2ae` 因合同阻断退回，保留作审计档案。

| # | D0 门禁 | 设计条款 | D1 证明测试 |
|---|---|---|---|
| 1 | Raw 回执不可 UPDATE/DELETE；授权处置走事件链 | FACT_LAYERING §4（触发器；`raw_disposition_event`；PURGE 物理删 blob、hash 留证、HOLD 阻断） | `T01`：① 普通 UPDATE/DELETE 被拒 ② 授权 PURGE：行原样、blob 删除、事件在链 ③ HOLD 期间 PURGE 被拒 |
| 2 | 重复采集不重复生成回执/事实 | IDEMPOTENCY §4#1、§6 | `T02`：同回执 N 次采集 → 1 回执、fact 不变 |
| 3 | 新版本保留完整血缘且旧行零修改 | FACT_LAYERING §5（`supersedes_fact_id` + append-only `fact_relations`） | `T03a`：替代后旧行字节不变、链可遍历、旧行无回填 |
| 4 | Evidence 溯源到 raw hash/parser/rule 版本 | FACT_LAYERING §6（interpretation_context） | `T03b`：evidence → receipt → payload_hash 全链存在 |
| 5 | 回放只见 cutoff 前事实 | FACT_LAYERING §6 + 语料 §4 | `T07a`（hindsight 增删改，cutoff 输出字节级不变） |
| 6 | parser 重放确定；历史结论可复现 | IDEMPOTENCY §5（R3 双模式） | `T04`（重放确定性）、`T16`（HISTORICAL 字节级复现；REINTERPRET 带 `reinterpreted=true` 且不覆盖） |
| 7 | UNKNOWN fail-closed；无响应不伪装观察 | IDEMPOTENCY §4 Attempt 层（A2/A3） | `T06b`（超时→门禁 UNKNOWN、score=null）、`T14`（N 次超时→N Attempt、0 Receipt） |
| 8 | 冲突未解决不得晚者胜 | IDEMPOTENCY R2（CONTESTED→UNKNOWN/null/RESEARCH_REQUIRED；`contest_resolution_event`） | `T15`：注入冲突→冻结输出；解决事件后按 resolved receipt 恢复 |
| 9 | 来源仍只有 synthetic fixture | 未触碰 source-registry | 隔离 grep 0/0/0 纳入 D1 电池 |
| 10 | 不加页面/不接真源/不改六门阈值 | 各文档"明确不做" | `git show --stat` 仅 docs；阈值常量零 diff |
| 11 | 语料预期独立于被测引擎 | 语料 §2（oracle import 禁令） | `T17`（import-lint）、`T07`（校准 vs golden）、`T18`（family 无跨集） |
| 12 | engine.ts 注释修正只登记 | 下表 | 并入 D1 首个实现提交 |
| 13 | 处置事件全序/竞态 | FACT_LAYERING §4.1 | `T20`：并发 HOLD/PURGE 按全序先到胜；两阶段执行区间含 HOLD ⇒ 取消 |
| 14 | Attempt 可重建请求/重试/崩溃重放序列 | FACT_LAYERING §2（origin + retry 链 + error_body 留存） | `T21`：构造 INITIAL→RETRY→CRASH_REPLAY 链，序列可无损遍历 |
| 15 | 健康零样本不伪装完美 | DATA_HEALTH §3.1 | `T22`：空窗口四率=null、degraded_reason=UNKNOWN |

登记不执行：① engine.ts 头注释 → "I/O + persistence adapter; domain logic in lib/domain"（D1 首提交）；
② 载体规范 `git bundle create f.bundle HEAD main`（本次已采用）。

D1 放行申请条件：按 A/B/C/D 四段（A：schema+不可变边界+幂等/并发 → T01/T02/T03a/T06/T14；
B：血缘管道 → T03b/T04/T05/T15/T16；C：语料校准 → T07/T07a/T08/T09/T10/T17/T18；
D：健康投影 → T11/T12/T13/T19）。范围继续排除：真实来源、新页面、阈值变更。
