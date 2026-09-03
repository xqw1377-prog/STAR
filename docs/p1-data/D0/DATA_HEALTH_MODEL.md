# P1-DATA-D0 · 数据健康模型（DATA HEALTH MODEL）· rev6

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
范围：领域模型与投影合同。**不改 Desk 页面**（视图属后续授权）。
版本链：rev1–rev4 均已替代。rev6：R5-03 终态六类化、R5-13 completeness 双语义、R5-19 degraded 集合化。

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

## 3. 指标合同（R5-03/13/19 冻结）

**聚合维度**：`source × method`（ProjectHealth 归因经 collection_plan_item_id）。
**默认滑窗 1 小时**，以 **Outcome `completed_at` 落入窗口**为准。

**六类互斥终态率**（共同分母 = **窗口内有终态的 Attempt**（Outcome 的
`completed_at` 落窗）；零终态 Attempt ⇒ 六率全部 null）：


| 指标 | 定义 |
|---|---|
| `success_rate` | SUCCESS 终态占比 |
| `partial_rate` | PARTIAL 终态占比 |
| `source_error_rate` | SOURCE_ERROR（HTTP 非成功响应）占比 |
| `transport_error_rate` | TRANSPORT_ERROR（DNS/连接/TLS/断线）占比 |
| `timeout_rate` | TIMEOUT 占比 |
| `aborted_rate` | ABORTED 占比 |

恒等式：**六率之和 = 1**（在"有终态"子总体上完备分割——孤儿不含终态，
不入分母，故与恒等式不矛盾）。
**`unresolved_rate`（孤儿单列）** = `UNRESOLVED Start 数 / 同窗全部 Start 数`
（按 `started_at` 落窗；零 Start ⇒ null）。
**`response_availability` 单独计算** = `response_bytes_received / 有终态 Attempt`
（独立布尔，与 SOURCE_ERROR 等类别**可重叠**），**不参与终态率求和**。

**质量指标**：

| 指标 | 定义 |
|---|---|
| `freshness` | now − 最近 SUCCESS 回执 observed_at（半衰期 24h 归一，仅展示） |
| `completeness`（R5-13） | **已存在冻结必需事实计划**：`合格必需事实数 / 必需事实总数`，**零成功观察 = 0**；**尚未登记计划或分母不可定义 = null**。注意：来源健康"窗口零 Attempt ⇒ 各率 null"与"项目证据完整度 = 0"是**两个不同语义** |
| `lag` | `ingested_at − observed_at` p95 |
| `license_status` / `parser_health` / `contradiction_count` / `last_successful_observation` | 沿用（contradiction = 未解决 CONTESTS + 活跃 CONTRADICTS）（contradiction = 未解决 CONTESTS + 活跃 CONTRADICTS） |

### §3.1 `degraded_reason` 是可并列集合（R5-19）

计算输出为**原因集合**；UI 可按固定显示优先级排序，但**不得丢弃其他原因**，
**不得把无样本显示成 0% 可用**。成员：`LICENSE_HOLD / RATE_LIMITED / TIMEOUT /
CONFLICTED / PARSER_DEGRADED / SOURCE_ERROR / NO_SAMPLE / NONE`。

## 4. 投影合同

沿用：纯读可重建（A/R 聚合）；消费者白名单=展示/调度/告警文案；
**禁止**消费者：门禁引擎、评分、回放评估、任何把健康数值混入项目判断的路径
（R5-12：eligibility 属 EvidenceEligibilityPolicy，不属健康）。

## 5. D1 测试（全量目录见 D0_ACCEPTANCE）

T11/T12/T13/T19/T22/T27/T28 + R5-T03（六率恒等、可用率正交）、
R5-T13（completeness 0-vs-null 双语义）、R5-T19（窗口边界/零样本/多重原因集合）。
