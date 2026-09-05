# E-01 Interpretation Contract v0.1-R2

```text
状态        FROZEN-v1（主理人 2026-09-05 第三次 Contract Review APPROVED；签署文本经外部逐字核验）
修订        R1 = REVISE-01…04（见 2026-09-05 第一次 Review）
            R2 = REVISE-05 BUY 形式化闭环：逐字核对 B3.1:311-329 后发现
            「base 侧非枯竭」措辞源自 v0.1 编译稿而非签署文本——R2 将其归位为
            ③ 曲线模型的定义域数学事实（非独立治理约束）；费用链按 B3.1 原文
            编译为价格路径组成部分，其与 N 的约束关系签署文本未定义 → 新增 GAP-03
性质        已签署 E-01 文本的纯编译产物 + 主理人 2026-09-05 七项裁决（D-02…D-08）
            本文件不新增任何治理规则；两处治理缺口（GAP-01/02）显式暴露，禁止实现层填补
编译来源    STAR-MONEY-CAPABILITY-CONTRACT.md rev1（已签署）B3.1:311-329 · B3.2:331-343 ·
            E-01:362-371 · E-02:356-360 · E-03:348-354
            M0.1-ACCEPTANCE-WORKSHEET.md:18（ACCEPT）· CONSENSUS-OPERATING-MODEL.md FROZEN-rev1 §10
落地形态    批准后进入实现授权流程；是否需要 gates@4、以及 Gate integration 的具体版本，
            待 F2-B 实现前另行裁决（授权顺序由 D-08 冻结）
```

---

## 一、形式化定义（忠实翻译，无再创作）

对规范池（该报价资产 **earliest observed_at** 池，E-03:354）在 slot 时点的状态 `(R_q, R_b)`、链上费率 `f`（E-03:352-353，费率未知 → fail-closed）：

```text
executableNotional (N) = max USDC 名义，满足：

  ① Pricing leg（仅 SELL 为主动约束）
     SELL：R_q − Δq ≥ 0.80 × R_q          ⟺  5(R_q − Δq) ≥ 4R_q   （整数交叉相乘）
     BUY ：R_q' = R_q + Δq ≥ R_q ≥ 0.80R_q —— 数学恒真，非豁免规则（裁决 D-03）

  ② Curve Impact（费前，裁决 D-02）
     impact = (p_pre − p_post) / p_pre ≤ 0.15   （边界含等号，裁决 D-07）
     p_pre/p_post = candidate execution 前/后的曲线现价（B3.3:365，非图表中间价）
     不含：routing fee · priority fee · ATA rent · 任何执行层费用（独立成本链，B3.1:317-320）

  ③ 曲线模型 = venue 官方（含其定义域）
     raydium-amm-v4 / cpmm：x·y=k，费率取当时链上值（E-03:352-353）
     pump.fun：只用该 slot 账户里的 bonding-curve 参数（E-03:351）
     定义域（BUY，数学事实非治理约束）：买入名义 Δt 使 R_b − Δt ≤ 0 时曲线模型无解——
     这是 ③ 模型自身的边界条件，与 D-03 的恒真同属数学事实类，不是新增规则。
     （编译注：v0.1/R1 第 9 行曾以「base 侧非枯竭」将其列为独立 BUY 约束，该措辞
      并非签署文本原文，R2 予以归位。）

  ④ 费用链（B3.1:317-320 价格路径的组成部分）
     路由费 → 优先费 → 账户创建成本（ATA / 必要账户租金）
     签署文本将其列为模拟成交价格路径的组成，**未定义其是否构成 N 的约束**
     （例如 N 为费前毛名义还是费后净名义）→ 见 GAP-03。

换算：报价为 SOL 时，N 经 slot 时点 SOL-USDC 规范池折成 USDC（E-02:359 先例）
求解：SELL 取 ①、② 允许范围的交集上界；BUY 取 ②、③ 定义域的交集上界；
     CPMM 下的 ② 可由曲线模型推导为相应的代数约束，实现时必须验证其精确性、边界和溢出安全
禁止：用聚合器未来路由反推（E-03:354）；任何后来价格补算（B3:305）
```

## 二、门禁状态机（裁决后的完整形态）

