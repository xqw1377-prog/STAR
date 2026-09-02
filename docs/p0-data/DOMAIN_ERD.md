# 领域模型 ERD

状态：P0 逻辑模型。物理库未冻结；本图约束对象与证据字段。

```text
Chain 1──* Project 1──* Token
                │
                ├──* Program
                ├──* Pool
                ├──* Evidence *──1 Source
                ├──* Claim *──* Evidence
                ├──* Contradiction
                ├──* GateResult
                ├──* ScoreSnapshot
                ├──* Decision
                ├──* Wallet *──* Entity
                └──* GraphEdge (Wallet|Entity)──(Wallet|Entity)

Narrative 1──* Project
TopicCluster 1──* Narrative
Catalyst *──* Narrative
```

## 对象组

| 组 | 对象 | 不变量 |
|---|---|---|
| 市场 | Chain, DEX, Pool, PriceObservation | 价格不是可退出性 |
| 资产 | Project, Token, Program | 项目身份与链上部署分离 |
| 主体 | Wallet, Entity | 地址不是人；边带置信度 |
| 叙事 | Narrative, TopicCluster, Catalyst | 名人提及是 Catalyst，不是自动加分 |
| 证据 | Source, Observation, Evidence, Claim, Contradiction | 主张必须可被证据支持或反驳 |
| 风控 | GateResult, AuditSnapshot | 门禁不可被机会分抵消 |
| 决策 | ScoreSnapshot, Decision, ShadowPosition | Shadow 无签名端口 |

## Evidence（合同字段）

```text
Evidence
  id
  project_id
  check_key     ∈ GATE_KEYS
  fact_kind     ∈ FACT_KINDS          -- 必须匹配该 check_key 的规定 kind
  status        PASS | FAIL | UNKNOWN
  claim
  source
  source_kind
  effective_at / observed_at / ingested_at
  confidence
  -- P1 必填：contract_version, parser_version, rule_version, source_version
```

`HOLDER_CONCENTRATION` 与 `ASSOCIATED_WALLETS` 是两行。前者 PASS 不得省略或替代后者。

## GateResult

```text
GateResult
  project_id
  check_key
  status
  claim           -- 缺证据时为合成 UNKNOWN 说明
  as_of
  evidence_id?    -- 选中的最新可见证据
```

汇总：任一 FAIL → FAIL；否则任一 UNKNOWN → UNKNOWN；六门全 PASS → PASS。
