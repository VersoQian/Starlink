import type { FailureCase } from '../types'

export const failureCases: FailureCase[] = [
  // 中国谈判场景
  {
    id: 'cn-1',
    title: '直接拒绝茶水',
    scenario: '与中国合作伙伴谈判',
    mistake: '说"不用了，我们直接谈正事吧"并拒绝喝茶',
    consequence: '对方认为你不尊重中国商务礼仪，"茶凉了人就走了"，被视为缺乏诚意，影响后续谈判氛围。',
    correction: '应双手接过茶杯，轻啜一口并称赞茶香，利用喝茶时间建立私人关系，观察对方团队决策层级。',
    severity: 'high'
  },
  {
    id: 'cn-2',
    title: '过早讨论价格',
    scenario: '与中国合作伙伴谈判',
    mistake: '在破冰阶段就直接问"这个项目预算多少"',
    consequence: '中方认为太急功近利，缺乏"关系"基础，可能会提高价格或减少让步空间。',
    correction: '先通过几轮对话建立信任，讨论项目愿景和双方优势，待时机成熟再循序渐进谈条款。',
    severity: 'high'
  },
  {
    id: 'cn-3',
    title: '忽视在场的高层',
    scenario: '与中国合作伙伴谈判',
    mistake: '只与项目经理沟通，忽视旁边的总监或VP',
    consequence: '真正的决策者感到被忽视，可能在会后否决合作，或要求重新谈判。',
    correction: '主动向高层问好、敬茶，重要观点先向决策者阐述并征求意见，体现尊重等级制度。',
    severity: 'medium'
  },

  // 韩国演示场景
  {
    id: 'kr-1',
    title: '使用模糊的回答',
    scenario: '韩国客户技术演示',
    mistake: '对技术问题回答"这个我们会尽力解决""应该可以实现"',
    consequence: '韩国客户认为你准备不足或技术能力不够，失去信任，可能转向竞争对手。',
    correction: '用明确的数据和时间表回答："根据我们的测试，这个功能在2周内可以实现，准确率达到95%以上。"',
    severity: 'high'
  },
  {
    id: 'kr-2',
    title: '避免承认不足',
    scenario: '韩国客户技术演示',
    mistake: '被问到产品弱点时说"我们没有明显缺点"',
    consequence: '韩国商界重视诚实，夸大宣传会被视为不可信，影响长期合作前景。',
    correction: '坦诚指出局限性但强调解决方案："目前X功能确实有提升空间，我们计划Q2推出增强版，同时可以通过Y方案临时满足需求。"',
    severity: 'medium'
  },
  {
    id: 'kr-3',
    title: '忽视层级礼仪',
    scenario: '韩国客户技术演示',
    mistake: '未等最高职位的人发言就先开始演示',
    consequence: '违反韩国严格的等级制度，被视为没有教养，影响公司形象。',
    correction: '在演示开始前，向在场最高职位的人致意并询问："李社长，我们现在开始演示可以吗？"',
    severity: 'medium'
  },

  // 美国客服场景
  {
    id: 'us-1',
    title: '过度道歉而无行动',
    scenario: '处理美国客户升级投诉',
    mistake: '反复说"非常抱歉，我们会调查""对不起给您添麻烦了"但没有具体方案',
    consequence: '美国客户会更加愤怒，认为你在浪费时间，要求更高级别的主管介入或要求退款。',
    correction: '致歉后立即给出具体行动："对此我深表歉意。我现在为您做三件事：1)立即退款；2)赠送价值$50的积分；3)安排技术专员今天内解决问题。您看这样可以吗？"',
    severity: 'high'
  },
  {
    id: 'us-2',
    title: '推卸责任',
    scenario: '处理美国客户升级投诉',
    mistake: '说"这不是我们部门的问题""这是供应商的责任"',
    consequence: '美国文化强调ownership（主人翁精神），推卸责任会被视为不负责任，客户可能公开投诉或诉诸法律。',
    correction: '即使是他人失误也要主动承担："这确实是我们的疏漏，我会亲自跟进确保问题解决，并定期向您汇报进展。"',
    severity: 'high'
  },
  {
    id: 'us-3',
    title: '使用被动语态',
    scenario: '处理美国客户升级投诉',
    mistake: '说"Your issue is being looked into""It will be fixed"',
    consequence: '美国客户偏好直接沟通，被动语态显得推诿和缺乏诚意。',
    correction: '使用第一人称主动语态："I am personally handling your case""I will ensure this gets resolved by 5 PM today."',
    severity: 'low'
  },

  // 通用跨文化错误
  {
    id: 'common-1',
    title: '假设所有文化相同',
    scenario: '所有场景',
    mistake: '用同一套话术对待不同文化背景的客户',
    consequence: '可能冒犯对方或错失建立深度关系的机会，被视为文化无知。',
    correction: '提前研究对方文化背景，调整沟通方式（如：中国重关系、韩国重层级、美国重效率）。',
    severity: 'high'
  },
  {
    id: 'common-2',
    title: '忽视非语言沟通',
    scenario: '所有场景',
    mistake: '只关注说什么，不注意肢体语言和面部表情',
    consequence: '在一些文化中（如日本、韩国），非语言信号比言语更重要，可能误读对方真实态度。',
    correction: '观察对方的眼神、停顿、身体前倾等信号，调整自己的节奏和表达方式。',
    severity: 'medium'
  },
  {
    id: 'common-3',
    title: '翻译依赖机器',
    scenario: '所有场景',
    mistake: '完全依赖Google翻译或DeepL，不核查文化适配性',
    consequence: '可能出现语义正确但文化不当的表达（如"老板"在中国是尊称，直译成英文"boss"可能显得随意）。',
    correction: '重要沟通请母语人士review，学习关键术语的文化含义，避免直译。',
    severity: 'medium'
  }
]

// 按场景分类失败案例
export function getFailureCasesByScenario(scenarioId: string): FailureCase[] {
  const scenarioMap: Record<string, string> = {
    'cn-negotiation': '与中国合作伙伴谈判',
    'kr-presentation': '韩国客户技术演示',
    'us-support': '处理美国客户升级投诉'
  }

  const scenarioName = scenarioMap[scenarioId]
  if (!scenarioName) return failureCases.filter(fc => fc.scenario === '所有场景')

  return failureCases.filter(fc => fc.scenario === scenarioName || fc.scenario === '所有场景')
}