```text
                 缺少必要输入（储备/费率/曲线参数/换算价）
                         │
                         ▼
                     UNKNOWN ──────────────┐
                         ▲                │
              ┌──────────┴───┐            │
              │              │            │
              │       N = 0  │            │
              │              ▼            │
Candidate N ──┤            FAIL          │
              │                           │
              │  N ≥ intendedNotional     │
              ▼                           │
             PASS                         │
                                          │
     0 < N < intendedNotional             │
        ╳ 治理未授权语义空间 ╳ ────────────┘
        （GAP-01：刻意留在状态机外，系统须显式暴露，禁止实现层映射为
         PASS / FAIL / UNKNOWN 之任何一种；执行层 PARTIAL_FILL 不得反推门禁状态）
```

## 三、十二行合同（含主理人对行 5/7/8 的修订）

| # | 条款 | 语义（裁决后） | 出处/裁决 |
|---|---|---|---|
| 1 | Impact ≤15% | 费前曲线冲击，`(p_pre−p_post)/p_pre ≤ 0.15`，边界含等号 | B3.3:365 · D-02 · D-07 |
| 2 | Pricing leg ≥80% | SELL 主动约束（`5(R_q−Δq) ≥ 4R_q`）；BUY 数学恒真 | B3.3:364 · D-03 |
| 3 | 计算对象 | 双约束上界取 min 的最大 USDC 名义 N；SOL 报价经规范池换算 | B3.3:362-363 · E-02:359 |
| 4 | 输入 facts | 点时储备、链上费率、曲线参数、换算价、Token 扩展/转账限制；聚合器冲击永不为 E-01 基准 | B3.2 · E-03:354 |
| 5 | 门禁输出 | `N≥intended→PASS`；`N=0→FAIL`；缺输入→UNKNOWN；**`0<N<intended→未定义，禁止实现层自行映射`** | B3.3:367-369 · **GAP-01** |
| 6 | 缺失输入 | 一律不计算→UNKNOWN；NO_POINT_IN_TIME_BOOK 归 UNKNOWN 族；禁止补价/外推 | B3:305 · B3.1:328 |
| 7 | 超冲击关系 | 冲击约束用于**收缩 N**，不直接 FAIL；仅 `N=0` 进 FAIL；部分区间的门禁表达待 GAP-01 裁决 | B3.3:367-368 · **GAP-01** |
| 8 | 固定探针 | **仅允许作为 Observation 保留；不得产生 executable；不得作为 E-01 输入；不得改变解释结果** | D-05 |
| 9 | BUY leg | 签署文本约束集 = ② 冲击 ≤15% + ③ 曲线模型定义域（R_b−Δt>0，模型数学事实）+ ① 恒真（D-03）+ ④ 费用链（价格路径组成，与 N 的关系未定义→GAP-03）；**「BUY+SELL 双腿组合为门禁条件」无签署级依据，未获治理授权/未定义**（GAP-02 未裁决前禁止组合逻辑） | B3.1:311-329 · D-03 · D-06 · **GAP-02/03** |
| 10 | SELL leg | 解释器覆盖可计算项（储备/冲击/费率）；转账限制→扩展事实独立检查；撤池→储备变化观察；分批重定价属执行层不入门禁 | B3.2:331-343 |
| 11 | 数值精度 | 所有判定使用整数/精确算术；比例用整数交叉相乘或等价无损精确计算；实现位宽必须足以避免中间量溢出；USDC 换算精度与舍入方式必须遵循已签署 E-02 定义，若签署文本未规定具体舍入算法，实现前必须单独验证，不得由实现层自行选择；边界含等号；浮点仅允许展示，不得参与判定 | D-07 · REVISE-02/03 |
| 12 | Provenance | 每个计算结果携带输入事实 id+slot 清单、规范池选择依据（earliest observed_at 出处）、E-01 Interpretation Contract 版本 + 实际采用的 Gate/Contract 版本（Gate 版本不得由本合同预授权）；评估记录持久化、重放可复现 | 模型 §Provenance · REVISE-01 |

## 四、七项裁决记录（2026-09-05，主理人）

