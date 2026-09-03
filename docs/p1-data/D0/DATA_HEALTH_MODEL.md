# P1-DATA-D0 · 数据健康模型（DATA HEALTH MODEL）· rev2

状态：DESIGN-ONLY · 基线 star-web@6f40295 · 2026-09-03
范围：领域模型与投影合同。**不改 Desk 页面**（视图属后续授权）。
rev2 变更：指标基于 CollectionAttempt/Receipt 双层重算（一致性 B——
availability 拆分为 response availability / success / error / timeout 四率）。

## 1. 两条铁律（先于一切指标）

1. **数据健康永远不是项目风险分数。** 健康只描述"我们的观察能力"，
   门禁只裁决"项目的事实"。二者在类型层面隔离：
   健康对象不进入 `interpretCheck`、不进入 `scoringAllowed`、不进入任何门禁载荷。
2. **数据缺失不能把 UNKNOWN 变 PASS。** 健康恶化最多把 readiness 展示为
   `RESEARCH_REQUIRED`（这本来就是 fail-closed 的语义），绝不改变任何 gate 状态。

## 2. 度量对象

- `SourceHealth`：按 source_id × method_id 聚合；
- `ProjectHealth`：按 project × fact_kind 聚合（七类事实各自健康）。

## 3. 指标合同（冻结；Attempt 层与 Receipt 层分列，一致性 B）

**Attempt 层（每次请求都在场——真实故障率）**：

| 指标 | 定义 | 计算源 |
|---|---|---|
| `response_availability` | `outcome=RESPONSE_RECEIVED / 全部 Attempt`（滑窗 1h）。仅「收到可成回执的响应字节」。传输/HTTP 失败计 `error_rate`，不计可用 | Layer A |
| `success_rate` | `产出 SUCCESS Receipt 的 Attempt / 全部 Attempt` | A+R |
| `error_rate` | `outcome=ERROR 的 Attempt / 全部 Attempt` | Layer A |
| `timeout_rate` | `outcome=TIMEOUT 的 Attempt / 全部 Attempt` | Layer A |

**Receipt/Fact 层（观察质量）**：

| 指标 | 定义 | 计算源 |
|---|---|---|
| `freshness` | `now − max(observed_at of latest SUCCESS receipt per observation_key)`，按 fact_kind 归一 (0,1]（半衰期 24h，仅展示） | Layer R |
| `completeness` | SUCCESS 回执覆盖的 observation 比例（分母=已注册必采清单） | R + 采集计划 |
| `lag` | `ingested_at − observed_at` 的 p95 | Layer R |
| `license_status` | 来源注册表状态快照 | source-registry |
| `parser_health` | 最近 parser 重放的 payload_hash 一致率（<1 即非确定或输入漂移） | R→N 重放遥测 |
| `contradiction_count` | **未解决的** CONTESTS 关系数（R2 冻结中的观察） | Layer R |
| `degraded_reason` | `NONE / RATE_LIMITED / TIMEOUT / LICENSE_HOLD / PARSER_DEGRADED / CONFLICTED / UNKNOWN` | 派生 |
| `last_successful_observation` | 最近 SUCCESS 回执的 observed_at | Layer R |

（原 `source_availability` 单一指标废除——它把 ERROR 计入"可用"，见一致性 B。）

## 4. 投影合同

- 健康投影是**纯读、可重建**的 Layer P 派生视图（从 Layer R 聚合，
  不新增可变状态）；落库形式（快照表）仅供历史趋势，重建永远以 R 为准（DATA-008 语义）。
- 消费者白名单（设计冻结）：
  1. Desk 数据健康视图（未来授权页面元素）——仅展示；
  2. 采集调度——`degraded_reason` 驱动退避与降频（如 RATE_LIMITED 指数退避）；
  3. `RESEARCH_REQUIRED` 的解释文案——"数据不可用"与"项目被阻断"在 UI 语义上必须分列，
     对应 P0-C2 已冻结的错误态语义。
- **禁止**消费者：门禁引擎、评分、回放评估、任何把健康数值混入项目判断的路径。

## 5. 与 P1 验收目录的对应

闭合 `P1-05`（数据健康与来源故障降级）的设计前置；
D1 证明测试：`T11`（健康投影可从 A/R 全量重建）、
`T12`（注入 RATE_LIMITED/TIMEOUT Attempt 后四率正确且门禁状态零变化）、
`T13`（健康数值不出现在任何 gate/score 载荷的类型级断言）、
`T19`（N 次超时重试 → N 行 Attempt、四率如实上升，回执层零行）。
