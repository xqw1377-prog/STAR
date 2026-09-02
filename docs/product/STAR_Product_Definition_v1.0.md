# STAR Product Definition v1.0

> 阅读摘录，不是内容真源。唯一原件：`STAR_Product_Definition_v1.0.docx`
> SHA-256 `9634c819b3662b10d6bbcf844c499141baa252ef71976a9f6e3453f348da88d5`。
PRODUCT DEFINITION
STAR
Signal · Truth · Alpha · Risk
链上早期机会情报与项目审计系统
在叙事成为共识之前发现机会，以可追溯事实排除骗局、拥挤与不可退出的交易。
版本
日期
状态
v1.0
2026-09-02
产品定义 · 待评审
冻结决策
独立项目  ·  Solana 优先  ·  BNB Chain 第二阶段  ·  只读  ·  不连接钱包  ·  不自动交易
产品底线
STAR 不通过热度替代事实，不允许高收益潜力抵消关键安全失败。任何关键事实 UNKNOWN，项目不得进入可决策状态。
本文件定义 STAR 的产品合同、证据模型、评分边界、用户工作流、数据架构与分阶段验收。它不是投资建议，也不构成自动交易授权。
目录  /  PRODUCT DEFINITION
文档导航
20 个产品定义章节，从边界、证据和门禁一路落到 MVP 与验收。
章节
主题
核心产出
00–03
执行摘要、边界、用户、工作流
产品合同与晋级流程
04–08
证据、叙事、门禁、评分、实体图
STAR 的判断内核
09–11
信息架构、关键页面、告警运营
第一版产品体验
12–14
系统架构、开源边界、回放与 Shadow
数据与验证闭环
15–19
指标、路线图、MVP、风险、下一步
GO / NO-GO 计划
快速阅读路径
读者
建议章节
产品负责人
00 → 01 → 03 → 09 → 15 → 16 → 19
研究负责人
04 → 05 → 06 → 07 → 08 → 14
工程负责人
04 → 12 → 13 → 14 → 15 → 17
安全/合规
01 → 04 → 06 → 08 → 13 → 18
阅读约定
文档中的“建议目标”需要由历史语料校准；“冻结决策”与硬安全门禁在下一版变更时必须经过正式评审。

## 00 · PRODUCT DEFINITION

执行摘要
从周期热点中寻找早期机会，但把“可证明、可进入、可退出”置于热度之前。
一句话定义
STAR 的北极星
持续发现少数值得研究的链上早期机会，并以时间一致、可追溯的证据排除大多数骗局、伪热度和拥挤交易。
为什么现在需要 STAR
每一轮加密周期都会出现具有强财富效应的新叙事：上一轮的铭文、Solana Meme、AI 代币只是案例。真正的优势通常不是杠杆，而是更早识别叙事、更快验证项目真实性、更准确判断筹码与退出条件，并在大众共识形成前完成研究。
	•	信息分散：链上、代码、团队、社交、融资、锁仓和流动性事实散落在不同平台。
	•	噪声与操纵：机器人放量、批量钱包、KOL 先买后喊、假社区和伪锁仓会制造错误信号。
	•	后见之明偏差：很多“成功案例”只在涨完后看起来合理，缺少当时可获得的证据快照。
	•	安全与机会混算：多数评分器让热度抵消合约或流动性风险，产生危险的高分项目。
产品承诺与非承诺
STAR 承诺
STAR 不承诺
更早发现、证据可追溯、风险先过滤、生命周期可解释
预测所有百倍币、保证收益、替代人工判断
给出事实、推断、未知项和置信度
把单一第三方安全分数当成事实
历史无前视回放与前向 Shadow 验证
在产品早期连接钱包或自动下单

## 01 · PRODUCT DEFINITION

