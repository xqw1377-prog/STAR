# P1-DATA-D0 DESIGN PACKAGE（rev2）

```text
P0 CONTRACT CONSOLIDATION = PASS
star/ ARCHIVE              = PASS
ACTIVE IMPLEMENTATIONS     = 1
P1-DATA-D0 rev1            = CHANGES-REQUIRED（c83e2ae 档案保留，不再待签）
P1-DATA-D0 rev2            = AUTHORIZED / DOCS-ONLY
P1-DATA-D1                 = UNAUTHORIZED / QUARANTINED
SIX MVP PAGES              = 4/6 IN HEAD
WALLET_GRAPH_MISSING       = NOT IMPLEMENTED IN HEAD
P1                          = NO-GO
REAL DATA                   = NO-EVIDENCE
HISTORICAL CORPUS           = NO-EVIDENCE
```

状态：DESIGN-ONLY（无实现代码）· 基线 star-web@6f40295 · 2026-09-03  
rev2 只修订 `docs/p1-data/D0/**`，闭合 rev1 评审退回的合同阻断。不触碰 `app/`、`lib/`、`db/`、测试实现、页面或隔离 stash。

| 文档 | 内容 |
|---|---|
| [FACT_LAYERING_CONTRACT.md](./FACT_LAYERING_CONTRACT.md) | Attempt / RawReceipt / NormalizedFact / 投影 四层；单向 supersedes；PURGE 不改写内容寻址对象；effective_time_kind |
| [IDEMPOTENCY_SEMANTICS.md](./IDEMPOTENCY_SEMANTICS.md) | 五身份；UNKNOWN 重试只增 Attempt；CONTESTED→UNKNOWN；parser HISTORICAL/REINTERPRET |
| [SYNTHETIC_CORPUS_CONTRACT.md](./SYNTHETIC_CORPUS_CONTRACT.md) | 合成 50+100；独立 oracle/golden；家族分组；real=0 |
| [DATA_HEALTH_MODEL.md](./DATA_HEALTH_MODEL.md) | 健康≠风险；availability / success / error / timeout 四率分列 |
| [D0_ACCEPTANCE.md](./D0_ACCEPTANCE.md) | 门禁 → 条款 + D1 测试；登记不执行项 |

边界重申：本阶段不接真实来源（RPC/Jupiter/DexScreener 继续 HOLD）、
不新增页面、不改六门禁与阈值、不引入钱包/交易/AURORA。
