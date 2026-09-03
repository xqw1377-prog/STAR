#!/usr/bin/env python3
"""D0 合同 lint 脚本（零依赖；repo 根执行：python3 docs/p1-data/D0/verify_d0_contract.py）

定位：**快速 lint，不是合同一致性证明**——关键词/结构断言只能捕获已知矛盾模式，
语义一致性仍需人工交叉评审（rev6 终审教训：关键词全绿仍存在结构性矛盾）。
MUST：关键条款与结构实体在正文可检索。
FORBIDDEN：已废除的旧措辞必须为 0（全部包内 .md）。
退出码：0 = 全部通过；1 = 存在缺失/残留。
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

MUST = [
    # (file, needle, tag)
    ("FACT_LAYERING_CONTRACT.md", "先提交 Outcome 稍后补 Receipt", "R5-01"),
    ("FACT_LAYERING_CONTRACT.md", "同一数据库事务", "R5-01"),
    ("FACT_LAYERING_CONTRACT.md", "禁止循环外键", "R5-01"),
    ("FACT_LAYERING_CONTRACT.md", "attempt_id UNIQUE NOT NULL", "R5-02"),
    ("FACT_LAYERING_CONTRACT.md", "矛盾第二终态", "R5-02"),
    ("FACT_LAYERING_CONTRACT.md", "SOURCE_ERROR", "R5-03"),
    ("FACT_LAYERING_CONTRACT.md", "response_bytes_received", "R5-03"),
    ("FACT_LAYERING_CONTRACT.md", "独立布尔", "R5-03"),
    ("FACT_LAYERING_CONTRACT.md", "as-received SHA-256", "R5-04"),
    ("FACT_LAYERING_CONTRACT.md", "payload_inline 自本版删除", "R5-05"),
    ("FACT_LAYERING_CONTRACT.md", "合成夹具同样适用", "R5-05"),
    ("FACT_LAYERING_CONTRACT.md", "DB CHECK：至少一非空", "R5-06"),
    ("FACT_LAYERING_CONTRACT.md", "query_identity", "R5-07"),
    ("FACT_LAYERING_CONTRACT.md", "可收敛到同一 Receipt", "R5-07"),
    ("FACT_LAYERING_CONTRACT.md", "DUPLICATES", "R5-08"),
    ("FACT_LAYERING_CONTRACT.md", "不具备 gate eligibility", "R5-09"),
    ("FACT_LAYERING_CONTRACT.md", "ContestResolutionEvent", "R5-09"),
    ("FACT_LAYERING_CONTRACT.md", "SOURCE_PRIORITY", "R5-09/项2"),
    ("FACT_LAYERING_CONTRACT.md", "禁止投影期即时套用优先级", "项2"),
    ("FACT_LAYERING_CONTRACT.md", "fact_local_key` NOT NULL", "R5-10"),
    ("FACT_LAYERING_CONTRACT.md", "singleton", "R5-10"),
    ("FACT_LAYERING_CONTRACT.md", "subject_type + subject_id", "R5-10"),
    ("FACT_LAYERING_CONTRACT.md", "ArtifactRegistry", "R5-11"),
    ("FACT_LAYERING_CONTRACT.md", "REPLAY_ARTIFACT_MISSING", "R5-11"),
    ("FACT_LAYERING_CONTRACT.md", "EvidenceEligibilityPolicy", "R5-12"),
    ("FACT_LAYERING_CONTRACT.md", "PURGE_REQUESTED → PURGE_EXECUTED", "R5-14"),
    ("FACT_LAYERING_CONTRACT.md", "idempotency_key", "R5-14"),
    ("FACT_LAYERING_CONTRACT.md", "同一受控事务/锁边界", "R5-14"),
    ("FACT_LAYERING_CONTRACT.md", "RAW_ONLY", "R5-15"),
    ("FACT_LAYERING_CONTRACT.md", "LICENSE_ERASURE", "R5-15"),
    ("FACT_LAYERING_CONTRACT.md", "REPLAY_SOURCE_PURGED", "R5-15"),
    ("FACT_LAYERING_CONTRACT.md", "墓碑字节", "R5-15"),
    ("FACT_LAYERING_CONTRACT.md", "IN_FLIGHT", "项1"),
    ("FACT_LAYERING_CONTRACT.md", "UNRESOLVED", "项1"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "禁止仅以 narrative_id + observed_at + parser_version 去重", "R5-16"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "独立的 narrative subject + fact kind 选择器", "R5-16"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "非法边拒绝入事实层", "R5-17"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "断链进入 CONTESTED", "R5-17"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "排序键固定为 `(effective_at, observed_at, ingested_at, id)`", "R5-17"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "禁止仅保存无法校验的 JSON id 数组", "R5-17"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "cutoff 时已生效", "R5-18"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "不得被推断为更早生效", "R5-18"),
    ("IDEMPOTENCY_SEMANTICS.md", "SOURCE_PRIORITY", "R5-09"),
    ("IDEMPOTENCY_SEMANTICS.md", "UNIQUE(attempt_id)", "R5-02"),
    ("IDEMPOTENCY_SEMANTICS.md", "singleton", "R5-10"),
    ("DATA_HEALTH_MODEL.md", "六率之和 = 1", "R5-03"),
    ("DATA_HEALTH_MODEL.md", "response_bytes_received / 有终态 Attempt", "R5-03"),
    ("DATA_HEALTH_MODEL.md", "unresolved_rate", "项1"),
    ("DATA_HEALTH_MODEL.md", "可并列集合", "R5-19"),
    ("DATA_HEALTH_MODEL.md", "不得丢弃其他原因", "R5-19"),
    ("DATA_HEALTH_MODEL.md", "不得把无样本显示成 0% 可用", "R5-19"),
    ("DATA_HEALTH_MODEL.md", "零成功观察 = 0", "R5-13"),
    ("DATA_HEALTH_MODEL.md", "分母不可定义 = null", "R5-13"),
    ("D0_ACCEPTANCE.md", "R5-T04a", "项3"),
    ("D0_ACCEPTANCE.md", "R5-T04b", "项3"),
    ("D0_ACCEPTANCE.md", "R5-T12a", "项3"),
    ("D0_ACCEPTANCE.md", "R5-T12b", "项3"),
    ("D0_ACCEPTANCE.md", "R5-T15a", "项3"),
    ("D0_ACCEPTANCE.md", "R5-T15b", "项3"),
    ("D0_ACCEPTANCE.md", "历史编号映射", "项3"),
    ("D0_ACCEPTANCE.md", "R5-T20", "R5-20"),
    ("ERD_CONSTRAINTS.md", "UNIQUE(`attempt_id`)", "项4"),
    ("ERD_CONSTRAINTS.md", "UNIQUE(`receipt_key`)", "项4"),
    ("ERD_CONSTRAINTS.md", "anchor_slot IS NOT NULL OR anchor_time IS NOT NULL", "项4"),
    ("ERD_CONSTRAINTS.md", "receipt_id, fact_kind, subject_type, subject_id, parser_version, fact_local_key", "项4"),
    ("ERD_CONSTRAINTS.md", "PURGE_REQUESTED / PURGE_EXECUTED / PURGE_CANCELLED / QUARANTINE / HOLD / RELEASE", "项4"),
    ("ERD_CONSTRAINTS.md", "terminal_anomaly_event", "项4"),
    ("ERD_CONSTRAINTS.md", "blob_refcount_event", "项4"),
    ("ERD_CONSTRAINTS.md", "artifact_registry", "项4"),
    ("README.md", "rev6            = CURRENT", "项6"),
    ("FACT_LAYERING_CONTRACT.md", "AttemptReceiptLink", "终审阻断1"),
    ("FACT_LAYERING_CONTRACT.md", "最多一个 AttemptOutcomeEvent", "终审阻断2"),
    ("FACT_LAYERING_CONTRACT.md", "lease_expires_at", "终审阻断2"),
    ("FACT_LAYERING_CONTRACT.md", "blob_key = SHA256(scope ‖ payload_hash)", "终审阻断3"),
    ("FACT_LAYERING_CONTRACT.md", "creator_outcome_event_id", "终审阻断1"),
    ("IDEMPOTENCY_SEMANTICS.md", "必写新 Link", "终审阻断1"),
    ("IDEMPOTENCY_SEMANTICS.md", "lease_expires_at", "终审阻断2"),
    ("DATA_HEALTH_MODEL.md", "Data Health 无研究判断权", "终审阻断5"),
    ("DATA_HEALTH_MODEL.md", "不得写入或覆盖 readiness", "终审阻断5"),
    ("DATA_HEALTH_MODEL.md", "EvidenceEligibilityPolicy → 判定事实是否有效", "终审阻断5"),
    ("TEMPORAL_RESEARCH_CONTEXT.md", "fact_relation(relation=TRIGGERS)", "终审阻断4"),
    ("ERD_CONSTRAINTS.md", "attempt_receipt_link", "终审阻断4"),
    ("ERD_CONSTRAINTS.md", "blob_key = SHA256(scope ‖ payload_hash)", "终审阻断3"),
    ("ERD_CONSTRAINTS.md", "### fact_relation", "终审阻断4"),
    ("ERD_CONSTRAINTS.md", "### interpretation_context", "终审阻断4"),
    ("ERD_CONSTRAINTS.md", "error_body_hash", "终审阻断4"),
    ("ERD_CONSTRAINTS.md", "parser_artifact_id", "终审阻断4"),
    ("ERD_CONSTRAINTS.md", "lease_expires_at", "终审阻断2"),
    ("ERD_CONSTRAINTS.md", "PK(`blob_key`)", "终审阻断3"),
    ("README.md", "DESIGN PACKAGE（rev6）", "终审阻断6"),
    ("ERD_CONSTRAINTS.md", "||--o| ATTEMPT_RECEIPT_LINK", "裁定7-1"),
    ("ERD_CONSTRAINTS.md", "ATTEMPT_OUTCOME_EVENT ||--o| RAW_RECEIPT", "裁定7-2"),
    ("ERD_CONSTRAINTS.md", "attempt_id → collection_attempt.id", "裁定7-2"),
    ("ERD_CONSTRAINTS.md", "blob_key → raw_blob.blob_key", "裁定7-3"),
    ("ERD_CONSTRAINTS.md", "{ADD, REMOVE, RECONCILE}", "裁定7-3"),
    ("ERD_CONSTRAINTS.md", "reconciled_count", "裁定7-3"),
    ("ERD_CONSTRAINTS.md", "### fact_resolution_event", "裁定7-4"),
    ("ERD_CONSTRAINTS.md", "### interpretation_context_parser", "裁定7-5"),
    ("ERD_CONSTRAINTS.md", "### interpretation_context_fact", "裁定7-5"),
    ("ERD_CONSTRAINTS.md", "contract_artifact_id", "裁定7-5"),
    ("ERD_CONSTRAINTS.md", "error_body_ref → raw_blob.blob_key", "裁定7-6"),
    ("FACT_LAYERING_CONTRACT.md", "每 Attempt 最多一个；完成态恰一终态（R5-02）", "裁定7-7"),
    ("FACT_LAYERING_CONTRACT.md", "FactResolutionEvent", "裁定7-4"),
]

FORBIDDEN = [
    "每 Attempt 恰一个终态",
    "attempt_started_id",
    "blob_hash → raw_blob.hash",
    "+1 receipt / −1 purge",
    "||--|| ATTEMPT_RECEIPT_LINK",
    "RAW_RECEIPT ||--o| RAW_RECEIPT",
    "恰一个**终态",            # 旧"恰一终态"表述（阻断2 矛盾源）
    "PK `hash`",              # blob 全局主键（阻断3）
    "健康恶化最多把 readiness",  # 越权表述（阻断5）
    "DESIGN PACKAGE（rev2）",
    "DESIGN PACKAGE（rev4）",
    "degraded 优先级",
    "SUCCESS_RESPONSE",
    "RESPONSE_RECEIVED",
    "HTTP_ERROR/",          # 旧五态 HTTP_ERROR 类
    "部分唯一索引",
    "仅当 `fact_local_key` 非空",
    "五态",
    "五率",
    "T01–T28",
    "单值覆盖",
    "（前置：D1-A blob 仓）",
    "（前置：J0 冻结 readiness）",
    "payload_inline` | text / bytea·null",
    "· rev4\n",
    "· rev5\n",
]


def main() -> int:
    miss = []
    for fname, needle, tag in MUST:
        path = os.path.join(HERE, fname)
        with open(path, encoding="utf-8") as f:
            if needle not in f.read():
                miss.append(f"MISS [{tag}] {fname}: {needle!r}")
    contra = []
    for fname in sorted(os.listdir(HERE)):
        if not fname.endswith(".md"):
            continue
        with open(os.path.join(HERE, fname), encoding="utf-8") as f:
            text = f.read()
        for word in FORBIDDEN:
            if word in text:
                contra.append(f"CONTRADICTORY {fname}: {word!r}")
    for line in miss + contra:
        print(line)
    print(f"MUST={len(MUST)} present={len(MUST) - len(miss)} missing={len(miss)}")
    print(f"FORBIDDEN hits={len(contra)} (files scanned: all package .md)")
    ok = not miss and not contra
    print("RESULT:", "ALL PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