产品合同与边界
先定义不可跨越的边界，再讨论能力扩展。
产品身份
维度
定义
名称
STAR — Signal · Truth · Alpha · Risk
中文定位
链上早期机会情报与项目审计系统
第一目标
发现处于早期生命周期、具有可验证催化且具备真实退出条件的项目
首发链
Solana
第二链
BNB Chain
运行模式
只读研究；不连接钱包；不签名；不提交交易
部署关系
独立仓库、独立数据库、独立配置、独立 CI/CD；与 AURORA 零共享运行依赖
明确排除
	•	不做狙击机器人、跟单机器人、MEV、自动交易或私钥托管。
	•	不把社交热度、名人提及或短时涨幅直接解释为正向价值。
	•	不承诺以“AI 黑箱”替代证据；模型输出必须能追溯到原始观察。
	•	不在 MVP 阶段铺设多链空壳；Solana 闭环通过后才进入 BNB Chain。
	•	不复用 AURORA 的执行、风控、配置、数据库或进程。
架构隔离原则
STAR 与 AURORA 可以共享人的认知，但不能共享代码导入、密钥、账本、部署单元或运行状态。未来若产生研究信号，也只能经版本化、只读接口对外发布。

## 02 · PRODUCT DEFINITION

目标用户与核心任务
首期面向一个小型研究团队，但把角色权限设计清楚。
角色
核心问题
需要的输出
投资决策者
现在值得投入研究精力的主题和项目是什么？
Top-K 候选、证据摘要、否决项、生命周期、退出风险
叙事研究员
新叙事是否真正扩散，还是少数账号制造？
语义簇、独立作者、增速、跨链/链上确认、来源谱系
项目审计员
合约、筹码、团队、锁仓和流动性是否可信？
审计卡、钱包图、关键 UNKNOWN、事实变化告警
数据运营员
数据是否完整、延迟、冲突或被供应商污染？
数据健康、来源 SLA、回放一致性、证据覆盖率
首期核心 Job-to-be-Done
	•	每天在 15 分钟内知道：哪些链、哪些叙事、哪些项目值得新增研究。
	•	打开项目卡后在 5 分钟内知道：通过了什么、失败了什么、还有什么不知道。
	•	任何关键事实变化后在 60 秒至 5 分钟内收到可行动告警，而非重复噪声。
	•	用当时可见的数据回放历史周期，验证系统是否真的提前，而非事后解释。
	•	在前向 Shadow 中验证发现质量、风险拦截率和可退出性，仍不触碰资金。
第一版权限
能力
Reader
Analyst
Approver
Operator
查看事实与评分
✓
✓
✓
✓
新增研究备注
—
✓
✓
✓
更改项目状态
—
建议
批准
维护
更改评分规则
—
—
批准
发布
数据源配置
—
—
—
✓

## 03 · PRODUCT DEFINITION

端到端产品工作流
从周期雷达到证据决策，再到无资金的验证闭环。
标准工作流
阶段
系统动作
人工动作
输出
1 周期雷达
计算链上活跃、资本流、DEX 新池与叙事变化
确认宏观环境与关注链
Chain Watchlist
2 叙事发现
聚类新概念并识别增速、广度与独立传播
合并别名、标注伪叙事
Narrative Card
3 项目发现
将合约、代币、池、代码仓、团队与叙事关联
确认项目身份
Project Candidate
4 事实核验
抓取链上/代码/团队/融资/社交证据
处理冲突与 UNKNOWN
Evidence Graph
5 风险门禁
执行不可抵消的安全检查
批准例外或保持拒绝
PASS / FAIL / UNKNOWN
6 机会评估
计算机会分、置信度、数据新鲜度与生命周期
形成研究结论
Decision Brief
7 观察验证
进入 Watchlist / Shadow，持续监控事实变化
复盘误判
Performance & Learning
晋级规则
	•	发现 ≠ 推荐：新项目先进入 DISCOVERED，不立即显示为可决策。
	•	关键风险 UNKNOWN ≠ PASS：关键字段缺失时只能进入 RESEARCH_REQUIRED。
	•	安全门禁 PASS 后才计算机会得分；二者永远不相加。
	•	机会得分高但生命周期已进入 CROWDING，默认禁止新增进入。
	•	所有状态变化都记录规则版本、证据快照、操作者与时间。
Decision Readiness
可决策性 = Gate Status × Evidence Completeness × Opportunity Score × Lifecycle Fit。这里的“×”表示任何关键维度为零都会阻断，不是简单加权平均。

## 04 · PRODUCT DEFINITION

