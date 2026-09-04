# STAR-MONEY-CAPABILITY-CONTRACT

```text
文档：STAR-MONEY-CAPABILITY-CONTRACT
版本：rev0
日期：2026-09-04

STAR 研究基础设施 = 部分实现
STAR 赚钱能力     = NO-EVIDENCE
M0-OBJECTIVE      = FROZEN
M0-MEASUREMENT    = HOLD / UNSIGNED
M1 / M2           = NOT STARTED
M3 / M4           = DENIED
M5 / M6           = DENIED
资金权限          = DENIED

尚未签署：M0 FROZEN rev1
终审：docs/alpha/M0.1-FINAL-REVIEW.md
缺口补齐：待签确定值已写入 Part B
签署状态：仍 HOLD / UNSIGNED，未接受不得升格
```

本口径立即覆盖此前任何「能力已经对齐」「门禁/分数/页面/测试通过即具备能力」的宽泛表述。

> 六门禁、分数、页面、单测通过，只证明研究工具可运行，不证明存在 Alpha。

rev0 只冻结**方向、安全边界和诚实性**。  
rev0 **不能**单独作为赚钱能力判定合同。

### 后续治理规则（已冻结，不因未签 rev1 而可谈判）

1. 组合净值是唯一评价对象，不能用单笔盈利替代。
2. 失败成交、部分成交和无法退出必须进入结果。
3. 查看测试集后修改规则，必须创建新的实验版本。
4. PF、胜率和收益率必须同时报告样本量、置信区间、最大回撤及费用后结果。
5. 六门禁、分数、页面、单测通过，只证明研究工具可运行，不证明存在 Alpha。
6. M0 rev1 未签署前，不开发 M1 Recorder、回测器或策略优化器。
7. M3 / M4 未满足证据门槛前，不讨论 Micro-Live。

M0-MEASUREMENT 签署前，禁止继续开发回测器、策略优化器或排行榜，否则会围绕未冻结指标过拟合。  
若价格、失败样本、账户或实验口径仍有任何未定义项，继续保持 `HOLD / UNSIGNED`。

适用范围：`star-web` 唯一运行应用。  
取代：质量审计阶段「不接 solana-rpc」限制（该限制只约束当时的页面审计）。  
不取代：资金 `DENIED`、无杠杆、不借款、不自动交易、不接触偿债资金。

签署 `M0 FROZEN rev1` 的条件：本文 M0.1 五章被接受或逐条改写后重新冻结，且三个对象都有可执行定义：

```text
交易     DecisionIntent + 点时成交
账户     PortfolioPolicy + 日净值
实验     策略版本登记 + TRAIN/VALIDATION/embargo/SEALED TEST
```

---

# Part A · M0-OBJECTIVE（FROZEN）

## A0. 唯一目标

STAR 不再以研究页面完成度为主线。

唯一目标：

> 能否持续产生可执行、可复验、扣除成本后为正的交易决策。

「赚钱能力」不是系统声称能赚钱，而是在不偷看未来、计入完整执行成本、计入失败退出、策略版本冻结且不得回改旧规则冒充历史成绩之后，**组合账户**的样本外净期望仍为正。

未通过正式 M3 之前，禁止称 STAR「具备初步赚钱能力」。  
未通过 M4 之前，禁止讨论投入真钱。  
此前六页面与单测只证明工程存在，不证明能赚钱。

### 评价纪律（与文首七条治理规则同一效力）

正式成绩只承认**费用后的组合净值**。单笔盈利、图表涨幅、门禁通过、机会分、页面完整、单测通过，都不是 Alpha 证据。

### 每天唯一输出

```text
今日可行动候选：0—3 个
观察候选：若干
明确禁止：其余全部
```

每个可行动候选必须包含：决策（`AVOID` / `WATCH` / `ACTIONABLE`）、进入窗口、最大容量、机会依据、硬风险、失效条件、退出方案、证据时间、置信等级。迟到信号和数据缺失默认不交易。

### 立即冻结的非赚钱开发

QA-04 全面中文化、QA-05 决策 Tab、QA-07 钱包图、CSP 深度硬化、首屏包体积、六页扩功能、BNB、自动交易与钱包接入：全部暂缓。

### 禁止未来信息

每条记录必须带：

