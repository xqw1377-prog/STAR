# Interpreter Authorization Review（F2-B 前置审查）

```text
状态        APPROVED（主理人 2026-09-05 最终审查通过；feesResolved 冲突已消除）
前置        E-01 FROZEN-v1（含 GAP-01 行同步）· Evidence @2 · gates@4 FROZEN · GAP-01/02/03 全 CLOSED
性质        授权边界规范——定义 Interpreter 被允许做什么、禁止做什么；不是实现规格
代码        零代码 · 零提交 · 零 Gate 实现 · 零 RPC
```

---

## 总则

```text
Interpreter 的唯一职能：
  把 Adapter 产生的 pool-state 事实，按 E-01 FROZEN-v1 的公式，
  计算出 executableNotional N，并映射为门禁状态。

Interpreter 不是 Adapter（不采集事实）。
Interpreter 不是 Gate（不决定 readiness/score）。
Interpreter 不是 Strategy（不决定进出场）。
Interpreter 是一个数学函数 + 一个状态映射。
```

---

## 十项授权边界

### ① Interpreter 可以把哪些 Fact 转换为 Governance State

**EvidenceRecord 入场资格——五层门控，kind 只是第一层筛选：**

```text
第一层（kind 筛选）：
  ✓ pool-state（Evidence @2 白名单）
  ✓ token-2022-extensions（转账限制独立检查）
  ❌ pool-book（@1 遗留词汇，deprecated-for-E01）
  ❌ 任何非 Evidence @2 白名单的 kind
  ❌ 固定探针结果（D-05：仅 Observation，永不为 E-01 输入）

第二层（provenance 完整性）：
  EvidenceRecord.provenance.method 必须非空
  EvidenceRecord.provenance.rawRef 必须非空（哈希输入层级已声明）
  ❌ provenance 残缺 → 不入场 → UNKNOWN

第三层（slot 可确定性）：
  EvidenceRecord.slot 必须为非负整数
  ❌ slot = null 或不可解析 → 不入场 → UNKNOWN（NO_POINT_IN_TIME_BOOK 族）

第四层（contract version 可验证性）：
  EvidenceRecord.contractVersion 必须为 star-evidence@2
  ❌ 版本不匹配/无法识别 → 不入场 → UNKNOWN

第五层（E-01 计算必需字段完整性）：
  A. E-01 公式真正参与的 required inputs（按 venue-specific 需求）：
       reserveQuote / reserveBase / venue-specific curve parameters
     ❌ 任一 A 类字段为 null / 不存在 → 该维度记 UNKNOWN
        （DQ-2 CLOSED：部分事实保留，缺失维度标 UNKNOWN——不丢弃已知维度，不补全缺失维度）
  B. 独立事实字段（可记录但不参与 N 计算，GAP-03 CLOSED）：
       feesResolved / feeFields / complete / tokenTotalSupply
     ✓ B 类字段的缺失/标记 **不得阻止 pre-fee N 的计算**
     ✓ B 类字段作为独立事实进入 provenance / annotation
     ❌ B 类字段不得反向修正或阻断 pre-fee N

  架构原则：E-01 required-input set 仅由冻结公式定义；
           Evidence 中的其他事实字段不自动成为 E-01 必需输入。

五层全部通过 → 该 EvidenceRecord 方可进入 E-01 interpretation。
任一层未通过 → Interpreter 不消费该记录，产出 UNKNOWN 并记录原因。
```

**架构保证**：kind 白名单不是充分条件——一个合法的 pool-state EvidenceRecord，如果 provenance 不完整、slot 不闭合或版本不可验证，**仍然不能进入计算**。这与第④条 UNKNOWN fail-closed 形成纵深防御。

### ② PARTIAL 的唯一产生条件

```text
PARTIAL 当且仅当：
  Interpreter 成功计算 executableNotional N
  ∧ 0 < N
  ∧ N < intendedNotional

不存在其他路径可以产生 PARTIAL。
不存在「看起来像部分可退」就标 PARTIAL 的捷径。
如果 N 无法计算（输入缺失）→ 只能 UNKNOWN。
```

