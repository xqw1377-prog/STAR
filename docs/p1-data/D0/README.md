# P1-DATA-D0 DESIGN PACKAGE（rev2）

状态：DESIGN-ONLY（无实现代码）· 基线 star-web@6f40295 · 2026-09-03
rev2：Attempt/Receipt 拆分、supersedes 单向、CONTESTED 冻结、parser 策略冻结与双回放、
处置事件化 PURGE、effective_time_kind、语料 oracle 独立与家族分组、四率拆分。

| 文档 | 内容 |
|---|---|
| [FACT_LAYERING_CONTRACT.md](./FACT_LAYERING_CONTRACT.md) | RawObservation → NormalizedFact → 研究投影 三层合同；raw 字段冻结与不可变性 |
| [IDEMPOTENCY_SEMANTICS.md](./IDEMPOTENCY_SEMANTICS.md) | observation_key / receipt_key 正式计算规范；重复/冲突/修订/超时判定表；并发兜底；parser 重放 |
| [SYNTHETIC_CORPUS_CONTRACT.md](./SYNTHETIC_CORPUS_CONTRACT.md) | 50+100 合成语料 manifest 合同（cutoff / hindsight / 反证 / 覆盖率约束；real=0） |
| [DATA_HEALTH_MODEL.md](./DATA_HEALTH_MODEL.md) | 十项健康指标与投影合同；健康≠风险、缺失≠PASS 两条铁律 |
| [D0_ACCEPTANCE.md](./D0_ACCEPTANCE.md) | 十项 D0 门禁 → 设计条款 + D1 证明测试映射；登记不执行项 |

边界重申：本阶段不接真实来源（RPC/Jupiter/DexScreener 继续 HOLD）、
不新增页面、不改六门禁与阈值、不引入钱包/交易/AURORA。
