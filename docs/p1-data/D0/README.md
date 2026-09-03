# P1-DATA-D0 DESIGN PACKAGE（rev4）

```text
P1-DATA-D0 rev1            = SUPERSEDED（c83e2ae）
P1-DATA-D0 rev2            = SUPERSEDED（fbc802e）
P1-DATA-D0 rev3            = SUPERSEDED（ffaf938；终审 CHANGES-REQUIRED：
                             递交说明与正文不一致等八项阻断）
P1-DATA-D0 rev4            = CURRENT / DOCS-ONLY（本包）
P1-DATA-D1                 = HOLD（A/B/C/D 分段授权，未放行）
P1                         = NO-GO
```

状态：DESIGN-ONLY（无实现代码）· 基线 star-web@6f40295 · 2026-09-03

| 文档 | 内容 |
|---|---|
| FACT_LAYERING_CONTRACT.md | 五层模型（AttemptStarted/OutcomeEvent/Receipt/Fact/投影）；处置状态机与 blob 引用计数；事实级时间语义；解释上下文 |
| IDEMPOTENCY_SEMANTICS.md | 双键规范；两阶段判定表；回执/事实冲突两级作用域；唯一约束；parser 重放 |
| SYNTHETIC_CORPUS_CONTRACT.md | 50+100 合成语料：oracle 独立、无前视不变量、家族分组（real=0） |
| DATA_HEALTH_MODEL.md | 五率与质量指标；窗口/分母/零样本；degraded 优先级；plan_item 归因 |
| D0_ACCEPTANCE.md | 验收门禁与 D1-A/B/C/D 测试对齐（T01–T28） |

边界：不接真实来源（HOLD）、不新增页面、不改六门禁与阈值、不引入钱包/交易/AURORA。
