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

## M2/M3/M4 能力器官（@7 新增，纯计算层，同日落地）

```text
M2 star-actor@1        资金图/集群/早期买家/新钱包 → Evidence（Cluster ≠ Risk，零风险分）
M3 star-tokenrisk@1    字节级 SPL/Token-2022/ProgramData 解码 → Evidence（无裁决字段）
M4 star-eventintel@1   事件指纹/跨源聚类/叙事候选（候选永不是身份，零门禁资格）
共同约束              不写库 · 不接运行时 · 不产评分 · 源注册表 fail-closed · 全部经 M0 契约校验
```

## M5 集成与治理审计（@7 新增，2026-09-05 通过）

```text
审计器              m5-integration@1 · PASSED-FIXTURE-SCOPE
① provenance        Source→Adapter→Observation→Computation→Evidence 全链无断点
② 跨器官泄漏        器官→Gate / M4→Narrative·Lifecycle / M1→Truth / Asset→Event→Narrative 全部禁径成立
③ 夹具投毒          「完美伪造」证据经真实门禁解释器只得 UNKNOWN（truth 层载荷形状缺失即 fail-closed）；
                    evidence→gate 翻译层不存在——该缺失即 B2 治理闸门本体
④ 注册表完整性      READY ≠ ENABLED 永久规则（测试锁定）；synthetic-fixtures 仍为唯一 ENABLED 源
Dashboard           所有权裁决执行：/ = 阻击决策台（单一主人）；复用 site-navigation 与 lib/ui/dashboard；
                    并行在途首页及 e2e 隔离于 /tmp/star-dashboard-quarantine（未采纳未销毁）
```