核心对象与证据模型
把事实、主张、推断和评分拆开，避免系统把猜测存成真相。
领域对象
对象组
核心对象
说明
市场
Chain, Block, DEX, Pool, PriceObservation
链、区块、流动性与可成交事实
资产
Project, Token, Contract/Program
项目身份与链上部署分离建模
主体
Wallet, Entity, TeamMember, SocialAccount
地址不是人；Entity 是带置信度的归因
叙事
Narrative, TopicCluster, Catalyst, LifecycleTransition
语义簇、事件与阶段演化
证据
Source, Observation, Evidence, Claim, Contradiction
原始观察与解释分层
风控
RiskFinding, GateResult, AuditSnapshot
不可抵消的失败/未知项
决策
ScoreSnapshot, Decision, WatchlistItem, ShadowPosition
版本化评分和无资金验证
事实的三重时间
字段
含义
用途
effective_at
事实在现实或链上生效的时间
判断项目当时真实状态
observed_at
STAR 或来源第一次观察到该事实的时间
禁止回放使用未来信息
ingested_at
数据进入 STAR 的时间
审计延迟、重放与供应商 SLA
Claim / Evidence / Inference
层
示例
规则
Claim 主张
“团队代币锁仓 12 个月”
必须可被证据支持或反驳
Evidence 证据
链上 vesting 合约、交易哈希、官方条款快照
保存来源、哈希、时间与原文片段
Inference 推断
“短期团队抛压较低”
必须标注模型/规则版本、置信度和反例
点时证据原则
历史回放只允许使用 observed_at 不晚于回放时点的证据。今天知道的团队身份、锁仓解除或跑路结果，不能倒灌到过去。

## 05 · PRODUCT DEFINITION

叙事引擎与生命周期
STAR 要识别“正在形成的共识”，而不是复述已经发生的上涨。
叙事评分输入
维度
正向信号
操纵防线
新颖性
新语义簇、旧叙事的新可验证催化
与历史语料去重；禁止同义改名刷榜
速度
独立来源与高质量作者的增速
机器人/复制文案降权；按实体而非账号计数
广度
开发者、交易者、媒体、链上资金多群体扩散
单一 KOL 或单群体不得构成广度
链上确认
新项目、新池、活跃地址、资金流同步出现
剔除女巫集群、刷量和内部转账
项目存活
同叙事项目在 7/30/90 天仍有开发与流动性
失败样本进入负反馈，不只保留赢家
生命周期状态机
阶段
判定信号
产品动作
SEED 种子
小规模高质量来源出现，链上确认有限
观察；收集身份与催化证据
IGNITION 点火
传播速度上升，链上新项目/资金开始确认
新增候选；提高研究优先级
VERIFIED 验证
叙事与多项链上事实相互印证
允许通过门禁的项目进入 Shadow
ACCELERATION 加速
资本、用户、开发与传播持续扩张
重点监控持仓集中、流动性和异常
CROWDING 拥挤
大众关注、估值和拥挤指标显著上升
默认停止新增；转向退出风险
DISTRIBUTION 派发
聪明钱/团队净流出、成交结构恶化
高危告警；复盘先行指标
DEAD 失效
活跃、流动性或叙事持续衰减
归档为正/负样本
状态切换采用滞回：晋级与降级使用不同阈值，并要求最短确认窗口，减少社交事件造成的来回抖动。名人提及属于 Catalyst，不是自动加分项。

## 06 · PRODUCT DEFINITION

项目审计与硬风险门禁
任何关键失败或未知都不能被热度、团队故事或价格表现抵消。
门禁输出
状态
含义
后续动作
PASS
关键检查均有新鲜、可验证证据且无阻断项
允许进入机会评分
FAIL
存在可利用权限、不可退出、严重集中或事实造假
拒绝晋级；持续监控事实变化
UNKNOWN
关键数据缺失、冲突或来源超时
Fail-closed；进入 RESEARCH_REQUIRED
Solana 首期门禁
	•	代币权限：mint / freeze authority、Token-2022 扩展、transfer hook、永久委托、费用配置。
	•	可买可卖：通过受控模拟验证真实交易路径、税费、失败条件与滑点；不以网站声称为准。
	•	流动性：池归属、LP 锁定/销毁事实、可退出深度、单侧抽走能力与路由依赖。
	•	筹码：Top holder、部署者/团队/早期钱包聚类、同槽买入、共同资金源、内部转账。
	•	代码与身份：Program 是否可验证构建、升级权限、代码仓连续性、官方域名和账号控制。
