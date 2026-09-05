# Governance Change Proposal：GCP-GAP-01 + GCP-GAP-02

```text
状态        SUBMITTED（等待主理人签署裁决；批准前零代码、零 Gate 修改、零 gates@4）
前置        E-01 FROZEN-v1 · GAP-01/02 = NEEDS-GOVERNANCE-CHANGE（主理人 2026-09-05 裁决）
性质        最小治理变更提案——不替治理做决定，只把问题从代码层提升到签署层
```

---

# GCP-GAP-01：tradability 门禁是否承认 PARTIAL_FILL 为独立结果

## 治理问题

```text
executableNotional N 落于 0 < N < intendedNotional 时，tradability 门禁输出什么？
```

## 签署结构现状

| 区间 | 执行层（E-05） | 门禁层（Gate） |
|---|---|---|
| `N ≥ intended` | FILL_OK | **PASS**（B3.3:367-369 已签） |
| `N = 0` | SELL_FAIL / BUY_FAIL | **FAIL**（B3.3:367-369 已签） |
| `0 < N < intended` | **PARTIAL_FILL**（B3.3:368 已签） | **??? （本 GCP 待裁）** |
| 输入缺失 | NO_POINT_IN_TIME_BOOK | **UNKNOWN**（fail-closed 推论） |

签署文本已经承认四行中三行的门禁语义——只剩部分区间。

## 方案

### 方案 1：引入第四门禁状态 `PARTIAL`

```text
Gate 状态枚举：PASS | FAIL | UNKNOWN | PARTIAL
```

| 需定义项 | 内容 |
|---|---|
| 语义 | 「已确认存在可执行深度，但不足意向名义」——既非完全可执行也非完全不可执行 |
| 与 score 关系 | PARTIAL 是否阻断评分？（建议：是——非 PASS 不产分，维持门禁-分数分离纪律） |
| 与 readiness 关系 | PARTIAL 映射 readiness 什么？（建议：RESEARCH_REQUIRED 或新值） |
| 与 BLOCKED 关系 | PARTIAL ≠ BLOCKED（不是安全否定，是容量不足） |
| 与执行层关系 | 门禁 PARTIAL ↔ 执行层 PARTIAL_FILL 语义对齐但**不等于**——门禁说的是「当前事实状态」，执行层说的是「实际执行了部分」 |
| gates 版本 | gates@3 → **gates@4**（枚举扩展 + 所有消费方适配） |
| 波及面 | `domain/types.ts` GateStatus 枚举 · `interpret.ts` · `engine.ts` readiness 逻辑 · `queries.ts` · 全部门禁测试 · 前端展示 · e2e |

### 方案 2：保持三态，部分区间映射为 FAIL 附标注

```text
Gate 状态仍为 PASS | FAIL | UNKNOWN
0 < N < intended → FAIL + reason 标注「partial capacity: N=X of intended=Y」
```

| 项 | 说明 |
|---|---|
| 优点 | 零 gates 版本变更；最小波及 |
| 缺点 | 「能退 80%」与「一分退不出」不可区分——决策粒度损失**永久化** |
| gates 版本 | 仍需 gates@4（interpretSell 结果分布改变），但不扩展枚举 |

### 方案 3：保持三态，部分区间映射为 UNKNOWN 附标注

```text
0 < N < intended → UNKNOWN + reason 标注「partial capacity observed」
```

| 项 | 说明 |
|---|---|
| 优点 | 零 gates 版本变更 |
| 缺点 | 把「确定存在但不足」的已知事实标记为「不知道」——信息丢失 |
| 主理人已表态 | 「会把确实存在可执行深度的确定事实抹掉」——你已明确反对 |

### 方案 4：保持 OPEN，此区间 Interpreter 不实现

```text
0 < N < intended → 抛出/标记为「治理未授权区间」，不产生任何门禁输出
```

| 项 | 说明 |
|---|---|
| 含义 | Interpreter 只覆盖 N≥intended 与 N=0 两个分支 |
| 效果 | 实质与方案 3 类似（UNKNOWN），但显式标记为治理缺口而非信息丢失 |
| 适用 | 如果治理层认为需要更多实证数据再决定 |

## 提案方呈报（不预选）

**方案 1 是最忠实的**——签署人在执行层给了这个区间独立标签（PARTIAL_FILL），说明他们认为它值得被区分；门禁层不给对应状态会在这两层之间制造永久语义缝隙。但它也是**代价最高的**（gates@4 枚举扩展波及全栈）。

**方案 2 是最务实的**——保持三态、以 reason 附注保留信息——但代价是把一个语义区分永远留在 reason 字符串里而非状态枚举里。

**建议的裁决问题**：不是「选哪个方案」，而是：

> **STAR 的门禁层是否需要区分「完全不可执行」与「部分可执行」？**
>
> 如果业务上这个区分对决策有实质影响（例如：部分可退时降仓而非清仓），→ 方案 1。
> 如果这个区分对当前产品不产生行为差异（都是「不能全进/全出」），→ 方案 2。

