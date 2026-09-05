# Evidence Vocabulary CCP：star-evidence@1 → @2 提案

```text
状态        APPROVED & IMPLEMENTED（主理人 2026-09-05 三项裁决：路径 (b) pool-state ·
            校验仅新 kind · 即授权 Adapter 实现；已落地为 star-evidence@2 + lib/poolstate/）
动机        Reserve/Curve Fact Adapter Design（APPROVED 2026-09-05）F 节确认的硬前置：
            E-01（FROZEN-v1）输入需要双储备/费率/曲线参数/完整性标志，
            现有 pool-book 词汇无法合法承载——不解决则授权 Adapter 只会产出
            无法进入冻结 Evidence 链的孤立事实结构
上位约束    E-01 FROZEN-v1 行 4（输入清单）· 设计合同 F 节硬边界
            （Fact schema 不得预设计为 E-01 输入结构）
```

---

## 一、现状（代码级）

| 层 | 现状 | 位置 |
|---|---|---|
| M0 事实类型 | `'pool-book'` 在白名单，门禁资格 = `[]`（观察层） | `lib/evidence/contract.ts:64,86` |
| M0 载荷校验 | **无 per-kind 字段校验**——assertEvidence 只查 value 是对象 | `contract.ts:139` |
| M1 观察层 | per-kind 必填字段表：`pool-book: ['mint','quoteReserve']` | `lib/observation/decode.ts:26` |
| 现有生产者 | M1 夹具流（`fixture-source.ts:44`）产出 `{mint, quoteReserve}` | 唯一活跃发射点 |

**缺口**：E-01 需要的 `R_q/R_b 双侧储备 · 费率字段+feesResolved · 曲线参数（pump.fun virtual/real 双出） · completeness 标志 · venue 语义` 在词汇表中无合法位置。

## 二、两条演进路径

### 路径 (a)：扩展 `pool-book` 载荷

```text
pool-book 必填扩为：mint · poolAddress · venue · slot
可选新增：reserveQuote · reserveBase（raw 字符串）
         feeFields（原样对象）· feesResolved（bool）
         virtualSolReserves/virtualTokenReserves/realSolReserves/realTokenReserves（pump.fun）
         complete（bool）
M1 decode 必填表同步扩展；M0 可选引入 per-kind 载荷 schema 校验（能力新增）
```

| 影响面 | 说明 |
|---|---|
| 破坏性 | **是**——现有 pool-book 发射点（M1 夹具流）载荷不含新必填字段，须同步改 |
| 波及 | `evidence/contract.ts` · `observation/decode.ts` · `observation/fixture-source.ts` · 对应测试（M0/M1 两层） |
| 语义风险 | 「book」一词原义是点时报价簿（quote 单侧）；强行承载全池状态是**词义漂移**，历史证据的 pool-book 与新 pool-book 语义不可区分（同 kind 两代含义） |

### 路径 (b)：新增 `pool-state` 事实类型（additive）

```text
新增 kind：'pool-state'（命名避开 E-01 输入结构色彩，遵守设计合同硬边界）
门禁资格：[]（观察层，与 pool-book 同——E-01 经 Interpreter 消费，不直接入门禁）
必填：mint · poolAddress · venue('raydium-amm-v4'|'raydium-cpmm'|'pump.fun-curve') · slot
载荷词汇（venue 全量可选字段，按设计合同 B 节映射表）：
  raydium 系：reserveQuote/reserveBase（raw 字符串）· vaultA/vaultB ·
             feeFields（原样）· feesResolved（bool）
  pump.fun：virtualSolReserves/virtualTokenReserves/realSolReserves/
            realTokenReserves · complete · tokenTotalSupply
  通用：feesResolved · completeness 标志族
'pool-book' 原样保留（现有发射点零改动），标记 deprecated-for-E01（仅注释级，
     不移除——历史证据兼容）
M1 decode 必填表新增 'pool-state' 条目；M0 白名单新增 kind
```

| 影响面 | 说明 |
|---|---|
| 破坏性 | **否**——纯增量；现有 pool-book 发射点、测试、观察数据全部不动 |
| 波及 | `evidence/contract.ts`（+1 kind、资格表 +1 行）· `observation/decode.ts`（+1 必填条目）· 新增测试 |
| 语义风险 | 两种池事实并存需 deprecated 注记；长期清理另案 |

## 三、提案方建议（供裁决，不预选）

**建议路径 (b)**，理由：

1. **分层原则一致性**：@2 是证据词汇演进，不应同时制造破坏性变更——(a) 把「扩词汇」与「改存量生产者」捆在一个 CCP 里，违背一道门一道门过；
2. **词义诚实**：pool-book=点时簿（quote 侧），pool-state=池状态快照（双侧+费率+曲线）——两个概念本就该有两个名字；强行一词两义会重演「executable 一个字段两种语义」的教训；
3. **provenance 清晰**：历史 pool-book 证据与新 pool-state 证据天然分流，无需版本嗅探；
4. **回滚容易**：additive 失败只需删 kind，不动存量。

**无论 (a)/(b)**，本 CCP 同时提交一项**能力新增供裁决**：M0 是否引入 per-kind 载荷 schema 校验（现状只查「是对象」）。建议：@2 仅对**新增/扩展的 kind** 引入必填字段校验（M1 已有此机制，M0 对齐），存量 kind 不溯及——避免一次 CCP 变成全量重构。

## 四、不变式核对（两路径通用）

```text
✓ 新词汇不含 score/verdict/rating 字样（no-score 正则测试继续成立）
✓ pool-state 门禁资格 = []（永不直接入门禁——E-01 经 Interpreter，未授权）
✓ 虚/实储备并列输出（DQ-1 OPEN：选择权在 Interpreter）
✓ 费率缺失 feesResolved:false（DQ-2 CLOSED：部分事实保留）
✓ Fact schema 不预设计为 E-01 输入结构（命名与字段按 Provider/venue 语义，
  不出现 executable/impact 前缀）
✓ M0 六不变式、GATE_ELIGIBLE 白名单结构、assertEvidence fail-closed 语义不变
✓ gates@3 / solana-readonly@4 / GAP-01/02/03 / Registry / RPC / Sensor 全部不动
```

## 五、批准后的实施边界（届时另请实现授权）

```text
文件清单（预估，路径 b）：lib/evidence/contract.ts · lib/observation/decode.ts
                        · lib/evidence/contract.test.ts · lib/observation 测试
测试计划：新 kind 白名单/资格/校验用例 · no-score 不变式回归 ·
          M1 管道对新 kind 的 decode/幂等 · 全量套件
版本动作：EVIDENCE_CONTRACT_VERSION 'star-evidence@1' → '@2' ·
          CAPABILITY-LEDGER 登记 · capability.test 断言更新
```

---

## 审阅栏（Evidence Vocabulary CCP Review）

```text
主理人审阅    ______________    日期    ______________
裁决点        路径 (a) / (b) · per-kind 载荷校验范围（仅新 kind / 全量 / 不引入）
审阅结论      APPROVE / REVISE（通过后授权 CCP 实施；Adapter Code 在其后另行授权）
```