```text
append-only
+ observed_at
+ effective_at
+ ingested_at
+ source
+ raw_receipt
+ collector_version
```

决策只能使用 `observed_at / ingested_at / effective_at ≤ as_of` 的对象。  
无时间戳实体关系 fail-closed。  
回灌：`timing_quality = BACKFILLED_UNKNOWN`，`completed_at = ingested_at`，不得编造 `started_at`，不得进入实时成功率/延迟分母。

必须区分：

```text
图表最高涨幅
≠ 可成交收益
≠ 账户真实收益
```

一个币盘中涨 100 倍，仓位只能以 3 倍退出，账户只记 3 倍。无法卖出 ≈ 0。

---

# Part B · M0.1 测量合同（HOLD / UNSIGNED）

以下五章是赚钱判定的最小完备集。未签署前，任何回测数字只能标 `UNOFFICIAL`。  
2026-09-04 终审后已补齐 P-01–S-05 的**待签确定值**（见各章「待签确定值」节与 `M0.1-FINAL-REVIEW.md`）。  
这些值尚未被接受，**不得升为 `M0 FROZEN rev1`**。改写任何一条即生成新的待签稿，不能假装旧稿已被签署。

---

## B1. Portfolio Accounting Contract

单笔交易盈亏不能回答「整个账户到底赚了多少钱」。所有正式成绩必须来自组合模拟，不得用交易清单加总冒充账户净值。

### B1.1 PortfolioPolicy v0（签署 rev1 时冻结）

```text
reporting_currency        USDC
aux_benchmark             SOL
btc_benchmark             BTC
cash_mark                 现金按 USDC，收益 = 0
initial_nav               100_000 USDC
leverage                  0
position_sizing           单项目最大名义仓位 = 0.5% NAV
max_positions             5
max_total_exposure        min(5 × 0.5% NAV, 可用现金)
same_token_reentry        同一 mint 同时只能有一个仓位
risk_per_name             按最坏 100% 损失计风险
cash_treatment            现金收益 = 0
compounding_policy        按每日净值复利
exit_priority             先满足强制退出，再按失效时间，再按流动性恶化和容量
daily_nav_cutoff          每日 00:00 UTC
```

标准化 100,000 USDC 只为比较策略，不代表未来真钱规模，也不构成资金授权。

### B1.2 必须同时输出的账户指标

| 指标 | 定义 |
| --- | --- |
| USDC 净值 | `cash_usdc + Σ mark_to_exit(position)`；标记价必须是当时可实现退出，不是图表中间价 |
| SOL 相对收益 | 同期把同等初始净值换成 SOL 并持有的超额 |
| BTC 相对收益 | 同期把同等初始净值换成 BTC 并持有的超额 |
| 总资金利用率 | 占用名义 / NAV |
| 最大资金占用 | 观察期内利用率峰值 |
| 最大回撤 | 标准化组合净值从峰值到谷底 |
| 连续亏损次数 | 按已关闭仓位，中间不得插入未实现标记 |
| 单一项目利润贡献 | 该 mint 已实现盈亏 / 组合已实现总利润 |
| 组合级可退出价值 | 若此刻按规则清仓，扣执行成本后能拿到的 USDC |

### B1.3 三个评估点不得重复记账

15 分钟、1 小时、6 小时是三个**候选决策时间**，不是三笔独立赚钱机会。

**研究比较模式**（只比较哪一个时点更有预测价值）：

```text
Baseline-15M
Baseline-1H
Baseline-6H
```

三个策略各自拥有独立的 `strategy_version`、独立组合账户、独立实验登记。彼此可以比较，但不得把三个账户的利润加总成「系统总成绩」。

**真实组合模式**（唯一可用于 M3 / M4 正式成绩）：

```text
同一 mint
→ 第一次进入
→ 之后只能升级、维持或退出
→ 不得把 15M / 1H / 6H 记成三笔独立成功
→ 不得重复占用同一段上涨
```

一只上涨 Token 贡献三次利润 = 合同违规，成绩作废。

### B1.4 仓位与现金

- 无杠杆、无借款、无空头。
- 现金不产生利息。
- 买不进的 `ACTIONABLE` 不占用仓位，但计入执行失败分母。
- 卖不出的持仓按 0 计价，并继续计入已付出的买入成本。
- 同一 mint 已有持仓时，后续信号只能调整退出规则，不能开第二笔。

