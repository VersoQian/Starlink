/**
 * Hand-authored ground-truth personas for the coaching-mode benchmark
 * (2026-04-28).
 *
 * Each persona declares the durable traits we EXPECT the UserSkillExtractor
 * to surface from synthetic conversation summaries. After running the
 * extractor, we score `recall` (each GT trait found at least one matching
 * skill row) and `precision` (each extracted skill maps to at least one
 * GT trait, no fabrications).
 *
 * Persona traits are written in 中文 to match what the extractor LLM will
 * produce. Each trait carries `keywords` used for keyword-based recall
 * scoring (cheap fallback alongside vector cosine).
 */

export interface PersonaTrait {
  /** Stable id used in the report; not seen by the LLM. */
  id: string
  /** Trait category — should map to a UserSkillPayload tag. */
  category: 'domain' | 'experience' | 'style' | 'blind-spot' | 'constraint' | 'preference'
  /** Short label for the report. */
  label: string
  /** Full description of the trait — what we expect the extractor to write. */
  description: string
  /** Words/phrases that should appear in a correctly-extracted skill's
   *  `content` field. Used for the lexical recall heuristic. */
  keywords: string[]
}

export interface BenchmarkPersona {
  id: string
  name: string
  /** One-paragraph summary of who this person is, used as the system prompt
   *  for the user-simulator (synthetic-summaries.ts). */
  bio: string
  traits: PersonaTrait[]
  /** Pretend ideas this user has worked on — drives the synthetic summary
   *  generation (each summary is set in one of these workspaces). */
  ideaWorkspaces: Array<{ workspaceId: string; ideaName: string; ideaPitch: string }>
}

export const personaB2BSaasPM: BenchmarkPersona = {
  id: 'persona-b2b-saas-pm',
  name: 'B2B SaaS PM',
  bio: '一位 5 年 B2B SaaS PM 出身的创业者，做过分销渠道管理 + 客户成功体系。'
    + '说话偏好引用具体数字和 case study，对抽象框架（如蓝图、心智模型）反应冷淡。'
    + '单创独立，明确表示不打算融资。在思考时倾向跳过定价与商业模式细节，'
    + '常陷入产品功能讨论。',
  traits: [
    {
      id: 'trait-b2b-domain',
      category: 'domain',
      label: 'B2B SaaS 资深背景',
      description: '5 年 B2B SaaS PM 经验，熟悉分销和客户成功',
      keywords: ['B2B', 'SaaS', 'PM', '产品经理', '分销', '客户成功']
    },
    {
      id: 'trait-style-concrete',
      category: 'style',
      label: '偏好具体数字',
      description: '更喜欢具体数字、case study、客户访谈摘录；不耐烦抽象概念',
      keywords: ['数字', '具体', 'case', '案例', '不抽象', '不爱框架']
    },
    {
      id: 'trait-blindspot-pricing',
      category: 'blind-spot',
      label: '回避定价讨论',
      description: '在产品讨论中很少主动谈定价或收入模型；需要 coach 主动追问',
      keywords: ['定价', '收入', '商业模式', '回避', '不谈']
    },
    {
      id: 'trait-constraint-solo',
      category: 'constraint',
      label: '单创不融资',
      description: '明确表态自己单干创业，不打算外部融资；偏好 lean / bootstrap',
      keywords: ['单创', '不融资', 'bootstrap', '独立', 'lean']
    }
  ],
  ideaWorkspaces: [
    {
      workspaceId: 'ws-coach-eval-saaspm-001',
      ideaName: 'AI 销售助手',
      ideaPitch: '帮 B2B 销售人员自动整理客户对话记录 + 生成跟进 talking points'
    },
    {
      workspaceId: 'ws-coach-eval-saaspm-002',
      ideaName: '客户成功仪表盘',
      ideaPitch: '给中型 SaaS 公司提供客户健康度 + 流失风险预警的轻量工具'
    },
    {
      workspaceId: 'ws-coach-eval-saaspm-003',
      ideaName: '分销商 portal',
      ideaPitch: 'B2B SaaS 公司用来管理分销伙伴 + 分账 + leads 共享的 SaaS'
    }
  ]
}

export const personaIndieHardware: BenchmarkPersona = {
  id: 'persona-indie-hardware',
  name: 'Indie Hardware Hacker',
  bio: '一位嵌入式硬件 + 3D 打印背景的兼职创业者。说话喜欢长条解释 + 画原理图，'
    + '习惯先想技术实现再想用户。对客户访谈、调研薄弱，常假设市场需求。'
    + '全职业余，月度预算 ≤ ¥3000，不打算辞职。',
  traits: [
    {
      id: 'trait-hw-domain',
      category: 'domain',
      label: '嵌入式 + 3D 打印背景',
      description: '深厚的嵌入式硬件 + 3D 打印工程经验',
      keywords: ['嵌入式', '硬件', '3D 打印', 'embedded', 'firmware']
    },
    {
      id: 'trait-style-tech-first',
      category: 'style',
      label: '技术优先思维',
      description: '先想技术实现 + 原理图，再想用户场景',
      keywords: ['技术先行', '原理图', '实现', '工程', 'tech-first']
    },
    {
      id: 'trait-blindspot-research',
      category: 'blind-spot',
      label: '客户调研薄弱',
      description: '很少做用户访谈/市场调研，常假设需求；coach 应主动推动 evidence-needed',
      keywords: ['不调研', '假设', '没访谈', '凭直觉']
    },
    {
      id: 'trait-constraint-budget',
      category: 'constraint',
      label: '业余 + 极低预算',
      description: '全职工作之外业余做，月度预算 ≤ ¥3000',
      keywords: ['业余', '兼职', '低预算', '不辞职', '钱少']
    }
  ],
  ideaWorkspaces: [
    {
      workspaceId: 'ws-coach-eval-hw-001',
      ideaName: '低成本环境监测仪',
      ideaPitch: 'ESP32 + 3D 打印外壳的家用 PM2.5 / VOC 监测设备'
    },
    {
      workspaceId: 'ws-coach-eval-hw-002',
      ideaName: '宠物喂食器',
      ideaPitch: '可远程定时的猫狗自动喂食器，重点是 BOM 控制在 100 元以内'
    },
    {
      workspaceId: 'ws-coach-eval-hw-003',
      ideaName: '3D 打印工具盒',
      ideaPitch: '为 maker 社区设计的可定制工具收纳盒生成器（参数化模型 + 在线下载）'
    }
  ]
}

export const ALL_PERSONAS: BenchmarkPersona[] = [personaB2BSaasPM, personaIndieHardware]
