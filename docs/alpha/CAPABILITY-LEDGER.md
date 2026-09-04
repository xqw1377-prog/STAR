# STAR 能力台账（单一真相）

> 机器可读副本：`lib/alpha/capability.ts`（`GET /api/capability`）。
> 纸面政策与运行时代码分开写。页面/单测通过 ≠ Alpha。

```text
台账              star-capability@1
赚钱能力          NO-EVIDENCE
研究基础设施      PARTIAL（夹具六页 + 六门禁 + D1）

── 纸面（工作单）──
M0-OBJECTIVE      FROZEN
M0-MEASUREMENT    FROZEN rev1
M0-BOUNDARY       FROZEN rev2
M1-BUILD          IN PROGRESS
M1-EVIDENCE       NOT STARTED
M3 / M4           DENIED
M5-BUILD          AUTHORIZED-PAPER（本轮不开工）
M5-EVIDENCE / M6  DENIED
资金政策          MICRO-LIVE-CANDIDATE ≤ 1,000 USDC
P1                NO-GO

── 运行时（本树代码）──
ENABLED 源        synthetic-fixtures（仅此）
solana-rpc        BLOCKED
钱包 / 广播 / 自动成交   无模块
Recorder          库存在，未接 API / UI
浏览器库          idb://star
服务端库          .pglite
两库耦合          否
「重新评估」采链   否（只重算已有证据）
DecisionIntent    可锁定定义，不可执行
组合 NAV          政策已编码，未记账
```