### B1.5 待签确定值（P-01–P-04）

```text
P-01 退市/失败未平仓
  下列任一事实的首次 observed_at 立即将该 mint 未平仓记 0，标签 EXIT_IMPOSSIBLE，样本不得删除：
  · 冻结权限被行使，或 transfer hook / 暂停导致不可转账
  · 该 mint 全部支持池的可退出深度 = 0，或储备不可观测
  · 单槽增发超过当时供给 10%
  不得把上述仓位继续按未实现浮盈浮亏悬挂。

P-02 日切标记
  每日 00:00 UTC：未平仓用当时 mark_to_exit（费用后可实现退出）计入 NAV 与回撤。
  已实现盈亏只在关闭时确认。复利用标记后的日净值。

P-03 基准价
  SOL 基准：实验窗起点用 Raydium SOL-USDC（earliest observed_at 的规范池）按执行模型买入并持有。
  BTC 基准：同上，交易对 BTC-USDC。
  日切与期末均用当时可实现卖出价标记。起点买入与期末卖出都扣执行成本。
  规范池或点时簿记缺失 → 该日基准记 NO_BENCHMARK，正式成绩不得用后来价补。

P-04 现金货币
  账户现金只允许 USDC。卖出得到的 SOL 必须在同一 as_of 按执行模型换成 USDC 后再计入 NAV。
  禁止 SOL 现金余额。
```

---

## B2. Universe & Sampling Policy

「符合基础流动性的新池」若在看结果后改门槛，就是选择偏差。采样宇宙必须在看结果前冻结。

### B2.1 UniversePolicyVersion

```text
UniversePolicyVersion
├── supported_dexes
├── quote_assets
├── minimum_initial_liquidity
├── minimum_observation_duration
├── excluded_token_extensions
├── duplicate_pool_resolution
├── discovery_source
└── effective_from
```

任何字段修改都生成**新版本**。旧宇宙、旧样本、旧成绩不得改写。

### B2.2 发现分母 ≠ 策略资格

| 集合 | 谁必须留下 | 能否事后删除 |
| --- | --- | --- |
| 发现分母 | 支持 DEX + 支持报价资产上的全部新池诞生 | 否。很快死亡的池也必须留下 |
| 策略资格 | 同时满足当时已冻结的流动性/观察期/扩展限制 | 否。后来未达门槛不能从发现分母消失 |
| 正式成绩样本 | 资格集合 ∩ 实验切分规则 | 否。禁止从测试集挑「较好阶段」重定义 |

### B2.3 待签确定值（U-01–U-04；不再是「建议值」）

签署 rev1 即接受下表。改任一字段 = 新 `UniversePolicyVersion`，旧样本不得改写。

```text
U-01 宇宙门槛（接受即冻结，禁止边看结果边改）
  supported_dexes              pump.fun bonding-curve, raydium-amm-v4, raydium-cpmm
  quote_assets                 SOL, USDC（SOL 与 wSOL 视为同一报价资产）
  minimum_initial_liquidity    该 mint 首次可观测储备 ≥ 8 SOL 等值（USDC 池按当时 SOL-USDC 规范池折算）
  minimum_observation_duration 发现分母 = 0；策略资格观察期由策略版本定义
  excluded_token_extensions    transfer-hook / permanent-delegate / 非零转账费 / 冻结权限仍在
  duplicate_pool_resolution    规范项目 = mint，不是池
  discovery_source             三条支持程序的链上日志/签名为唯一真源
  effective_from               宇宙开启日写入，不得回溯

U-02 退市币 / 失败币（FAILED_RETAINED）
  发现分母中的 mint 一旦出现 B1.5 P-01 任一条件，或连续 24h 无成功成交且储备 < 1 SOL 等值：
  → 标签 FAILED_RETAINED，永久留在发现分母。
  禁止事后改成「从未发现」或移出分母。

U-03 毕业身份
  pump.fun 毕业到 Raydium = 同一 mint 的场地变更，不是第二个项目。
  first_tradable_at = bonding-curve 首次可观测成交。
  规范池随时间可变，但项目键永远是 mint。

U-04 独立核对索引
  对照物 = 同一 slot 范围、同一三个程序 ID 的二次回放（不同只读端点，或延迟重放同一原始回执）。
  覆盖率 = Recorder 发现的 mint ∩ 二次回放发现的 mint / 二次回放发现的 mint。
  二次回放不可用 → M1-EVIDENCE 不得通过（覆盖率不可测）。
  商业聚合索引不得当过滤器，也不得在未写入许可证矩阵前当对照物。
```