BNB Chain 第二阶段门禁
	•	Owner / Proxy / Upgrade / Mint 权限，黑名单、暂停、最大交易、最大钱包与动态税。
	•	Honeypot 与买卖模拟；以真实路径为准，不只依赖静态扫描。
	•	源码可验证性、字节码与源码一致性、Slither/Mythril 发现及人工复核。
	•	LP 锁定/销毁、Timelock、Multisig、解锁计划和团队关联钱包。
锁仓不是布尔值
STAR 分别记录代币归属、LP 锁定/销毁、金库多签/时间锁、解锁曲线与受益实体。任何“已锁仓”标签都必须能展开到具体合约、数量、期限和控制权。

## 07 · PRODUCT DEFINITION

机会评分、置信度与可退出性
风险决定能不能研究；评分决定值不值得投入研究精力。
机会评分（门禁 PASS 后计算）
维度
权重
核心问题
代表性输入
Narrative
25
叙事是否早、真、广，并有链上确认？
新颖性、速度、广度、链上活动、项目存活
Team / Product
20
团队与产品是否真实、持续交付？
身份谱系、代码提交、产品使用、融资证据
Capital / Holders
20
资金与筹码结构是否健康？
钱包集群、聪明钱、团队净流、集中度
Market Structure
20
是否能以合理滑点进入并退出？
深度、成交质量、路由、FDV/流通、锁仓
Lifecycle Fit
15
当前阶段是否仍提供非拥挤赔率？
阶段、拥挤度、催化窗口、失速信号
四个独立输出
输出
范围
不可混合的原因
Gate Status
PASS / FAIL / UNKNOWN
安全与事实完整性是一票否决
Opportunity Score
0–100
衡量研究优先级，不代表收益承诺
Confidence
0–1
衡量证据一致性、独立来源与模型稳定性
Freshness
0–1
衡量关键证据是否仍在 SLA 内
可退出性优先
STAR 不以 K 线中间价估算可交易收益，而以真实池深度、路由、费用、价格冲击和拥堵情境评估退出。项目可以“基本面有趣”但“当前不可进入”；系统必须允许这种分离表达。
评分使用纪律
不要在 30 个指标上追求看似精确的 87.4 分。首期只保留可解释、可回放、能改变决策的特征；所有权重都有版本号，并接受消融测试。

## 08 · PRODUCT DEFINITION

钱包实体图与反操纵
地址不是主体，交易量也不等于真实需求。
实体解析
证据
可支持的推断
限制
共同资金来源
一组地址可能由同一主体控制
交易所出金、桥和空投会造成误聚类
同槽/近同时买入
可能为同一 bundle、机器人或内部协同
高热事件中自然同步也会发生
直接转账与循环路径
团队、做市或关联资金网络
必须识别路由器与公共服务地址
金额/时间模式相似
自动化钱包集群
只能作为软证据，不单独定性
部署、创建池、初始供给
项目控制或早期分配关系
需结合代码、域名和社交证据
反操纵检测
	•	刷量：买卖循环、短持仓、相同资金源、异常低独立交易者占比。
	•	假社区：复制文案、机器人时间谱、账号创建批次、互动网络高度集中。
	•	KOL 前置仓：首次买入早于公开提及，且提及后向关注者分配风险。
	•	批量钱包：表面 holder 分散但实体聚类后集中度显著上升。
	•	伪开发：Fork/模板仓、集中补历史 commit、无发布物、代码与部署不一致。
诽谤与误伤控制
Entity 归因和团队关联均以概率表达；对外展示使用“系统发现的关联证据”，不直接宣称违法或欺诈。高影响结论必须人工复核。

## 09 · PRODUCT DEFINITION

