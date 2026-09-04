# STAR — Signal · Truth · Alpha · Risk

链上早期机会情报与项目审计系统（Solana 优先，只读研究）。本仓库是 STAR 的 Web 工作台：机会队列、叙事雷达、项目审计与时间点回放。

**基线状态**：`BASELINE-CANDIDATE`（已固定提交，见 `docs/verification/VERIFICATION.md`）。`star/`（沙箱参考实现）冻结为只读参考。

**边界（冻结决策）**：只读 · 不连接钱包 · 不自动交易。任何页面与 API 都不包含签名、私钥或广播能力。

## 产品口径（2026-09-04 收紧；覆盖「能力已经对齐」）

```text
STAR 研究基础设施 = 部分实现
STAR 赚钱能力     = NO-EVIDENCE
M0-OBJECTIVE      = FROZEN
M0-MEASUREMENT    = HOLD / UNSIGNED
M1 / M2           = NOT STARTED
M3 / M4           = DENIED
M5 / M6           = DENIED
资金权限          = DENIED
P1                = NO-GO
```

六门禁、分数、页面、单测通过，只证明研究工具可运行，不证明存在 Alpha。  
测量合同见 `docs/alpha/STAR-MONEY-CAPABILITY-CONTRACT.md`。终审见 `docs/alpha/M0.1-FINAL-REVIEW.md`。  
M0 rev1 未签署前，不开发 M1 Recorder、回测器或策略优化器。

说明：网络冒烟中的买卖报价仅证明**报价端点可响应**，不证明模拟与真实路由一致、指定规模可成交、拥堵/失败概率/费用准确，也不代表数据来源已获准使用。持币事实在公共 RPC 限流下不可得（fail-closed → 门禁 UNKNOWN），实体调整集中度未实现。PGlite 的运行时绝对路径加载是**环境修复而非稳定架构**，已登记为部署债务（`docs/verification/VERIFICATION.md`）。

## 架构

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

```bash
npm run dev            # http://localhost:3000（浏览器自动建表并灌入夹具）
npm run typecheck      # tsc --noEmit
npm test               # vitest（不含真实网络）
STAR_SMOKE=1 npm run test:smoke   # 真实主网只读冒烟（需工程覆盖，见下）
npm run build && npm start
```

服务端 API：

```bash
curl localhost:3000/api/collect                            # 来源状态（不含 RPC URL）
# 生产默认 403。本地可设 STAR_WRITE_TOKEN 后带 Bearer。
curl -X POST localhost:3000/api/seed
curl -X POST localhost:3000/api/collect -d '{"projectId":"proj-neural"}'
curl -X POST localhost:3000/api/collect -d '{"provider":"solana-rpc"}'   # → 403（DATA-006）
curl localhost:3000/api/health                                # liveness（commit/schema/时间，无秘密）
```

真实只读冒烟（工程验证用途；冒烟入口仅存在于测试模块图，不在生产构建中）：

```bash
STAR_SMOKE=1 npx vitest run lib/data/rpc-smoke.test.ts
```

注意：公共主网对 `getTokenLargestAccounts` 有按调用限流（"Too many requests for a specific RPC call"），持币分布事实因此可能缺失——按 fail-closed 设计，对应门禁保持 UNKNOWN，直到按矩阵选定正式 RPC 提供商。

## 页面

- `/` 研究台 — 仅就绪度=可决策的研究队列与风险队列
- `/cycle-radar` 周期雷达 — 叙事迁移（合成）
- `/narrative-map` 叙事地图 — 叙事速度/广度/链上确认
- `/project/[id]` 项目审计 — 六门禁、未知责任链、证据与评分
- `/risk-center` 风险中心 — 未通过/未知开放风险
- `/replay-lab` 回放实验室 — 历史冻结 / 重新解释 + 证据哈希溯源

## 文档

- [赚钱能力合同 rev0](docs/alpha/STAR-MONEY-CAPABILITY-CONTRACT.md)（M0-MEASUREMENT = HOLD / UNSIGNED）
- [M0.1 签署工作单](docs/alpha/M0.1-ACCEPTANCE-WORKSHEET.md)（22 项裁定列为空）
- [M0.2 边界改写提案](docs/alpha/M0.2-REWRITE-WORKSHEET.md)（UNSIGNED，不构成签署）
- [M0.1 五章终审](docs/alpha/M0.1-FINAL-REVIEW.md)（待签确定值已写齐，未接受不得签 rev1）
- [产品定义 v1.0](docs/product/README.md)（docx SHA-256 为准）
- [P0-DATA 基线](docs/p0-data/BASELINE.md)
- [数据源与许可证矩阵](docs/p0-data/SOURCE_LICENSE_MATRIX.md)
- [领域模型 ERD](docs/p0-data/DOMAIN_ERD.md)
- [Solana 50+100 历史样本规范](docs/p0-data/HISTORICAL_SAMPLE_SPEC.md)
- [P1 验收目录](docs/p0-data/P1_ACCEPTANCE.md)

## P1 之前的硬性规则

1. 不接钱包、不做交易、不做 BNB Chain（按冻结决策）。
2. 真实数据源接入前必须先在许可证矩阵中变更为 ENABLED。
3. 历史语料保持 NO-EVIDENCE，不得用回填数据做性能声明。
