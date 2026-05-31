/**
 * Seed script: 往现有 KB 中灌入 SaaS/BMC 相关的 mock 文档。
 *
 * 用法:
 *   npx tsx packages/server/src/scripts/seed-mock-saas-kb.ts [workspaceId] [kbId]
 *
 * 默认: workspaceId=proj-001, kbId=自动查找或创建
 *
 * 内容覆盖:
 *   - SaaS 定价模型（per-seat, usage-based, hybrid, freemium）
 *   - 客户细分方法论（B2B vs B2C, firmographics, JTBD）
 *   - 市场渠道策略（PLG, SLG, channel partners, SEO/content）
 *   - 产品策略与 MVP（lean canvas, 价值主张设计, 核心资源）
 *   - 财务模型（unit economics, CAC/LTV, 现金流, breakeven）
 *   - BMC 方法论（9 维度详解, 实战案例, 常见错误）
 *   - 中国 SaaS 出海（APAC 市场, 合规/支付, 本地化）
 *
 * 这些文档会经过 chunk → embed 流水线，写入 kb_documents + kb_chunks。
 * 之后在画布里 @deep-research 或 @market-agent 就能搜到这些内容。
 */

import { nanoid } from 'nanoid'
import { pool } from '../infrastructure/db/pool.js'
import { getKbStore } from '../application/kb-store.js'

// ============================================================================
// 文档定义
// ============================================================================

interface SeedDoc {
  id: string
  title: string
  content: string
  contentType?: string
}