产品信息架构
页面围绕用户问题组织，不围绕数据表组织。
页面
用户问题
核心组件
主要动作
STAR Desk
今天发生了什么、我先看什么？
链轮动、叙事迁移、Top-K、新风险、数据健康
进入研究、静音噪声
Cycle Radar
资金和活动正在向哪里迁移？
链级资金流、活跃、DEX、新池、稳定币变化
选择关注链
Narrative Map
哪些新叙事在形成或失速？
语义簇、阶段、速度/广度、代表项目、来源
合并/拆分/关注叙事
Project Discovery
叙事里有哪些早期项目？
候选漏斗、首次发现、门禁预检、流动性
送审、排除、观察
Project Audit
这个项目到底可信到什么程度？
证据时间线、门禁、评分、钱包图、冲突
形成决策简报
Risk Center
哪些事实改变会推翻判断？
关键 UNKNOWN、权限变化、解锁、抽池、团队流出
升级、关闭、分派
Shadow Portfolio
若按规则观察，结果如何？
模拟进入/退出、BTC/SOL 基准、风险事件
复盘规则
Replay Lab
历史上系统能否提前且不偷看未来？
时间轴、证据可用性、参数版本、对照组
运行回放、导出报告
Evidence Center
事实来自哪里，是否冲突或过期？
来源、哈希、SLA、冲突、许可证
确认、降级来源
MVP 导航
第一版只交付 6 个页面：STAR Desk、Cycle Radar、Narrative Map、Project Audit、Risk Center、Replay Lab。Project Discovery 先作为 Narrative Map 的抽屉；Shadow Portfolio 在前向验证阶段开放。

## 10 · PRODUCT DEFINITION

关键页面定义
项目审计卡与 STAR Desk 是第一版的产品中心。
STAR Desk
区域
展示内容
验收标准
今日变化
新链轮动、新叙事、阶段变化、关键事实变化
每条变化可展开到证据
研究队列
按 Decision Readiness 排序的候选
FAIL/UNKNOWN 不混入可决策列表
风险队列
新权限、抽池、解锁、团队流出、来源冲突
支持确认、分派、静音与审计
数据健康
索引延迟、来源故障、关键字段新鲜度
来源异常时对应结论自动降级
Project Audit Card
区块
必须回答的问题
Identity
项目、代币、Program、网站、代码仓、社交账号是否属于同一实体？
Gate
哪些检查 PASS / FAIL / UNKNOWN？哪一项阻断晋级？
Evidence Timeline
每个重要主张在什么时间被什么来源支持或反驳？
Wallet Graph
团队、部署者、早期钱包、做市和 KOL 是否有关联？
Liquidity & Exit
以目标资金规模进入/退出的真实冲击、路由和失败概率？
Narrative
所属叙事处于什么阶段，项目是领先者、跟随者还是蹭热点？
Decision
当前结论、反证条件、下一次复核时间与责任人是什么？
设计原则
所有结论都可点击回到证据；所有分数都能展开到特征；所有 UNKNOWN 都必须说明缺什么、何时重试、谁负责。

## 11 · PRODUCT DEFINITION

告警与研究运营
告警只服务于判断变化，不服务于制造兴奋。
告警等级
级别
触发例
时效
默认动作
CRITICAL
权限变化、不可卖、抽池、团队大额流出、证据造假
≤ 60 秒（链上）
立即阻断/降级，要求人工确认
HIGH
解锁临近、保护性深度骤降、关键来源冲突
≤ 5 分钟
进入风险队列
MEDIUM
叙事阶段切换、拥挤度上升、钱包集中度变化
≤ 30 分钟
更新研究优先级
INFO
新代码发布、新合作声明、数据源恢复
批量摘要
加入时间线
降噪规则
	•	同一事实按 Project × Risk Type × Evidence Version 去重。
	•	连续数值变化采用阈值与冷却，不对每个区块重复告警。
	•	来源故障不产生项目风险结论，而是产生 Data Health 告警并将结论降为 UNKNOWN。
	•	告警关闭必须记录理由；规则更新后可以重放关闭样本验证漏报。
