# STAR-P0-CONSOLIDATION 评审包

Status: **DRAFT_AWAITING_REVIEW**  
Date: 2026-09-02  
Product truth: 《STAR Product Definition v1.0》  
This file is the first deliverable. No feature work proceeds until the rulings below are frozen.

```text
P1                     = NO-GO
MUST HAVE              ≈ 36%
ACTIVE IMPLEMENTATIONS = 2（阻断）
REAL DATA              = NO-EVIDENCE
HISTORICAL CORPUS      = NO-EVIDENCE
NEW UI WORK            = HOLD
REAL SOURCE ADAPTER    = HOLD
IMPLEMENTATION         = HOLD
```

Even if this round later PASSes:

```text
P0 CONTRACT CONSOLIDATION = PASS
P1                         = NO-GO
```

---

## 1. 单一基线迁移表

| 对象 | `star/` | `star-web` | 建议最终真源 | 建议处理 | 待裁定 |
|---|---|---|---|---|---|
| 产品定义 | `docs/product/*.docx` SHA-256 `9634c819…` | `docs/product/*.md`（另一份） | 《STAR Product Definition v1.0》docx | 只保留一份哈希可核的原件；md 标为摘录或删除 | D0 |
| 运行应用 | 无 UI | Next 14 四页壳 | `star-web` | 保持唯一运行时 | 已冻结 |
| 领域内核位置 | `src/domain/*`（interpret + evaluateGatesAt + temporal） | `lib/domain/*`（types + temporal 适配层）+ `lib/engine.ts` 调用 `star/` | `star-web/lib/domain` | 把 `star/` 解释/聚合/点时迁入后停止 `star/` 开发并归档 | 已冻结路径；迁移动作等表过审 |
| Evidence / 观察契约 | `EvidenceRecord` snake + `CONTRACT_VERSION` 现为 `@2` + `GATE_KEYS` 大写 | `ChainFact` kebab + `solana-readonly@2`；库表 `evidence.type` 已是 kebab | 观察层：`star-web/lib/data/contract.ts` `@2`；证据层：`star-web/lib/domain` kebab | 保留 `@2` kebab 为持久化真源；`EvidenceRecord` 删除 | D2 |
| FactKind | `TOKEN_AUTHORITY` 等 6 个 SCREAMING | kebab 7 个（mint/freeze 拆开） | PRD 语义 + kebab 持久化 | 单向别名：PRD 名只出现在文档/别名表，不入库 | D3 |
| Temporal | `validateEvidenceRow` / ISO / 1s skew / fact_kind 校验 / Date | ISO 字符串比较；无 skew 校验；无 fact_kind 校验 | 一份：`star-web/lib/domain/temporal.ts` | 吸收 `star/` 的校验后删除 `star/src/domain/temporal.ts` | D4 |
| 六门禁引擎 | `interpretCheck` + `evaluateGatesAt` + `evaluateChecksAt` | `engine.ts` 再调上述函数，且本地再算一遍 checks 展示 | 一份：`star-web/lib/domain/{interpret,gates}.ts` | UI / engine 禁止重算；`engine.ts` 只做 I/O | D5 |
| 门禁键名 | `TOKEN_PERMISSIONS`… | `token-permissions` / `tradability` / `concentration`… | kebab（已写入 gates 表） | PRD 大写仅作别名 | D3 |
| Sprint 文档 | `docs/p0-data/*` + `tests/acceptance` | `docs/sprint-01/*`（指向 star）+ 本目录 | `star-web/docs/p0-data/` | 合并后标版本；删除 sprint-01 副本；`star/docs` 随包归档 | D1 |
| 合成夹具 | `src/fixtures/synthetic.ts`（已盖章 status） | `lib/data/star-fixture.ts`（payload 时间线） | `star-web/lib/data/star-fixture.ts` | `star/` 夹具随包归档，不平行维护 | — |
| 构建逃逸 | 无 Next | `ignoreBuildErrors` + `ignoreDuringBuilds` + `externalDir` + `star/domain` alias | 无逃逸 | 内核迁入后删除三项逃逸 | 验收项 |

当前阻断：`star-web/lib/engine.ts` 同时走 `star-web` temporal 与 `star/` `evaluateChecksAt`。同一请求两套点时过滤。这就是 `ACTIVE IMPLEMENTATIONS = 2`。

---

## 2. 删除 / 归档清单（过审后执行，现在不删）

| 路径 | 动作 | 前提 |
|---|---|---|
| `star/src/domain/interpret.ts` `thresholds.ts` `gates.ts` `fromChecks.ts` `temporal.ts` `types.ts` `index.ts` | 迁入 `star-web/lib/domain/` 后归档 | 测试迁完且 TYPECHECK PASS |
| `star/src/fixtures/synthetic.ts` | 归档 | star-web 夹具已覆盖时间线断言 |
| `star/tests/domain/*` | 迁入 `star-web/lib/domain/*.test.ts` 或 `star-web/lib/engine` 兼容套件后归档 | 兼容测试绿 |
| `star/docs/p0-data/*` `star/tests/acceptance` `star/docs/product/*` | 评审后并入 `star-web/docs/p0-data/` 与 `star-web/docs/product/` | D0 D1 |
| `star/README.md` `star/vitest.config.ts` `star/tsconfig.json` | 改为 ARCHIVED 指针或整目录归档 | 内核已不从 star-web import |
| `star-web/docs/sprint-01/*` | 删除（内容已并入唯一目录） | 唯一目录过审 |
| `star-web/next.config.js` `externalDir` / `star/domain` alias | 删除 | 不再跨包 import |
| `star-web/vitest.config.ts` / `tsconfig.json` 的 `star/domain` | 删除 | 同上 |
| `star-web/vitest.star-kernel.config.ts` | 删除或改为指向迁入后的测试 | 测试迁完 |
| `p0-data-snapshot/` | 保持忽略（空骨架） | — |