独立核对只回答「漏掉多少」，不用于把漏掉的失败项目踢出分母。

### B2.4 采样顺序

> 先冻结时间范围和 UniversePolicyVersion，再收集该范围内的全部发现对象。

禁止：只采集知名成功项目；随机切分 Token；看完收益再收紧流动性门槛。  
合成 150 与夹具 ≠ 历史语料。`REAL DATA` 在 M1-EVIDENCE 完成前 = `NO-EVIDENCE`。

最近 90 天连续样本只能得到 `M3-CANDIDATE`，不能完成正式 M3。正式 M3 必须覆盖热点扩张、高位拥挤、冷却衰退。

---

## B3. Execution Cost Model

「计入滑点」不够。必须冻结成交价如何产生。缺少点时池状态时，**不允许用后来价格补算**。

### B3.1 买入路径

```text
signal_observed_at
→ decision_created_at
→ 最早下一可执行区块
→ 当时池储备
→ AMM 价格影响（按拟买入名义）
→ 路由费
→ 优先费
→ 账户创建成本（ATA / 必要账户租金）
→ 模拟成交价格（允许部分成交；未成交部分记未执行，不得改用后来价格补全）
```

若 `decision_created_at` 之后到可执行区块之间池储备不可得：记 `NO_POINT_IN_TIME_BOOK`，不得成交。  
部分成交按实际成交名义入账，剩余意向不得假装全部成交。

### B3.2 卖出路径

卖出必须同时使用：

- 实际池储备（卖出当时，不是买入当时）
- 仓位相对池深
- 路由可用性
- 转账限制与 Token 扩展
- 交易失败与 RPC 延迟
- 价格冲击
- 优先费
- 流动性突然撤走
- **分批卖出对后续价格的影响**（第二笔看到第一笔之后的储备）

### B3.3 待签确定值（E-01–E-04）

```text
E-04 可执行区块
  executable_slot = max(signal_slot, decision_slot) + 2
  （+1 等待上链，+1 覆盖只读 RPC 延迟）
  该 slot 无点时储备 → NO_POINT_IN_TIME_BOOK，不得成交、不得补价。

E-03 AMM / 曲线
  pump.fun     只用该 slot 账户里的 bonding-curve 参数；程序版本未知则 fail-closed
  raydium-amm-v4  恒定乘积 x*y=k，费率取当时链上 fee
  raydium-cpmm    恒定乘积，费率取当时链上 fee config
  禁止用聚合器未来路由反推。费率未知 → fail-closed。
  同一 mint 多池：只对规范池（该报价资产 earliest observed_at）询价。

E-02 优先费
  N = 150 个已确认 slot 的优先费 p75。
  可得 slot < 32 → EXECUTION_FAILURE。
  账户创建成本按该 slot 租金免租额，用当时 SOL-USDC 规范池折成 USDC。

E-01 部分成交
  可成交名义 = 同时满足以下两者的最大 USDC：
  · 成交后规范池报价侧储备仍 ≥ 成交前的 80%
  · AMM 曲线价格冲击 ≤ 15%（相对成交前曲线现价，不是图表中间价）
  该名义 > 0 且 < 意向 → PARTIAL_FILL：成交部分入账，剩余意向记未执行。
  该名义 = 0 → BUY_FAIL 或 SELL_FAIL。
  剩余意向禁止用后来簿记补成交。分批卖出必须在上一笔之后的储备上重定价。
```

### B3.4 失败语义（不可谈判）

```text
ACTIONABLE 已发布
但因系统未预见的流动性问题无法买入
→ EXECUTION_FAILURE
→ 不得静默删除
→ 不得改成 WATCH 以提高成交率

已持仓但无法卖出
→ 最终价值 = 0
→ 额外计入已发生交易成本

缺少点时池状态
→ 不允许用后来价格补算
```

