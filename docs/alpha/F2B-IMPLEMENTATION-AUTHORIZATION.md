# F2-B Implementation Authorization

```text
状态        DRAFT-FOR-REVIEW（等待主理人签署；批准后方可写实现代码）
前置        Interpreter Authorization Review APPROVED 2026-09-05
            E-01 FROZEN-v1 · gates@4 FROZEN · Evidence @2 · GAP-01/02/03 全 CLOSED
性质        极窄实施授权——把已冻结的数学与状态映射落成代码，不重新设计规则
代码        本文件为零代码治理文档；批准后另行动工
```

---

## 一、被授权实现的完整功能清单

```text
功能 1：E-01 executableNotional 计算（纯数学函数）
功能 2：门禁状态映射（N → PASS/FAIL/PARTIAL/UNKNOWN）
功能 3：BUY 附注计算（同一公式，输出 reason）
功能 4：Provenance 构造（输入 EvidenceRecord id + slot + 版本链）
```

## 二、实现规格（逐条绑定冻结源）

### 功能 1：executableNotional 计算

```text
来源    E-01 FROZEN-v1 第一节（完整公式）
输入    pool-state EvidenceRecord（经五层门控 ①）
        + intendedNotional（策略侧传入值）

SELL 计算：
  Step 1  从 pool-state 取 R_q / R_b（venue-specific A 类字段）
  Step 2  Pricing leg 上界：5(R_q − Δq) ≥ 4R_q → Δq_max① = R_q − (4R_q/5) = R_q/5
  Step 3  Impact 上界（CPMM x·y=k）：
          p_pre = R_q / R_b
          卖出 Δt base → Δq = R_q·Δt / (R_b + Δt) （恒定乘积公式）
          p_post = (R_q − Δq) / (R_b + Δt)
          impact = (p_pre − p_post) / p_pre ≤ 0.15
          展开为 Δt 的不等式，求解最大 Δt_max②
          （实现必须验证精确性/边界/溢出——E-01 求解行）
  Step 4  Δ_max = min(Δq_max①, Δq_max②)
  Step 5  换算 USDC（若报价为 SOL，经 slot 时点 SOL-USDC 换算池的 pool-state 计算）
  Step 6  N = Δ_max 的 USDC 名义值

  pump.fun 计算：
          DQ-1 OPEN → virtual 与 real 参数均从 pool-state 取出
          Interpreter 按 GCP-GAP-02 方案 D 仅产出 SELL 侧
          DQ-1 未裁决前 → pump.fun pool-state 的 N 计算标 UNKNOWN（virtual/real 选择未授权）
          （此为①→④ UNKNOWN 条件的 DQ-1 子句）

BUY 计算（功能 3 附注用）：
  Step 1-2 同 SELL Step 3-4，但用 BUY 约束集（② impact + ③ 定义域）
  Step 3  Pricing leg 恒真（D-03），不参与上界
  Step 4  N_buy 输出为 reason 附注

全部计算必须：
  ✓ 整数/精确算术（E-01 行 11——实现位宽足以避免中间量溢出）
  ✓ 边界含等号（D-07）
  ✓ 费前（GAP-03 CLOSED——fee facts 不参与 N）
  ✓ 确定性（同一输入 → 同一输出，可重放验证 ⑧）
```

### 功能 2：门禁状态映射

```text
来源    E-01 FROZEN-v1 第二节（状态机）+ gates@4 GCP（PARTIAL 枚举）

映射规则（完整的四态输出）：
  N ≥ intendedNotional      → PASS
  N = 0                     → FAIL
  0 < N < intendedNotional  → PARTIAL
  输入缺失 / 无法计算         → UNKNOWN（含 reason）

约束：
  ✓ 这是唯一的状态产出路径（②）
  ✓ PARTIAL 不自动触发任何业务行为（⑦）
  ✓ readiness 映射由 engine.ts 执行，不由 Interpreter 执行
```

### 功能 3：BUY 附注

```text
来源    GCP-GAP-02 方案 D

输出    reason 字符串或 annotation 对象：
        { buyNotional: N_buy, buyStatus: "computed", constraintsMet: {...} }
        或 { buyNotional: null, buyStatus: "unknown", reason: "..." }

约束    BUY 附注不改变门禁状态/readiness/score（③）
```

### 功能 4：Provenance 构造

