# STAR — Signal · Truth · Alpha · Risk

新叙事早期资产阻击引擎。抓的是「热点正在变成资产」的连接，不是涨幅榜。  
Core 与链、叙事、具体市场无关；运行实例只有 `U-01-SOLANA`。研究页不是主线。

**方向**：`docs/alpha/DIRECTION.md`。能力以 `docs/alpha/CAPABILITY-LEDGER.md` 与 `GET /api/capability` 为准。

**运行时边界**：夹具自动循环 · 默认 `DRY_RUN` · 无钱包模块 · 无广播。`STAR_MICRO_LIVE=1` 且本机配置钱包才谈广播；适配器尚未接线。私钥不得入库。

## 产品口径（能力对齐：纸面 ≠ 运行时）

```text
台账              star-capability@6
方向              EARLY-MARKET-RESPONSE
模型              EVENT-NARRATIVE-ASSET-MARKET-MONEY
宇宙              U-01 / U-01-SOLANA
组合              v1-convex
赚钱能力          NO-EVIDENCE
研究台            SHELL-ONLY
策略              snipe-value-meme@v0（自动执行）
执行默认          DRY_RUN
循环              process-interval
M0-MEASUREMENT    FROZEN rev1
M0-BOUNDARY       FROZEN rev2
资金运行时        DENIED（无广播）
P1                NO-GO
```

夹具循环跑通、页面能显示成交，只证明策略对象会自动开平仓，不证明存在 Alpha。  
回测器与策略优化器在 M1-EVIDENCE 完成前禁止。

说明：网络冒烟中的买卖报价仅证明**报价端点可响应**，不证明模拟与真实路由一致、指定规模可成交、拥堵/失败概率/费用准确，也不代表数据来源已获准使用。持币事实在公共 RPC 限流下不可得（fail-closed → 门禁 UNKNOWN），实体调整集中度未实现。PGlite 的运行时绝对路径加载是**环境修复而非稳定架构**，已登记为部署债务（`docs/verification/VERIFICATION.md`）。

## 架构

产品主路径（夹具 DRY_RUN）：

```text
fixture births/books ──snipe-v0──▶ lockDecisionIntent ──execute──▶ 组合账户
        │                         process-interval / GET /api/snipe
        └─ 六门禁不参与入场
```

观察壳仍走研究路径（不是 Alpha）：

```text
ReadonlyChainProvider ──assertFact──▶ evidence + D1 账本（attempt/receipt/fact）
        │  fixture（唯一 ENABLED）            │
        │  solana-rpc（被注册表阻断）          ▼
        └─ collect.ts                   lib/domain（门禁/时态/叙事/生命周期）
                                            ▼
                         HISTORICAL 冻结上下文 │ REINTERPRET 标记当前工件
                                            ▼
                                    lib/engine.ts 六门禁（fail-closed）
                                            ▼
                                 score（仅六门禁全 PASS 时产生）
```

- **数据契约** `lib/data/contract.ts` — `solana-readonly@3`：七类事实 + `graphIngested`；每个事实带 `observedAt` / `slot` / `source`。
- **时态内核** `lib/domain/temporal.ts` — 时点截止、确定性平局（observedAt→ingestedAt→id）。引擎与回放共用，未来数据泄漏被结构性禁止；违反时态不变式的证据被隔离。
- **六项强制门禁** `lib/engine.ts` — 代币权限 / 买卖模拟（双腿必需）/ 流动性与退出 / 持币集中度 / **关联钱包（独立门禁，集中度 PASS 不能替代）** / 程序验证。任何 FAIL 或 UNKNOWN 都阻断评分（fail-closed）。
- **来源注册表** `lib/data/source-registry.ts` — 代码级镜像许可证矩阵；真实 RPC/Jupiter/DexScreener 全部阻断。冒烟入口不在生产图。
- **存储** — 浏览器 PGlite(`idb://star`) + 服务端 PGlite(`.pglite/`)，同一份 `public/init.sql` 建表、同一份时间线夹具。

## 门禁与分数的关系

门禁是硬安全判断，分数是机会判断，**二者永不相加**：六门禁任一非 PASS，`score = null`、readiness 进入 `BLOCKED`（有 FAIL）或 `RESEARCH_REQUIRED`（有 UNKNOWN）。

## 本地运行

