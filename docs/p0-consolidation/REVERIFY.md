# STAR-P0-CONSOLIDATION 最终复验输出

Status: **REVIEW-PENDING（本包不请求签署 PASS）**  
Date: 2026-09-02  
Claimed commit: `4495cafaebd57cea1c683068888d08d9ca1a76f5`

```text
P0 CONTRACT CONSOLIDATION = REVIEW-PENDING
P1                         = NO-GO
WALLET_GRAPH_MISSING       = NOT IMPLEMENTED
GATE QUALITY               = HOLD
PRODUCTION BUILD           = FAIL
star/ ARCHIVE              = NOT REQUESTED
```

本文件回答复审列出的缺口。原始命令日志在 `docs/p0-consolidation/reverify/`。

---

## 1. 固定 commit / 工作区 / 产品哈希

在还原到 `4495caf` 之后、跑命令之前：

```text
git rev-parse HEAD
4495cafaebd57cea1c683068888d08d9ca1a76f5

git status --short
(empty)

shasum -a 256 docs/product/STAR_Product_Definition_v1.0.docx
9634c819b3662b10d6bbcf844c499141baa252ef71976a9f6e3453f348da88d5
```

跑完 `npm ci` / typecheck / test / build 后，工作区只多了本复验目录（untracked）。源码已重新 `git checkout -- lib docs/verification`，与 `4495caf` 对齐。

`npm ci` 第一次因嵌套 `node_modules/.../.claude/settings.local.json` EPERM 失败；删除 `node_modules` 后第二次 `npm ci`：**added 800 packages**，成功。

---

## 2. 命令结果

| 命令 | 结果 |
|---|---|
| `git rev-parse HEAD` | `4495cafaebd57cea1c683068888d08d9ca1a76f5` |
| `git status --short`（T0） | 空 |
| docx SHA-256 | `9634c819…` 与 D0 一致 |
| `npm ci` | PASS（第二次；见上） |
| `npm run typecheck` | PASS（`tsc --noEmit` exit 0） |
| `npm test` | **72 passed / 6 skipped** |
| `npm run build` | **FAIL**（compile 成功；prerender `/` `/replay-lab` `/narrative-map` `/_not-found` 失败） |

构建失败栈：`Element type is invalid: expected a string ... but got: undefined`，发生在 Next 14 静态预渲染，**不是**门禁/契约编译错误。`tsc` 已通过。这是签署 PASS 的阻断项，本轮不修（避免和 MOVE_ONLY 证据混在一起）。

---

## 3. 72 项通过 + 6 项 skipped（全名）

### 通过（72）

1. CROSS-IMPORT star/ = ZERO > star-web runtime and tests do not import star/
2. interpretCheck — token privileges > FAIL when transfer hook is present even if mint/freeze are empty
3. interpretCheck — token privileges > FAIL when mint is live even if extensions are unresolved
4. interpretCheck — token privileges > UNKNOWN when Token-2022 extensions are not resolved
5. interpretCheck — holders > UNKNOWN when only address-level top10 exists
6. interpretCheck — holders > PASS only with entity-adjusted share inside threshold
7. interpretCheck — liquidity exit depth > UNKNOWN when TVL and burn exist but exit depth is missing
8. interpretCheck — liquidity exit depth > PASS when lock/burn and exit depth are both observed
9–12. base58 > encodes leading zero bytes as 1s / round-trips a real pubkey / round-trips arbitrary bytes / throws on invalid characters
13–21. assertFact > accepts conforming fact / rejects wrong version / non-UTC ISO / unknown kind / missing source / non-solana chainId / malformed mint / missing payload / fractional slot
22–23. DATA-005 > FACT_KINDS == checkKeys / every check has exactly one gate
24. evidenceAvailableAt > hides evidence observed after the cutoff
25–28. latestEvidenceByCheck > latest per check / hide after cutoff / tie-break observedAt then ingestedAt then id / empty before any evidence
29–30. quarantineReason / validateIsoUtc > quarantines observedAt after ingestedAt / rejects non-UTC ISO
31–45. parsers: mint map / Token-2022 hook / null mint / holder top10 / null supply / program immutable / live upgrade authority / short immutable / DexScreener TVL / null TVL / jupiter buy+sell / outsized impact / missing routes / standardSellSize 0.01% / zero supply
46–51. evaluateGatesAt > six kebab categories / no mint-freeze gates / missing kind fail-closed / concentration cannot substitute related-wallets / any FAIL aggregates FAIL / ignore after asOf
52–53. toGateRecordsAsOf > FAIL if one authority / UNKNOWN if mint PASS and freeze missing
54–56. Neural timeline > 08-16 FAIL / no 08-18 leak / 08-25 six PASS
57–59. llm-lab anti-sub / honeypot FAIL / rocket mint FAIL + lock UNKNOWN
60. PRD aliases display only
61. source registry guard throws even with decoy STAR_ENGINEERING_OVERRIDE
62–67. engine Neural 08-16 / no leak / 08-19 / 08-23 / 08-25 / before any evidence
68–70. honeypot / llm-lab anti-sub / rocket
71. temporal quarantine
72. refreshProject writes six gates, score only when earned

