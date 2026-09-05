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

## M1 链上观察层（@7 新增，主理人授权 2026-09-05）

```text
观察器            star-observation@1
状态              READY-FIXTURE-REPLAY-ONLY（M1 READY ≠ B2）
管道              单一 runPipeline：decode→interpret→normalize→幂等→原子批次+检查点
                  live / capture / replay 同管道（确定性测试锁定）
可靠性            检查点与批次同事务 · 缺口显式记录（非 UNKNOWN 同义词）·
                  缺口回填 · 死信全上下文 · 验证器 · append-only 触发器
输出              仅 Observation——永不 Evidence Truth / Gate / Score / Decision
真实 RPC          false（下一闸门：Provider→Adapter Review→Read-only→Sensor 验证→B2 独立授权）
```
