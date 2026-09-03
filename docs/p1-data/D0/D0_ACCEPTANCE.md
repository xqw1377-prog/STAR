# P1-DATA-D0 · 验收矩阵（D0 ACCEPTANCE）· rev6

```text
P1-DATA-D0 rev1–rev5 = SUPERSEDED
P1-DATA-D0 rev6      = CURRENT / DOCS-ONLY（吸收 R5-01…R5-20；测试目录 T01–T30 + R5-T01–R5-T20）
```

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03 · 仅 `docs/p1-data/D0/**`。

## 阶段定义（R5-20）

| 阶段 | 范围 |
|---|---|
| D1-A | Attempt/Outcome/Receipt/Fact、原子性、幂等、关系、PURGE/HOLD、身份、数据库约束 |
| D1-B | parser 血缘、冲突资格、Narrative/Lifecycle 时态事实、HISTORICAL/REINTERPRET |
| J0 | Decision Readiness、Evidence Completeness、Opportunity Score、Lifecycle Fit、Confidence、Top-K 语义 |
| D1-C | 150 合成语料、独立 oracle、无前视与区分度 |
| D1-D | Data Health 聚合、窗口、零样本、降级原因 |

**每项测试只有一个主要实施阶段**；跨阶段前置显式列"（前置：X）"，不重复归属。

## 测试目录（全量；治理列 = R5-T20 lint 规则的输入）

| ID | 性质 | 阶段 |
|---|---|---|
| T01 | 行不可变 + 授权 PURGE + HOLD 阻断 | D1-A |
| T02 | 同 receipt_key 重复采集零新增 | D1-A |
| T03a | supersedes 血缘链，旧行零修改 | D1-A |
| T03b | evidence → receipt → payload_hash 溯源 | D1-B |
| T04 | parser 重放确定性（同字节同版本同 payload_hash） | D1-B |
| T05 | JCS 规范化向量 | D1-A |
| T06 | 并发唯一约束兜底 | D1-A |
| T06b | 超时 ⇒ 门禁 UNKNOWN、score=null（前置：D1-B eligibility） | D1-B |
| T07 | 150 案例校准 vs oracle/golden | D1-C |
| T07a | 无前视不变量（逐案例，hindsight 增删改字节级不变） | D1-C |
| T08 | 语料种子重放字节级一致 | D1-C |
| T09 | 区分度敏感性（独立于 T07a） | D1-C |
| T10 | 覆盖率矩阵约束 | D1-C |
| T11 | 健康投影可从 A/R 全量重建 | D1-D |
| T12 | 注入后率正确且门禁零变化 | D1-D |
| T13 | 健康数值不入 gate/score 载荷（类型级） | D1-D |
| T14 | Attempt 永不去重（N 次请求 N 行） | D1-A |
| T15 | 回执冲突冻结/解决（仅 FINALIZED_SLOT/MANUAL_AUDIT） | D1-B |
| T16 | HISTORICAL 字节级复现；REINTERPRET 带标记；PURGED 语义 | D1-B |
| T17 | oracle import 隔离 lint | D1-C |
| T18 | family 分组无跨集 | D1-C |
| T19 | N 次超时 ⇒ N 组 Start+Outcome，率如实 | D1-D |
| T20 | 处置事件全序/竞态（并入 R5-T14） | D1-A |
| T21 | Attempt 链重建含 CRASH_REPLAY 孤儿 | D1-A |
| T22 | 零 Attempt ⇒ 率 null；无样本不显示 0% | D1-D |
| T23 | 两阶段：Start 先存、崩溃孤儿、无回填 | D1-A |
| T24 | purge worker 崩溃恢复三分支收敛（并入 R5-T14） | D1-A |
| T25 | blob 引用计数/跨范围隔离 | D1-A |
| T26 | 跨源 fact_relations + 策略哈希复现 | D1-B |
| T27 | degraded_reason 集合语义（多重并存可复现） | D1-D |
| T28 | plan_item 归因：失败请求计入 ProjectHealth | D1-D |
| T29 | 当前缓存列篡改 ⇒ 历史 cutoff 输出不变（逐案例扩展见 R5-T18） | D1-B |
| T30 | Narrative/Lifecycle 点时事实与区分度 | D1-B |
| T31 | （rev5 已并入 R5-T01）— | — |
| T32 | （rev5 已并入 R5-T10/R5-T02）— | — |
| T33 | （rev5 已并入 R5-T08）— | — |
| T34 | （rev5 已并入 R5-T17）— | — |
| T35 | （rev5 已并入 R5-T11）— | — |
| R5-T01 | Outcome/Receipt 单向外键与事务原子性，逐写点崩溃无半状态 | D1-A |
| R5-T02 | 每 Attempt 仅一终态；重复/矛盾终态不双计 | D1-A |
| R5-T03 | 六类终态互斥求和=1；响应可用率正交 | D1-D |
| R5-T04 | 错误体 hash 恒存，blob 受 retention/license 控制且不泄密 | S0（前置：D1-A blob 仓） |
| R5-T05 | 无 inline payload；PURGE 后原 hash 位置无墓碑字节 | D1-A |
| R5-T06 | 锚点至少一非空；锚点前进成新观察 | D1-A |
| R5-T07 | 重试/崩溃重放不同 Attempt、同字节收敛同 Receipt | D1-A |
| R5-T08 | 一回执多重 CONTESTS/SUPERSEDES/DUPLICATES 关系 | D1-A |
| R5-T09 | 冲突未解决 Fact 无 gate 资格；解决后仅投影变化 | D1-B |
| R5-T10 | singleton 与复数键并发写入满足统一唯一约束 | D1-A |
| R5-T11 | 缺 artifact ⇒ HISTORICAL 明确失败 REPLAY_ARTIFACT_MISSING | D1-B |
| R5-T12 | 过期/缺失/冲突强制证据 UNKNOWN；健康不改 Gate | D1-B（前置：J0 冻结 readiness） |
| R5-T13 | 有计划零事实 completeness=0；无计划 null；零 Attempt 率=null | D1-D（前置：J0 冻结 completeness 量纲） |
| R5-T14 | PURGE/HOLD 全竞态序列确定收敛、无越权删除 | D1-A |
| R5-T15 | RAW_ONLY 与 LICENSE_ERASURE 重放语义不同且正确 | D1-A（执行）/D1-B（回放断言，前置列出） |
| R5-T16 | 多源同时点 NarrativeSnapshot 并存且冲突 fail-closed | D1-B |
| R5-T17 | Lifecycle 非法边/断链/并发冲突拒绝或 UNKNOWN | D1-B |
| R5-T18 | 当前缓存任意篡改不改逐案例历史 cutoff | D1-B（语料断言入 D1-C 前置） |
| R5-T19 | 健康窗口边界、零样本、多重 degraded 集合可复现 | D1-D |
| R5-T20 | 测试—阶段映射 lint：无遗漏、无重复主归属 | 治理（CI） |

注：T31–T35 为 rev5 编号，rev6 起并入对应 R5-T*（表内已注明），编号保留防断链。

## 登记不执行

① engine.ts 头注释（D1-A 首提交）；② 载体规范 `HEAD main`（已执行）；
③ S0 工单（AUDIT_DISPOSITION）待显式授权；④ R5 §4 全部代码修复在 rev6 签署前=否。
