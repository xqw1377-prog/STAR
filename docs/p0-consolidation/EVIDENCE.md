# STAR-P0-CONSOLIDATION 证据包

Date: 2026-09-02  
Freeze: D0–D7  
Scope: MOVE_ONLY

```text
P0 CONTRACT CONSOLIDATION = PASS (pending reviewer sign-off)
P1                         = NO-GO
WALLET_GRAPH_MISSING       = NOT IMPLEMENTED
GATE QUALITY               = HOLD
SEMANTIC CHANGES           = ZERO
star/ ARCHIVE              = NOT YET (step 10, after review)
```

## 1. 单一基线（已执行）

| 对象 | 真源 |
|---|---|
| 产品原件 | `star-web/docs/product/STAR_Product_Definition_v1.0.docx` SHA-256 `9634c819b3662b10d6bbcf844c499141baa252ef71976a9f6e3453f348da88d5` |
| 文档 | `star-web/docs/product/` + `star-web/docs/p0-data/` |
| 观察契约 | `star-web/lib/data/contract.ts` `solana-readonly@2` kebab |
| 时态 | `star-web/lib/domain/temporal.ts` |
| 门禁 | `star-web/lib/domain/{interpret,gates,thresholds,types}.ts` kebab |
| 运行时 | `star-web`；`lib/engine.ts` 只做 I/O |

## 2. 删除/归档（本轮已做 / 未做）

已做：sprint-01 副本删除并留 ARCHIVE；`star/docs/p0-data` 正文删除并留 ARCHIVE；`star/` README 标为冻结参考；去掉 `star/domain` alias / `externalDir`。

未做：整包归档 `star/`（步骤 10，待复审）。`star/src/domain` 源码仍在磁盘上，但 `index.ts` 已清空导出，且 star-web 零导入。

## 3. 门禁矩阵

MOVE_ONLY：判定规则未改。`WALLET_GRAPH_MISSING` **不得写成 PASS**。

## 4. 兼容性

kebab 六门禁 + PRD 别名映射测试在 `lib/domain/gates.test.ts`。Neural / llm-lab / honeypot / rocket 时间线断言与迁入前一致。

## 5. 测试与类型检查

```text
vitest run   9 files, 72 passed, 6 skipped (smoke)
tsc --noEmit PASS
CROSS-IMPORT star/ = ZERO  (lib/domain/no-star-import.test.ts)
```

## 6. 仍存在、不得误报

- 活动 Next 配置是 `next.config.mjs`（PGlite externals），无 `star/` alias，无 `ignoreBuildErrors`
- `WALLET_GRAPH_MISSING = NOT IMPLEMENTED`
- 真实源与历史语料仍为 NO-EVIDENCE
