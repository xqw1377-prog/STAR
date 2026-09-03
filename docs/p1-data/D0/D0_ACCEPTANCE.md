# P1-DATA-D0 · 验收矩阵（D0 ACCEPTANCE）· rev4

```text
P1-DATA-D0 rev1 = SUPERSEDED（c83e2ae）
P1-DATA-D0 rev2 = SUPERSEDED（fbc802e）
P1-DATA-D0 rev3 = SUPERSEDED（ffaf938；终审 CHANGES-REQUIRED，八项阻断）
P1-DATA-D0 rev4 = CURRENT / DOCS-ONLY（本包）
```

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
本提交只含 `docs/p1-data/D0/**`（治理前置：`b9c2a57` 已独立 revert 未授权
`5f0001a`，`git diff --exit-code ffaf938..b9c2a57` = 0）。rev4 闭合终审八项。

| # | D0 门禁 | 设计条款 | D1 证明测试（阶段） |
|---|---|---|---|
| 1 | Raw/A0/A1 行不可 UPDATE/DELETE；授权处置走事件链 | FACT §5.1–§5.4 | T01（A） |
| 2 | 重复采集不重复入库 | IDEM §4#1、§6 | T02（A） |
| 3 | 新版本血缘完整、旧行零修改 | FACT §6 supersedes_fact_id | T03a（A） |
| 4 | Evidence 溯源 raw hash/parser/rule/策略哈希 | FACT §7 interpretation_context | T03b（B） |
| 5 | 回放只见 cutoff 前事实 | FACT §7 + 语料 §4 | T07a（C） |
| 6 | parser 重放确定；历史可复现 | IDEM §5 R3 | T04（B）、T16（B） |
| 7 | 无响应不伪装观察；UNKNOWN fail-closed | IDEM §4 A2–A5 | T06b（A）、T14（A）、T23（A） |
| 8 | 回执冲突未解决不得晚者胜 | IDEM R2 + §4.1（仅 FINALIZED_SLOT/MANUAL_AUDIT） | T15（B） |
| 9 | 事实级跨源矛盾用 fact_relations + 策略内容哈希 | IDEM §4.2 + FACT §8 | T26（B） |
| 10 | 处置状态机可恢复、HOLD 优先、引用计数 | FACT §5.2–§5.4 | T20（A）、T24（A）、T25（A） |
| 11 | 事实级时间语义（effective/kind/scheduled） | FACT §6 | T23 断言组（A/B） |
| 12 | blob PURGE 后 HISTORICAL 不假装可重算 | FACT §7 REPLAY_SOURCE_PURGED | T16（B） |
| 13 | 健康零样本 null、优先级确定、失败请求可归因 | HEALTH §3.1/§3.2/§2 | T22（D）、T27（D）、T28（D）、T19（D） |
| 14 | 来源仍只有 synthetic fixture | 未触碰 source-registry | 隔离 grep 纳入 D1 电池 |
| 15 | 不加页面/不接真源/不改六门阈值 | 各文档"明确不做" | git show --stat 仅 docs |
| 16 | engine.ts 注释修正只登记 | 下表 | D1-A 首提交执行 |
| 17 | Replay 禁读当前缓存列；Narrative/Lifecycle 为时态事实 | TEMPORAL_RESEARCH_CONTEXT §2–§4 | T29（B）、T30（B） |
| 18 | 外部审计 C1–C6 处置已登记（J0/S0/D1-B 映射） | TEMPORAL_RESEARCH_CONTEXT §6 | 签署后按序（S0→D1-A→D1-B→J0→C/D） |

登记不执行：① engine.ts 头注释 → "I/O + persistence adapter; domain logic in lib/domain"；
② 载体规范 `git bundle create f.bundle HEAD main`。

## D1 阶段测试对齐（T01–T28 全量归位，无漏项）

| 阶段 | 范围 | 测试 |
|---|---|---|
| **D1-A 事实底座** | A0/A1/R/N schema、不可变边界、幂等、并发、处置状态机、健康合同前置 | T01, T02, T03a, T05, T06, T06b, T14, T20, T21, T22, T23, T24, T25 |
| **D1-B 时态事实管道** | fixture→raw→parser→fact 血缘、冲突、双回放、**Narrative/Lifecycle 点时事实、写入前时态校验、固定时钟** | T03b, T04, T15, T16, T26, T29, T30 |
| **D1-C 合成语料** | 150 案例、oracle 独立、无前视、家族分组 | T07, T07a, T08, T09, T10, T17, T18 |
| **D1-D 数据健康** | 投影、四率、优先级、归因 | T11, T12, T13, T19, T27, T28 |

（T21 = Attempt 链重建含 CRASH_REPLAY 孤儿语义；T22/T27/T28 归 D，
其中 T22 的**合同**（零样本语义）已在 HEALTH §3.1 冻结，实现随 D 落地。）