软件与运维边界（部署前须知）：
- 写限流（`STAR_WRITE_RATE_LIMIT`）为**单进程内存**上限。横向扩展（>1 实例）前必须改用共享存储（Redis/DB），否则每实例上限可被倍数绕过。
- P1 真正接入真实数据源前，需在许可证矩阵中将其从 BLOCKED/LEGAL_REVIEW 变更为 ENABLED（`lib/data/source-registry.ts` 为代码级镜像，无运行时覆盖）。

```bash
npm run dev            # http://localhost:3000（浏览器自动建表并灌入夹具）
npm run typecheck      # tsc --noEmit
npm test               # vitest（不含真实网络）
STAR_SMOKE=1 npm run test:smoke   # 真实主网只读冒烟（需工程覆盖，见下）
npm run build && npm start
# 内部只读单机形态见 docs/deploy/SINGLE_NODE.md
```

服务端 API：

```bash
curl localhost:3000/api/collect                            # 来源状态（不含 RPC URL）
# 生产默认 403。生产要写必须同时设 STAR_ALLOW_WRITE=1 与 STAR_WRITE_TOKEN；缺 token 仍 403。
curl -X POST localhost:3000/api/seed
curl -X POST localhost:3000/api/collect -d '{"projectId":"proj-neural"}'
curl -X POST localhost:3000/api/collect -d '{"provider":"solana-rpc"}'   # → 403（DATA-006）
curl localhost:3000/api/health                                # liveness（commit/schema/时间，无秘密）
curl localhost:3000/api/capability                            # 纸面 vs 运行时能力（只读）
curl localhost:3000/api/snipe                                 # 自动阻击循环快照（默认 DRY_RUN）
```

真实只读冒烟（工程验证用途；冒烟入口仅存在于测试模块图，不在生产构建中）：

```bash
STAR_SMOKE=1 npx vitest run lib/data/rpc-smoke.test.ts
```

注意：公共主网对 `getTokenLargestAccounts` 有按调用限流（"Too many requests for a specific RPC call"），持币分布事实因此可能缺失——按 fail-closed 设计，对应门禁保持 UNKNOWN，直到按矩阵选定正式 RPC 提供商。

## 页面

- `/` 阻击台 — 策略自动循环、组合记账与成交（夹具 DRY_RUN；不加载研究库）
- `/cycle-radar` 周期雷达 — 叙事迁移（合成）
- `/narrative-map` 叙事地图 — 叙事速度/广度/链上确认
- `/project/[id]` 项目审计 — 六门禁、未知责任链、证据与评分
- `/risk-center` 风险中心 — 未通过/未知开放风险
- `/replay-lab` 回放实验室 — 历史冻结 / 重新解释 + 证据哈希溯源

## 文档

- [架构：Core ≠ 链](docs/alpha/ARCHITECTURE.md)
- [能力台账](docs/alpha/CAPABILITY-LEDGER.md)（纸面 vs 运行时，单一真相）
- [赚钱能力合同 rev1](docs/alpha/STAR-MONEY-CAPABILITY-CONTRACT.md)（M0-MEASUREMENT = FROZEN）
- [M0.1 签署工作单](docs/alpha/M0.1-ACCEPTANCE-WORKSHEET.md)（22 ACCEPT）
- [M0.2 边界改写](docs/alpha/M0.2-REWRITE-WORKSHEET.md)（rev2 ACCEPTED；本轮不开工 M5）
- [M0.1 五章终审](docs/alpha/M0.1-FINAL-REVIEW.md)（签署前记录，不可回改）
- [产品定义 v1.0](docs/product/README.md)（docx SHA-256 为准）
- [P0-DATA 基线](docs/p0-data/BASELINE.md)
- [数据源与许可证矩阵](docs/p0-data/SOURCE_LICENSE_MATRIX.md)
- [领域模型 ERD](docs/p0-data/DOMAIN_ERD.md)
- [Solana 50+100 历史样本规范](docs/p0-data/HISTORICAL_SAMPLE_SPEC.md)
- [P1 验收目录](docs/p0-data/P1_ACCEPTANCE.md)

## P1 之前的硬性规则

1. 默认不广播、不接钱包。自动交易只在 DRY_RUN 执行。不做 BNB Chain。私钥不得入库。
2. 真实数据源接入前必须先在许可证矩阵中变更为 ENABLED。
3. 历史语料保持 NO-EVIDENCE，不得用回填数据做性能声明。