每日研究节奏
时间
动作
产物
开盘前 / 每日一次
查看 Chain Rotation 与新叙事
今日研究清单
实时
处理 CRITICAL/HIGH 事实变化
风险处置记录
日终
审阅晋级/降级、Shadow 偏差
Decision Log
每周
复盘 false positive / false negative
规则变更提案

## 12 · PRODUCT DEFINITION

数据与系统架构
开源负责通用索引和分析，STAR 自建点时证据、身份图、门禁与生命周期。
逻辑分层
层
职责
首选能力
Source Adapters
链上、代码、社交与公开资料接入；保留原始响应
Solana RPC/gRPC、GitHub、授权数据源
Fact Pipeline
幂等解码、实体识别、证据时间、冲突与新鲜度
事件流 + 批处理，UNKNOWN fail-closed
Intelligence
叙事聚类、钱包图、门禁、机会评分、生命周期
可解释规则优先，模型版本化
Serving
研究 API、查询、告警、回放与权限
PostgreSQL/AGE + read API
Experience
STAR Desk、项目审计、风险中心、回放实验室
Web App；无钱包连接组件
数据存储
存储
内容
原因
PostgreSQL
在线事实、项目、评分快照、决策、运营状态
事务、SQL、成熟运维
Apache AGE
钱包/实体/项目/社交关系图
在 Postgres 上补图查询，减少早期系统数量
Object Storage + Parquet
不可变原始事件、来源快照、历史特征
可审计、可重放、低成本
DuckDB
历史回放、研究查询、无前视验证
直接查询 Parquet，避免先建大数仓
唯一事实原则
第三方风险 API、KOL 标签和聚合平台只作为证据来源之一；STAR 保留原始响应、来源版本和冲突，不把供应商结论直接写成内部真相。

## 13 · PRODUCT DEFINITION

开源能力接入边界
吸收成熟基础设施，不把核心投资判断外包给开源评分器。
模块
用途
接入方式
边界/风险
SQD Squid SDK
Solana/EVM 历史索引与 ETL
Provider Adapter；历史回填
Apache-2.0；需验证数据覆盖与供应 SLA
Yellowstone gRPC
Solana 低延迟链上事件
独立进程/服务边界
AGPL 边界需法务确认；不嵌入闭源核心
SPL Token-2022
官方代币扩展语义
协议解析真源
跟随官方版本；完整覆盖扩展
Solana Verifiable Build
Program 构建可验证性
审计证据
“可验证”不等于“无漏洞”
Ponder
BNB/EVM 事件索引
第二阶段索引服务
MIT；适合 Postgres + SQL/GraphQL
Mythril
EVM 字节码安全分析
隔离扫描任务
MIT；结果需人工/规则复核
Slither
EVM 源码静态分析
隔离服务或离线任务
AGPL；许可证与部署边界先审查
GoPlus SDK
第三方风险补充
只作 corroboration
不得作为唯一真源或单点门禁
BERTopic
叙事语义聚类
可替换模型插件
MIT；需防止 embedding 漂移
River
在线漂移/异常检测
特征监控
BSD；不直接决定推荐
Apache AGE
钱包与实体关系图
数据库扩展
图边必须保留证据与置信度
DuckDB
Parquet 历史回放
研究/回测运行时
防止将今天的维表倒灌过去
参考链接：github.com/subsquid/squid-sdk · github.com/ponder-sh/ponder · github.com/rpcpool/yellowstone-grpc · github.com/ConsenSysDiligence/mythril · github.com/crytic/slither · github.com/MaartenGr/BERTopic · github.com/online-ml/river · github.com/apache/age · github.com/duckdb/duckdb

## 14 · PRODUCT DEFINITION

历史回放与前向 Shadow
证据不是“看起来合理”，而是能在无前视条件下重复验证。
历史样本框架
样本组
建议规模
目的
成功叙事
≥ 50 个项目
检验发现提前量、晋级质量与生命周期识别
失败/归零
≥ 100 个项目
检验风险门禁与生存偏差
Rug/Honeypot/抽池
覆盖主要攻击类型
验证关键失败能否在损失前出现
伪热度/刷量
多种操纵模式
验证实体聚类与反操纵
叙事对照
同周期非热点项目
判断系统是否只是跟随整体牛市
回放要求
	•	按 observed_at 截断信息；任何后验标签只能用于评估，不能用于当时决策。
	•	项目发现时间以 STAR 可观察到的首次证据为准，不以历史最低价为准。
	•	收益使用当时池深度、路径、费用和滑点；无法退出记为失败，而非用收盘价。
	•	规则、模型、数据版本全部固化；回放结果可从原始事实重建。
	•	报告同时展示错过的赢家和误判的输家，禁止只讲成功案例。
