# STAR 能力台账

```text
台账              star-capability@7
产品              新叙事早期资产阻击引擎
模型              EVENT-NARRATIVE-ASSET-MARKET-MONEY
运行模型          CONSENSUS-OPERATING-MODEL FROZEN-rev1（已签署）
组合              portfolio-policy@v1-convex
宇宙类            U-01
运行实例          U-01-SOLANA
赚钱能力          NO-EVIDENCE
```

## B1 叙事事件日志（@7 新增）

```text
记录器            b1-recorder@1
状态              ACTIVE-FIXTURE-ONLY（B1-ACTIVE = Recording Active / Sensor OFF）
数据源            synthetic-fixtures（唯一）
真实传感器        false（RPC 提供商未选定，注册表未 ENABLED）
Decision Core     不可触达（代码边界 + DB 触发器 + 写面测试三重强制）
写面              仅五张 b1_* append-only 表；关系方向 Event→Narrative→Asset 单向
B2                未授权启动
```
