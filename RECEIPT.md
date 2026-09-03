# D0 rev6 correction 回执（终审七阻断逐条位置）

```text
D0 rev6-correction commit = ac60e1d（链：8e5551e → 71ee34c → ccbc730 → ac60e1d）
WORKTREE                  = CLEAN
DOCS-ONLY DIFF            = PASS（对 app/lib/db/e2e/package*.json exit-code=0）
CONTRADICTORY OLD TEXT    = 0（lint FORBIDDEN=0，含新增 6 模式）
CODE/THRESHOLD/PAGE DIFF  = 0
STASH                     = PRESERVED（b336ac7 refs/stash，非 HEAD 祖先）
P1                        = NO-GO
```

## 七阻断 → 条款位置

1. **重试收敛血缘断裂** → FACT「AttemptReceiptLink」节（`outcome_event_id UNIQUE`、幂等命中必写新 Link、多 Attempt→单 Receipt）；Receipt 仅存 `creator_outcome_event_id`（首次创建锚点）；ERD `attempt_receipt_link` 表
2. **恰一终态 vs 孤儿** → FACT §2（"每个 Attempt 最多一个 AttemptOutcomeEvent；完成的 Attempt 恰有一个终态；IN_FLIGHT/UNRESOLVED 可以没有 Outcome"）；`lease_expires_at` 冻结字段；UNRESOLVED=窗口收盘时点谓词（HEALTH §3 同步）
3. **RawBlob 许可隔离** → FACT blob 身份（`blob_key = SHA256(scope ‖ payload_hash)`，PK(blob_key)）；ERD `raw_blob` 同步；Receipt 引用完整 scoped key
4. **ERD 缺实体** → 新增 `attempt_receipt_link`、`fact_relation`（CONTRADICTS/SUPERSEDES/TRIGGERS，TEMPORAL §3 指向）、`interpretation_context`（四个 artifact FK + parser_map + fact_ids）、Outcome `error_body_hash/ref/retention_class`、`normalized_fact.parser_artifact_id` 真外键
5. **Health 越权 readiness** → HEALTH 铁律 2 重写：「Data Health 无研究判断权」——展示/调度/告警；eligibility 判事实有效性；Gate/J0 产 UNKNOWN/readiness；"不得写入或覆盖 readiness"
6. **回执/索引过期** → 本 RECEIPT 重写（commit=ac60e1d，MUST=90）；README 标题 rev6、`degraded 优先级`→`原因集合`
7. **脚本只是关键词** → 脚本 docstring 明示「lint 非一致性证明，人工交叉评审必需」；新增 20 条结构断言 + 6 条禁用模式（恰一终态/PK hash/健康改 readiness/旧标题）；README 同步定位

## lint 原始输出（verify-output.txt）

MUST=90 present=90 missing=0 · FORBIDDEN hits=0 · RESULT: ALL PASS
（执行：python3 docs/p1-data/D0/verify_d0_contract.py）

## 电池

tsc PASS · vitest 72 passed/6 skipped · 自 P0 起代码零 diff
