# P1-DATA-D0 DESIGN PACKAGE（rev4）

```text
P1-DATA-D0 rev1            = SUPERSEDED（c83e2ae）
P1-DATA-D0 rev2            = SUPERSEDED（fbc802e）
P1-DATA-D0 rev3            = SUPERSEDED（ffaf938；终审 CHANGES-REQUIRED：
                             递交说明与正文不一致等八项阻断）
P1-DATA-D0 rev4            = SUPERSEDED（20c2bca）
P1-DATA-D0 rev5            = SUPERSEDED（1859b81；R5 裁定清单退回）
P1-DATA-D0 rev6            = CURRENT / DOCS-ONLY（吸收 R5-01…R5-20；测试目录 T01–T30 + R5-T01–20）
P1-DATA-D1                 = HOLD（A/B/C/D 分段授权，未放行）
P1                         = NO-GO
```

状态：DESIGN-ONLY（无实现代码）· 基线 star-web@6f40295 · 2026-09-03

| 文档 | 内容 |
|---|---|
| FACT_LAYERING_CONTRACT.md | 五层模型（AttemptStarted/OutcomeEvent/Receipt/Fact/投影）；处置状态机与 blob 引用计数；事实级时间语义；解释上下文 |
| IDEMPOTENCY_SEMANTICS.md | 双键规范；两阶段判定表；回执/事实冲突两级作用域；唯一约束；parser 重放 |
| SYNTHETIC_CORPUS_CONTRACT.md | 50+100 合成语料：oracle 独立、无前视不变量、家族分组（real=0） |
| DATA_HEALTH_MODEL.md | 六类终态率与质量指标；窗口/分母/零样本；degraded 优先级；plan_item 归因 |
| TEMPORAL_RESEARCH_CONTEXT.md | Narrative/Lifecycle 时态事实合同（C3 修复）+ 外部审计 C1–C6 处置映射 |
| D0_ACCEPTANCE.md | 验收门禁与阶段映射（T01–T30 + R5-T01–R5-T20 + 治理 lint） |
| AUDIT_DISPOSITION.md | 两轮审计全量处置总账（P0-1…5/门禁确定性/工程项 → S0/J0/D1 阶段） |
| ERD_CONSTRAINTS.md | 可实施 ERD 与 FK/UNIQUE/CHECK 约束表（D1-A 建表依据） |
| verify_d0_contract.py | 合同断言脚本（python3 docs/p1-data/D0/verify_d0_contract.py，零依赖） |

边界：不接真实来源（HOLD）、不新增页面、不改六门禁与阈值、不引入钱包/交易/AURORA。