---

# GCP-GAP-02：tradability 门禁的 SELL / BUY 组合逻辑

## 治理问题

```text
tradability 门禁的必要条件是：SELL 可行？BUY 可行？两者？还是分别成为独立条件？
```

## 签署结构现状

| 文本 | 内容 | 指向 |
|---|---|---|
| B3.1:311-329 | 买入路径（储备→冲击→费→模拟成交价，允许部分） | BUY 有独立的风险模型 |
| B3.2:331-343 | 卖出路径九项清单（储备/仓位/路由/限制/冲击/费/撤池/分批） | SELL 有更重的风险清单 |
| B3.3 E-01:367 | `BUY_FAIL` / `SELL_FAIL` 作为独立执行标签 | 两腿在执行层有独立失败语义 |
| B3.4:377-380 | 「已持仓但无法卖出 → 最终价值 = 0」 | SELL 失败的最重惩罚条款 |
| （无） | 「BUY AND SELL 同时满足才过门禁」 | **未在任何签署文本中出现** |

**关键事实**：B3.4 只惩罚 SELL 失败（最终价值=0），不惩罚 BUY 失败（只记 EXECUTION_FAILURE）——这不等于「BUY 不重要」，但确实等于「SELL 失败的后果更重」。

## 方案

### 方案 A：SELL-only

```text
tradability = SELL 退出可行性
BUY 侧检验降级为观察/辅助指标（不入门禁）
```

| 依据 | 后果 |
|---|---|
| B3.4 最重惩罚条款只针对 SELL | 入场决策少了 BUY 深度信号（进得去但可能进得很差） |
| 退出风险是核心风险 | 门禁最窄、最保守的 tradability 语义 |

### 方案 B：SELL AND BUY（双腿必需）

```text
tradability = SELL 可行 ∧ BUY 可行
```

| 依据 | 后果 |
|---|---|
| 恢复历史 GATE-002 直觉（但以新签署文本为依据，非从 @3 注释升格） | 最严格的门禁——两腿任一不可行即 FAIL |
| B3.1/B3.2 均有独立风险模型 | 可能过于保守：BUY 冲击大但 SELL 无碍的资产被阻断 |

### 方案 C：SELL / BUY 分别形成独立门禁条件

```text
tradability-sell = SELL 可行性（独立门禁）
tradability-buy  = BUY 可行性（独立门禁）
```

| 依据 | 后果 |
|---|---|
| B3.3 已有 BUY_FAIL / SELL_FAIL 独立标签 | 门禁数量从 6 → 7（或替换 tradability 为两个） |
| 两腿风险模型完全不同（B3.1 vs B3.2） | 最忠实的结构映射——但需要最大的架构变更 |

### 方案 D：SELL 核心 + BUY 辅助标注

```text
tradability = SELL 退出可行性（门禁决定因素）
BUY 检验结果作为 reason/annotation 附注（信息保留，不参与门禁判定）
```

| 依据 | 后果 |
|---|---|
| B3.4 的惩罚不对称 → SELL 是核心约束 | 决策信息保留（reason 里可见 BUY 状态），但不增加门禁复杂度 |
| B3.1 的独立风险模型不丢失 | 门禁语义最简（仍然只看 SELL），BUY 信号降为参考 |

## 提案方呈报（不预选）

**B3.4 的不对称惩罚**是本案最强的签署文本信号——它说「SELL 失败的后果远重于 BUY 失败」。但这**不直接等于**「门禁只看 SELL」（方案 A 或 D），因为门禁的功能可能不仅是惩罚映射，还可能是入场前置筛选。

**建议的裁决问题**：

> **tradability 门禁的职能定位是什么？**
>
> 如果是「退出安全保障」（已持仓后能不能出来）→ 方案 A 或 D（SELL 主导）。
> 如果是「全流程可行性验证」（进得去也出得来才算过）→ 方案 B（双腿）。
> 如果是「两腿独立风险各有 veto 权」→ 方案 C（分离门禁）。

---

## 两项 GCP 的共同边界

```text
❌ 不因方便实现而选择方案
❌ 不因 B3.4 信号强而直接推断门禁逻辑（这是 GCP 存在的原因）
❌ 不在裁决前实现任何方案的代码
❌ 不改 gates@3
❌ 不创建 gates@4
❌ 不改 E-01 FROZEN-v1 的任何条款
```

---

## 签署栏

```text
GCP-GAP-01 方案 1（第四状态 PARTIAL / gates@4）    主理人签署 2026-09-05  APPROVED
GCP-GAP-02 方案 D（SELL 核心 + BUY 附注）          主理人签署 2026-09-05  APPROVED
备注：PARTIAL 只是门禁状态，不自动获得 PASS 资格/评分/放行/降仓行为；
     BUY 不得改变 SELL Gate 的 PASS/FAIL/PARTIAL/UNKNOWN。
```