「95% 订单可成交」的分母 = 所有已经锁定发布的 `ACTIONABLE`。  
成交失败、未发布、事后改标，一律不得移出分母。

### B3.5 待签确定值（E-05 闭合分类）

正式结果只允许下列执行标签，禁止改回 `WATCH` 或删除：

```text
BUY_FAIL
PARTIAL_FILL
SELL_FAIL
EXIT_IMPOSSIBLE
NO_POINT_IN_TIME_BOOK
EXECUTION_FAILURE
FILL_OK
```

`FILL_OK` 只表示按 E-01 全额成交。部分成交不是 `FILL_OK`。

---

## B4. Experiment Split & Multiple-Testing Policy

「样本外为正」必须能回答：这个样本是否已经被看过、是否被反复用于调参。

### B4.1 切分

```text
TRAIN
→ VALIDATION
→ 14天 purge / embargo
→ SEALED TEST
```

- 按 Token **首次可交易时间**顺序切分，禁止随机切分。
- 7 天 / 14 天结果标签会造成时间重叠，因此测试集前必须留 14 天隔离。
- `SEALED TEST` 只能正式开启一次。
- 看到测试结果后修改任何规则，必须**同时**创建新实验版本并启用新的测试时间窗（X-03）。
- 禁止从测试集挑出「表现较好的市场阶段」重新定义样本。

### B4.1a 待签确定值（X-01–X-04）

```text
X-01 切分边界（按 mint 的 first_tradable_at 升序，禁止随机）
  TRAIN        前 60% mint
  VALIDATION   随后 20% mint
  embargo      VALIDATION 最后一个 first_tradable_at + 14 个自然日
  SEALED TEST  剩余 20% mint，且 first_tradable_at ≥ embargo 结束
  落在 embargo 内的 mint 不进入任何正式成绩，只保留在发现分母。

X-02 「查看测试集」
  下列任一即视为已查看：
  · 人类或代理读取 SEALED 的合计指标（NAV / PF / 胜率 / CI / 回撤）
  · 读取任一 SEALED mint 的已实现或标记结果
  · 把上述数字写入决策者可打开的报告或会话
  不含：仅含合成标签的单测夹具。
  已查看必须写入 experiment_run.sealed_viewed_at，不可擦除。

X-03 新版本与新窗同时强制
  查看后改任何规则 → 新 experiment_run + 新策略版本 + 新 SEALED 时间窗。
  禁止只换版本号沿用已看过的封测窗。旧 run 标 SUPERSEDED，不得删除。

X-04 封测最低样本
  正式 M3 至少同时满足：
  · 锁定 ACTIONABLE ≥ 200
  · 已关闭仓位 ≥ 80
  否则只能 INSUFFICIENT-EVIDENCE，不能因点估计漂亮而通过。
```

### B4.2 试验登记

所有试验过的策略版本必须登记，失败策略不能删除。  
每次规则修改递增 `rule_change_count`，并保留实验谱系，不可改写。  
AI 生成的每个策略同样计入试验次数。

每次实验保存不可变 `experiment_run`：

```text
experiment_run
├── strategy_version_hash
├── universe_policy_hash
├── portfolio_policy_hash
├── execution_model_hash
├── oracle_version_hash
├── dataset_hash
├── split_bounds
├── created_at
└── result_status          UNOFFICIAL | M3-CANDIDATE | SEALED | SUPERSEDED
```

回头修改旧规则冒充历史成绩 = 合同违规。

### B4.3 最近 90 天的法律地位

```text
最近90天回测     = M3-CANDIDATE
正式 M3          = 覆盖至少两个独立市场阶段的 SEALED TEST
```

点估计漂亮但未封测，只能是候选，不能宣称 Alpha。

---

## B5. Statistical Alpha Acceptance

山寨币收益是重尾分布。Profit Factor 1.3 仍可能被一个百倍币欺骗。

### B5.1 正式 M3 必须同时满足

```text
样本外净期望                         > 0
样本外 Profit Factor                 ≥ 1.3
95% 区块 Bootstrap 净期望下界        > 0
95% 区块 Bootstrap PF 下界           > 1.0
前5大盈利交易贡献                    ≤ 总利润 50%
最大单项目利润贡献                   ≤ 总利润 20%
标准组合最大回撤                     ≤ 15%
至少两个独立市场阶段净收益为正
完整失败样本计入                     100%
```

