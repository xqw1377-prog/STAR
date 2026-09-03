# P1-DATA-D0 · 事实分层合同（FACT LAYERING CONTRACT）· rev2

状态：DESIGN-ONLY（无实现；建表与代码待 D1 授权）· 基线 star-web@6f40295 · 2026-09-03
rev2 变更：Attempt/Receipt 拆分（裁定 #1）、supersedes 单向引用（#2）、PURGE 处置事件化（#5）、
`effective_time_kind`（#6）、payload 必填性修正（一致性 A）。

## 1. 四层模型

```text
Layer A  CollectionAttempt（每次请求一行，绝不去重；健康遥测）
            ↓ 收到响应字节时
Layer R  RawReceipt（SUCCESS/PARTIAL；receipt_key 幂等；不可变）
            ↓ parser_version（重放，不重采集；仅 SUCCESS 可入）
Layer N  NormalizedFact（append-only；supersedes_fact_id 单向引用；CONTESTED 不入投影）
            ↓ rule_version + interpretation_context（评估时冻结）
Layer P  Evidence / Gate / Score（研究投影；HISTORICAL / REINTERPRET 两种回放模式）
```

**核心禁令**：任何 Gate、Score、页面、API 都不得直接解释 Layer R/A。
无响应（超时/错误）**不是** RawReceipt——它们只存在于 Layer A，不伪装成观察。

