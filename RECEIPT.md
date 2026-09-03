# D0 schema correction 回执（七项 ERD 阻断逐条位置）

```text
commit                    = d23f331（链：…ccbc730 → ac60e1d → d23f331）
WORKTREE                  = CLEAN
DOCS-ONLY                 = PASS（代码路径 exit-code=0）
lint                      = MUST=103/103 · FORBIDDEN=0 · ALL PASS（verify-output.txt）
电池                      = tsc PASS · vitest 72/6
STASH                     = PRESERVED · P1 = NO-GO
```

| # | 阻断 | 落点 |
|---|---|---|
| 1 | Outcome→Link 基数 | ERD Mermaid `||--o|`；attempt_receipt_link 条件 CHECK（SUCCESS/PARTIAL⇒恰一 Link；其余四终态⇒零）；FACT/IDEM 方向链同步 |
| 2 | 首创关系画错 + 字段名 | Mermaid 改 `ATTEMPT_OUTCOME_EVENT ||--o| RAW_RECEIPT`（creator 锚点）；`attempt_started_id` 全文清零，统一 `attempt_id` |
| 3 | refcount 引用废除字段 | FK `blob_key → raw_blob.blob_key`；`event_type ∈ {ADD, REMOVE, RECONCILE}` 与 `delta integer` 两列分离；RECONCILE 附确定性 `reconciled_count`；FACT §5.2 同步 |
| 4 | Fact 冲突无解决事件 | 新表 `fact_resolution_event`（→fact_relation；basis ∈ SOURCE_PRIORITY/MANUAL_AUDIT；内容哈希 basis_version）；FACT §6 跨源段落补充（lint 断言 FactResolutionEvent 在正文，非仅 ERD） |
| 5 | JSONB 外键不可约束 | interpretation_context 拆三表：主表（contract_artifact_id 等四个真 FK）+ `_parser` + `_fact` 关系表 |
| 6 | 错误 Blob 缺 FK/条件 | `error_body_ref → raw_blob.blob_key` 真外键 + 四条条件 CHECK（bytes⇒hash、RAW_RETAINED⇒ref、非留存⇒ref NULL、scope 一致） |
| 7 | 残留"恰一终态" | FACT §1 摘要行改"最多一个；完成态恰一终态"；lint 新增禁用模式 `每 Attempt 恰一个终态` + 摘要行正向断言 |

lint 增强：MUST 90→103（+13 结构断言）；FORBIDDEN 13→19（+6：恰一终态/attempt_started_id/blob_hash→raw_blob.hash/旧 delta 混合/||--||/自关联边）。
