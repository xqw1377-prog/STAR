# GAP 裁决简报（Interpreter Authorization 前置）

```text
裁决记录    GAP-01 = CLOSED → PARTIAL（GCP 方案 1 + gates@4 FROZEN 2026-09-05）
            GAP-02 = CLOSED → SELL-core + BUY-annotation（GCP 方案 D + gates@4 FROZEN）
            GAP-03 = CLOSED · pre-fee N（一致性推论）
目的        为主理人裁决 GAP-01/02/03 提供决策材料
性质        只读简报——每项列出选项与后果，不预选、不补规则
前置关系    GAP-01 是 Interpreter 授权的最硬前置（不裁决则 Interpreter 无法写出完整状态机）
```

---

## GAP-01：`0 < N < intended` 的门禁状态

**问题**：executableNotional 落在部分区间时，tradability 门禁输出什么？

**已签文本定义的**：`N ≥ intended → PASS`；`N = 0 → FAIL`（B3.3:367-369）。
**已签文本未定义的**：部分区间。

**选项**：

| 路径 | 含义 | 后果 |
|---|---|---|
| A. 映射为 UNKNOWN | 「知道 N 存在但不知道够不够」是一种未确定 | 传统 fail-closed；部分可退回可重评；但 UNKNOWN 掩盖了「确实存在可退出深度」这一信息 |
| B. 映射为 FAIL | 「不够就是不能」 | 最保守；但会把「能退 80%」和「一分都退不出」混为一谈——丢失决策粒度 |
| C. 映射为 PASS | 「有深度就算过」 | 最激进；变相把 E-01 降级为存在性检查；**必然产生 GAP-01 关闭后 PARTIAL_FILL→PASS 的等价——前面已禁止** |
| D. 新增第四状态（如 PARTIAL） | 「部分可退，行动者自决」 | 需要修改 gates 状态枚举——**gates@4 级 Governance Change**；门禁/决策/执行三层需重新对齐 |
| E. 保持 OPEN | 暂不裁决 | Interpreter 写不出完整状态机（此区间每条输入都会挂） |

**呈报事实（不裁决）**：B3.3 原文用「该名义 > 0 且 < 意向 → PARTIAL_FILL」描述的正是这个区间的**执行层**语义——签署人知道这个区间存在并在执行层给了标签，但没给门禁层定义状态。**选项 D 最忠实于签署文本的结构（执行层有三态、门禁层也应有对应），但代价最高（gates@4 + 状态枚举扩展）；选项 A 最保守且无需 gates 变更。**

---

## GAP-02：BUY+SELL 双腿组合是否构成门禁级规则

**问题**：「SELL 可退 AND BUY 可进」是否作为 tradability 门禁的必要条件？

**已签文本**：B3.1 定义买入路径（含冲击/费用/储备），B3.2 定义卖出路径（九项清单），E-01 分别给出 BUY_FAIL / SELL_FAIL / EXIT_IMPOSSIBLE——**但没有一句话说「两腿同时满足才过门禁」**。

**选项**：

| 路径 | 含义 | 后果 |
|---|---|---|
| A. CLOSE：不要求双腿，SELL 独立项 | 门禁 = SELL 退出可行性（因 B3.4「已持仓但无法卖出 → 最终价值 = 0」是最重后果） | BUY 侧检验降级为观察/辅助指标；入场决策信息变少但不丢安全底线 |
| B. CLOSE：要求双腿 | 恢复 GATE-002 语义（但重新签署，不是从 @3 注释升格） | 需要新的签署级规则文本；会增加tradability 的 PASS 难度 |
| C. 保持 OPEN | 暂不裁决 | Interpreter 只实现 SELL 侧（B3.4 的硬风险），BUY 侧待后续裁决 |

**呈报事实**：B3.4:377-380 的最重惩罚条款针对的是「无法**卖出**」（最终价值=0），而非「无法买入」（只是 EXECUTION_FAILURE）。这暗示签署人把 SELL 侧视为更核心的风险约束。**但这个暗示不足以替代裁决。**

---

## GAP-03：费用链与 executableNotional 的关系

**问题**：N 是费前毛名义还是费后净名义？费用是否参与 N 的约束？

**已签文本**：B3.1:317-320 把费用（路由费/优先费/ATA）列为模拟成交价格路径组成部分；B3.3 的 E-01 双约束均为费前曲线量。

**选项**：

| 路径 | 含义 | 后果 |
|---|---|---|
| A. CLOSE：N = 费前毛名义 | ②③ 均为费前量，N 亦费前；费用作为独立成本事实另行记录 | 最忠实于 B3.3 原文（冲击不含费、储备约束不含费）→ N 自然也不含费；不新增规则 |
| B. CLOSE：N = 费后净名义 | 可成交名义 = 扣费后实际可获得的量 | 更贴近交易现实；但 B3.3 没有这个定义——属于替治理补规则 |
| C. 保持 OPEN | 维持当前过渡语义（费前计算 + 费用独立记录） | 与 A 实质相同但留后续调整空间 |

**呈报事实**：D-02 已裁「冲击不含费」（Impact ≠ Total Execution Cost）；80% 约束原文「成交后报价侧储备」——卖出注入储备不扣费。**选项 A 是已签文本的直接推论而非新规则；选项 B 则需要新的签署。**

---

## 裁决后自动解锁

```text
GAP-01 CLOSED → Interpreter 状态机可写完整
GAP-02 CLOSED → Interpreter 知道是否实现 BUY leg
GAP-03 CLOSED → Interpreter 知道 N 的费前/费后语义
三者齐 CLOSED → 可进 Interpreter Authorization Review（仍不等于立即写代码）
任一保持 OPEN → Interpreter 相应路径只能 UNKNOWN
```