### ③ SELL / BUY 的输入关系

```text
门禁判定因子 = SELL 侧 executableNotional（gates@4 GCP 方案 D）

BUY 侧 executableNotional：
  ✓ 可以计算（同一公式，BUY 约束集）
  ✓ 可以作为 reason 附注输出
  ✗ 不能改变门禁状态
  ✗ 不能改变 readiness
  ✗ 不能改变 score
  ✗ 不能作为独立的 veto 条件

BUY 附注输出格式：reason 字符串或 annotation 对象，含 N_buy 值与约束满足情况。
```

### ④ UNKNOWN 的 fail-closed 路径

```text
以下任一条件成立 → UNKNOWN（不计算，不猜测）：
  - pool-state EvidenceRecord 不存在
  - 储备字段缺失（reserveQuote/reserveBase 为 null 或不存在）
  - curve parameters 缺失（pump.fun 曲线账户不可解码）
  - intendedNotional 未定义（无策略对象或无意向值）
  - slot 缺失（无法锚定点时事实）
  - venue 无法识别

UNKNOWN → 不产生 PARTIAL / FAIL / PASS。
UNKNOWN → reason 必须记录缺失原因（哪项输入不可用）。

GAP-03 一致性（CLOSED）：feesResolved=false **不自动导致 UNKNOWN**——
E-01 FROZEN-v1 下 N 为费前名义，fee facts 为独立记录；
只有当缺失字段实际属于 E-01 公式的 required inputs（A 类）时才进入 UNKNOWN。
```

### ⑤ N 的精确计算与边界

```text
E-01 FROZEN-v1 第一节（完整公式）：

SELL：
  ① Pricing leg：5(R_q − Δq) ≥ 4R_q
  ② Curve Impact：(p_pre − p_post) / p_pre ≤ 0.15
  N = 满足 ①② 的最大 Δq（经 SOL-USDC 换算为 USDC 名义）

BUY：
  ① 恒真（数学事实，D-03）
  ② 同 SELL
  ③ 曲线定义域：R_b − Δt > 0
  N = 满足 ②③ 的最大 Δt（经换算）

约束全部为费前（GAP-03 CLOSED：pre-fee N + independent fee facts）
所有判定使用整数/精确算术（E-01 行 11）
边界含等号（D-07）
```

### ⑥ E-01 的 80% / 15% 如何落成计算

```text
80% pricing leg 的计算实现：
  SELL：从 pool-state 取 R_q（报价侧储备 raw 字符串）
       构造不等式 5(R_q − Δq) ≥ 4R_q → Δq ≤ R_q / 5
       这给出 pricing leg 允许的最大 Δq

15% curve impact 的计算实现：
  从 pool-state 取曲线参数（venue-specific）
  CPMM（x·y=k）：p_pre = R_q / R_b
                卖出 Δt base → 获得由 CPMM 决定的 Δq
                p_post = (R_q − Δq) / (R_b + Δt)
                impact = (p_pre − p_post) / p_pre ≤ 0.15
                → 展开为 Δ 的二次不等式，实现时必须验证精确性/边界/溢出
  pump.fun：bonding-curve 参数（REAL——DQ-1 CLOSED 2026-09-05；virtual 仅为描述性证据）
            曲线现价与冲击由该 venue 的曲线公式决定
            实现时必须验证与该 venue 程序布局的一致性

两约束各自给出 Δ 上界，取 min → 换算 USDC → executableNotional N。
```

### ⑦ PARTIAL → RESEARCH_REQUIRED 仅作状态映射