完整 verbose 日志：`reverify/01-typecheck-and-test.txt`。

### skipped（6/6）— 已批准的真实网络 smoke

文件：`lib/data/rpc-smoke.test.ts`  
门控：`describe.skipIf(process.env.STAR_SMOKE !== '1')`  
套件名：`solana-rpc provider (live mainnet, engineering smoke)`

| # | 全名 | 为何跳过 |
|---|---|---|
| S1 | reads mint authorities (BONK mint authority revoked years ago) | 需 STAR_SMOKE=1 + 真 RPC；源未放行 |
| S2 | holder distribution: computes on public RPC, or fail-closes when the public endpoint throttles the call | 同上 |
| S3 | reads liquidity pools from dexscreener | 同上；DexScreener 阻断 |
| S4 | quote endpoints respond for standard sell AND buy sizes (read-only probes, NOT tradability proof) | 同上；Jupiter 阻断 |
| S5 | relatedWallets honestly throws (cluster analysis needs wallet graph) → gate UNKNOWN | 同上 |
| S6 | reports program verification UNKNOWN shape when no program tracked | 同上 |

同文件另有 **1 条会跑**：`guarded factory throws even with a decoy override env var set`（上表第 61）。默认跳过的只有这 6 条 live mainnet 探测，符合「不接真源」。

---

## 4. 六门禁键 × FactKind 最终映射

持久化 kebab。PRD 大写只在 `PRD_GATE_ALIAS`。

| kebab gate | kebab FactKind / check | PRD 别名（展示） |
|---|---|---|
| token-permissions | mint-authority, freeze-authority | TOKEN_PERMISSIONS |
| tradability | sell-simulation | BUY_SELL_SIMULATION |
| liquidity | liquidity | LIQUIDITY_EXIT |
| concentration | holder-distribution | HOLDER_CONCENTRATION |
| related-wallets | related-wallets | ASSOCIATED_WALLETS |
| program-verification | program-verification | PROGRAM_VERIFICATION |

`FACT_KINDS`（`lib/data/contract.ts`）与 `checkKeys`（`lib/domain/types.ts`）是同一集合。测试 DATA-005 锁定。

---

## 5. 唯一声明位置

| 符号 | 唯一导出 | 残留 |
|---|---|---|
| `solana-readonly@2` / `CONTRACT_VERSION` | `lib/data/contract.ts:15` | `star-fixture.ts` 有本地字符串回声；`star/src/domain/types.ts` 磁盘副本 |
| kebab `gateKeys` / `checkKeys` | `lib/domain/types.ts` | `star/` 仍有 SCREAMING `GATE_KEYS` 磁盘副本 |
| `THRESHOLDS` / `RULE_VERSION` | `lib/domain/thresholds.ts` | `star/src/domain/thresholds.ts` 磁盘副本，内容相同 |
| temporal | `lib/domain/temporal.ts` | `star/src/domain/temporal.ts` 磁盘副本 |
| gate engine | `lib/domain/interpret.ts` + `gates.ts` | `star/src/domain/{interpret,gates,fromChecks}.ts` 磁盘副本 |

