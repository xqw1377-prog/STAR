# gates@4 Governance Change Proposal

```text
状态        FROZEN（主理人 2026-09-05 五项全签）
前置        GCP-GAP-01 方案 1 APPROVED（PARTIAL 枚举）
            GCP-GAP-02 方案 D APPROVED（SELL 核心 + BUY 附注）
            E-01 Interpretation Contract FROZEN-v1 · Evidence @2 · GAP-03 CLOSED
性质        最小治理变更——把两项已签署裁决编译为 gates@4 的规范文本
范围        仅定义语义与实现边界；实现授权在 Interpreter Authorization Review 之后另行下达
```

---

## 一、变更内容

### 变更 1：GateStatus 枚举扩展

```text
gates@3:  GateStatus = PASS | FAIL | UNKNOWN
gates@4:  GateStatus = PASS | FAIL | UNKNOWN | PARTIAL
```

### 变更 2：tradability 门禁的输入与判定逻辑

```text
gates@3:  interpretSell() 消费 adapter 的 executable 布尔值（已在 F2-A 中移除）
          → 当前恒 UNKNOWN（fail-closed 过渡态）

gates@4:  interpretSell() 消费 E-01 Interpreter 的 executableNotional
          → N ≥ intended      → PASS
          → N = 0             → FAIL
          → 0 < N < intended  → PARTIAL
          → 输入缺失           → UNKNOWN
```

### 变更 3：SELL/BUY 关系

```text
gates@4:  tradability 门禁判定因子 = SELL 侧 executableNotional
          BUY 侧 executableNotional = reason 附注（保留信息，不参与判定）
          BUY 不得改变 SELL 产生的 PASS / FAIL / PARTIAL / UNKNOWN
```

---

## 二、PARTIAL 的精确语义

### 定义

```text
PARTIAL
= 已确认存在可执行深度（executableNotional > 0），
  但该深度不足以支撑意向名义（N < intendedNotional）。
```

### 与既有状态的关系

| 关系 | 规则 | 依据 |
|---|---|---|
| PARTIAL ≠ PASS | **非 PASS 不产分、不放行**（门禁-分数分离纪律延续） | GCP-GAP-01 签署附注 |
| PARTIAL ≠ FAIL | 「能退 80%」与「一分退不出」不可混淆 | GCP-GAP-01 裁决理由 |
| PARTIAL ≠ UNKNOWN | **确定事实，非不知道** | GCP-GAP-01 裁决理由 |
| PARTIAL ≠ BLOCKED | 容量不足 ≠ 安全否定（BLOCKED 保留给 FAIL 语境） | GCP-GAP-01 裁决 |
| PARTIAL 与 score | **PARTIAL 状态下 score = null**（scoringAllowed 要求全 PASS） | 引擎现有纪律不变 |

### 与 readiness 的映射

```text
readiness 现有映射（gates@3）：
  任一 FAIL            → BLOCKED
  任一 UNKNOWN         → RESEARCH_REQUIRED
  全 PASS              → READY / TOO_LATE

gates@4 追加：
  任一 PARTIAL 且无 FAIL → 建议 RESEARCH_REQUIRED
                         （理由：tradability 容量不足 → 不足以 READY；
                           但非 BLOCKED —— 不是安全否定）
```

> **此映射为提案方建议**，主理人可改为其他 readiness 值。签署时确认。

### 与执行层的关系

```text
门禁层 PARTIAL ≠ 执行层 PARTIAL_FILL

门禁说的是：当前事实状态下存在部分容量（世界是什么样的）。
执行层说的是：实际执行了部分成交后产生的标签（做了什么）。

两者语义对齐但**不互相推导**：
  门禁 PARTIAL 时不自动执行 PARTIAL_FILL；
  执行层 PARTIAL_FILL 不反推门禁应为 PARTIAL。
```

### 未来行为的治理留白（显式）

```text
PARTIAL 当前只是状态，不自动触发：
  ❌ 降仓
  ❌ 部分放行
  ❌ 替代 signal
  ❌ 任何策略行为

任何 PARTIAL 驱动的业务行为，须另走治理变更，不得因枚举存在而隐含产生。
```

