# D0 rev6 开发团队回执（按 R5 §7 模板）

D0 rev6 commit            = 71ee34c1535d2e5e2dff785e3c6c12dd13d6e6f2（8e5551e 主包 + 修正提交：IDEMPOTENCY/CORPUS/AUDIT_DISPOSITION 对齐 R5——自查发现禁用词扫描未覆盖全部 8 文件，已修复并全目录复扫=0）
WORKTREE                  = CLEAN
DOCS-ONLY DIFF            = PASS（6f40295..HEAD 对 app/lib/db/e2e/package*.json exit-code=0；仅 docs/p1-data/D0/**）
R5-01..R5-20 条款位置：
  R5-01 FACT §3 原子性（同一数据库事务 / 不反向保存 receipt_id / 禁止循环外键）
  R5-02 FACT §2（attempt_id UNIQUE NOT NULL / 矛盾终态不得覆盖 / 健康分母=Attempt）
  R5-03 FACT §2 终态枚举六类 + HEALTH §3（六率之和=1；response_bytes_received 独立布尔、正交）
  R5-04 FACT §2 错误响应字节（as-received SHA-256 / retention 门控 / 不泄密清单）
  R5-05 FACT §3（payload_inline 自本版删除；合成夹具同样适用）
  R5-06 FACT §3（DB CHECK 至少一非空；锚点前进=新观察）
  R5-07 FACT §4 四身份（attempt/query/observation/receipt_key；重试收敛同 Receipt）
  R5-08 FACT §5 ReceiptRelation（SUPERSEDES/CONTESTS/DUPLICATES；多重关系）
  R5-09 FACT §6（CONTESTED 无 gate 资格；ContestResolutionEvent 字段全）
  R5-10 FACT §7（fact_local_key NOT NULL + singleton；subject_type+subject_id；统一唯一约束）
  R5-11 FACT §8（ArtifactRegistry；REPLAY_ARTIFACT_MISSING 禁自动最新版）
  R5-12 FACT §9（EvidenceEligibilityPolicy 五输入；健康禁入 interpretCheck/评分）
  R5-13 HEALTH §3 completeness（计划制 0-vs-null 双语义；与零 Attempt 率 null 区分）
  R5-14 FACT §10（PURGE_REQUESTED→EXECUTED；请求五字段；同一受控事务/锁边界）
  R5-15 FACT §10（RAW_ONLY / LICENSE_ERASURE / REPLAY_SOURCE_PURGED / 禁墓碑字节）
  R5-16 TEMPORAL §2（统一事实身份含血缘+local key；禁 latestEvidenceByCheck；独立选择器）
  R5-17 TEMPORAL §3（状态图版本化；非法边拒绝；断链 CONTESTED；排序键四元组；关系表触发）
  R5-18 TEMPORAL §4（observed+effective 双 cutoff；UNKNOWN 不推断更早；缓存不变性）
  R5-19 HEALTH §3.1（degraded_reason 可并列集合；不丢弃；无样本≠0%）
  R5-20 D0_ACCEPTANCE 全目录（T01–T30 + R5-T01–R5-T20 + 治理 lint；唯一阶段归属）
R5-T01..R5-T20            = D0_ACCEPTANCE 测试目录（阶段映射唯一；跨阶段前置显式标注）
CONTRADICTORY OLD TEXT    = 0（全 8 文件目录级扫描，含修正前漏扫的 IDEMPOTENCY/CORPUS/DISPOSITION）
CODE/THRESHOLD/PAGE DIFF  = 0
STASH                     = PRESERVED（b336ac7 refs/stash；bundle list-heads 仅 HEAD+refs/heads/main，stash 未进载体；非 HEAD 祖先）
INDEPENDENT ARTIFACT      = bundle SHA-256 见 SHA256SUMS.txt；ZIP 哈希见下
REQUESTED DECISION        = PASS / CHANGES-REQUIRED（评审定）
P1                        = NO-GO

机器可复验：断言脚本（50 条 R5 检索词 + 禁用词扫描）可由评审在克隆内重跑；
电池：tsc PASS · vitest 72 passed/6 skipped · 自 P0 起代码零 diff。


## 上轮六项预上传阻断 → 本包条款位置（ccbc730）

1. 孤儿 Attempt 矛盾 → FACT §2「Attempt 生命周期状态」（IN_FLIGHT/UNRESOLVED；终态率分母=有终态 Attempt）；HEALTH §3（unresolved_rate = UNRESOLVED Start/同窗全部 Start，零 Start ⇒ null；六率恒等式在有终态子总体成立）
2. 跨源优先级 → FACT §6（SOURCE_PRIORITY 仅作已追加 ContestResolutionEvent 的冻结依据；「禁止投影期即时套用优先级」；事件前 Fact 不可用、Gate=UNKNOWN）+ IDEM §4 R2 同步
3. 阶段映射 → D0_ACCEPTANCE：R5-T04a(S0)/R5-T04b(D1-A)、R5-T12a(D1-B)/R5-T12b(J0)、R5-T15a(D1-A)/R5-T15b(D1-B)；「前置：D1-A blob 仓」「前置：J0 冻结 readiness」全文清零；T31–T35 改历史编号映射附录（非测试）
4. ERD/约束 → ERD_CONSTRAINTS.md（attempt/outcome/receipt/blob/relation 双端点/resolution/terminal_anomaly/fact/artifact_registry/disposition 枚举/refcount + 全部 FK/UNIQUE/CHECK + 4 条触发器清单）
5. 断言脚本入仓 → docs/p1-data/D0/verify_d0_contract.py；执行 python3 docs/p1-data/D0/verify_d0_contract.py；原始输出 = 载体内 verify-output.txt（MUST=70 present=70 missing=0；FORBIDDEN hits=0；RESULT: ALL PASS）
6. 版本/索引统一 → 全部包内 .md 标题 rev6（含 TEMPORAL 标题残留修复）；术语统一由脚本禁用词强制（五率/单值覆盖/rev4·rev5 标注 = 0）；README 索引含 ERD 与脚本
