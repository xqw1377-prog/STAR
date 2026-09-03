# P1-DATA-D0 · 合成语料合同（SYNTHETIC CORPUS CONTRACT，50+100）

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
上位规范：`docs/p0-data/HISTORICAL_SAMPLE_SPEC.md`（其排除规则与切分纪律全部继承）

## 0. 诚实声明（不可移除）

本语料是**合成语料**：用于校准引擎与验收框架的**行为**，
不可用于任何真实发现率/拦截率/收益声明。
**真实案例数量 = 0**；任何真实样本入库需先过来源许可矩阵与样本规范验收。

## 1. 规模与构成

| 队列 | 数量 | 合成机制覆盖 |
|---|---|---|
| SUCCESS（早期可识别、可退出、存活） | 50 | 权限收回、LP 锁/烧、集中度改善、双向可交易、验证构建 |
| FAIL（ rugs / honeypot / 流动性枯竭 / 热点消退 / 操纵注意力） | 100 | 含 rug-by-mint、freeze-honeypot、sell-blocked、LP 单侧抽走、top10>35%、关联集群>25%、操纵放量子集 |

失败队列按机制打标：`failure_mechanism ∈ {RUG_MINT, RUG_LP_PULL, HONEYPOT_SELL,
FREEZE_ABUSE, LIQUIDITY_DEATH, ATTENTION_FADE, MANIPULATED_VOLUME}`；
其中 `MANIPULATED_VOLUME` 同时混入两队列（反操纵测试）。

## 2. Manifest schema（每案例一行，`synthetic-corpus/manifest.json`）

继承上位规范全部字段（sample_id, cohort, narrative, cutoffs, outcome_window_30d/90d,
label_confidence…）并新增：

```jsonc
{
  "sample_id": "syn-001",
  "cohort": "SUCCESS | FAIL",
  "narrative": "inscriptions | solana-meme | ai-agent",
  "t0": "…",                      // 案例时间原点，全部事实相对 t0 偏移
  "decision_cutoff": "t0+Nd",     // 评估时点（唯一，明示）
  "expected": {                   // 截止时点的预期引擎输出（回归金标准）
    "gates": { "token-permissions": "PASS|FAIL|UNKNOWN", "…6 组全列…" },
    "readiness": "READY|RESEARCH_REQUIRED|BLOCKED|TOO_LATE",
    "score_total": "number|null"
  },
  "expected_unknowns": [ { "gate": "…", "reason": "…" } ],
  "falsification": [              // 反证：什么证据会推翻预期（校准测试的负样本）
    { "if_evidence": "…", "then_gate_flips": "token-permissions: PASS→FAIL" }
  ],
  "outcome": { "window_30d": "…", "window_90d": "…", "exit_executable": true },
  "hindsight": [                  // cutoff 之后的事实（仅供结果标注与泄漏测试）
    { "fact_kind": "…", "observed_at": "t0+M>d", "payload": {} }
  ],
  "generator_seed": 12345         // 确定性生成种子
}
```

## 3. 反泄漏规则（复用已冻结内核）

- 案例事实由 fixture 供应器按 `observed_at = t0 + offset` 展开为标准 Layer N 事实；
- 引擎评估固定 `asOf = decision_cutoff`，`latestEvidenceByCheck` 的截止过滤
  **天然排除 hindsight**（DATA-001 同机制，无需新代码路径）；
- 校准测试额外反向断言：若把任一 hindsight 事实的 observed_at 篡改为 cutoff 前，
  至少一个案例的预期输出必须改变——否则说明该案例区分度不足，退回生成器重做。

## 4. 生成与验收

- 生成器：确定性（种子固定 ⇒ manifest 与全部事实字节级可复现，D1 测试 P1D-T08）；
- 覆盖率硬约束：六个门禁 × {PASS, FAIL, UNKNOWN} 每格 ≥ 3 个案例；
  50 SUCCESS 中 ≥ 10 个在 cutoff 时刻六门禁全 PASS（含分数>0），
  100 FAIL 中 ≥ 30 个存在"部分门禁 PASS 但被单项 FAIL 阻断"（反替代回归语料化）；
- 每案例校准 = `evaluateChecksAt(facts(cutoff))` 输出与 `expected` 全等；
- 语料状态字段：`synthetic = 150`、`real = 0`（写入 README 与 Desk 数据源标注）。

## 5. D1 证明测试

`P1D-T07`（150 案例全量校准通过）、`P1D-T08`（种子重放字节级一致）、
`P1D-T09`（hindsight 篡改区分度断言）、`P1D-T10`（覆盖率矩阵约束）。
