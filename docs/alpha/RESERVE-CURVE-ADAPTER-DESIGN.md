# Reserve/Curve Fact Adapter Design Contract v0.1

```text
状态        APPROVED & IMPLEMENTED（主理人 2026-09-05；CCP 三裁决落定后 Adapter 实现已交付：
            lib/poolstate/adapter.ts（star-reserve-curve@1），Evidence @2 = pool-state）
裁决记录    DQ-1 = OPEN（virtual/real 归 Interpreter，Adapter 双出）
            DQ-2 = CLOSED（保留部分事实；消费者不得将 partial 当作完整 E-01 输入）
            M0 词汇演进 = SEPARATE CCP（本设计不预选 (a)/(b)）
上位合同    E-01 Interpretation Contract FROZEN-v1（2026-09-05）· E-03（已签署）
授权依据    主理人 2026-09-05 窄授权令（G1-B / Reserve-Curve Fact Adapter Design）
核心原则    Adapter 只回答「Provider 在某个 point-in-time 提供了哪些事实」，
            永不回答「这笔交易是否满足 E-01」
禁令继承    本设计不实现 Interpreter / N 求解 / 80%/15% 判断 / Gate 映射 /
            GAP-01/02/03 的任何关闭动作；不改 gates@3、不改 solana-readonly@4、
            不接 RPC、不开 Sensor、不改 Registry、不改 M0–M5
```

---

## A. Adapter Design Contract（总体契约）

```text
职责边界（唯一）：
  输入：pool 地址 + 报价资产 + 目标 slot（point-in-time）
  输出：该池在该 slot 的事实集（储备/费率/曲线参数/完整性标志）
  拒答：一切「可否成交 / 名义多大 / 是否 PASS」类问题（→ E-01 Interpreter，未授权）

事实三定律（继承 F1/F5 语义）：
  1. 原样透传——Provider 给什么记什么，String()/字节解码是格式化不是解释
  2. 缺失保持缺失——结构性必填字段缺失 → 整条事实拒绝（null → 采集失败 → UNKNOWN）
  3. UNKNOWN 保持 UNKNOWN——解码不完整时输出完整性标志，绝不补全

数据流位置（D-08 顺序的既定环节）：
  Provider（五方法，Helius 候选）→ [本 Adapter] → Fact（M0 契约）→（未授权）
  → E-01 Interpreter → Gate integration
```

## B. Raw → Fact 字段映射表

### B-1 Raydium AMM v4

| Provider 原始（getMultipleAccounts, base64） | 解码 | Fact 字段 | 说明 |
|---|---|---|---|
| 池账户 → `token_vault_a/b` 公钥 | 字节切片 + b58 | `vaultA` / `vaultB`（内部引用） | 布局偏移在实现期以已部署程序布局验证，设计不冻结偏移量（分层原则） |
| vault 代币账户（jsonParsed）→ `tokenAmount.amount` | 原样字符串 | `reserveA` / `reserveB`（raw u64 字符串） | 储备=金库代币账户余额；不换算 uiAmount |
| 池账户 → fee 字段 | 原样 | `tradeFeeNumerator/Denominator` | 费率未知/未初始化 → `feesResolved: false` → UNKNOWN（E-03 fail-closed） |
| 两 vault 的 mint | 原样 | `mintA` / `mintB` | 与请求 mint 匹配校验，不匹配 → 事实拒绝 |
| `context.slot` | 原样 | `slot` | F3 纪律：响应自带槽位，禁用独立时钟 |

### B-2 Raydium CPMM

| 原始 | Fact 字段 | 说明 |
|---|---|---|
| 池账户 → `token_a/b_vault` | `vaultA/B` | 同上 |
| vault 代币账户余额 | `reserveA/B`（raw 字符串） | 同上 |
| 池账户 → `fee_config` | `feeConfig`（原样对象）+ `feesResolved` | 同上 fail-closed |

### B-3 pump.fun bonding curve

| 原始（getAccountInfo, base64） | Fact 字段 | 说明 |
|---|---|---|
| 曲线账户 → `virtual_sol_reserves` / `virtual_token_reserves` | `virtualSolReserves` / `virtualTokenReserves`（raw 字符串） | 曲线**参数**（E-03：只用该 slot 账户里的 bonding-curve 参数） |
| → `real_sol_reserves` / `real_token_reserves` | `realSolReserves` / `realTokenReserves` | 实际深度事实 |
| → `complete` / `token_total_supply` | `complete` / `tokenTotalSupply` | complete=true → 该曲线不再是交易场所（事实标志，不是判断） |
| `context.slot` | `slot` | 同 F3 |

> **设计呈报（DQ-1，不裁决）**：pump.fun 的 R_q/R_b 对应「virtual 还是 real 储备」属于 E-01 Interpreter 对 E-03「曲线参数」的解释问题，本 Adapter 两者都作为事实输出，选择权在治理层。

### B-3-A 实现纪律（Review 增补，MUST NOT）

```text
MUST NOT：因「当前只有一个字段被消费者使用」而在 Adapter 内部提前裁决。
virtualSolReserves / realSolReserves（及 token 侧对称字段）必须同时存在、各自携带
来源语义；禁止出现 reserve = virtualReserve 这类坍缩赋值。
```

### B-4 SOL-USDC 换算池（E-02:359 依赖）

复用 B-1/B-2 同一事实模型（换算池也是池）；换算价计算属 Interpreter，Adapter 不产出价格。

## C. Point-in-Time / slot / provenance 语义

