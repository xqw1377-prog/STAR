# STAR-WEB BASELINE-CANDIDATE 冻结清单（Fixed Candidate Freeze Manifest）

日期：2026-09-03 · 状态：`BASELINE-CANDIDATE`（等待独立复验后归档 `star/`）

本文件按评审裁定的 10 项冻结交付物组织。固定 commit hash 见 `git rev-parse HEAD`（本清单入库后立即提交，提交即候选版本；清单本身不影响任何构建产物）。

## 1–2. 固定提交与工作区状态

- 候选提交：本清单提交后的 `git log -1 --format=%H`（见交付报告）。
- 提交后 `git status --short` 必须为空；不为空即存在外部写入，冻结失效。

## 3. 环境版本

| 项 | 值 |
|---|---|
| Node | v22.22.0 |
| npm | 10.9.4 |
| OS | macOS 26.3（darwin arm64） |
| Playwright | 1.62.1 |
| Chromium（e2e 实际使用） | chromium_headless_shell-1234（Chrome Headless Shell 151.0.7922.34） |

## 4–5. 哈希（SHA-256，前 16 位；完整值以 `shasum -a 256` 现算为准）

| 文件 | 哈希前缀 |
|---|---|
| `package-lock.json` | ca18fc7608dd32a5 |
| `docs/product/STAR_Product_Definition_v1.0.docx`（产品原件） | 9634c819b3662b10（见 `docs/p0-data/DATA_CONTRACT.md` 记录的完整值） |
| `docs/product/STAR_Product_Definition_v1.0.md`（阅读副本） | 908eb7d683589fe9 |
| `lib/data/contract.ts`（solana-readonly@2 实现） | 076a5f455a3cd8fd |

治理文档（`docs/p0-data/`：DATA_CONTRACT / SOURCE_LICENSE_MATRIX / DOMAIN_ERD / HISTORICAL_SAMPLE_SPEC / P1_ACCEPTANCE / BASELINE）随本提交一并冻结，其哈希以提交对象为准（`git ls-tree HEAD docs/p0-data/`）。

## 6. 全新目录 `npm ci` 复验

源：候选工作树 rsync（排除 node_modules/.next/.pglite/.git/测试产物）→ `/tmp/star-freeze`。

| 步骤 | 结果 | 日志 |
|---|---|---|
| npm ci | PASS | `fresh-verify/verify-npmci.log` |
| tsc --noEmit | PASS | `fresh-verify/verify-typecheck.log` |
| vitest run | 72 passed / 6 skipped（skip=真实网络冒烟，注册表阻断） | `fresh-verify/verify-unit.log` |
| next build | PASS（lint+type 全开，无 ignoreBuildErrors） | `fresh-verify/verify-build.log` |
| playwright e2e | 6/6 PASS | `fresh-verify/verify-e2e.log` |

## 7. 主树原始日志

`typecheck.log` / `unit.log` / `build.log` / `e2e.log` / `override-isolation.log`（本目录）。
e2e 含：四页面渲染 + SYNTHETIC FIXTURE DATA 标注（SAFE-004）、STAR Desk 水合队列、Replay Lab 时点回放（验证"时点后被隐藏"证据计数）。

## 8. `star/` 与 `star-web` 语义对照

`diff -r star/src/domain star-web/lib/domain`：

| 文件 | 对照结论 |
|---|---|
| temporal.ts | 语义一致（时点截止、确定性平局 observedAt→ingestedAt→id）；star-web 版增加内核类型导出适配 |
| types.ts | 语义一致：六 kebab gateKeys + 七 kebab checkKeys、PRD_GATE_ALIAS 仅展示、Evidence/CheckKey/GateAssessment 同构 |
| gates.ts / interpret.ts | star-web 版为适配 star-web 证据行（snake_case GateRecord）的实现，聚合规则一致（FAIL>UNKNOWN>PASS，fail-closed） |
| synthetic-checks.ts、gates/interpret/temporal 测试 | star-web 独有：时间线夹具 + 防回归（A-07）+ 点时泄漏测试 |
| fromChecks.ts（star/ 独有） | star/ 的检查项构造器；star-web 由 `lib/engine.ts` I/O 适配层承担同等职责 |