禁止：在迁移完成前删除 `star/`。禁止再新增第三套 contract / temporal / gate。

---

## 3. 六门禁输入—判定—UNKNOWN 矩阵

对照本轮指令第二节。`当前` = 2026-09-02 仓库实装（`star/src/domain/interpret.ts` + 夹具）。`本轮验收` = 你列出的四个 UNKNOWN 条件。`指令全文` = 第二节完整质量，默认不进本轮，除非 D6 = 扩合同。

| 门禁 | 输入（现有 payload） | 当前 PASS | 当前 FAIL | 当前 UNKNOWN | 对照本轮验收 | 对照指令全文 |
|---|---|---|---|---|---|---|
| TOKEN_PERMISSIONS | mint/freeze/hook/delegate/fee/`token2022Extensions` | 特权全空且 `token2022Extensions === []` | 任一已知特权非空 | `token2022Extensions == null` 且无已知特权 | TOKEN2022_UNPARSED = UNKNOWN：**已满足** | Default Account State / Non-transferable 等未单列；未进 `@2` 字段 |
| BUY_SELL_SIMULATION | sell `executable` + `buy` | 两腿均可执行 | 任一腿 `executable === false` | 缺 buy 腿 | 未单列本轮验收 | 有路由；无指定研究规模/费用拆分 |
| LIQUIDITY_EXIT | TVL、pools.lock/burn、`exitDepthUsd` | TVL≥150k 且 lock/burn 且 depth>0 | TVL 过低 | TVL 缺、lock 未证、depth 缺或 ≤0 | NO_EXIT_DEPTH = UNKNOWN：**已满足** | 缺池控制权、可用路由、冲击/费用、单侧抽走、新鲜度 SLA |
| HOLDER_CONCENTRATION | `top10Pct`（特征）、`top10PctEntityAdjusted` | 实体调整 ≤35% | 实体调整 >35% | 实体调整缺失 | HOLDER_NO_ENTITY = UNKNOWN：**已满足** | 地址层 Top10 已禁止 PASS |
| ASSOCIATED_WALLETS | `clusterPct` + 标注钱包列表 | clusterPct ≤25% | clusterPct >25% | `clusterPct` 非数字 | WALLET_GRAPH_MISSING = UNKNOWN：**未满足**。夹具可仅凭 clusterPct PASS | 缺部署者/建池/共同资金/早期钱包/内部转账/实体图独立检查 |
| PROGRAM_VERIFICATION | verifiedBuild / immutable / upgradeAuthority | 已验证或不可升级 | 可升级且未验证 | 不可证 | 未单列本轮验收 | 无构建谱系 |

聚合（已满足 FAIL_OR_UNKNOWN_SCORE = NULL）：任一 FAIL → 聚合 FAIL；否则任一 UNKNOWN → UNKNOWN；仅六门 PASS 才允许分数；否则 `score = null`。

缺口裁定：

- 若本轮必须 `WALLET_GRAPH_MISSING = UNKNOWN`，需要观察合同加法字段（建议 `solana-readonly@3`），否则夹具继续用 clusterPct 冒充图。
- 指令第二节流动性/扩展全表超出本轮四个 UNKNOWN 验收，建议单独立项，不塞进迁移。

---

## 4–6. 证据状态（本包）

| # | 材料 | 状态 |
|---|---|---|
| 1 | 单一基线迁移表 | **本文件 §1** |
| 2 | 删除/归档清单 | **本文件 §2** |
| 3 | 六门禁矩阵 | **本文件 §3** |
| 4 | 新旧契约兼容性测试 | **HOLD** — 表未过审，禁止写兼容套件 |
| 5 | 全量 typecheck / 测试日志 | **HOLD** |
| 6 | Git 固定 commit + 干净工作区 | **HOLD** — 未获准提交 |

---

## 待你冻结的裁定

回复编号即可（例：`D0-D5 YES；D6 MOVE_ONLY；D7 @3`）。

| ID | 问题 | 建议 |
|---|---|---|
| D0 | 产品原件以 docx 哈希为准，还是以 star-web md 为准？ | docx SHA-256 `9634c819b3662b10d6bbcf844c499141baa252ef71976a9f6e3453f348da88d5` |
| D1 | 唯一文档目录？ | `star-web/docs/p0-data/` + `star-web/docs/product/` |
| D2 | 持久化观察契约？ | 保留 `solana-readonly@2` kebab `ChainFact` |
| D3 | 门禁/检查键？ | kebab 入库；PRD SCREAMING 仅别名 |
| D4 | 唯一 temporal？ | `star-web/lib/domain/temporal.ts` 吸收 ISO/skew/映射校验 |
| D5 | 唯一 gate engine？ | `interpretCheck` + `evaluateGatesAt` 迁入 `star-web/lib/domain`；`engine.ts` 只 I/O |
| D6 | 本轮范围？ | **MOVE_ONLY**：迁内核、并文档、去 `ignoreBuildErrors`、锁定已有三个 UNKNOWN。质量扩表另开一轮 |
| D7 | `WALLET_GRAPH_MISSING` 本轮是否强制？ | 若 YES：必须 `@3` + 夹具 `graphResolved`；若 NO：本轮验收删该条或标 DEFERRED |

未收到 D0–D7 冻结前：**不迁代码、不删 `star/`、不接真源、不加页、不提交。**