Shadow 阶段
Shadow 只记录“若按当时规则研究/观察”的虚拟决策，不持有可签名端口。每个观察项保存进入理由、失效条件、模拟规模、可退出性和退出规则。
结构性安全
Shadow 模块在类型和部署上都不能访问钱包、私钥或 submit/cancel 能力；不是靠配置项关闭交易，而是根本不存在交易接口。

## 15 · PRODUCT DEFINITION

成功指标与验收
产品成功不是“命中过一个百倍币”，而是稳定提高发现质量并减少不可恢复错误。
指标
定义
MVP 目标（建议）
Discovery Lead Time
首次发现到叙事主流/价格加速之间的时间
成功样本中位数领先 ≥ 48h
Critical Miss Rate
已知关键风险未被门禁阻断的比例
0；任何一例即 NO-GO
High-risk Intercept
Rug/不可卖/抽池样本被及时阻断比例
≥ 90%
Top-K Precision
每日/每周 Top-K 中 30/90 天存活且可退出比例
先建基线，再冻结阈值
Evidence Completeness
关键字段有新鲜证据的比例
可决策项目 100%
False Alert Rate
关闭后判定无需行动的 HIGH/CRITICAL 告警比例
≤ 20%
Replay Reproducibility
同版本、同快照回放输出一致
100%
Shadow Drawdown
按真实流动性估算的最大回撤
不设收益承诺；与基准并列
所有数字均为 v1.0 建议目标，需要在历史语料完成后校准；Critical Miss Rate 与 point-in-time 一致性属于硬门禁，不因样本不足降低要求。
质量 SLO
能力
目标
Solana 链上关键事件延迟
P95 ≤ 60 秒；来源故障时明确 UNKNOWN
项目审计卡首次形成
发现后 ≤ 10 分钟生成基础卡，关键字段允许 UNKNOWN
可追溯性
每个风险结论、评分特征和生命周期切换 100% 可追溯
幂等性
重复区块、事件、来源响应不产生重复经济或风险事实
恢复
可从不可变原始事件重建派生状态并复现同版本输出

## 16 · PRODUCT DEFINITION

分阶段路线图与 GO / NO-GO
先证明 Solana 研究闭环，再扩链；先证明信息优势，再讨论资金。
阶段
范围
交付
GO 条件
P0 产品合同
对象、证据时间、门禁、指标、许可证
本 PRD + 数据源矩阵 + 历史样本规范
冻结关键定义；关键数据源可合法获得
P1 Solana Read-only
链、叙事、项目、审计、风险告警
6 页面 MVP + 原始事实仓 + 项目卡
关键风险 UNKNOWN fail-closed；可回放
P2 Historical Replay
成功/失败/操纵样本
无前视回放与误差报告
Critical Miss=0；结果可重复
P3 Forward Shadow
实时候选与虚拟决策
Shadow Portfolio + 周复盘
连续 90–180 天数据稳定；指标达到冻结阈值
P4 BNB Chain
EVM 索引与安全扫描
Ponder + EVM 门禁 + 跨链叙事
Solana 闭环已 PASS；许可证边界完成
P5 资金评审
仅评审是否需要人工批准的小额执行
独立 RFC，不属于当前范围
需要全新安全审计与明确授权
首个 12 周计划
周期
重点
可验收结果
W1–2
数据源/许可尽调、领域模型、历史样本清单
Source Registry；50 成功 + 100 失败候选
W3–5
Solana 索引、Token/Pool/Wallet/Program 事实
点时事实表；原始事件可重放
W6–8
门禁、钱包聚类、项目审计卡
离线风险用例；关键 UNKNOWN 阻断
W9–10
叙事聚类、生命周期、STAR Desk
历史周期可视化与候选漏斗
W11–12
Replay Lab、指标基线、内部试用
第一次 GO/NO-GO 评审

