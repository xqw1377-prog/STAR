# STAR 共识运行模型 V1

```text
状态        FROZEN-rev1（主理人已签署，2026-09-05；不再讨论冻结原则）
依据        主理人 2026-09-05 指令（方向定稿）+ 同日审阅裁决 + 同日签署
上位文档    DIRECTION.md（star-capability@6 口径）· ARCHITECTURE.md
角色表      lib/alpha/layers.ts（STAR_ROLES / STAR_LOOP）
传感器状态  B0=本文档（已冻结）· B1=只记录 · B2=链上资产化代理 · B3=社交接入 · B4=校准后打分
```

> **STAR = Emerging Consensus → Earliest Tradable Asset → Autonomous Response。**
> 从现实事件和市场注意力中识别正在形成的共识，寻找其最早的可交易资产，验证真实市场与资金行为，执行进入，并持续重评估直到自动退出。

**工程顺序 ≠ 产品逻辑**：当前先建 Asset Radar（链上），是落地顺序。认知顺序永远是
`Event → Narrative → Consensus → Assetization → Market → Money → Decision → Position → Exit`（= `STAR_LOOP`）。

**核心架构原则**：社交/情报层负责缩短 STAR 的**反应时间**；链上层负责决定 STAR **是否相信这件事**。
任何非链上信号在系统内的最高形态是 `CONSENSUS_SIGNAL / CANDIDATE`，永远到不了 `MARKET_FACT`。

```text
                     WORLD
                       │
                       ▼
                     EVENT
                       │
                       ▼
                  NARRATIVE
                 /    │     \
                /     │      \
               ▼      ▼       ▼
          Attention Authority Consensus
                       │
                       ▼
                  ASSETIZATION
                       │
                       ▼
                 EARLIEST ASSET
                       │
                       ▼
                  MARKET TRUTH
                       │
                       ▼
                    MONEY
                       │
                       ▼
                   DECISION
                       │
                       ▼
                   POSITION
                       │
                 ┌─────┴─────┐
                 ▼           ▼
              RE-EVAL      EXIT
```

下方的 `Solana / BNB / BTC / Base / TON …` 一律只是 **Market Adapter**，不是产品边界。

---

## 1–4 基础定义

### Event（S0）
世界/信息空间中的可观察事件：政治、人物、科技突破、产品发布、行业事故、言论。**Event 不是交易对象**，只是漏斗起点。V1 无 World Radar 传感器：定义冻结，传感器延后（B3）。

### Narrative
对一或多个 Event 的**命名化、扩散中的解释**，社区收敛于同一名称/关键词/meme/别名。
一等对象 = `narratives` 表（已存在：`name / aliases / novelty·velocity·breadth·onChainConfirm·survival`）。
存在判定：别名簇 + 独立行为者重复使用。不是每个叙事都与 Crypto 相关。V1 传感器 = 链上资产簇代理（B2）。

**模型硬约束（关联方向唯一）**：

```text
Event ──produces / contributes_to──▶ Narrative
                                      ├── aliases
                                      ├── actors
                                      ├── assets
                                      └── lifecycle
```

- 禁止 Token→Narrative 反向归属。B2 的「同主题 Token 出生簇」是 **Narrative→Asset 方向**的传感器：把资产归入叙事，不是给币找叙事。
- **Narrative 可以没有 Token**：无资产的叙事是合法一等对象，照常记录、照常跟踪生命周期；只是（接 §16-1）没有链上资产的叙事永远不能进入 Decision Core。

### Consensus
Narrative 的**一种状态**（不是独立对象）：核心行为者集合（KOL/交易员/builder）上的**超线性采用增长**。
V1 代理 = 同主题资产出生速率 + 独立铸造者增速。

### Assetization
Narrative 获得链上可交易载体的转变：首个引用叙事的 Token 出生 → 首个池 → 首个可交易深度。
**只能由链上事实判定（fail-closed）**。社交信号（"有没有人问 Token / $XXX / CA"）以后只增不换——永不替代链上判定。

## 5 S0–S8 ↔ 现有七阶段：唯一映射

存储层保持 7 值 lifecycle enum 不变；S4–S6 用事实标记（assetization / liquidity / speculation markers）区分，不改 enum。映射**单向确定**，禁止双向重解释。

| 模型阶段 | 存储 enum | 判定标记 |
|---|---|---|
| S0 EVENT | —（仅事件日志，无叙事行） | event log |
| S1 SEED | SEED | 少数关键行为者 |
| S2 SPREAD | IGNITION | 传播速度突增 |
| S3 CONSENSUS | VERIFIED | 名称/关键词收敛 |
| S4 ASSETIZATION | ACCELERATION·early | 首个链上资产事实 |
| S5 LIQUIDITY | ACCELERATION·mid | 首个有效流动性池 |
| S6 SPECULATION | ACCELERATION·late | 机器人/聪明钱进入 |
| S7 CONSENSUS PEAK | CROWDING | 大众知晓 |
| S8 DECAY | DISTRIBUTION → DEAD | 注意力/资金衰退 |