以上全部在**真实组合模式**的标准化账户上计算，不是研究比较模式的三个账户加总。

### B5.2 证据不足

若样本量不足以计算稳定置信区间，结果只能是：

```text
INSUFFICIENT-EVIDENCE
```

不能因为点估计漂亮就通过。不得为通过测试降低本表标准。

### B5.3 可执行门槛（分母锁定）

- 已锁定 `ACTIONABLE` 中，按模型价格区间成交的比例 ≥ 95%。
- 退出容量必须覆盖计划仓位；覆盖失败按执行失败或归零，不改信号标签。
- 无法卖出 ≈ 0。
- 迟到信号和数据缺失默认不交易，并留在决策日志里。

### B5.4 待签确定值（S-01–S-05）

```text
S-01 胜率
  分母 = 评价集内全部已锁定 ACTIONABLE
  分子 = 已关闭仓位中费用后已实现盈亏 > 0 的笔数
  BUY_FAIL / SELL_FAIL / EXIT_IMPOSSIBLE / NO_POINT_IN_TIME_BOOK
  / EXECUTION_FAILURE / 费用后亏损的 PARTIAL_FILL
  全部计为未赢，不得移出分母。

S-02 费用后科目（正式 NAV / PF / 胜率 / 收益率只能用扣完后的数字）
  · AMM 价格冲击
  · 协议 / LP 费
  · 优先费
  · ATA / 必要账户租金
  · 失败交易仍发生的费
  禁止把费用前数字标成正式成绩。

S-03 Bootstrap
  块长 = 7 个自然日；重采样 10_000 次；取百分位区间。
  观察窗 < 21 个自然日 → 不得计算正式 Bootstrap，结果 = INSUFFICIENT-EVIDENCE。

S-04 稳定置信区间最低样本
  与 X-04 相同：ACTIONABLE ≥ 200 且已关闭仓位 ≥ 80。
  否则 INSUFFICIENT-EVIDENCE。

S-05 市场阶段分类器（只许用 TRAIN 校准，禁止用 SEALED 重拟合）
  指标 = 过去 7 日新进入发现分母的 mint 数
  EXPANSION  该 7 日计数 ≥ TRAIN 期同指标的 p75
  COOLING    该 7 日计数 ≤ TRAIN 期同指标的 p25
  OTHER      其余
  正式 M3 要求 SEALED 内至少各有一段 EXPANSION 与一段 COOLING，
  且每段至少 20 个已关闭仓位，两段费用后净值均为正。
  禁止事后挑选「较好阶段」重定义窗口。
```

---

# Part C · 代码边界与状态阶梯

## C1. 三个对象，三条代码线

赚钱判定需要三个对象：交易、账户、实验。因此建设期是三条线，不是两条：

```text
lib/alpha/decision/     生产信号与策略
lib/oracle/outcome/     独立结果计算
lib/portfolio/          组合账户模拟
```

对应建设：

```text
Solana Market Recorder
Independent Outcome Oracle
Portfolio Simulator
```

没有 Portfolio Simulator，系统永远只能回答「选中过什么币」，不能回答「账户赚了多少钱」。

### C1.1 强制隔离（复用语料 Oracle 的 T17 import-lint）

- Oracle **禁止**导入决策评分、门禁、排名、`THRESHOLDS`、`lib/engine`、`lib/domain`。
- 决策引擎 **禁止**导入未来结果标签、Oracle 产出、测试集成绩。
- Oracle 只接受冻结的 `DecisionIntent` 和点时市场数据。
- 必须有 import-lint 测试。参考现有 `lib/corpus/corpus.test.ts` T17。
- 原始数据集、策略版本、Oracle 版本生成哈希，写入 `experiment_run`。

### C1.2 DecisionIntent（Oracle 唯一输入面）

```text
DecisionIntent
├── strategy_version
├── mint
├── decision            AVOID | WATCH | ACTIONABLE
├── signal_observed_at
├── decision_created_at
├── entry_window
├── max_notional_usdc
├── exit_rules
├── evidence_cutoff
└── intent_hash
```

