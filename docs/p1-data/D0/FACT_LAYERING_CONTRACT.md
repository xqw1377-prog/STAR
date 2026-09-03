# P1-DATA-D0 · 事实分层合同（FACT LAYERING CONTRACT）

状态：DESIGN-ONLY（本文档为设计合同，不含实现；建表与代码待 D1 授权）
评审基线：star-web@6f40295 · 2026-09-03

## 1. 三层模型

```text
Layer R  RawObservation（不可变原始响应）
            ↓ parser_version（重放，不重采集）
Layer N  NormalizedFact（标准事实，append-only，带血缘）
            ↓ rule_version（v3.0 起）
Layer P  Evidence / Gate / Score（研究投影，可重建、可回放）
```

**核心禁令**：任何 Gate、Score、页面、API 都不得直接解释 Layer R 的原始响应。
Layer R 的唯一消费者是 parser；parser 的唯一输出是 Layer N；门禁引擎只消费 Layer N。
现有 `lib/data/parsers.ts` 的解析函数在 D1 迁移为受版本管理的 parser（输入 raw，输出 fact），
现有 evidence 表升级为 Layer N+P 的合并视图（见 §4 迁移注记）。

## 2. Layer R — RawObservation 字段合同（冻结）

| 字段 | 类型 | 语义 | 约束 |
|---|---|---|---|
| `id` | uuid | 行标识 | 生成后不变 |
| `source_id` | text | 来源注册表键（如 `synthetic-fixtures`） | 必须是 SOURCE_REGISTRY 中的键 |
| `source_version` | text | 来源/端点版本（适配器自报） | 非空 |
| `network` | text | `solana`（P1 冻结单网络） | 合同层校验 |
| `method_id` | text | 请求模板标识（如 `rpc:getAccountInfo`、`jup:quote`） | 非空 |
| `request_fingerprint` | char(64) | `observation_key`（见 IDEMPOTENCY_SEMANTICS §2） | 由请求规范算出，与响应无关 |
| `request_params` | jsonb | 规范化请求参数（canonical JSON） | 仅供审计，不参与键计算以外的用途 |
| `collection_run_id` | uuid | 采集批次 | 索引用 |
| `anchor_slot` | bigint·null | 链上锚（slot）；离线源为 null | null 时以 `anchor_time` 兜底 |
| `anchor_time` | timestamptz·null | 离线源时间锚 | 二者至少其一 |
| `effective_at` / `observed_at` / `ingested_at` | timestamptz | 三重时间，语义与现内核一致 | 沿用 DATA-001 不变式 |
| `payload_hash` | char(64)·null | payload 的 SHA-256；错误响应为 null | success/partial 必填 |
| `payload_ref` | text | blob 存储键（D1 以文件仓实现） | 与 `payload_inline` 至少其一 |
| `payload_inline` | bytea·null | ≤4KB 小响应内联 | 便于测试与小载荷 |
| `schema_version` | text | raw 信封结构版本（`star-raw@1`） | 起始为 `star-raw@1` |
| `parser_version_at_ingest` | text | 摄取时最新 parser 版本（信息性快照） | 不随 parser 升级而更新 |
| `retention_class` | enum | `RAW_RETAINED` / `HASH_ONLY` / `PENDING_LEGAL_REVIEW` | 由来源注册表的许可状态推导 |
| `license_class` | text | 来源注册表状态快照（如 `LEGAL_REVIEW_REQUIRED`） | 与采集时注册表一致 |
| `status` | enum | `SUCCESS` / `PARTIAL` / `ERROR` / `UNKNOWN` | 超时=UNKNOWN，见幂等合同 §6 |
| `error_code` / `http_status` / `latency_ms` | | 失败与性能遥测 | 仅诊断 |
| `created_at` | timestamptz | 行创建时间 | 等于首次 ingest |

### 不可变性

- **禁止 UPDATE、禁止 DELETE**（D1 以数据库权限/触发器双保险落地；
  PGlite 场景以触发器 `RAISE EXCEPTION` 与代码层 repository 唯一入口共同保证）。
- 纠错 = 追加新行（`relation`/`relates_to` 字段见幂等合同 §5），旧行永久保留。
- blob 文件仓同样 append-only：键含 `payload_hash`，天然内容寻址、不可串改。

## 3. Layer N — NormalizedFact 字段合同

| 字段 | 说明 |
|---|---|
| `id` | uuid |
| `receipt_id` → RawObservation.id | **血缘**：每个事实指向唯一 raw receipt |
| `fact_kind` | 契约 `FACT_KINDS`（solana-readonly@2，七类） |
| `subject_mint` / `subject_project` | 事实主体 |
| `payload` | 标准事实载荷（现 contract.ts 各 Payload 类型） |
| `payload_hash` | 规范化载荷哈希（parser 确定性证明用） |
| `parser_version` | 产出本事实的 parser 版本 |
| `derived_at` | parser 运行时间 |
| `superseded_by` | uuid·null；同 (kind, subject, cutoff 语义) 下被更新事实替代时的指针；**旧行不删不改** |

规则：同一 parser 版本对同一 raw 字节必须产出字节级一致的 `payload_hash`
（D1 验收测试 P1D-T04）。

## 4. Layer P — 研究投影与现有表的关系

- `evidence` 表 = NormalizedFact 的研究视图（现字段 `hash` 升级为指向
  `fact.payload_hash`，并新增 `receipt_id`/`parser_version` 列；D1 迁移脚本处理，
  语义不变：observed/effective/ingested 三重时间与 DATA-001 泄漏守卫完全保留）。
- `gates`/`scores` 行新增 `evidence_refs`（gate 评估时实际引用的 fact id 列表）
  ——满足"每条 Evidence/Gate/Score 可追溯到 raw hash、parser、规则版本"。
- 回放：Replay Lab 只按 `observed_at ≤ cutoff` 过滤 Layer N（内核
  `latestEvidenceByCheck` 不变），Layer R 永不直接参与评估。

### 迁移注记（D1 实现时执行，此处仅登记）

fixture 供应器在 D1 改造为"合成 raw → 合成 parser → fact"管道，
使三层在纯合成数据下即可端到端验证（来源仍只有 `synthetic-fixtures`）。

## 5. 明确不做（本设计阶段）

- 不新增页面、不接真实来源、不改六门禁与阈值；
- 不引入钱包/签名/交易/AURORA；
- Layer R 不做任何"清理任务"设计——保留策略只允许 `retention_class`
  标注与未来按许可评审的处置流程，处置动作本身需要新的授权。
