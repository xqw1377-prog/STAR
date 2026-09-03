# D0 rev7 回执（四项可实施性阻断）

```text
commit      = 4e23cab（链：…ac60e1d → d23f331 → 4e23cab）
WORKTREE    = CLEAN · DOCS-ONLY PASS · lint 113/113 · 电池 tsc/72+6
STASH       = PRESERVED · P1 = NO-GO
```

| # | 阻断 | 落点 |
|---|---|---|
| 1 | payload_ref FK vs PURGE 悖论 | ERD raw_receipt：**设计性悬空内容句柄**（无 FK）；完整性两不变式（创建时同事务 + PURGE 唯一删除入口）；读取处置投影 `BYTES/PURGED/MISSING`（MISSING⇒对账+隔离）；FACT 同步行 |
| 2 | fact_relation 解决事件矛盾 | ERD fact_relation：**解除冻结经 fact_resolution_event**（回执级才走 contest_resolution_event，两级分轨）；旧矛盾句入 lint 禁用 |
| 3 | LICENSE_ERASURE 派生载荷 | fact 行 append-only 不动；载荷外置 `fact_payload_ref`（同 scoped blob 协议）；擦除 = 追加 `fact_erasure_event(LICENSE_ERASED)` + 外置 blob 同事务物理删除；读取投影 `PAYLOAD/ERASED`；ERASED⇒事实不可用⇒门禁 UNKNOWN |
| 4 | collection_plan_item 缺表 | 新表（append-only 版本化：UNIQUE(source,method,project,kind,plan_version)、retired_at）；attempts FK；**completeness 分母=该窗口当时活跃的 plan 版本**（历史可复现） |

运行时 P0-1…6 与工程项按既定映射不变（S0/D1-B/J0/backlog）；README 陈旧文案（46 tests、OVERRIDE 描述）登记至 S0 提交（保持 D0 边界纯 docs/p1-data）。