## 2. Layer A — CollectionAttempt 字段合同（冻结）

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` | uuid | 行标识 |
| `observation_key` | char(64) | 查询身份（IDEMPOTENCY §2） |
| `collection_run_id` | uuid | 采集批次 |
| `request_params` | jsonb | 本次请求参数快照（审计） |
| `started_at` / `completed_at` | timestamptz | 请求起止 |
| `latency_ms` / `http_status` | | 性能与传输遥测 |
| `outcome` | enum | `RESPONSE_RECEIVED` / `TIMEOUT` / `ERROR` / `ABORTED` |
| `error_code` | text·null | TIMEOUT/ERROR 的机器可读原因 |
| `receipt_id` | uuid·null | `RESPONSE_RECEIVED` 时指向 RawReceipt；其余为 null |
| `attempt_origin` | enum | `INITIAL` / `RETRY` / `CRASH_REPLAY` / `SCHEDULER_REISSUE`（裁定终检 #2：区分一次物理请求、客户端重试、进程崩溃后重放、调度器补发） |
| `retry_of_attempt_id` | uuid·null | 重试链：指向本 attempt 所重试的前一次 attempt；INITIAL 为 null |
| `error_body_hash` / `error_body_ref` | char(64)·null / text·null | **HTTP 错误响应若实际收到字节**（终检 #1）：至少存哈希；字节本体仅在 `retention_class` 允许 RAW_RETAINED 时落 blob，受 §4 处置规则约束 |
| `created_at` | timestamptz | 行创建（写入发生在请求完成时，行本身不可变） |

约束：**无任何唯一约束、绝不去重**——同一查询的重试每次都是新 Attempt（裁定 #1）。
一行 = 一次物理请求；`attempt_origin` + `retry_of_attempt_id` 链可无损重建
"原始请求 → 客户端重试 → 崩溃重放"的完整序列（终检 #2）。
Layer A 的唯一消费者是数据健康模型与采集调度。

## 3. Layer R — RawReceipt 字段合同（冻结）

| 字段 | 类型 | 语义 | 约束 |
|---|---|---|---|
| `id` | uuid | 行标识 | 生成后不变 |
| `observation_key` | char(64) | 查询身份 | 与产生它的 Attempt 一致 |
| `collection_run_id` / `attempt_id` | uuid | 血缘到批次与请求 | |
| `anchor_slot` / `anchor_time` | bigint·null / timestamptz·null | 链上/离线锚 | 二者至少其一 |
| `effective_at` | timestamptz·**null** | 事实发生时间，**可空**（见 `effective_time_kind`） | 非 null 时受 `effective_at ≤ ingested_at` 不变式 |
| `effective_time_kind` | enum | `CHAIN_EVENT` / `OBSERVATION_BOUND` / `UNKNOWN`（裁定 #6） | 见 §3.1 |
| `scheduled_at` | timestamptz·null | 未来计划生效时间（锁仓解锁、Cliff）；不参与不变式；不得作为已发生事实入 Evidence | |
| `observed_at` / `ingested_at` | timestamptz | 观察时间 / 入库时间 | 沿用内核不变式 |
| `payload_bytes_hash` | char(64) | **原始响应字节**（as-received，零规范化）的 SHA-256 | 必填（有字节才有 Receipt） |
| `payload_ref` / `payload_inline` | text / bytea·null | blob 键 / ≤4KB 内联 | **二者至少其一，必填**（一致性 A） |
| `schema_version` | text | raw 信封版本（`star-raw@2`） | |
| `parser_version_at_ingest` | text | 摄取时 parser 最新版（信息性快照，不变） | |
| `retention_class` / `license_class` | enum / text | 许可与保留类别（来源注册表快照） | |
| `status` | enum | **`SUCCESS` / `PARTIAL`（仅此两种）** | 超时/错误留在 Layer A |
| `relation` / `relates_to` | enum·null / uuid·null | `CONTESTS` / `SUPERSEDES` 及其指向（IDEMPOTENCY §4） | 追加时写定，不再修改 |
| `created_at` | timestamptz | 首次 ingest | |

### §3.1 `effective_time_kind`（反误报规则，裁定 #6）

- `CHAIN_EVENT`：事实由链上交易/事件直接产生且其时间可知（如从签名/区块时间取得）——
  此时 `effective_at` 非空且为事件时间；
- `OBSERVATION_BOUND`：账户状态**快照**类观察（权限、余额、持币分布）——
  无法知道"实际发生变化的时间"，只声明"至少在此刻为真"：
  `effective_at = observed_at`，语义为上界声明，**不主张此刻发生**；
- `UNKNOWN`：连上界都不可靠（如来源无时间锚）——`effective_at = null`。
- 快照误报为事件是类别错误；门禁与回放解释 payload 时不因 kind 改变结论，
  kind 只约束"发生时间"的表述与不变式适用。

## 4. 不可变性与受控例外（裁定 #5 重构）

- **RawReceipt 行禁止 UPDATE、禁止 DELETE**（触发器 + repository 单入口双保险，D1 落地）。
- 纠错 = 追加新行（relation/relates_to），旧行永久保留。
- blob 仓内容寻址（键 = payload_bytes_hash）。
- **处置（disposition）不触碰 Receipt 行与 blob 键**：
  append-only 的 `raw_disposition_event` 表记录一切处置：

| 字段 | 说明 |
|---|---|
| `receipt_id` | 处置对象 |
| `disposition` | `PURGE` / `QUARANTINE` / `HOLD` / `RELEASE` |
| `basis` | 触发依据（来源注册表变更引用 / 合规指令引用 / 校验失败证据） |
| `authorization_ref` | 授权引用（必填） |
| `created_at` | 事件时间 |

  - **PURGE**：**物理删除 blob 文件**；Receipt 行原样保留，`payload_bytes_hash`
    作为「删除前存在过」的证明；读取层 join 处置链后返回 `PURGED`（读不到字节）。
    **禁止**：在原 hash 键下覆盖、写墓碑、改字节或复用该键装别的对象。
    内容寻址对象一旦写出，键与历史哈希永不被改写。新对象只用新哈希。
  - **QUARANTINE**：行排除出重放与派生，字节保留取证；
  - **HOLD**：活动 HOLD **阻止**对同一 receipt 执行 PURGE（优先级最高）；
  - 无处置事件引用的任何行状态变化被触发器拒绝（静默迁移不存在）。

### §4.1 处置事件全序与并发竞态（终检 #4）

- 同一 receipt 的处置事件按 **(created_at, event_id) 全序**排序，无并发歧义；
- **PURGE 两阶段**：`PURGE_REQUEST` 事件 → 物理删除 → `PURGE_EXECUTED` 事件。
  执行条件：在全序区间 `[PURGE_REQUEST, PURGE_EXECUTED)` 内**不存在**任何
  针对同一 receipt 的 `HOLD` 事件；存在则 PURGE 取消（记录 `PURGE_CANCELLED`）；
- 并发 HOLD vs PURGE_REQUEST：按全序**先到者胜**——HOLD 在前 ⇒ 阻断；
  PURGE_REQUEST 在前且已完成执行 ⇒ HOLD 只影响后续（字节已删，hash 留证）；
- `QUARANTINE`/`RELEASE` 单阶段，按全序幂等叠加，当前状态 = 最后一条事件；
- 触发器以全序区间检查实现，杜绝"检查-执行"窗口竞态。

## 5. Layer N — NormalizedFact 字段合同（裁定 #2 重构）

| 字段 | 说明 |
|---|---|
| `id` | uuid |
| `receipt_id` → RawReceipt | 血缘：唯一，且该回执 `status=SUCCESS`（规则 R1） |
| `fact_kind` / `subject_mint` / `subject_project` | 契约七类 / 事实主体 |
| `payload` / `payload_hash` | 标准载荷（规范化哈希，命名空间 `star-fact-v1`） |
| `parser_version` | 产出本事实的 parser 版本 |
| `derived_at` | parser 运行时间 |
| **`supersedes_fact_id`** | uuid·**null**；**新行单向引用被它替代的旧 fact**；**旧行永不修改** |

- 原 `superseded_by`（旧行回填）设计**废除**——那需要 UPDATE，违反 append-only；
- 替代链沿 `supersedes_fact_id` 正向遍历即可重建任意时点版本序列；
- **append-only fact relation**：CONTESTS / SUPERSEDES 不改已存在的 fact 或 receipt 行。
  关系本身是新插入的 `fact_relations`（及 RawReceipt 上仅写在**新行**的 `relation`/`relates_to`）：

  | 字段 | 说明 |
  |---|---|
  | `id` | 关系行，插入后禁止 UPDATE/DELETE |
  | `kind` | `CONTESTS` / `SUPERSEDES` |
  | `from_fact_id` / `to_fact_id` | 新 → 旧（或对等冲突两端） |
  | `created_at` | 写入时间 |

  禁止在旧 fact 上回填指针。更复杂多对多只许再追加关系行，不许改旧行。

## 6. Layer P — 投影与回放（裁定 #4 重构）

- 每次评估（gate/score/replay）写入**冻结的** `interpretation_context`：
  `{ contract_version, parser_versions: {fact_kind → version}, rule_version,
     fact_ids: […] }`——评估结论与它的解释版本集合永远一起可查；
- **回放两种模式，禁止静默混用**：
  - `HISTORICAL`：使用**当次评估冻结的** interpretation_context 重放——
    原结论字节级可复现，与之后 parser 升级无关；
  - `REINTERPRET`：使用**当前** parser 集合重新解释 Layer R——输出必须携带
    `reinterpreted=true` 标记，且不覆盖任何 HISTORICAL 结论；
- 原"默认选择最新 parser 版本"的措辞**废除**；
- Replay Lab 默认模式为 HISTORICAL；REINTERPRET 需显式选择并明示。
- `evidence` 表 = Layer N 研究视图（新增 receipt_id/parser_version 列，
  三重时间与泄漏守卫语义不变）；`gates`/`scores` 行携带 interpretation_context 引用。

## 7. 明确不做（本设计阶段）

不新增页面、不接真实来源、不改六门禁与阈值、不引入钱包/签名/交易/AURORA；
Layer R/A 不做清理任务——一切处置走 §4 授权事件。