const DOCS: SeedDoc[] = [
  // ── 1. SaaS 定价模型 ──────────────────────────────────────────────
  {
    id: 'doc-saas-pricing-models-2024',
    title: 'SaaS 定价模型全景 · 2024 行业报告',
    contentType: 'text/markdown',
    content: `# SaaS 定价模型全景 · 2024

## 概述
SaaS 定价在过去十年经历了三波演变：per-seat（2010-2016）、usage-based（2017-2021）、hybrid（2022-至今）。选择合适的模型直接影响 ARR 增速和 NRR。

## Per-seat 定价
每用户/每席位固定价格。Salesforce、Slack、Zoom 的早期模型。

优点：
- 收入可预测，易于财务建模
- 客户容易理解，销售培训成本低
- 天然契合 B2B 企业采购流程

缺点：
- 客户会主动压缩席位数以控制成本
- 无法捕捉 heavy user 的价值
- 与客户成功脱钩（客户用得好不会多付费）

典型价格带：
- SMB: $10-30/seat/month
- Mid-market: $30-100/seat/month
- Enterprise: $100-300/seat/month

## Usage-based 定价
按实际用量计费。Snowflake（compute credits）、Twilio（API calls）、Datadog（hosts）、AWS Lambda（invocations）。

优点：
- 客户价值与用量线性相关，天然 PLG
- 无需"升级谈判"——用得越多自然付得越多
- 对小客户友好（$0 起步），降低获客门槛

缺点：
- 收入不可预测，财报波动大
- 需要精确的 metering 基础设施
- 客户 CFO 不喜欢不可预测的月账单

关键指标：usage-based 公司中位数 NRR 约 125%，per-seat 公司约 108%。

## Hybrid 模型（推荐）
混合 per-seat + usage-based，取两者之长。

Notion 案例：免费版 10 guests → Plus $10/seat + 用量上限 → Business $15/seat + 更高用量上限。转化率 4.2%（高于行业中位数 2-4%）。

Datadog 案例：per-host 基础费 + per-metric 超量费。NRR 持续 > 130%。

## Freemium 与免费增值
免费版不是"少几个功能"，而是"在价值最相关的维度上设上限"：
- 存储型产品 → 限制存储量（Notion、Figma）
- API 型产品 → 限制调用次数（Twilio、Stripe）
- 协作型产品 → 限制协作者数量（Miro、Linear）

免费→付费转化率中位数：2-4%（B2B SaaS）。顶级公司 6-8%。

## 中国企业 SaaS 的特殊定价挑战
- 中小企业对付费 SaaS 的支付意愿约为美国同行的 30-50%
- 大客户（央企/国企）更偏好私有化部署 + 一次性买断
- 微信生态内支付链路（小程序 → 微信支付）的 friction 远低于独立 SaaS 网站
- 钉钉/企业微信/飞书生态内的应用分发正成为新的定价渠道`,
  },

  // ── 2. 客户细分方法论 ──────────────────────────────────────────────
  {
    id: 'doc-customer-segmentation-jtbd',
    title: '客户细分方法论 · Jobs-to-be-Done 与 B2B 实践',
    contentType: 'text/markdown',
    content: `# 客户细分方法论 · JTBD 框架与 B2B 实践

## 传统人口统计学细分的局限
按行业/公司规模/地区细分是最常见的做法，但有三个致命缺陷：
1. 同行业同规模的两家公司，采购动机可能完全不同
2. "CIO 画像"忽略了实际使用者和决策者的差异
3. 静态细分无法反映客户的成长轨迹（SMB → Mid-market → Enterprise）

## Jobs-to-be-Done (JTBD) 框架
Clayton Christensen 提出：客户"雇佣"产品来完成某个特定任务。

核心四问：
1. 客户想完成什么任务？（functional job）
2. 完成这个任务的情感驱动是什么？（emotional job）
3. 现在的替代方案是什么？（competition ≠ competitors）
4. 成功完成任务的障碍是什么？（hiring criteria）

### B2B SaaS JTBD 案例
某 DevOps 工具公司发现：
- Persona "DevOps 工程师" → too broad
- JTBD "当 CI/CD pipeline 挂了，我要在 5 分钟内定位到是哪个 commit 导致的" → actionable

细分后：
- 快速定位故障（核心 JTBD）
- 合规审计追踪（次要 JTBD）
- 跨团队发布协调（边缘 JTBD）

三个 JTBD 对应三个不同的 pricing tier，而不是按"企业版 vs 标准版"来切。

## B2B 细分维度
实际可用的 B2B 细分维度组合：

| 维度 | 示例值 | 用途 |
|------|--------|------|
| 公司规模 | 1-10 / 11-100 / 101-1000 / 1000+ | TAM 估算 |
| 行业 | SaaS / 金融 / 医疗 / 制造 | GTM 聚焦 |
| 技术栈 | AWS vs Azure vs 自建机房 | 产品集成优先级 |
| 采购成熟度 | 首次采购 SaaS / 有经验的买家 | 销售周期预测 |
| 用例深度 | 单部门 pilot → 全公司 rollout | 扩展路径 |
| 预算来源 | 部门 discretionary vs 总部集中采购 | 定价策略 |

## TAM / SAM / SOM 计算
- TAM (Total Addressable Market): 全球所有潜在客户的总花费
- SAM (Serviceable Addressable Market): 你的产品能覆盖的那部分 TAM
- SOM (Serviceable Obtainable Market): 你在前 2-3 年实际能拿到的份额

计算公式：
TAM = 目标客户总数 × 年均合同价值 (ACV)
SAM = TAM × 地域/行业/规模覆盖率
SOM = SAM × 市场份额目标（通常 1-5% for early stage）

案例：一个面向美国 SMB 的 SaaS CRM
- TAM: 600 万 SMB × $600 ACV = $36B
- SAM: 聚焦 5 个行业 → $6B
- SOM: Year 3 目标 2% → $120M`,
  },

  // ── 3. 市场渠道策略 ──────────────────────────────────────────────
  {
    id: 'doc-gtm-channel-strategy',
    title: 'B2B SaaS 市场渠道策略 · PLG vs SLG',
    contentType: 'text/markdown',
    content: `# B2B SaaS 渠道策略 · Product-Led Growth vs Sales-Led Growth

## 两种主流 GTM 模式

### Product-Led Growth (PLG)
用户通过产品本身发现价值，自助注册、自助使用、自助升级。

典型公司：Notion、Figma、Linear、Vercel、Supabase

核心指标：
- 注册→激活率（PQL 定义）
- 免费→付费转化率（median 2-4%）
- Viral coefficient（邀请带来的新注册 / 邀请人数）
- Time-to-value (TTV)：从注册到"aha moment"的分钟数

PLG 适用条件：
- 产品价值可以在 10 分钟内被感受到
- 目标用户群体足够技术化，不需要手把手 onboarding
- 单个用户就能用起来（不需要团队配置/管理员审批）

### Sales-Led Growth (SLG)
通过销售团队获客，demo → POC → 采购审批 → 部署。

典型公司：Salesforce、Workday、SAP、Oracle

核心指标：
- CAC (Customer Acquisition Cost) = 总销售+营销费用 / 新客户数
- Sales cycle length（中位数 3-6 个月 for $50k+ ACV）
- Win rate（合格线索 → 成交，通常 20-30%）
- Quota attainment（完成配额的销售占比，行业平均 ~60%）

### PLG + SLG 混合（Product-Led Sales）
产品自助获取用户，销售团队介入高价值账户。

Datadog 是典型：工程师自助接入 → 用量增长 → 销售团队联系采购部门 → enterprise deal。

关键信号（PQL → SQL 的触发条件）：
- 用量超过免费版上限的 80%
- 同一公司域名下 3+ 独立注册
- 浏览了 enterprise pricing 页面
- 使用了需要团队协作的功能

## 内容营销与 SEO
B2B SaaS 的内容策略：
- TOFU (Top of Funnel): 行业趋势报告、benchmark 数据、checklist
- MOFU (Middle of Funnel): 产品对比、use case 指南、webinar
- BOFU (Bottom of Funnel): case study、ROI calculator、free trial

SEO 关键：
- B2B buyer 搜索的是"问题"不是"产品"——排名靠前的是解决方案文章，不是 landing page
- 长尾关键词的转化率远高于通用关键词
- 技术博客是工程团队的招聘工具，也是 SEO 内容源

## 渠道合作伙伴
- 系统集成商 (SI)：Accenture, Deloitte — 适合 enterprise SaaS
- 增值经销商 (VAR)：中小型 IT 咨询公司 — 适合 mid-market
- 市场平台 (Marketplace)：AWS Marketplace, Salesforce AppExchange — 适合 PLG 扩展
- 技术联盟：与互补产品做双向集成 + co-marketing`,
  },

  // ── 4. 产品策略与 MVP ──────────────────────────────────────────────
  {
    id: 'doc-product-strategy-mvp',
    title: '产品策略 · Lean Canvas 与 MVP 验证',
    contentType: 'text/markdown',
    content: `# 产品策略 · 从想法到 MVP 验证

## Lean Canvas 框架
Ash Maurya 对 Osterwalder BMC 的实用改编，聚焦"不确定性最大的部分"：

9 个模块（与 BMC 的映射）：
1. Problem → 客户痛点（Customer Segments 的起点）
2. Customer Segments → 早期采用者是谁
3. Unique Value Proposition → 价值主张
4. Solution → 关键业务
5. Channels → 渠道通路
6. Revenue Streams → 收入来源
7. Cost Structure → 成本结构
8. Key Metrics → 核心资源（的量化表达）
9. Unfair Advantage → 护城河

与经典 BMC 的关键区别：
- Lean Canvas 从"问题"出发，BMC 从"客户"出发
- Lean Canvas 更强调早期验证，BMC 更适合成熟业务的系统描述
- Lean Canvas 的 Unfair Advantage 是 BMC 没有的（对应"为什么是你"）

## MVP 类型选择
MVP 不是"产品的最简版本"，而是"验证假设的最简实验"。

| MVP 类型 | 适用场景 | 时间 | 案例 |
|----------|----------|------|------|
| Concierge MVP | 不确定自动化是否必要 | 2-4 周 | Zappos 创始人手动买鞋发货验证在线购鞋需求 |
| Wizard of Oz | 前端完整，后端人工 | 4-8 周 | Airbnb 早期手动匹配房东和房客 |
| Single-feature MVP | 核心价值主张已明确 | 8-12 周 | Buffer 用一个 landing page 测试付费意愿 |
| Piecemeal MVP | 用现有工具拼凑 | 1-2 周 | Groupon 用 WordPress + 手动发邮件 |

## 价值主张设计
Strategyzer 价值主张画布（Value Proposition Canvas）：
- 客户画像：Jobs（任务）、Pains（痛点）、Gains（期望收益）
- 价值地图：Products & Services、Pain Relievers、Gain Creators
- Fit = Pain Relievers 匹配 Pains + Gain Creators 匹配 Gains

好的价值主张：具体、可量化、相对于替代方案有明确差异。

反面案例："我们帮助企业提高效率" → 太模糊
正面案例："Slack 让团队内部邮件减少 48%，会议减少 25%" → 具体可量化

## 关键资源与核心能力
对于 SaaS 初创公司，通常有 4 类核心资源：
1. 技术 IP（代码、算法、数据）
2. 人才（工程团队、领域专家）
3. 数据网络效应（用户越多产品越好）
4. 品牌 & 社区（开发者社区、用户口碑）

早期优先级：技术 IP > 人才 > 数据网络效应 > 品牌`,
  },

  // ── 5. 财务模型与 Unit Economics ──────────────────────────────────
  {
    id: 'doc-saas-finance-unit-economics',
    title: 'SaaS 财务模型 · Unit Economics 与关键指标',
    contentType: 'text/markdown',
    content: `# SaaS 财务模型 · Unit Economics

## 核心指标

### CAC (Customer Acquisition Cost)
CAC = (销售总成本 + 营销总成本) / 新获取客户数

B2B SaaS 行业基准：
- SMB（ACV < $5k）：CAC 通常 $500-2000
- Mid-market（ACV $5k-50k）：CAC 通常 $3k-15k
- Enterprise（ACV $50k+）：CAC 通常 $20k-100k+

LTV/CAC 比率：健康 SaaS 应在 3:1 以上。低于 3:1 意味着获客成本过高；高于 5:1 意味着可能 underspending on growth。

CAC 回收期（Payback Period）：B2B SaaS 中位数约 12-18 个月。顶级公司 < 6 个月。

### LTV (Lifetime Value)
LTV = ARPU × Gross Margin / Churn Rate

示例：
- ARPU（月）= $200
- Gross Margin（SaaS 通常在 70-80%）= 75%
- Monthly Churn = 3%
- LTV = $200 × 0.75 / 0.03 = $5,000

LTV/CAC = $5,000 / $1,500 = 3.3:1 ✓

### NRR (Net Revenue Retention)
NRR = (期初 MRR + 扩展 MRR - 缩量 MRR - 流失 MRR) / 期初 MRR × 100%

NRR > 100% 意味着即使零新客，收入也在增长。NRR > 120% 是顶级 SaaS 的标志。

NRR 低于 100% 的 SaaS 在"漏水的桶"里——先修 retention 再投 acquisition。

### Churn 分析
月度 churn 2-5% 是 B2B SMB 的常态，> 5% 意味着年化流失 > 46%——商业模式不可持续。

Logo churn vs Revenue churn：
- Logo churn = 流失客户数 / 总客户数
- Revenue churn = 流失的 MRR / 总 MRR
- 好的 SaaS：Revenue churn < Logo churn（留下来的都是大客户）

## 收入来源分析
B2B SaaS 常见收入来源组合：

| 收入来源 | 典型占比 | 毛利率 | 可预测性 |
|----------|----------|--------|----------|
| 订阅费（subscription） | 60-80% | 75-85% | 高 |
| 用量费（usage/consumption） | 10-30% | 60-75% | 中 |
| 专业服务（onboarding/training） | 5-15% | 30-50% | 低 |
| 市场平台抽成（marketplace） | 0-10% | 80-90% | 中 |
| API/数据许可费 | 0-5% | 85-95% | 高 |

## 成本结构
典型 B2B SaaS 的成本结构（占 revenue %）：

- COGS（infra + support）：15-25%
- R&D：25-35%
- Sales & Marketing：30-45%（早期可能更高）
- G&A：10-15%

毛利率（Gross Margin）中位数：
- Horizontal SaaS: 75-82%
- Vertical SaaS: 65-75%
- API-first / infra: 55-70%

## 现金流时序
SaaS 的现金流特征：
- 年度预付：Q1 现金流入集中（企业客户多在 Q4/Q1 签约）
- 月度付费：现金流平稳但收款成本高
- Usage-based：按实际用量后付费，有 30-60 天账期

Rule of 40：增长率 + 利润率 ≥ 40%。上市 SaaS 公司约 50% 满足此标准。`,
  },

  // ── 6. BMC 方法论详解 ──────────────────────────────────────────────
  {
    id: 'doc-bmc-methodology-deep-dive',
    title: '商业模式画布 (BMC) 方法论详解 · 9 维度实战',
    contentType: 'text/markdown',
    content: `# 商业模式画布 (Business Model Canvas) 方法论详解

## 历史背景
Alexander Osterwalder 在 2004 年博士论文中提出 BMC 概念，2008 年与 Yves Pigneur 合著《Business Model Generation》正式发布。目前是全球最广泛使用的商业模式工具，被 70%+ 的商学院和加速器采用。

## 9 个维度的逻辑关系

### 左侧：效率侧（内部运营）
1. **重要合作 (Key Partnerships)**：谁帮你做事？供应商、渠道商、技术伙伴
2. **关键业务 (Key Activities)**：你每天在做什么？开发、营销、运营
3. **核心资源 (Key Resources)**：你有什么？技术 IP、人才、品牌、数据

### 右侧：价值侧（面向客户）
4. **价值主张 (Value Propositions)**：客户为什么选你？解决什么问题？
5. **客户关系 (Customer Relationships)**：怎么跟客户互动？自助、专属客服、社区
6. **渠道通路 (Channels)**：怎么触达客户？线上、线下、合作伙伴
7. **客户细分 (Customer Segments)**：谁付你钱？他们有什么共同特征？

### 底部：财务侧（可持续性）
8. **收入来源 (Revenue Streams)**：钱从哪来？订阅、交易费、广告、数据许可
9. **成本结构 (Cost Structure)**：钱花在哪？人力、基础设施、营销、合规

## 常见 BMC 错误

### 错误 1：价值主张 = 功能列表
"我们提供 A/B/C/D 功能" → 不是在说价值。价值主张应该回答：
- 客户在不用你的时候是怎么解决这个问题的？
- 用你之后最大的变化是什么？

### 错误 2：客户细分太宽泛
"我们的客户是所有企业" → 等于没有细分。早期 BMC 应该精确到"一个具体的人"：
- 不是"HR 经理"而是"50-200 人科技公司的 HR 经理，正在经历从 Excel 到 HR SaaS 的第一次升级"

### 错误 3：收入来源太乐观
常见乐观偏差：
- 高估转化率（"1% of free users will convert" → 实际 0.3%）
- 低估销售周期（"3 months" → 实际 6-9 months for enterprise）
- 忽略支付失败率（APAC credit card failure rate ~15%）

### 错误 4：成本结构遗漏
常被遗漏的成本项：
- 合规/法律成本（数据隐私、出口管制、行业牌照）
- 支付网关手续费（2.9% + $0.30 看起来小，大规模下显著）
- 退款/chargeback 损失
- 云基础设施的预留实例 vs on-demand 价差

### 错误 5：忽视竞争替代品
竞争 ≠ 竞品。Google Docs 的竞争对手不是 Microsoft Word，而是"同事走过来口头沟通 + 写在白板上"。理解客户的替代方案比研究竞品功能更重要。

## BMC 与 Lean Canvas 的互补使用
- BMC：全貌审视，适合已经有初步 traction 的团队
- Lean Canvas：聚焦不确定性，适合 idea 阶段
- 建议：先用 Lean Canvas 找到 product-market fit，再用 BMC 做系统化的商业模式设计`,
  },

  // ── 7. 中国 SaaS 出海 ──────────────────────────────────────────────
  {
    id: 'doc-china-saas-global-expansion',
    title: '中国 SaaS 出海 · 市场选择与本地化策略',
    contentType: 'text/markdown',
    content: `# 中国 SaaS 出海 · 市场选择与本地化策略

## 为什么出海
中国 SaaS 市场的结构性挑战：
- ARPU 偏低：中小企业对 SaaS 的支付意愿约为美国的 30-50%
- 销售周期长：大客户（央企/国企）决策链长，通常需要 6-12 个月
- 定制化需求高：中国大客户普遍要求私有化部署 + 定制开发
- 生态依赖：钉钉/企业微信/飞书生态内流量大但分成高

相比之下：
- 北美 B2B SaaS 市场规模约 $300B（2024），是中国的 8-10 倍
- 美国企业有成熟的 SaaS 采购文化和预算
- 英语产品天然面向全球市场

## 出海目标市场优先级
| 市场 | ARPU | 竞争烈度 | 合规难度 | 推荐优先级 |
|------|------|----------|----------|------------|
| 美国/加拿大 | 最高 | 最高 | 中 | ★★★★★ |
| 东南亚 | 低 | 中 | 低 | ★★★★ |
| 欧洲（英/德/法） | 高 | 高 | 高（GDPR） | ★★★ |
| 中东（UAE/沙特） | 高 | 中 | 中 | ★★★ |
| 日本/韩国 | 高 | 中 | 高（本地化深度） | ★★ |
| 拉美（巴西/墨西哥） | 中低 | 低 | 中 | ★★★ |

## 支付与合规
### 支付网关选择
- Stripe：覆盖 46 个国家，最佳开发者体验，2.9%+$0.30
- Paddle：覆盖全球，作为 merchant of record 处理税务
- Lemon Squeezy：小团队友好，MoR 模式
- Adyen：适合 enterprise，支持本地支付方式

### 关键合规清单
- 数据隐私：GDPR（欧盟）、CCPA（加州）、PIPL（中国）
- 税务：VAT（欧盟）、Sales Tax（美国各州不同）、GST（新加坡/澳大利亚）
- 行业特定：SOC 2（企业安全）、HIPAA（医疗）、PCI DSS（支付）

## 本地化深度
不是翻译 UI，而是：
- 支付方式：信用卡（北美）、iDEAL（荷兰）、Pix（巴西）、Konbini（日本便利店）
- 定价心理：北美偏好整数价（$99）、日本偏好具体价（980円）
- 销售方式：美国接受 cold email、日本必须有人介绍
- 客户 support：英语区接受 async chat、日本/韩国必须电话+日语/韩语

## 竞品分析框架
在海外市场面对本土竞品时：
1. 不要在通用功能上竞争——本土公司比你更懂客户
2. 找中国供应链/制造业的特殊 know-how 作为差异化
3. AI-first 是弯道超车的机会——大多数海外 SaaS 还在加 AI feature，而不是 AI-native`,
  },

  // ── 8. 关键业务与运营指标 ──────────────────────────────────────────
  {
    id: 'doc-saas-operations-metrics',
    title: 'SaaS 关键业务与运营指标 · 从数据到决策',
    contentType: 'text/markdown',
    content: `# SaaS 关键业务与运营指标

## 北极星指标 (North Star Metric)
北极星指标是衡量产品为用户创造价值的核心指标：
- Spotify: 每月活跃听歌时长
- Airbnb: 预订过夜数
- Slack: 每天发送的消息数
- Notion: 每周活跃编辑者数

好的北极星指标特征：
1. 与用户价值直接相关（不是收入）
2. 团队可以 daily/weekly 追踪
3. 长期增长驱动短期指标

## 增长模型
### AARRR 海盗指标
- Acquisition（获客）：网站访问 → 注册转化
- Activation（激活）：注册 → "aha moment"
- Retention（留存）：持续使用
- Revenue（收入）：免费 → 付费
- Referral（推荐）：用户邀请新用户

### 各阶段优化重点
Acquisition 阶段：优化 channel mix，不做单一渠道依赖
Activation 阶段：time-to-value 是核心，< 5 分钟为佳
Retention 阶段：Day 1/7/30 留存是先行指标
Revenue 阶段：expansion revenue（add-on/upgrade）的毛利率远高于 new logo
Referral 阶段：viral loop 需要产品内建分享/协作功能

## B2B vs B2C 指标差异
| 指标 | B2B SaaS | B2C |
|------|----------|-----|
| 注册→付费转化 | 2-5% | 0.5-3% |
| 月留存（付费用户） | 95-98% | 70-90% |
| 销售周期 | 2-6 months | instant |
| CAC | $500-50k | $1-50 |
| 主要获客渠道 | 内容+outbound+events | 广告+viral+SEO |

## 数据基础设施
早期 SaaS 的推荐数据栈：
- Product analytics: Mixpanel, Amplitude, PostHog (self-hosted)
- CRM: HubSpot (SMB), Salesforce (enterprise)
- Data warehouse: BigQuery, Snowflake
- BI: Metabase (开源), Looker (enterprise)
- Reverse ETL: Census, Hightouch

不要过早建数据团队——先让工程团队用现成工具追踪核心 5-8 个指标。`,
  },
]

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2)
  const workspaceId = args[0] || 'proj-001'

  // 查找或创建 KB
  const { rows } = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM kb_definitions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [workspaceId]
  )

  let kbId: string
  let kbName: string

  if (rows.length > 0) {
    kbId = rows[0].id
    kbName = rows[0].name
    console.log(`[seed] 使用现有 KB: ${kbId} (${kbName})`)
    // 确保状态为 ready
    await pool.query(
      `UPDATE kb_definitions SET status = 'ready', updated_at = now() WHERE id = $1`,
      [kbId]
    )
  } else {
    kbId = `kb-mock-saas-${nanoid(8)}`
    kbName = 'SaaS · BMC 知识库'
    await pool.query(
      `INSERT INTO kb_definitions (id, workspace_id, name, status, owner_user_id, visibility, created_at, updated_at)
       VALUES ($1, $2, $3, 'ready', $4, 'workspace', now(), now())`,
      [kbId, workspaceId, kbName, '__legacy__']
    )
    console.log(`[seed] 创建新 KB: ${kbId} (${kbName})`)
  }

  const store = getKbStore()

  // 跳过已存在的文档（按 docId 去重）
  const { rows: existingDocs } = await pool.query<{ id: string }>(
    `SELECT id FROM kb_documents WHERE kb_id = $1`,
    [kbId]
  )
  const existingIds = new Set(existingDocs.map((d) => d.id))

  let added = 0
  let skipped = 0

  for (const doc of DOCS) {
    if (existingIds.has(doc.id)) {
      console.log(`[seed] ⏭ 跳过已存在: ${doc.id} — ${doc.title}`)
      skipped++
      continue
    }
    const r = await store.addDocument({
      kbId,
      workspaceId,
      title: doc.title,
      content: doc.content,
      contentType: doc.contentType ?? 'text/markdown',
      docId: doc.id,
      metadata: { seedSource: 'mock-saas-bmc', addedAt: new Date().toISOString() },
    })
    console.log(`[seed] ✓ ${doc.id} → ${r.chunkCount} chunks — ${doc.title}`)
    added++
  }

  console.log(`[seed] 完成: +${added} 篇文档, 跳过 ${skipped} 篇 (已存在)`)
  console.log(`[seed] KB: ${kbId} (${kbName}) | workspace: ${workspaceId}`)

  await pool.end()
}

await main()
