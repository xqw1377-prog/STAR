# 基线决定

日期：2026-09-02  
冻结：STAR-P0-CONSOLIDATION D0–D7

```text
唯一运行应用     = star-web
唯一领域内核     = star-web/lib/domain
唯一观察契约     = solana-readonly@2 kebab
唯一时态内核     = star-web/lib/domain/temporal.ts
唯一文档目录     = star-web/docs/product + star-web/docs/p0-data
产品原件         = STAR_Product_Definition_v1.0.docx SHA-256 9634c819…
star/            = 冻结参考，复审通过后再归档
本轮范围         = MOVE_ONLY
WALLET_GRAPH_MISSING = NOT IMPLEMENTED（D7 DEFERRED）
P1               = NO-GO
```

## 禁止

- 不新增页面
- 不连接真实 Solana RPC / DEX / GitHub / 社交源
- 不从 star-web 导入 `star/`
- 不把 PRD 大写名称做成第二套领域类型
- 不引入钱包、签名、交易或 AURORA 依赖