**硬规则**：S4/S5/S6 **不是 lifecycle enum 的三个状态**，而是同一个 ACCELERATION 生命周期内的三个**事实派生标记**（assetization / liquidity / speculation 可审计事实锚点）。锚点一旦成立**只可追加，不可由模型推测回填**；`lifecycle` enum 仍是唯一持久化生命周期状态，`stage(Sn)` 是其上的只读派生视图。`lifecycle = ACCELERATION` 与 `stage = S5` 不允许被当作两个可自由互换的状态。

**作业窗口：S2–S6 内由 §15 实验裁定；S7+ 一律 BLOCKED（见 §17-v）。**

## 6–9 前瞻指标（预测层）

| 指标 | 定义 | V1 状态 | 冻结约束 |
|---|---|---|---|
| **EIS**（Event Impact **Vector**） | 向量 `{ attention, authority, consensusVelocity, assetizationProbability }`，各分量独立记录原始观测 | VECTOR-ONLY | 合成分（calibrated score，单调加权和）**只能**在 B4 校准后从向量导出并冻结权重；B4 前不存在合成总分，任何 UI/接口不得展示未校准的合成分。只排序候选，**永不授权进入** |
| **Consensus Velocity** | 核心行为者集合上的采用增速 d(采用)/dt | ON-CHAIN-PROXY | B1 起以同主题出生簇强度代理；斜率优先于绝对量 |
| **Authority** | 行为者「发言 → 后续成为共识」的历史命中率加权影响度 | EMPTY-BY-DESIGN | 从运行日志积累；**显式拒绝粉丝数排行**；每行为者未达 N 次校准观察前无信号 |
| **Assetization Probability** | P(叙事在视野 H 内获得 ≥1 可交易资产 \| 当前证据) | ON-CHAIN-PROXY | 链上出生簇强度为基线；社交信号只增不换 |

## 10–13 当下分数（判定层）

| 分数 | 回答 | 数据来源 | 约束 |
|---|---|---|---|
| **Market Score** | 最早可交易资产的市场质量（池深/储备轨迹/退出可行性） | 仅链上事实 | 复用 E-01（≥80% 计价腿、≤15% 冲击）/ E-03（点时簿） |
| **Money Score** | 钱进来了吗 | 链上 | related-wallets/实体聚类 + 早期买家集中度；限流 RPC 下持币事实可保持 UNKNOWN（fail-closed，不豁免） |
| **Entry Score** | 现在是否最佳窗口 | 合成 | **只是排序分，不是授权**；进入必须走版本化策略对象（改规则必升版本），默认 DRY_RUN |
| **Exit Score** | 是否应退出 | 合成 | 七类退出（TAKE_PROFIT/STOP_LOSS/TRAILING/TIMEOUT/LIQUIDITY_COLLAPSE/THESIS_BREAK/MARKET_INVALID）；TAKE_PROFIT/STOP/TRAILING 前置条件 = mark price 规则（从 curve/pool 储备比推导）；与 A 轨 ExitIntent 对象对接 |

门禁与分数**永不相加**（沿用既有纪律）：分数排序机会，门禁裁定安全。

## 14 Consensus-to-Asset Latency（市场择时情报）

时间锚点集冻结：`T_event → T_seed → T_name → T_first_token → T_first_pool → T_first_smart_money → T_mass → T_public`。

- V1 可观测锚（B3 前）：`T_first_token / T_first_pool / 流动性里程碑`——社交锚缺失时延迟按「最近可得锚对」记录并标注缺失。
- 按叙事类别积累延迟分布（政治≈分钟级、明星≈分钟级、科技≈小时级、技术创新≈天级）。
- 定性：**记录资产，不是性能声明**。不得用于回填式收益主张。

## 15 Time-to-Consensus Alpha（S2–S6 对照实验）

对每个拥有已验证可交易资产的叙事，维持 **S2 / S3 / S4 / S5 / S6 五个平行虚拟组合**，同规则退出。十项度量：

```text
扣费 PnL · 最大回撤 · 胜率 · 盈亏比 · 持仓时长 · 失败率 · 100x 尾部率 · 流动性风险事件率 · rug/流动性崩溃率 · Missed Upside（阶段机会落差）
```

实验必须同时回答两个问题：

- **Risk-adjusted return**：哪个阶段风险收益最好？
- **Opportunity capture**：哪个阶段能捕获最多的早期非对称收益？

Missed Upside 口径（单位由 B1 冻结）：每叙事记录各带入场标记与峰值标记；`capture = 带内组合终值 ÷ 同叙事峰值终值`（等额入场口径）；`Missed Upside = 1 − capture`，按带报告分布。

