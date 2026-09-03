# P1-DATA-D0 · 合成语料合同（SYNTHETIC CORPUS CONTRACT，50+100）· rev6

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
上位规范：`docs/p0-data/HISTORICAL_SAMPLE_SPEC.md`（排除规则与切分纪律全部继承）
rev2 变更：expected 由独立 oracle/金标生成（裁定 #7）、无前视不变量与敏感性测试分离、
场景家族整体分组。

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

## 2. expected 的来源——独立 oracle（裁定 #7，禁止实现验证实现）

- `expected.gates / readiness / score_total` 由**独立 oracle** 或人工冻结的
  **golden manifest** 产生；
- oracle **禁止 import**：`interpretCheck`、`gates.ts`、`aggregateGates`、
  生产阈值常量（THRESHOLDS）及任何被测引擎路径——以 import-lint 测试强制
  （D1 测试 P1D-T17）；
- oracle 允许依赖的仅有：契约 Payload 类型（纯类型）、门禁语义的**文字规范**
  （PRD §06 与 D0 合同）——即用第二实现（或人工）按规范独立推导预期值；
- golden manifest 一经冻结进入版本管理，其修改需与引擎变更同评审（防止双向迁就）。

## 3. Manifest schema（每案例一行，`synthetic-corpus/manifest.json`）

继承上位规范全部字段并新增：

```jsonc
{
  "sample_id": "syn-001",
  "cohort": "SUCCESS | FAIL",
  "narrative": "inscriptions | solana-meme | ai-agent",
  "family_id": "F-017",          // 场景家族：同模板变体必须同 partition（§6）
  "t0": "…",                      // 案例时间原点
  "decision_cutoff": "t0+Nd",     // 评估时点（唯一，明示）
  "expected": {                   // 由独立 oracle/golden 生成（§2）
    "gates": { "token-permissions": "PASS|FAIL|UNKNOWN", "…6 组全列…" },
    "readiness": "READY|RESEARCH_REQUIRED|BLOCKED|TOO_LATE",
    "score_total": "number|null"
  },
  "expected_unknowns": [ { "gate": "…", "reason": "…" } ],
  "falsification": [ { "if_evidence": "…", "then_gate_flips": "…" } ],
  "outcome": { "window_30d": "…", "window_90d": "…", "exit_executable": true },
  "hindsight": [ { "fact_kind": "…", "observed_at": "t0+M>d", "payload": {} } ],
  "generator_seed": 12345
}
```

## 4. 两个分离的测试不变量（裁定 #7）

1. **无前视不变量（主测试，P1D-T07a）**：**逐案例**验证（150 个案例各自独立
   断言，汇总通过不替代单案例通过）——每个案例的 cutoff 评估结果在该案例
   hindsight **新增 / 删除 / 修改** 三种扰动下必须**完全不变**（字节级）；
2. **区分度敏感性测试（独立，P1D-T09）**：把某 hindsight 事实篡改到 cutoff 前，
   ≥1 个案例的预期输出必须改变——它证明语料有判别力，
   **不得**替代或弱化 1 的不变量。

## 5. 生成与验收

- 生成器确定性：种子固定 ⇒ manifest 与全部事实字节级可复现（P1D-T08）；
- 覆盖率硬约束：六门禁 × {PASS, FAIL, UNKNOWN} 每格 ≥ 3 案例；
  50 SUCCESS 中 ≥ 10 个 cutoff 时刻六门禁全 PASS（分数>0）；
  100 FAIL 中 ≥ 30 个"部分门禁 PASS 但被单项 FAIL 阻断"（反替代语料化）；
- 每案例校准 = 引擎输出 vs **oracle/golden** expected 全等（P1D-T07）；
- 语料状态字段：`synthetic = 150`、`real = 0`。

## 6. 家族分组纪律（裁定 #7）

- `family_id` 标识场景模板；**同一 family 的全部变体必须落在同一 partition**
  （calibration / validation 切分按 family 整体分配，禁止同族变体跨集）；
- 切分表冻结于 `corpus-partition.json`，先于任何阈值调优冻结（继承上位规范）；
- 校准集只用于调阈值；验证集在阈值冻结前对规则作者不可见（沿用上位规范）。

## 7. D1 证明测试

`T07`（150 案例校准 vs oracle/golden）、`T07a`（无前视不变量，hindsight 增删改不变）、
`T08`（种子重放字节级一致）、`T09`（区分度敏感性，独立）、`T10`（覆盖率矩阵）、
`T17`（oracle import 隔离 lint）、`T18`（family 分组完整性：无同族跨集）。

