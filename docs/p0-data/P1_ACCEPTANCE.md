# P1 验收目录

状态：**P1 = NO-GO**

P1 GO 需要：关键风险 UNKNOWN fail-closed、可回放、六页 MVP、原始事实仓。当前只具备合成内核，真实管道未接，历史语料 NO-EVIDENCE。

## 必须通过才能谈 P1 GO

| ID | 项 | 当前 |
|---|---|---|
| A-01 | 产品定义原样入库且哈希可核 | PASS（docx SHA-256 已记录） |
| A-02 | 数据源矩阵存在；未放行源不得启用 | PASS（SYNTHETIC ONLY） |
| A-03 | 领域 ERD 覆盖 Project/Token/Evidence/Gate/Entity | PASS（逻辑模型） |
| A-04 | 50+100 样本规范存在且语料状态诚实 | PASS（NO-EVIDENCE） |
| A-05 | 六 kebab `gateKeys` 与 kebab `checkKeys` 对齐 | PASS（单元测试） |
| A-06 | Gate/Replay/Audit/Collect 共用 `star-web/lib/domain` | PASS（无跨包 `star/` 导入） |
| A-07 | `concentration` PASS 不能替代 `related-wallets` | PASS（防回归） |
| A-08 | 无钱包/签名/交易 API 引用 | PASS（本包） |
| A-09 | 无 AURORA 依赖 | PASS（本包） |
| A-10 | 点时过滤：`observedAt > T` 的事实不可见 | PASS |

## 明确未通过（保持 NO-GO）

| ID | 项 | 当前 |
|---|---|---|
| P1-01 | 至少一条合法只读 Solana 源 ENABLED | FAIL |
| P1-02 | 幂等索引与不可变原始事实仓 | FAIL |
| P1-03 | 六页 MVP（Desk / Radar / Map / Audit / Risk / Replay）接本内核 | FAIL |
| P1-04 | 历史语料 50+100 不再是 NO-EVIDENCE | FAIL |
| P1-05 | 数据健康与来源故障降级 | FAIL |
| P1-06 | 角色权限与审计日志 | FAIL |
| D7 | `WALLET_GRAPH_MISSING = UNKNOWN` | **NOT IMPLEMENTED**（不得写成 PASS） |

## 运行

```bash
npm test
npm run typecheck
```