## 17 · PRODUCT DEFINITION

MVP 需求清单
把第一版砍到能证明价值的最小闭环。
Must Have
	•	Solana 区块/交易/代币/池/Program 的幂等索引与不可变原始事实。
	•	Project / Token / Program / Wallet / Entity / Narrative / Evidence 的基础对象模型。
	•	Token 权限、可买可卖、流动性、持仓集中、关联钱包、代码可验证性的硬门禁。
	•	证据时间、来源、哈希、冲突、UNKNOWN、新鲜度和规则版本。
	•	叙事聚类、阶段状态机、项目候选漏斗与 Top-K 研究队列。
	•	STAR Desk、Cycle Radar、Narrative Map、Project Audit、Risk Center、Replay Lab。
	•	历史无前视回放与确定性输出；关键用例和性质测试。
	•	审计日志、角色权限、数据健康与来源故障降级。
Should / Later
Should（MVP 后）
Later（证据证明后）
Forward Shadow、跨链叙事、更多社交源、团队履历图
BNB Chain、机构级协作、组合研究预算
更强的模拟交易、路由与拥堵模型
人工批准的小额执行 RFC（当前不授权）
模型漂移检测、主动学习、分析师反馈
其他热点链；每条链都须独立 GO/NO-GO
明确不做
钱包连接、私钥、下单、狙击、跟单、杠杆、AURORA 集成、把所有链一次性接入、单一外部 API 决策、无法回放的黑箱分数。

## 18 · PRODUCT DEFINITION

主要风险与控制
STAR 本身也会被数据、模型和叙事操纵；产品必须把这些风险显式化。
风险
表现
控制
前视/生存偏差
回放只保留赢家或使用后验身份
三重时间、失败样本、点时维表、盲测
数据许可/封禁
社交和第三方源突然不可用
Source Registry、合法来源、适配器、降级 UNKNOWN
实体误归因
把独立钱包误判为团队
多证据、概率边、人工复核、可撤销结论
模型漂移
热点语义与操纵方式变化
漂移监控、版本化、消融、定期重训
供应商结论污染
第三方风险标签错误进入真源
原始响应、冲突模型、永不单点门禁
低流动性幻觉
账面收益无法真实退出
池级冲击、路由、费用、拥堵与失败模拟
过度自动化
高分被误解为买入指令
只读、无钱包能力、人工决策、措辞约束
许可证传染
AGPL 组件嵌入闭源服务
进程边界、法务评审、可替换适配器
最高风险
最危险的不是漏掉一个热点，而是系统用不完整事实给出确定结论。STAR 宁可少推荐，也不能把 UNKNOWN 伪装成 PASS。

## 19 · PRODUCT DEFINITION

冻结决策、开放问题与下一步
这份文档完成产品定义；下一轮应转入数据合同和原型，而不是直接写全栈。
已冻结
决策
结果
产品名
STAR
品牌语义
Signal · Truth · Alpha · Risk
项目关系
完全独立于 AURORA
链路顺序
Solana 第一；BNB Chain 第二
能力边界
只读研究；不连接钱包；不交易
判断模型
硬门禁与机会评分分离；关键 UNKNOWN fail-closed
证据纪律
point-in-time、可追溯、可重放、版本化
需要产品负责人确认
	•	STAR 第一版是单人研究工作台，还是从一开始支持 3–5 人协作与审批？
	•	首批历史语料是否固定为：铭文、Solana Meme、AI/AI Agent，并加入相同周期失败对照？
	•	社交源优先级与合规边界：X、Telegram、Discord、GitHub、新闻与官网，哪些具备合法稳定访问？
下一轮交付建议
STAR Product Sprint 01
交付数据源与许可证矩阵、领域模型 ERD、项目审计卡低保真原型、Solana 50+100 历史样本规范和 P1 验收测试目录。
批准本产品定义不等于批准资金接入。钱包、签名或交易能力必须经过独立 RFC、安全边界和新的 GO/NO-GO 审计。
