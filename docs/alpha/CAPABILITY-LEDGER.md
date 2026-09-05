# STAR 能力台账（单一真相）

> 机器可读副本：`lib/alpha/capability.ts`（`GET /api/capability`）。  
> 方向：`docs/alpha/DIRECTION.md`。页面/单测 ≠ Alpha。

```text
台账              star-capability@3
方向              MEME-SNIPE-AUTO
赚钱能力          NO-EVIDENCE
研究台            SHELL-ONLY（观察壳，阻击台不依赖该库）

── 策略（snipe-value-meme@v0）──
宇宙              pump.fun curve + Raydium v4/CPMM · SOL/USDC
进场              首次储备 ≥ 8 SOL 等值 + 点时簿记 + 仓位上限
出场              不可退出 / 储备 < 1 SOL / 持有 ≥ 1800 slot
执行              自动；默认 DRY_RUN
循环              process-interval（无需打开浏览器）
广播              需 STAR_MICRO_LIVE=1 且本机钱包；适配器尚未接线

── 运行时──
ENABLED 源        synthetic-fixtures
solana-rpc        BLOCKED
钱包模块          无
broadcast         false
snipeCycleWired   true
deskRequiresResearchDb  false
```