引擎侧：`star-web/lib/engine.ts` 是纯 I/O 适配器（读库→内核→落库），解释/聚合全部在 `lib/domain`——与 `star/` 的"领域内核无 I/O"结构一致。运行时无任何 `star/` 导入（`lib/domain/no-star-import.test.ts` 强制为零）。

## 9. Engineering Override 生产隔离证明

- 运行时代码不存在任何环境变量旁路：`source-registry.ts` 无 override 分支；`solana-rpc.ts`（应用图唯一入口）无条件 `assertSourceEnabled('solana-rpc')`。
- 冒烟入口 `solana-rpc-smoke.ts` 仅被 `rpc-smoke.test.ts`（vitest 图）导入，不出现在任何 app/runtime 模块图。
- 诱饵测试：设置 `STAR_ENGINEERING_OVERRIDE=1` 后受保护工厂仍抛错（`rpc-smoke.test.ts` 第一组）。
- 构建产物证明：`override-isolation.log`——`.next` 内 `SMOKE_ONLY_MARKER` / `ForEngineeringSmoke` / `STAR_ENGINEERING_OVERRIDE` 三项 grep 均为 **0**。
- `/api/collect` 对未授权 provider 返回 403 并引用矩阵文档。

## 10. 真实网络调用清单（全部位于测试专用 `solana-rpc-core.ts`，生产不可达）

| 域名 | 方法/路径 | 读取字段 | 用途 | 保存内容 |
|---|---|---|---|---|
| `api.mainnet-beta.solana.com`（或 `STAR_RPC_URL`） | JSON-RPC POST: getAccountInfo / getTokenSupply / getTokenLargestAccounts / getMultipleAccounts / getSlot | mint 权限、供应量、最大持币账户、程序账户字节、slot | 铸/冻权限、持币分布、程序验证 | 通过采集器时仅写 evidence 行（type/payload/observedAt/slot/source）；原始响应不落盘（P1-02 幂等仓未建） |
| `api.dexscreener.com` | GET /latest/dex/tokens/{mint} | pairAddress、dexId、baseToken/quoteToken、liquidity.usd | 流动性观察 | 同上（source=dexscreener） |
| `lite-api.jup.ag` | GET /swap/v1/quote（卖向与买向各一次） | outAmount、priceImpactPct | 买卖模拟（报价级，非成交证明） | 同上（source=jupiter-quote） |

浏览器运行时零外部网络调用（仅 IndexedDB）。上述三个源在 Source Registry 中均未 ENABLED；公共 RPC 对 `getTokenLargestAccounts` 存在按调用限流，采集失败→门禁 UNKNOWN（fail-closed）。

## 部署债务登记

1. **PGlite 服务端运行时路径加载**（`db/client.ts`）：以 `process.cwd()/node_modules` 绝对路径 require 真模块，规避 Next 打包对 `new URL(..., import.meta.url)` 的改写。依赖安装目录布局，不兼容 standalone 产物/pnpm。P1 前需换正式方案（custom server / 依赖升级 / 外部 PGlite 服务）。
2. **PGlite 浏览器端 SSR 切断**（`app/providers-ssr.tsx`，`dynamic ssr:false`）：浏览器 idb 存储不参与 SSR；页面内容水合后呈现。
3. **lockfile 曾损坏**：原 lock 缺跨平台 optional 依赖导致 `npm ci` 失败，已用 `npm install --package-lock-only` 重建；候选 lockfile 以本提交为准。

## 冻结后纪律

- `star/` 保持只读参考，复审通过后归档。
- 任何写入 star-web 的行为都会使 `git status --short` 非空，即冻结失效，需重新走固定提交流程。
