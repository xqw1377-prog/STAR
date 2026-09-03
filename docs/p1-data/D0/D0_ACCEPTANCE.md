# P1-DATA-D0 · 验收矩阵（D0 ACCEPTANCE）

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
（rev1：吸收评审五处核对点——原始字节哈希、身份分层 R0、parser 输入门 R1、
受控例外 §2.1、scheduled_at §2.2；diff 741284c..HEAD 仅含 D0 文档修订）
本提交**只含文档**（`git show --stat` 范围 = `docs/p1-data/D0/**`）。
每项 D0 门禁给出：设计条款出处 + D1 实现阶段将以哪个测试证明。

| # | D0 门禁 | 设计条款 | D1 证明测试 |
|---|---|---|---|
| 1 | Raw 层不可更新、不可删除 | FACT_LAYERING §2 不可变性（触发器+repository 单入口；blob 内容寻址） | `P1D-T01`：尝试 UPDATE/DELETE raw 行必须抛错且计数不变 |
| 2 | 重复采集不重复生成事实 | IDEMPOTENCY §4#1、§6（receipt_key 唯一约束 + DO NOTHING + run 日志） | `P1D-T02`：同回执采集 N 次，raw 行数=1、fact 行数不变 |
| 3 | 同一事实新版本保留完整血缘 | IDEMPOTENCY §4#2/#3、§5（CONTESTS/SUPERSEDES 链 + fact.superseded_by） | `P1D-T03`：注入冲突后两版并存、链完整、投影带 conflict 标记 |
| 4 | 每条 Evidence 可溯到 raw hash / parser / 规则版本 | FACT_LAYERING §3/§4（receipt_id、parser_version、rule_version、evidence_refs） | `P1D-T03b`：随机抽 evidence 反查 receipt → payload_hash 全链存在 |
| 5 | 回放只见 cutoff 前已观察事实 | FACT_LAYERING §4（投影走 Layer N + latestEvidenceByCheck） | 语料 `P1D-T07/T09`（含 hindsight 反向篡改断言） |
| 6 | parser 重放结果确定 | IDEMPOTENCY §5（重放不重采集；同字节+同版本⇒同 payload_hash） | `P1D-T04`：fixture 全量重放两次逐字节一致；`P1D-T05` JCS 向量 |
| 7 | UNKNOWN 全程 fail-closed | IDEMPOTENCY §4#5/#6（UNKNOWN/ERROR 不产 fact）；HEALTH 铁律 2 | `P1D-T06b`：超时注入后对应门禁=UNKNOWN、score=null、readiness 不因健康变化 |
| 8 | 来源仍只有 synthetic fixture | 设计未触碰 source-registry；采集对象仅 `synthetic-fixtures` | 现有隔离 grep 0/0/0 纳入 D1 电池（沿用） |
| 9 | 不加页面 / 不接真源 / 不改六门阈值 | 各文档"明确不做"节；本提交 diff 仅 docs | `git show --stat` 仅 `docs/p1-data/D0/**`；六门阈值常量零 diff |
| 10 | engine.ts 注释修正只登记 | 见下表"登记不执行" | 并入 D1 首个实现提交 |

## 登记不执行（deferred）

| 项 | 处置 |
|---|---|
| `lib/engine.ts` 头注释 "I/O adapter only" 措辞 | 改为 "I/O + persistence adapter; domain logic in lib/domain"——**D1 首提交执行**，本包不夹带 |
| 载体规范 | 下次 bundle 制作使用 `git bundle create f.bundle HEAD main`（含默认 HEAD） |

## D1 放行申请条件（本包评审通过后）

D1（synthetic implementation）将交付：raw/fact 表与触发器、幂等写入路径、
fixture→raw→parser→fact 管道、150 案例合成语料与校准测试、健康投影、
上述 P1D-T01…T13 全部测试，以及两条登记项。范围继续排除：真实来源、新页面、阈值变更。