Oracle 不得回读「引擎现在认为该怎么判」。

---

## C2. 状态阶梯

代码完成 ≠ 证据完成。

```text
M0-OBJECTIVE                 FROZEN
M0-MEASUREMENT               HOLD / UNSIGNED
M1 / M2                      NOT STARTED   未签 rev1 不得开工
M3 / M4                      DENIED
M5 / M6                      DENIED
资金权限                     DENIED
```

P1：在正式 M3 证明前保持 `NO-GO`。M3 / M4 / M5 / M6 / 资金均为 `DENIED`。

### C3. M1-EVIDENCE 最低要求

- 连续运行 7 天
- 对照独立发现索引，新池发现覆盖率 ≥ 95%
- 决策所需核心字段完整率 ≥ 95%
- 采集延迟分位数可见
- 断线补采不修改历史可见时间（补采只能追加，`observed_at` 保持当时）
- 原始回执可重放
- 失败采集不得静默丢弃

只提交记录器代码 = `M1-BUILD`。不得宣布 M1 通过。

### C4. M2-EVIDENCE 最低人工核对

必须逐条核对：

- 正常买卖
- 极端滑点
- LP 突然撤走
- 能买不能卖
- 多池路由
- 交易失败
- 100 倍图表但只能 3 倍退出
- 完全归零

只提交 Oracle 代码 = `M2-BUILD`。不得宣布 M2 通过。

### C5. M4 不能只按 30 天放行

```text
M4 观察期
=
至少 30 个自然日
+ 锁定 ACTIONABLE ≥ 40
+ 覆盖至少一次 EXPANSION 与一次 COOLING（定义见 B5.4 S-05）
```

30 天样本不足则自动延长，不因日历到期而放行。

同时要求：每日信号发布时间戳；发布后不可修改；修正只能追加新版本；Shadow 采用真实可用数据延迟；每日生成组合净值；与同期 SOL 和现金基准比较。

---

## C6. 第一份有意义的产物

不是新页面，而是机器生成报告：

```text
STAR Alpha Report v0
├── 采样宇宙
├── 数据覆盖率与延迟
├── 策略版本
├── 交易明细
├── 无法成交 / 无法退出
├── USDC 组合净值（费用后）
├── SOL / BTC 相对净值
├── 最大回撤
├── 胜率（含分母与样本量）
├── Profit Factor
├── 收益集中度
├── Bootstrap 置信区间
└── GO / NO-GO / INSUFFICIENT-EVIDENCE
```

验收语言改为：发现数、提前识别失败、捕获上涨、漏报、误报、可退出收益、最大回撤、每投入 1 元承担多少风险并得到多少期望收益。  
不再用页数、接口数、单测数、表数作为主进度。

---

# Part D · 开发顺序

| 阶段 | 内容 | 出口 |
| --- | --- | --- |
| 现在 | 终审 M0.1 五章；补齐未定义口径后才可签 rev1 | 仍为 `HOLD / UNSIGNED` |
| 建设 | 仅在签署后启动 Recorder | `M1-BUILD` |
| 记录 | 连续记录 ≥ 7 天 | 进入 M1-EVIDENCE |
| 复验 | 覆盖率、延迟、回执重放、失败不丢弃 | `M1-EVIDENCE` |
| Oracle | 独立执行结果计算 + 金标 | `M2-BUILD` → `M2-EVIDENCE` |
| 候选 | 最近 90 天 + Baseline-15M/1H/6H 比较 + 真实组合模式一账户 | `M3-CANDIDATE` |
| 正式 | 多市场状态 SEALED TEST | 正式 M3 = GO / NO-GO / INSUFFICIENT-EVIDENCE |
| Shadow | 30 日 + 样本量 + 热/冷覆盖 | M4 |
| 之后 | 仅当 M4 通过才讨论 `MICRO-LIVE` | M5 仍默认禁止 |

未签署 rev1 之前：不开发 M1 Recorder、回测器、策略优化器、排行榜；不把代码存在写成能力通过。  
签署 rev1 之后的顺序：`M1-BUILD` → 连续记录 ≥7 天 → `M1-EVIDENCE` → M2 独立执行 Oracle。不再继续研究型壳开发。  
M3 / M4 未满足证据门槛前，不讨论 Micro-Live。