- 判据：作业窗口 = **风险收益优势带 ∩ 捕获率达标带**，二者缺一即窗口不成立。
- 反模式警告：不得以「晚带风险最低 / PnL 最高」单独裁定窗口——若其优势以放弃早带非对称收益为代价（Missed Upside 高），判定为**窗口错失**，不是窗口优选。
- 护栏一：**每带 N ≥ 30 个叙事之前，任何阶段带不得作出优势声明**（保持 NO-EVIDENCE）。
- 护栏二：本实验是**活体 DRY_RUN 队列对照，不是历史回测**——「M1-EVIDENCE 完成前回测器/优化器禁止」与「历史回填数据不得用于性能声明」两条规则不变、不因本实验松动。

## 16 Narrative 进入 Decision Core 的五项前置

1. 该叙事拥有 **≥1 项链上验证资产**（Assetization = 链上事实，fail-closed）；
2. 目标资产通过 **Market Truth**（既有 E 规则双腿）；
3. EIS / Entry Score **只排序**，任何情况下不单独构成进入授权；
4. 进入必须经**版本化策略对象**执行，默认 DRY_RUN（广播四锁不变：注册表 ENABLED + `STAR_MICRO_LIVE` + `STAR_JUPITER_EXECUTE` + `STAR_WALLET_KEYPAIR`，且适配器未接线前仍结构性拒绝）；
5. **只有社交信号、无链上资产的叙事，永远进不了 Decision Core**。

对应 `STAR_ROLES`：`discovery.CANDIDATE_ONLY / truth.VERIFY_FACTS / decision.decidesEntry=true / exit.decidesExit=true`。角色表与本节冲突时，以本节为准并升台账版本。

## 17 高分也必须 BLOCKED 的八种情形

| # | 情形 | 依据 |
|---|---|---|
| i | 资产未经链上验证（事实 UNKNOWN） | fail-closed，readiness=RESEARCH_REQUIRED/BLOCKED |
| ii | 退出不可能 / 流动性低于底线 | E-01 / E-03 双腿 |
| iii | 持币集中度或关联钱包 FAIL | 集中度 PASS 不替代关联钱包 FAIL（反回归测试在） |
| iv | rug 标记：mint/freeze 权限活着 | token-privilege 门禁 |
| v | 叙事阶段 ≥ S7（CROWDING+） | 超出作业窗口，**分数无效** |
| vi | 叙事的复制/仿冒资产 | 只有经验证的**最早载体**合格，其余 BLOCKED |
| vii | 决策路径含未 ENABLED 数据源 | 注册表无运行时旁路，信号整体不可用 |
| viii | 使用 B4 前的 EIS **合成分**（向量的原始观测照常记录） | 合成分视为缺失——不是高分也不是低分 |

## 18 四雷达 × 传感器 × 里程碑

| 雷达 | 回答 | V1 传感器 | 接入 |
|---|---|---|---|
| World Radar | 发生了什么？ | 无（Event 定义已冻结，日志先行） | B3+ |
| Consensus Radar | 什么正在成为共识？ | 无（Authority 空、斜率未校准） | B3+ |
| Asset Radar | 共识开始资产化了吗？ | **Solana Adapter（U-01-SOLANA）**：pump.fun / Raydium 出生簇 | B1–B2 |
| Money Radar | 钱进来了吗？ | 部分：链上钱包事实（限流下可 UNKNOWN） | 随 A 轨 |

Asset Radar 为 **Core + Adapter** 结构：Core 与链无关，当前唯一适配器 Solana；BNB/BTC/Base/TON 不接（边界改写须显式治理动作）。
**Ave.ai 属于 Discovery/Intel Adapter，永不属于 Truth Adapter**：其任何候选、排名、风险标签、Smart Money 标签均**不得直接构成 Market Fact**——只能触发链上验证（注册表 `LEGAL_REVIEW`，`decidesEntry: false`）。「Ave 标签 → Market PASS → Entry」为被禁止路径。

## 19 不变清单（本模型不改写）

fail-closed 六门禁 · DRY_RUN 默认 · 无钱包模块、私钥不入库 · 来源注册表无运行时旁路 · 门禁与分数不相加 · 研究六页维持观察壳 · 策略版本纪律 · 回测禁令（§15 护栏二口径）。

---

## 签署

```text
裁决        APPROVE — FROZEN-rev1
主理人签署  2026-09-05（会话指令原文：「签。…APPROVE — FROZEN-rev1」）
入库哈希    7143ec60498795016613b13c91d68e7c44a3e106（模型冻结提交 7143ec6；M0.1 纪律：签署记录挂提交哈希）
生效        自本行起状态 = FROZEN-rev1；此后 B1+ 传感器逐层接入，接入不改模型。
运行时姿态  READ-ONLY · NO-WALLET · M5-UNAUTHORIZED 保持不变，直到对应治理动作发生。
修改规则    修改本模型任何一节 = 升 rev 并重新签署；冻结原则不再讨论。
```
