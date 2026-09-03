# P1-DATA-D0 · 审计处置总账（AUDIT_DISPOSITION）· rev6

登记两轮外部审计全部发现的处置归属；本文件只登记，不实现。

## 运行时阻断（第二轮审计 P0-1…P0-5）

| 编号 | 发现 | 处置阶段 |
|---|---|---|
| P0-1 | 旧 score 残留 + Top-K 无当前 readiness 校验 → 失败项目留在可决策队列（含 C2） | **J0**（readiness/队列过滤语义冻结后修复）+ D1-B（评分读取时态化） |
| P0-2 | 来源失败/过期不降级旧 PASS（缺 evidence validity/SLA 机制） | **D1-B**（合同归宿 = R5-12 EvidenceEligibilityPolicy：asOf/来源 SLA/事实时态/冲突/许可五输入；过期强制事实 ⇒ UNKNOWN） |
| P0-3 | Replay 读当前 narratives/lifecycle（前视） | **D1-B**（TEMPORAL_RESEARCH_CONTEXT 已合同化，T29/T30） |
| P0-4 | ingestedAt 先于 observedAt 生成 → 真源事实被自隔离 | **D1-B**（写入前时态校验 + 固定采集时钟） |
| P0-5 | API 密钥反射（canary 实测）+ seed/collect 无鉴权/限流 + 无安全头 | **S0**（工单见下） |

## S0 安全补丁工单（冻结范围，待显式授权后执行——代码修改）

1. `providerStatus()` / `GET /api/collect`：永不返回 RPC URL、query、header、任何环境派生值；
2. seed/collect 写接口：production 默认关闭；本地/测试经显式开关 + 独立 token；
3. seed 标记 destructive、仅限合成数据库；
4. collect：请求上限、`projectId` 必填、来源门禁（403 语义保留）；
5. 安全响应头（CSP/Frame-Options/Referrer-Policy/Permissions-Policy）；
6. 前置检查：若历史公网暴露过含密钥 URL → 轮换密钥（本仓库核查结论：无 .env、默认公共 RPC、仅 localhost，未发现暴露证据）。

## 门禁错误确定性（第二轮审计第三节）

| 发现 | 处置 |
|---|---|
| assertFact 只验信封不验 payload | **D1-A**：每 fact kind 的 payload schema 校验进 parser 门（R1 扩展） |
| 报价缺 priceImpactPct 视为可执行 | **J0**：缺失 ⇒ UNKNOWN（fail-closed）规则冻结后修 |
| exitDepthUsd>0 即过、无规模阈值 | **J0**（GATE-003 规模化退出深度） |
| lockedUntil 过期仍 PASS | **J0**（锁定语义：过期=未锁） |
| 小池锁仓为聚合 TVL 背书 | **J0**（LP 判定按池归因） |
| 短/畸形 program account → immutable | **D1-A**（payload 校验拒绝畸形输入 ⇒ UNKNOWN） |
| immutable 即 PASS、不要求 build/owner 证明 | **J0**（GATE-006 语义细化） |
| mint/freeze 理由文本互相污染 | **J0**（按 check 归因理由） |
| Number(supply) 大整数精度 | **D1-A**（bigint 字符串运算） |
| clusterPct 由 fixture 直供即可 PASS（graphIngested 不存在） | **D1-B**（钱包图血缘要求；现状态已在 D0 合同中以 receipt lineage 覆盖，实现跟进） |

## 工程/供应链/测试（第二轮审计第五节）→ 登记为 BACKLOG（阶段归属）

| 项 | 归属 |
|---|---|
| npm audit 6 项（Next 14.2.35 / PostCSS 高危） | S0 后专项评估升级路线（独立授权） |
| drizzle-kit 误入 dependencies、旧 esbuild | D1-A 前依赖整理 |
| 6 组零引用依赖（duckdb×2/cytoscape×2/zustand/date-fns） | D1-A 前移除 |
| 无 CI / .env.example / engines / 迁移漂移检查 | D1-A 配套 |
| init.sql、drizzle schema、浏览器/服务端 DB 多套状态源 | D1-A 统一迁移策略 |
| 核心写入无事务 | D1-A（§3.1 原子事务为起点） |
| evidence/回放/外键无索引 | D1-A 性能配套 |
| E2E 环境受阻（审计容器无 Chromium） | 已有历史 7/7 证据 + 零 diff 论证；CI 化后消除 |

## 基线更正（沿用 rev4 记录）

ffaf938/20c2bca 载体干净；"未提交改动"指向已隔离的本机 main（5f0001a 已 revert）。
