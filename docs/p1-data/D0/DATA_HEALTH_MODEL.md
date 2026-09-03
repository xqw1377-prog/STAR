# P1-DATA-D0 · 数据健康模型（DATA HEALTH MODEL）· rev5

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
范围：领域模型与投影合同。**不改 Desk 页面**（视图属后续授权）。
版本链：rev1–rev4 均已替代。rev5：Outcome 五态化（矛盾 2）、completeness 语义修正（矛盾 10）。

## 1. 两条铁律（先于一切指标）

1. **数据健康永远不是项目风险分数。** 健康只描述"我们的观察能力"，
   门禁只裁决"项目的事实"。类型层面隔离：健康对象不进入 `interpretCheck`、
   不进入 `scoringAllowed`、不进入任何门禁载荷。
2. **数据缺失不能把 UNKNOWN 变 PASS。** 健康恶化最多把 readiness 展示为
   `RESEARCH_REQUIRED`（fail-closed 本义），绝不改变任何 gate 状态。

## 2. 度量对象

- `SourceHealth`：按 source_id × method_id 聚合；
- `ProjectHealth`：按 project × fact_kind 聚合（七类事实各自健康）。
  **归因路径（阻断 #8）**：`AttemptStarted.collection_plan_item_id` → 采集计划项
  声明 (project, expected_fact_kind) ⇒ **失败/超时的请求同样计入对应
  ProjectHealth**（分母含未成功尝试），无 plan_item 的请求只进 SourceHealth。

## 3. 指标合同（冻结）

**Attempt 层（真实故障率）**：

| 指标 | 定义 |
|---|---|
| `response_availability` | `(SUCCESS_RESPONSE + HTTP_ERROR) / 全部 Outcome`（收到字节即分子，rev5 五态） |
| `success_rate` | `SUCCESS_RESPONSE / 全部 Outcome`（恒 ≤ response_availability） |
| `http_error_rate` | `HTTP_ERROR / 全部 Outcome` |
| `transport_error_rate` | `TRANSPORT_ERROR / 全部 Outcome` |
| `timeout_rate` | `TIMEOUT / 全部 Outcome` |
| `aborted_rate` | `ABORTED / 全部 Outcome` |

**Receipt/Fact 层（观察质量）**：

| 指标 | 定义 |
|---|---|
| `freshness` | `now − max(observed_at of latest SUCCESS receipt per observation_key)`，按 fact_kind 归一 (0,1]（半衰期 24h，仅展示） |
| `completeness` | SUCCESS 回执覆盖的 observation 比例（分母 = 已注册必采清单） |
| `lag` | `ingested_at − observed_at` 的 p95 |
| `license_status` | 来源注册表状态快照 |
| `parser_health` | 最近 parser 重放的 payload_hash 一致率（<1 即非确定或输入漂移） |
| `contradiction_count` | 未解决的 CONTESTS（回执级）+ 活跃 CONTRADICTS（事实级）关系数 |
| `degraded_reason` | 见 §3.2 确定性优先级 |
| `last_successful_observation` | 最近 SUCCESS 回执的 observed_at |

（原 `source_availability` 单指标废除——它把 ERROR 计入"可用"。）

### §3.1 窗口、分母与零样本语义（阻断 #8；rev3 虚报，本次实际落地）

- **滑窗**：闭区间 `[now − 1h, now]`，按 **`AttemptOutcomeEvent.completed_at`** 计；
- **分母** = 窗口内同一 (source_id × method_id)——ProjectHealth 维度为
  (project × fact_kind)——的全部 **AttemptOutcomeEvent**（含 ABORTED）；
- **零样本**：窗口内 Outcome = 0 ⇒ 上述六率一律 **`null`（UNDEFINED）**，
  **禁止写 0**（`0` 表示"测过且为零"，`null` 表示"没有测量"）；
  同窗口 `degraded_reason = UNKNOWN`；
- **freshness**：从未有过 SUCCESS 回执 ⇒ `null`（未测量）；有过但陈旧 ⇒ 随半衰期衰减至 0（测过且过期）；
- **completeness（rev5，矛盾 10 闭合）**：分母（必采清单）> 0 前提下——
  **零尝试** ⇒ `null`（未测量）；**有尝试但 SUCCESS 覆盖为 0** ⇒ `0`（测过且覆盖为零）；
  有覆盖 ⇒ `covered / required`；
- 有样本时五态完备分割恒等式（rev5，矛盾 2 闭合）：
  `success_rate + http_error_rate + transport_error_rate + timeout_rate + aborted_rate = 1`，
  且 `success_rate ≤ response_availability`；
- 孤儿 Start（崩溃无 Outcome）不进任何分母（结果未知 ≠ 失败），
  但计入独立的 `orphan_start_count` 遥测。

### §3.2 `degraded_reason` 确定性优先级（阻断 #8）

存在多个诱因时按以下顺序**取第一个命中**（全序、确定性，无平局）：

```text
LICENSE_HOLD → RATE_LIMITED → TIMEOUT → CONFLICTED → PARSER_DEGRADED
→ SOURCE_ERROR → UNKNOWN（零样本/孤儿）→ NONE
```

各诱因判定：LICENSE_HOLD=注册表非 ENABLED；RATE_LIMITED=窗口内 error_code
含限流类且 error_rate>0；TIMEOUT=timeout_rate>0；CONFLICTED=contradiction_count>0；
PARSER_DEGRADED=parser_health<1；SOURCE_ERROR=error_rate>0；UNKNOWN=零样本。

## 4. 投影合同

- 健康投影为纯读、可重建的 Layer P 派生视图（从 A0/A1/R 聚合）；快照仅供趋势，
  重建永远以原始层为准（DATA-008 语义）；
- 消费者白名单：① Desk 数据健康视图（未来授权，仅展示）；② 采集调度
  （degraded_reason 驱动退避降频）；③ RESEARCH_REQUIRED 解释文案
  （"数据不可用"与"项目被阻断"分列，P0-C2 语义）；
- 禁止消费者：门禁引擎、评分、回放评估、任何把健康数值混入项目判断的路径。

## 5. 与 P1 验收目录的对应

闭合 P1-05 设计前置。D1 测试：T11（可从 A/R 全量重建）、T12（注入后四率正确
且门禁零变化）、T13（健康数值不入 gate/score 载荷）、T19（N 次超时→N 组
Start+Outcome、四率如实）、**T22（零样本 null、completeness 0-vs-null、五态分割恒等式；归 D，见 D0_ACCEPTANCE）**、
**T27（degraded_reason 优先级确定性：多诱因注入输出唯一）**、
**T28（plan_item 归因：失败请求计入 ProjectHealth）**。