```text
1. slot 来源 = 响应 context.slot（F3 冻结纪律）；多账户聚合（getMultipleAccounts
   批量取池+vault）时取本次响应自身 context.slot，不混用其他响应的槽位
2. observedAt = 采集时刻 UTC ISO（M0 契约要求）
3. 请求 commitment 原样记录为请求参数（raw param），不做语义解释
   ——commitment 的治理语义 = F4，LOCKED，本设计不碰
4. provenance closure 链：
   响应字节 → sha256(rawRef) → Fact{slot, observedAt, source, sourceUrl}
   →（经 assertEvidence）EvidenceRecord →（未来经 M1）Observation 键
   每条 Fact 可回溯至 Provider 原始响应哈希
5. 规范池选择（earliest observed_at）：属观察层（M1/出生数据）职责，
   Adapter 接收「给定池地址」作为输入，不自行选池——数据能力不得反向定义治理规则
6. slot 与 observed_at 不得互换（Review 增补）：
   slot        = Provider 对该响应事实给出的链上位置
   observed_at = 本地/系统观察时间
7. provenance 哈希输入层级必须显式声明（Review 增补）：若原始 Provider response
   bytes 可获得，对原始 bytes 做 hash；若只能获得结构化响应，必须标记 hash 的
   输入层级，不得将 canonicalized JSON hash 冒充 raw-response hash
```

## D. Missing / UNKNOWN 语义（数据契约）

```text
情形                          → Adapter 输出
账户不存在/未初始化            → 事实拒绝（错误）→ 采集失败 → UNKNOWN
账户数据短于布局最小长度        → 事实拒绝 → UNKNOWN
费率字段缺失/未初始化          → feesResolved: false（事实保留，储备部分照记）
  裁决（DQ-2 CLOSED）：保留部分事实（ReserveFact=PRESENT + FeeFact=UNKNOWN +
  feesResolved:false），不整体拒绝；硬规则=任何消费者不得把 partial fact 当成
  complete E-01 input，Interpreter 根据缺失字段自行 UNKNOWN
complete=true（pump.fun 已毕业）→ 事实照记（complete 标志原样），判断留给 Interpreter
槽位/上下文缺失                → slot: null + 完整性标志 false → 上游 UNKNOWN
任何默认填充（?? 0 / ?? ''）    → 禁止（F5 纪律全量继承）
```

## E. Raydium / pump.fun 原始事实需求边界

```text
全部落在已冻结五方法内：
  getMultipleAccounts（池账户 + 两个 vault 代币账户，base64/jsonParsed 组合）
  getAccountInfo（pump.fun 曲线账户）
不需要：getProgramAccounts / logsSubscribe / geyser / 聚合器（E-03 禁令维持）
vault 地址发现链：池账户字节 → vault 公钥（纯解码，无额外 RPC 轮次之外的语义动作）
Token-2022 扩展事实：走既有 M3 通道（token-2022-extensions 事实类型已存在于 M0 白名单），
  与储备事实平行供给 Interpreter，本 Adapter 不合并、不解释
```

## F. 与 E-01 Interpreter 的接口边界

```text
Adapter 输出（事实）： reserves · fee fields · curve params · completeness flags · slot · provenance
Interpreter 输入需求（E-01 FROZEN-v1 行 4）： 点时储备、链上费率、曲线参数、换算价、扩展/转账限制
缺口呈报（本设计的最重要发现）：
  M0 现有事实类型 'pool-book' 必填字段仅 ['mint','quoteReserve']
  ——E-01 需要 R_q/R_b 双侧储备 + 费率 + 曲线参数 + 完整性标志，
    现有词汇表不足以承载。
  处置（待 Review 裁决，二选一）：
    (a) 'pool-book' 载荷扩展（baseReserve/fees/curveParams/completeness…）→ star-evidence@1 → @2
    (b) 新增事实类型 'pool-state-full' → 同样是 @1 → @2
  两条路都是 M0 证据契约演进，须独立 CCP，本设计不预选。
换算价事实：SOL-USDC 池同样经本 Adapter 出事实，「价」的计算归 Interpreter。

硬边界（Review 增补）：Fact schema 不得为了兼容 E-01 而预先设计成「E-01 输入结构」——
禁止出现 E01PoolInput{executableReserve, impactReserve, executableFee…} 类设计。
分层必须保持：Raw Provider Facts → Venue Facts → Evidence Facts →（Interpreter 回答
「这个世界状态意味着什么」）。Adapter 提供的是「世界是什么样」。
```

## G. 风险与尚未授权事项

```text
R-1 布局偏移量：Raydium v4/CPMM 池账户字段偏移随程序版本——设计不冻结偏移，
    实现期以链上已部署程序验证（分层原则），并要求实现附验证证据
R-2 vault jsonParsed 与 base64 混合请求的响应槽位一致性——实现期验证
R-3 M0 契约演进（F 节缺口）是硬前置：不扩展词汇表，E-01 即使授权也无输入
R-4 commitment 语义依赖 F4（LOCKED）——当前仅记录请求参数
R-5 pump.fun virtual/real 的选用 = DQ-1，Interpreter 侧治理问题
未授权清单：Adapter 实现 · Interpreter · N 求解 · gates@4 · RPC · Sensor ·
            Registry 变更 · GAP-01/02/03 关闭 · M0 契约修改
```

---

## 审阅栏（Reserve/Curve Adapter Design Review）

```text
主理人审阅    ______________    日期    ______________
裁决点        DQ-1（virtual/real 归属 Interpreter）· DQ-2（部分事实粒度）· F 节 M0 演进路径 (a)/(b)
审阅结论      APPROVE / REVISE（通过后方授权 Adapter 实现，仍不授权 Interpreter）
```
