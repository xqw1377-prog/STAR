# STAR — Signal · Truth · Alpha · Risk

链上早期机会情报与项目审计系统（Solana 优先，只读研究）。本仓库是 STAR 的 Web 工作台：机会队列、叙事雷达、项目审计与时间点回放。

**基线状态**：`BASELINE-CANDIDATE`（已固定提交，见 `docs/verification/VERIFICATION.md`）。`star/`（沙箱参考实现）冻结为只读参考。

**边界（冻结决策）**：只读 · 不连接钱包 · 不自动交易。任何页面与 API 都不包含签名、私钥或广播能力。

## 产品口径（评审裁定）

```text
Six-gate structure       = PASS
Synthetic vertical slice = PASS
Point-in-time replay     = PASS on fixtures
Read-only network smoke  = PASS-WITH-DEGRADATION
Holder source            = BLOCKED
Entity resolution        = NOT IMPLEMENTED
Exit simulation          = PARTIAL
Source licensing         = HOLD
Historical 50+100        = NO-EVIDENCE
P1                       = NO-GO
```

说明：网络冒烟中的买卖报价仅证明**报价端点可响应**，不证明模拟与真实路由一致、指定规模可成交、拥堵/失败概率/费用准确，也不代表数据来源已获准使用。持币事实在公共 RPC 限流下不可得（fail-closed → 门禁 UNKNOWN），实体调整集中度未实现。PGlite 的运行时绝对路径加载是**环境修复而非稳定架构**，已登记为部署债务（`docs/verification/VERIFICATION.md`）。

## 架构

```text
ReadonlyChainProvider ──assertFact──▶ evidence(observed/effective/ingested)
        │  fixture（唯一 ENABLED）            │
        │  solana-rpc（被注册表阻断）          ▼
        └─ collect.ts                   lib/domain/temporal.ts（泄漏守卫）
                                            ▼
                                    lib/engine.ts 六门禁（fail-closed）
                                            ▼
                                 score（仅六门禁全 PASS 时产生）
```

- **数据契约** `lib/data/contract.ts` — `solana-readonly@2`：七类事实（mint/freeze 权限、持币分布、流动性、买卖模拟、关联钱包、程序验证），每个事实带 `observedAt` / `slot` / `source`。
- **时态内核** `lib/domain/temporal.ts` — 时点截止、确定性平局（observedAt→ingestedAt→id）。引擎与回放共用，未来数据泄漏被结构性禁止；违反时态不变式的证据被隔离。
- **六项强制门禁** `lib/engine.ts` — 代币权限 / 买卖模拟（双腿必需）/ 流动性与退出 / 持币集中度 / **关联钱包（独立门禁，集中度 PASS 不能替代）** / 程序验证。任何 FAIL 或 UNKNOWN 都阻断评分（fail-closed）。
- **来源注册表** `lib/data/source-registry.ts` — 代码级镜像许可证矩阵；真实 RPC/Jupiter/DexScreener 全部阻断，`STAR_ENGINEERING_OVERRIDE=1` 仅供工程冒烟。
- **存储** — 浏览器 PGlite(`idb://star`) + 服务端 PGlite(`.pglite/`)，同一份 `public/init.sql` 建表、同一份时间线夹具。

## 门禁与分数的关系

门禁是硬安全判断，分数是机会判断，**二者永不相加**：六门禁任一非 PASS，`score = null`、readiness 进入 `BLOCKED`（有 FAIL）或 `RESEARCH_REQUIRED`（有 UNKNOWN）。

## 本地运行

```bash
npm run dev            # http://localhost:3000（浏览器自动建表并灌入夹具）
npm run typecheck      # tsc --noEmit
npm test               # vitest（46 项，不含真实网络）
STAR_SMOKE=1 npm run test:smoke   # 真实主网只读冒烟（需工程覆盖，见下）
npm run build && npm start
```

服务端 API：

```bash
curl -X POST localhost:3000/api/seed                       # 灌入时间线夹具并全量评估
curl localhost:3000/api/collect                            # 来源注册表状态
curl -X POST localhost:3000/api/collect -d '{"projectId":"proj-neural"}'
curl -X POST localhost:3000/api/collect -d '{"provider":"solana-rpc"}'   # → 403（DATA-006）
```

真实只读冒烟（工程验证用途；冒烟入口仅存在于测试模块图，不在生产构建中）：

```bash
STAR_SMOKE=1 npx vitest run lib/data/rpc-smoke.test.ts
```

注意：公共主网对 `getTokenLargestAccounts` 有按调用限流（"Too many requests for a specific RPC call"），持币分布事实因此可能缺失——按 fail-closed 设计，对应门禁保持 UNKNOWN，直到按矩阵选定正式 RPC 提供商。

## 页面

- `/` STAR Desk — 机会队列（仅全 PASS 项目）与风险队列
- `/narrative-map` Narrative Radar — 叙事速度/广度/链上确认
- `/project/[id]` Project Audit — 六门禁、证据与评分
- `/replay-lab` Replay Lab — 任意时点重放（展示时点后被隐藏的证据数）

## 文档

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
