# 数据源与许可证矩阵

状态：**SOURCE ENABLEMENT = SYNTHETIC ONLY**  
日期：2026-09-02

真实 RPC、DEX、GitHub、社交数据全部为**阻断**或**待法务复核**。在本表放行之前，STAR 只允许合成夹具。

| 来源 | 用途 | 许可证/条款 | 状态 | 说明 |
|---|---|---|---|---|
| 合成夹具 `fixture` | P0 门禁与回放 | 内部 | **启用** | 唯一可写入证据库的来源 |
| Solana JSON-RPC（公共 mainnet） | 账户/供应/持仓 | RPC 提供方 TOS | 阻断 | 未选定付费端点，未确认存储与再分发 |
| Yellowstone gRPC | 低延迟链上事件 | AGPL 需确认 | 待法务 | 不得嵌入闭源核心；进程边界未评审 |
| `solana-labs/solana` | 协议参考 | Apache-2.0 历史仓库 | **不可作活跃上游** | 官方仓库已归档，不能继续当活跃依赖。见 [Solana License](https://github.com/solana-labs/solana/blob/master/LICENSE) |
| SPL Token-2022 现维护仓 | 代币扩展语义 | 跟随现维护者许可 | 待法务 | 必须指向未归档上游 |
| DexScreener | 池/TVL 观察 | 未授权存储/复用 | 阻断 | 第三方聚合，不得当唯一真源 |
| Raydium API v3 | 池与链上 keys | 公开文档 ≠ 许可 | 阻断 | 有 [API 文档](https://docs.raydium.io/api-reference/api-v3-endpoints/pools/get-pool-on-chain-keys) 不等于已获得存储、复用或商业使用许可 |
| Jupiter lite-api quote | 只读买卖模拟 | 未评审 | 阻断 | 只允许 quote，禁止 swap；仍待条款 |
| GitHub API | 代码仓连续性 | GitHub TOS | 阻断 | 未申请稳定配额与归档权 |
| Solana Verifiable Build | Program 证据 | 官方工具链 | 待法务 | “可验证”≠“无漏洞” |
| X / Telegram / Discord | 叙事与社交 | 各平台 TOS | 阻断 | §19 开放问题，未选定合法入口 |
| GoPlus 等风险 API | 旁证 | 供应商条款 | 阻断 | 禁止单点门禁 |
| SQD Squid SDK | 历史索引 | Apache-2.0 | 待覆盖验证 | 未证明 SLA |
| DuckDB / Parquet | 回放运行时 | MIT | 允许（本地研究） | 不得倒灌今日维表 |

## 放行条件

一条来源进入 `ENABLED` 必须同时满足：

1. 书面条款允许 STAR 存储原始响应、用于回放、并在研究产品中展示摘要。
2. 适配器只读，失败时产出 `UNKNOWN` 而不是缓存猜测。
3. Source Registry 记录许可证、版本、SLA 与降级动作。

在此之前，P1 = **NO-GO**。