```text
Interpreter 输出 PARTIAL 门禁状态。
下游（engine.ts readiness 逻辑）将含 PARTIAL 的项目映射为 RESEARCH_REQUIRED。

这仅是状态呈现，不是策略行为：
  ❌ 不自动降仓
  ❌ 不自动部分放行
  ❌ 不自动重试
  ❌ 不自动寻找替代池
  ❌ 不自动改变交易意向

任何 PARTIAL 驱动的业务行为须另走治理变更。
（gates@4 GCP 签署附注·强制解释）
```

### ⑧ Provenance 如何闭环

```text
每个 executableNotional 计算结果必须携带：
  - 输入 pool-state EvidenceRecord 的 evidenceId 列表
  - 每个 EvidenceRecord 的 slot（点时锚定）
  - 规范池选择依据（poolAddress + earliest observed_at 出处）
  - E-01 Interpretation Contract 版本
  - 实际采用的 Gate 版本（gates@4）
  - 计算方法的标识（求解路径标识）

重放验证：给定同一组输入 EvidenceRecord + 同一 intendedNotional
         → 必须产出同一 executableNotional + 同一门禁状态
         （确定性——与 M1 同管道 live/replay 等价纪律一致）
```

### ⑨ Interpreter 不得创造 Adapter 未提供的事实

```text
❌ 不得从 reserveQuote 推导 reserveBase（如果 base 缺失）
❌ 不得从一池储备推断另一池储备
❌ 不得用聚合器报价替代池储备
❌ 不得用历史储备替代点时储备
❌ 不得用 curve parameters 以外的模型推算价格
❌ 不得补全 feesResolved = false 的费率字段
❌ 不得从 complete = true 推断流动性充足

一句话：如果 Adapter 没给，Interpreter 就没有。
        Interpreter 是数学消费者，不是数据创造者。
```

### ⑩ 即使算得出来，也无治理授权去算的事

```text
❌ N 费后修正（GAP-03 CLOSED 为费前——费后须另走治理变更）
❌ BUY 侧的独立 veto 判定（GCP-GAP-02 方案 D：BUY 只是附注）
❌ PARTIAL_FILL 的执行触发（门禁 PARTIAL ≠ 自动部分成交）
❌ 多池组合 N（E-01 规范池单池——多池须另走治理变更）
❌ 分批卖出的序列 N（B3.2 属执行层，不入门禁）
❌ 降仓比例/部分放行比例（无 PARTIAL 行为授权）
❌ EXIT_IMPOSSIBLE 判定（属 B3.4 执行层语义，非 E-01 输出）
❌ 替代池搜索与规范池切换（属观察层，非 Interpreter）
❌ DQ-1 已关闭为 REAL（2026-09-05）——virtual 不作为治理裁决依据
```

---

## 与四层冻结体系的一致性

| 层 | Interpreter 依赖 | Interpreter 不得触碰 |
|---|---|---|
| solana-readonly@4 | 读取 pool-state 载荷 | 不得修改契约/版本 |
| Evidence @2 | 消费白名单 kind 的 EvidenceRecord | 不得新增 kind/修改校验器 |
| E-01 FROZEN-v1 | 按公式计算 N | 不得修改任何条款/边界 |
| gates@4 | 输出 PARTIAL/PASS/FAIL/UNKNOWN | 不得修改 readiness/score 逻辑 |

---

## 授权后的实现边界预估

```text
新模块    lib/interpret/e01.ts（纯计算，无 I/O，无 DB）
          lib/interpret/e01.test.ts（验收测试）
修改      lib/domain/interpret.ts interpretSell 接入 Interpreter 输出
          lib/domain/types.ts GateStatus 枚举扩展 PARTIAL
          lib/engine.ts readiness 映射
          相关测试/前端/e2e
版本      RULE_VERSION gates@3 → gates@4
前置      本 Review APPROVED + F2-B Implementation Authorization 另行下达
```

---

## 审阅栏

```text
主理人审阅 2026-09-05    裁决 APPROVED
修订记录    R1 = feesResolved 从 E-01 required inputs 移除（①第五层 A/B 分层 + ④ GAP-03 一致性条款）
```