star-web **运行时**只有上表左列。`rg` 在 `lib/ app/ db/ components/` 中 **0 条** `star/` 或 `AURORA` import。

---

## 6. 定义与引用清单

见 `reverify/03-scans.txt`。

`lib/star-engine.ts` 只有 `export * from './engine'`，不是第二套判定。`db.ts` 与 Project Audit 走这个别名，最终仍是 `engine.ts` → `lib/domain`。

---

## 7. MOVE_ONLY 语义对照（迁移前 `star/` 磁盘 vs 现 `star-web/lib/domain`）

| 项 | 迁移前 `star/` | 迁移后 `star-web` | 等价？ |
|---|---|---|---|
| TVL 下限 | 150_000 | 150_000 | 是 |
| LP burn | 0.5 | 0.5 | 是 |
| 实体 top10 | 0.35 | 0.35 | 是 |
| 关联 cluster | 0.25 | 0.25 | 是 |
| RULE_VERSION | gates@2 | gates@2 | 是 |
| interpretCheck | 同文件（仅少一行 FROZEN 注释） | 同规则 | 是 |
| mint+freeze 合并 | FAIL 优先；缺一边且另一边非 FAIL → UNKNOWN | 同 | 是 |
| 时态平局 | observed，然后 ingested，然后 id | ISO 字符串同一顺序 | 是（仅 Z 格式 ISO） |
| 分数 | 仅六门 PASS | scoringAllowed 相同 | 是 |

Git 无法对「第一笔实质提交」做前后 diff。上表是独立语义快照，对照仍留在磁盘上的 `star/src/domain`（冻结参考，未被 star-web 导入）。

---

## 8. `engine.ts` 只做 I/O 的证明

`evaluateProjectAsOf` 的判定入口只有：

1. `quarantineReason`（temporal）隔离坏行  
2. `latestEvidenceByCheck`（temporal）截断  
3. `interpretCheck`（domain）把 payload 变成 status  
4. `evaluateChecksAt`（domain）聚合六门  
5. `scoringAllowed`（domain）决定分数是否为 null  

文件中 **没有** `switch (key)` / mintAuthority 布尔 / top10Pct 阈值。机会分 `WEIGHTS` 只在 `allPass` 之后算，不能推翻门禁。`evaluateGates` / `refreshProject` 只是包装和落库。

---

## 9. 签署清单（开发自检，不请你改结论）

```text
FIXED COMMIT VERIFIED    = PASS   4495caf
CLEAN WORKTREE           = PASS   于 T0；复验产物 untracked
DOCX HASH                = PASS   9634c819…
NPM CLEAN INSTALL        = PASS   第二次 npm ci，800 packages
TYPECHECK                = PASS
UNIT TESTS               = 72/72
SKIPS EXPLAINED          = 6/6    live mainnet smoke，STAR_SMOKE 门控
PRODUCTION BUILD         = FAIL   prerender 组件 undefined
ONE CONTRACT             = PASS*  star-web 运行时唯一；star/ 磁盘副本仍在
ONE TEMPORAL ENGINE      = PASS*  同上
ONE GATE ENGINE          = PASS*  同上
MOVE_ONLY SEMANTICS      = PASS   对照磁盘快照，非 git 父子 diff
```

`*`：在归档 `star/` 之前，磁盘上仍有第二份实现。这是复审暂缓归档的正当理由，本包接受。

---

## 10. 不请求的事项

- 不签署 `P0 CONTRACT CONSOLIDATION = PASS`
- 不归档、不删除、不移出 `star/`
- 不修生产构建（单独开缺陷，避免和合并证据缠在一起）
- 不接真源、不加页、不改门禁质量
