# Solana 50+100 历史样本规范

状态：**HISTORICAL CORPUS = NO-EVIDENCE**  
目标规模：≥ 50 个成功项目 + ≥ 100 个失败/归零项目。  
当前入库项目数：**0**。`star-web/lib/data/star-fixture.ts` 与 `star-web/lib/domain/synthetic-checks.ts` 里的四个合成名字只用于门禁/回放内核测试，**不算**历史语料。

## 样本组

| 组 | 最小规模 | 目的 | 当前 |
|---|---|---|---|
| 成功叙事 | 50 | 发现提前量、晋级、生命周期 | 0 · NO-EVIDENCE |
| 失败/归零 | 100 | 门禁与生存偏差 | 0 · NO-EVIDENCE |
| Rug / Honeypot / 抽池 | 覆盖主要攻击类型 | 损失前能否 FAIL | 0 |
| 伪热度/刷量 | 多种操纵 | 实体聚类 | 0 |
| 同周期对照 | 非热点项目 | 是否只是跟随牛市 | 0 |

## 入选字段（每条样本必须有）

- `sampleId`, `name`, `symbol`, `mint`（或明确 UNKNOWN）
- `cohort`: success | fail | rug | wash | control
- `narrativeTheme`: 待产品负责人冻结（候选：铭文 / Solana Meme / AI Agent）
- `firstPublicAt`（后验标签，只用于评估，禁止进入当时决策）
- `evidencePlan`: 需要哪些 `check_key` / `fact_kind`、从哪类来源取
- `evidenceStatus`: 现在一律 `NO-EVIDENCE`

## 禁止

- 用今天的团队身份、锁仓解除或跑路结果回填 `observedAt`
- 用历史最低价当作“首次发现”
- 只用赢家讲故事
- 在真实来源未放行时把公开网站摘要写成 STAR 证据

## 何时可以离开 NO-EVIDENCE

至少 50+100 条都有：mint 或等价身份、计划中的六类事实来源、以及一条不晚于评估时点的原始观察哈希。在此之前，Replay 的“历史领先”指标不得计算。
