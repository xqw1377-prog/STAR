# STAR P0-DATA Contract v1

Status: **FROZEN_FOR_FIXTURE_IMPLEMENTATION**  
Scope: Solana read-only research  
Authoritative product definition: [docs/product/STAR_Product_Definition_v1.0.docx](../product/STAR_Product_Definition_v1.0.docx)

SHA-256 of the product definition file: `9634c819b3662b10d6bbcf844c499141baa252ef71976a9f6e3453f348da88d5`

## Non-negotiable boundaries

- STAR is independent from AURORA in code, data, configuration, deployment, credentials, and runtime state.
- The runtime has no wallet, private-key, signing, submit, cancel, or transaction-broadcast interface.
- Solana is the only P1 chain. BNB Chain remains out of scope.
- External provider conclusions are observations, never internal truth.
- Missing, stale, conflicting, or unavailable mandatory facts resolve to UNKNOWN and fail closed.
- A hard gate is never numerically offset by an opportunity score.

## Canonical module graph

```text
Source Adapter → Immutable Observation → Point-in-time Evidence
                                          ├→ Hard Gate ──PASS?──No──→ Score blocked
                                          │            └──Yes──→ Opportunity Score
                                          └→ Replay  ←── Hard Gate + Score
```

Only Point-in-time Evidence may feed gates, scores, and replay. UI pages may query derived outputs but may not implement their own temporal or gate logic.

## Six mandatory Solana gates

| Gate key | Required fact kind | PASS means | UNKNOWN examples |
|---|---|---|---|
| `TOKEN_PERMISSIONS` | `TOKEN_AUTHORITY` | Mint/freeze and relevant Token-2022 controls have been resolved and no blocking authority is present | RPC unavailable, unparsed extension, conflicting account state |
| `BUY_SELL_SIMULATION` | `TRADE_SIMULATION` | Controlled buy and sell paths complete under the frozen simulation policy | Missing route, simulation timeout, unsupported venue |
| `LIQUIDITY_EXIT` | `LIQUIDITY` | Pool control and exit depth meet the frozen scenario threshold | Unknown LP control, stale reserve, incomplete route |
| `HOLDER_CONCENTRATION` | `HOLDER_DISTRIBUTION` | Entity-adjusted concentration is computed and within threshold | Holder list without entity resolution is insufficient |
| `ASSOCIATED_WALLETS` | `WALLET_RELATIONSHIP` | Deployer, team, early-wallet, common-funder and internal-transfer checks are resolved | Unclassified major wallets or unresolved common funding |
| `PROGRAM_VERIFICATION` | `PROGRAM_VERIFICATION` | Relevant program identity, upgrade control, and verifiable-build evidence are resolved | Unverified build, unknown upgrade authority, identity conflict |

Mint and freeze are subchecks of `TOKEN_PERMISSIONS`; they are not two gates. Holder evidence alone cannot pass `ASSOCIATED_WALLETS`.

Quality rules (`RULE_VERSION = gates@2`), implemented only in `interpretCheck`:

- `TOKEN_PERMISSIONS` FAILs on known mint, freeze, transfer hook, permanent delegate, fee config, or Token-2022 extensions. Known privilege wins over unresolved extensions. Empty `token2022Extensions: []` means resolved none; omitted/null means not decoded → UNKNOWN (only when no other privilege is already proven).
- `HOLDER_CONCENTRATION` PASSes only with `top10PctEntityAdjusted`. Address-level `top10Pct` alone is UNKNOWN.
- `LIQUIDITY_EXIT` PASSes only when TVL ≥ 150000, LP lock/burn is proven, **and** `exitDepthUsd` is a positive observed number.

Observation payloads (`solana-readonly@2` in star-web) must carry these fields; RPC parsers that cannot prove them emit `null` so the gate stays UNKNOWN.

> **solana-readonly@4（F2-A 契约变更，主理人批准 2026-09-05）**：`SellSimulationPayload` 删除 `executable` / `buy.executable` 裁决字段（5% 阈值无治理身份，D1 撤销）。适配器只产出原始观察（priceImpactPct 等）；tradability 解释权归 F2-B 的 E-01 解释器（未授权），过渡期恒 UNKNOWN。

## Evidence contract

Each evidence record must contain:

```text
id, project_id, check_key, fact_kind, status,
claim, source, source_kind,
effective_at, observed_at, ingested_at,
confidence
```

Time meanings:

- `effective_at`: when the fact became true in the external world or on-chain.
- `observed_at`: earliest time STAR could know the fact. Replay cutoff uses this field.
- `ingested_at`: when STAR persisted the observation; used for latency and source-health audits.

For a replay cutoff `T`, only evidence satisfying `observed_at <= T` is visible. For each gate, the latest visible evidence wins; equal timestamps are resolved deterministically by ingestion time and evidence ID. Later evidence may overturn a prior PASS.

## Gate algorithm

1. Select the latest point-in-time evidence for each of the six keys.
2. Missing evidence becomes UNKNOWN.
3. Any FAIL makes the aggregate gate FAIL.
4. Otherwise any UNKNOWN makes it UNKNOWN.
5. Only six PASS results produce aggregate PASS.
6. Opportunity scoring is permitted only after aggregate PASS.

Canonical implementation: `evaluateGatesAt` / `aggregateGates` / `interpretCheck` in `star-web/lib/domain/`. No second copy in UI. Do not import `star/`.

## Versioning

Every production observation and derived snapshot must eventually carry `contract_version`, `parser_version`, `rule_version`, and `source_version`. The fixture implementation currently freezes the semantic contract; persistence of all four version fields is a P1 prerequisite.

## GO / NO-GO

P0-DATA may be marked PASS only when:

1. this contract and the ERD are reviewed;
2. every enabled source has an approved license/terms status;
3. the 50-success/100-failure sample manifest is complete;
4. acceptance tests prove fail-closed and point-in-time behavior;
5. no route can calculate a score or gate outside the canonical domain engine.

Current fixture baseline: contract frozen, sources synthetic-only, corpus `NO-EVIDENCE` → **P1 = NO-GO**.
