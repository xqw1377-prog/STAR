# STAR 外部能力收编矩阵 V1

```text
状态        IMPLEMENTED-BY-DIRECTION 2026-09-05（主理人《Acquisition Matrix V1》指令落地版）
依据        主理人 2026-09-05 冻结版 + 本会话代码级审计修正（克隆源码存证于审计当日）
纪律        DESIGN ONLY · 不接真实 RPC · 不改六门禁 · 不解锁 B2 · Sensor 保持 OFF
机器可读副本  lib/evidence/contract.ts（EVIDENCE_CONTRACT_VERSION = star-evidence@1）
```

> STAR 不买回完整系统，只拆能力器官。外部项目提供算法/采集/解析/图谱方法；
> **Evidence、Truth、Gate、Lifecycle、Decision 永远是 STAR 自己的。**

## 一、收编裁决（经代码级审计修正）

| 项目 | 许可证 | 代码审计关键事实 | 收编级 | CAP |
|---|---|---|---|---|
| solana-rugcheck-skill | MIT | 317 行真实只读 RPC：字节级 SPL 解码、Token-2022 TLV 存在性扫描、ProgramData 升级权限解码；「评分」仅为 LLM 文档规则不进代码 | **A 直接吸收**（仅 raw inspection） | CAP-04 |
| solana-realtime-indexer | MIT | 6,451 行 Rust：gaps/recover/verify/repair/identity/checkpoint/DLQ 模块齐整，单一 run_pipeline 覆盖 live/capture/replay/backfill | **B 架构吸收**（不复制业务 schema） | CAP-02 |
| dec-clust | **无许可证** | 725 行 cluster.js：funding→fan-out→cluster→rug 分真实；rug 判定为加法评分（禁式）；仓库含 56M node_modules | **C 算法重写**（无许可证=不得复制代码） | CAP-03 |
| find-the-insiders | **无许可证** | 425 行 main.py：**无 Helius key 时回退 `generate_mock_analysis()` 伪造数据**；真实路径仅 top-15 持币+基础资金追溯 | **C 算法重写**（数据模型思想；绝不复用其伪造回退） | CAP-03 |
| AlphaRidge | MIT | EventFingerprint/NarrativeTag/TopicSignature/分类学真实；**跨文章聚类与叙事生命周期不在仓库**；整体是 Bittensor 子网（torch/bittensor/openai） | **B/C 混合**（schema 重写，聚类自建） | CAP-01 |
| cabal-hunter-mcp | MIT | 付费托管 API 客户端（5-250 scans/mo），算法不在仓库；README 自述曾误判 funding cluster | **D 仅参考** | — |
| 0xdariel scanner | MIT | 300 行 demo；加法风险评分（禁式）；流动性为 placeholder 启发式；STAR `solana-rpc-core.ts` 已有更强等价 | **D 不收编** | — |
| solana-rug | 不可得 | 仓库 404，无法代码审计 | **D 暂不收编** | — |
| narra-app | — | Token→Narrative 方向违反 FROZEN-rev1 §2 | **D 不收编**（仅聚类算法可远观） | — |

## 二、门禁映射（唯一真源 = `lib/domain/types.ts` gateKeys）

| 证据域 | 事实类型（evidence fact type） | 真实 Runtime Gate |
|---|---|---|
| 代币权限 | `mint-authority-state` / `freeze-authority-state` / `token-2022-extensions` | `token-permissions` |
| 程序权限 | `program-upgrade-authority` | `program-verification` |
| 持币集中 | `holder-top-accounts` | `concentration` |
| 关联行为 | `funding-relation` / `coordinated-activity` / `early-buyer` / `fresh-wallet` | `related-wallets` |
| 市场观察 | `asset-birth` / `pool-book` | —（观察层，不入门禁） |
| 外部情报 | `external-event-candidate` | **永不入门禁**（最高到 CANDIDATE） |

Lifecycle 与 Decision Path 不属于六门禁，维持模型 FROZEN-rev1 口径。**未列入映射的事实类型没有门禁资格**——映射是白名单，不是默认放行。

## 三、不可变规则（本矩阵冻结）

1. **Evidence ≠ Score**：任何外部 composite score / verdict / rating 不得成为 Evidence，更不得入门禁。
2. **Cluster ≠ Risk**：集群是观察事实；`related-wallets` 门禁的 FAIL 判定永远由 STAR 自己的事实条件作出。
3. **候选永不是事实**：`external-event-candidate` 类证据最高到 CANDIDATE，链上验证才是 Truth。
4. **来源先于证据**：记录 Evidence 的源必须在注册表 ENABLED（fail-closed，无运行时旁路）。
5. **许可先于复制**：无许可证仓库只允许算法重写，一行代码不得复制。

## 四、实施顺序（M0 已落地，M1–M4 待授权逐个开工）

```text
M0 Evidence Contract   ← 已落地：lib/evidence/contract.ts（本矩阵的机器可读形态）
M1 Chain Observation   ← 已落地：lib/observation/（star-observation@1，READY-FIXTURE-REPLAY-ONLY；
                          单一管道 live/replay 等价、原子检查点、显式缺口、死信、验证器、十项验收全绿）
M2 Actor Evidence      funding graph / cluster / early buyer / fresh wallet —— 全部输出 Evidence，不输出风险分
M3 Token/Program       吸收 rugcheck-skill raw inspection → 三类证据映射三门禁
M4 Event Intelligence  AlphaRidge schema 最后接入（Event→Narrative 方向，禁止反向）
        ↓
Fixture/Replay 验证 → 零写面审计 → 能力评审 → 真实传感器评审 → B2 治理批准（独立动作，技术前置≠授权）
```

## 五、否决清单（不再讨论）

外部 AI 风险分 ❌ ｜ cabal/insider 类外部 verdict ❌ ｜ Token→Narrative 数据模型 ❌ ｜ solana-rug（不可审计）❌ ｜ 0xdariel ❌