---

## 三、SELL 核心 / BUY 附注的精确语义

### 门禁判定

```text
tradability 门禁的 PASS / FAIL / PARTIAL / UNKNOWN
  → 仅由 SELL 侧 executableNotional 决定
  → BUY 侧 executableNotional 不参与判定
```

### BUY 附注的保留

```text
BUY 侧 executableNotional（如果可计算）：
  → 作为 reason / annotation 附注保留
  → 展示层可见（决策信息不丢失）
  → 不改变门禁状态
  → 不改变 readiness
  → 不改变 score
```

### B3.4 不对称惩罚作为方案 D 的签署依据

```text
「已持仓但无法卖出 → 最终价值 = 0」   ← B3.4:377-380 最重惩罚条款
「因系统未预见的流动性问题无法买入 → EXECUTION_FAILURE」 ← B3.4:375-376

SELL 失败的后果远重于 BUY 失败 → SELL 是核心退出安全约束。
BUY 有独立风险模型（B3.1）但无等量惩罚条款 → 降为附注，不获 veto。
```

---

## 四、RULE_VERSION 递升

```text
gates@3 → gates@4

原因：GateStatus 枚举扩展（破坏性：所有 exhaustive switch 需适配）
     + interpretSell 结果分布改变 + readiness 映射新增规则
```

---

## 五、实现范围（获批后由 Interpreter Authorization Review 另行下达）

```text
文件（预估）：
  lib/domain/types.ts          GateStatus 枚举 + gates 聚合逻辑适配
  lib/domain/interpret.ts      interpretSell 重写（消费 E-01 Interpreter 输出）
  lib/domain/gates.ts          聚合规则（PARTIAL 的传播语义）
  lib/engine.ts                readiness 映射 + scoringAllowed 适配
  lib/queries.ts               消费方适配
  全部相关测试 + 前端展示 + e2e

前置依赖：E-01 Interpreter 已实现（但 Interpreter 授权在本 GCP 冻结之后另行审）
```

---

## 六、本 GCP 不做的事

```text
❌ 不实现任何代码
❌ 不修改 gates@3
❌ 不实现 E-01 Interpreter
❌ 不实现 N 求解
❌ 不实现 80% / 15% 判定
❌ 不定义 PARTIAL 的降仓/部分放行等业务行为（留白）
❌ 不给 BUY 附注赋予任何决策权
❌ 不关闭 R-1 / R-2
❌ 不接 RPC / Sensor / Registry
```

---

## 七、与冻结体系的一致性核对

| 冻结项 | gates@4 影响 | 一致性 |
|---|---|---|
| E-01 FROZEN-v1 | 状态机从三态扩展到四态——**E-01 行 5 需要同步修订**（`0<N<intended→未定义` → `0<N<intended→PARTIAL`） | ✅ 一致（E-01 该行本身标注了 GAP-01 待裁决） |
| solana-readonly@4 | 零影响（数据契约与门禁版本独立） | ✅ |
| Evidence @2 | 零影响（pool-state 不直接入门禁） | ✅ |
| M0–M5 | 零影响（门禁版本升级不在 M 层） | ✅ |
| 门禁-分数分离 | PARTIAL ≠ PASS → score = null 延续 | ✅ |
| fail-closed | PARTIAL 是确定状态而非默认放行 | ✅ |
| FROZEN-rev1 §17 | 高分 BLOCKED 八情形不变；PARTIAL 新增不改变任一既有 BLOCKED 条件 | ✅ |

---

## 签署栏

```text
主理人签署 2026-09-05 五项全签

签署确认项：
  [✓] PARTIAL 枚举 + 全部语义（第二节）
  [✓] PARTIAL→readiness = RESEARCH_REQUIRED（附强制解释：状态映射而非策略行为）
  [✓] SELL 核心 + BUY 附注（第三节）
  [✓] RULE_VERSION gates@3 → gates@4（破坏性升级，gates@3 FROZEN 不回改）
  [✓] E-01 行 5 同步修订授权（GAP-01 裁决的一致性同步，非重新修改 E-01）

签署后状态：gates@4 = FROZEN → 方可进入 Interpreter Authorization Review
```