```text
来源    Interpreter Authorization Review ⑧

每个计算结果必须携带：
  inputEvidenceIds: string[]     （输入 pool-state EvidenceRecord 的 evidenceId 列表）
  inputSlots: number[]           （每条 EvidenceRecord 的 slot）
  canonicalPool: string          （poolAddress + earliest observed_at 出处）
  e01ContractVersion: string     （E-01 Interpretation Contract 版本）
  gateVersion: string            （实际采用的 Gate 版本 = gates@4）
  methodId: string               （求解路径标识）

重放验证要求：同一 inputEvidenceIds + 同一 intendedNotional
             → 同一 executableNotional + 同一门禁状态
```

---

## 三、允许创建/修改的文件清单（穷举）

```text
新建：
  lib/interpret/e01.ts             E-01 Interpreter（纯计算，无 I/O，无 DB，无网络）
  lib/interpret/e01.test.ts        Interpreter 验收测试

修改：
  lib/domain/types.ts              GateStatus 枚举加 PARTIAL
  lib/domain/interpret.ts          interpretSell 接入 Interpreter 输出
  lib/domain/thresholds.ts         RULE_VERSION gates@3 → gates@4
                                   + THRESHOLDS 加 IMPACT_MAX_PCT / PRICING_LEG_MIN_RATIO
  lib/engine.ts                    readiness 映射加 PARTIAL 规则
  lib/domain/gates.ts              聚合逻辑适配 PARTIAL
  lib/queries.ts                   消费方适配

测试同步（修改既有）：
  lib/domain/interpret.test.ts
  lib/domain/gates.test.ts
  lib/engine.test.ts
  lib/corpus/corpus.test.ts        corpus 覆盖矩阵加 PARTIAL 维度
  lib/corpus/oracle.ts             sellVerdict 从 UNKNOWN 恢复为真实判定
  lib/corpus/payloads.ts           载荷可产生 PARTIAL 场景
  lib/data/f2a.test.ts             locks 测试更新（tradability 不再恒 UNKNOWN）
  lib/audit/m5-integration.test.ts 版本引用更新

文档同步：
  docs/alpha/CAPABILITY-LEDGER.md
  e2e/star.spec.ts                 如有 tradability 相关断言
```

## 四、验收标准

```text
1.  typecheck 通过
2.  全量测试套件通过（含新增 Interpreter 测试）
3.  e2e 通过
4.  以下不变式由测试锁定：
    a. PARTIAL 仅在 0<N<intended 时产生（唯一路径 ②）
    b. feesResolved=false 不阻止 pre-fee N 计算（GAP-03）
    c. BUY 附注不改变门禁状态（GCP-GAP-02 D）
    d. Interpreter 输出零 verdict 语言（E-01 色彩拦截延续）
    e. 确定性重放通过（⑧）
    f. 五层门控（①）：残缺 provenance/slot/version → UNKNOWN
    g. gates@3 语义不被回改
    h. RULE_VERSION = gates@4
    i. RULE_VERSION ≠ gates@3
5.  以下文件不被触碰：
    lib/poolstate/          （Adapter——不修改）
    lib/evidence/           （Evidence @2——不修改）
    lib/observation/        （M1——不修改）
    lib/b1/                 （B1——不修改）
    lib/alpha/strategy/     （策略——不修改）
    lib/data/solana-rpc-*   （RPC——不修改）
    middleware.ts / app/    （前端/路由——不修改）
```

## 五、仍然禁止

```text
❌ 实现 E-01 公式之外的任何数学（⑩ 九项禁令）
❌ 给 PARTIAL 赋予任何业务行为（降仓/放行/重试/替代池）
❌ BUY 参与门禁判定
❌ fee 参与或修正 N
❌ 多池组合 N
❌ 分批序列 N
❌ DQ-1 virtual/real 选择（pump.fun → UNKNOWN）
❌ EXIT_IMPOSSIBLE 判定
❌ 替代池搜索
❌ 接真实 RPC / Sensor / Registry 变更
❌ 修改 E-01 / gates@4 GCP / Evidence @2 / Adapter Design 的任何冻结文本
❌ git add -A（逐文件提交，永不使用 -A）
```

---

## 签署栏

```text
主理人签署 ______________    日期 ______________

签署确认项：
  [ ] 功能 1-4 完整清单（第二节）
  [ ] 文件穷举清单（第三节）
  [ ] 验收标准（第四节）
  [ ] 禁止清单（第五节）

签署后状态：F2-B Implementation = AUTHORIZED → Zcode 可开始写代码
```