```text
D-02 CLOSED  冲击不含费（Impact ≠ Total Execution Cost）
D-03 CLOSED  BUY 免 pricing leg = 约束的数学恒真（SELL: active / BUY: automatically satisfied）
D-04 GAP     0<N<intended 的门禁状态 = GOVERNANCE_UNDEFINED（非新状态，是缺口）
D-05 CLOSED  探针降级为 Observation；探针→E-01 路径彻底切断
D-06 GAP     GATE-002 双腿 = historical/unresolved（无签署出处，不得凭历史代码升格）
D-07 CLOSED  边界含等号（≥/≤ 可执行且 inclusive）
D-08 CLOSED  授权顺序：解释合同冻结 → 储备解析器授权 → Interpreter 实现（数据能力不得反向定义治理规则）
```

## 五、治理缺口登记（实现层禁区）

```text
GAP-01  0 < executableNotional < intendedNotional 的 Gate 状态
        —— 已签文本只定义了 N≥intended→PASS 与 N=0→FAIL；此区间无签署级定义。
           实现约束：不得映射为 PASS / FAIL / UNKNOWN 任何一种；
           不得因 E-05 存在 PARTIAL_FILL 而建立 PARTIAL_FILL→PASS 的等价。

GAP-02  BUY+SELL 双腿同时满足是否构成门禁级组合规则
        —— 未获签署级治理授权，当前不得实现（现存唯一引用为已删除的 @3 代码注释，
           属 historical/unresolved，非治理否定）。
           实现约束：E-01 可分别解释 SELL/BUY 两腿，但不得自动合成
           「SELL PASS ∧ BUY PASS → GATE PASS」组合逻辑。

GAP-03  费用链（路由费/优先费/ATA 租金）与 executableNotional 的关系
        —— B3.1:317-320 将费用链列为模拟成交价格路径的组成部分，但未定义：
           (a) N 是费前毛名义还是费后净名义；
           (b) 费用是否参与 N 的约束（即 N_fees 条件是否存在）；
           (c) 费用链对 SELL 侧 N 是否同样适用（B3.2 卖出路径亦列费用）。
           实现约束：GAP-03 裁决前，N 只能按费前语义计算（②③ 均为费前量），
           不得自行引入费后修正；费用仅作为独立成本事实记录。
```

## 六、数据依赖与授权顺序（D-08 冻结）

```text
本合同（DESIGN-READY）
   ↓ 治理批准（E-01 Contract Review）
储备/曲线事实适配器（点时储备解析器——尚未存在；授权后建设）
   ↓
E-01 Interpreter（具体 Gate 版本待另行授权）
   ↓
Gate integration
   → 在 E-01 所覆盖的 tradability 判定路径中，
     只有经过本合同授权的事实、解释器和 Gate integration，
     才允许改变当前 UNKNOWN 结果
```

**硬事实**：储备解析器落地前，Interpreter 即使实现也只能输出 UNKNOWN（pricing leg 无输入）。授权顺序不可倒置。

## 六-A、合同分层原则（主理人 2026-09-05 钉死）

> E-01 合同只冻结「必须算出什么、什么条件下成立、什么情况下不能判断」；
> 不冻结程序员必须用什么算法、什么整数位宽、什么代码结构。
> Reserve/Curve Adapter 只能负责把事实带进来，不得把实现选择变成治理规则。

## 七、实现层禁令汇总（给未来 Interpreter 作者）

```text
❌ 部分区间映射为任何门禁状态（GAP-01）
❌ 双腿组合门禁逻辑（GAP-02）
❌ 费用链擅自约束/修正 N（GAP-03：费前语义冻结至裁决）
❌ 费用混入 impact（D-02）
❌ 探针参与 E-01（D-05）
❌ 聚合器路由冲击作为基准（E-03:354）
❌ 后来价格补算 / 浮点中间量 / 排他边界（B3:305 · D-07）
❌ 未带 provenance 的计算结果（行 12）
```

---

## 审阅栏（E-01 Contract Review）

```text
主理人审阅    2026-09-05 三轮 Review（v0.1 REVISE → R1 REVISE → R2 APPROVED）
审阅结论      APPROVED → FROZEN-v1（含 B3.1:311-329 签署原文外部逐字核验；
              GAP-01/02/03 保持 OPEN，实现授权另循 D-08 顺序）
```
