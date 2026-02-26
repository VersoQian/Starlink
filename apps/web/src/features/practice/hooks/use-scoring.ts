import { useMemo } from 'react'
import type { Message, Insight } from '../types'

export interface ScoreBreakdown {
  total: number
  engagement: number // 参与度（基于对话轮数）
  cultural: number // 文化意识（基于洞察）
  quality: number // 质量（基于消息长度和多样性）
  responsiveness: number // 响应性（基于快速回复使用）
  grade: 'S' | 'A' | 'B' | 'C' | 'D' // 等级
  feedback: string // 反馈信息
}

export function useScoring(messages: Message[], insights: Insight[], quickReplyUsed: number) {
  const score = useMemo<ScoreBreakdown>(() => {
    const userMessages = messages.filter(m => m.role === 'user')
    const totalTurns = userMessages.length

    if (totalTurns === 0) {
      return {
        total: 0,
        engagement: 0,
        cultural: 0,
        quality: 0,
        responsiveness: 0,
        grade: 'D',
        feedback: '还未开始对话'
      }
    }

    // 1. 参与度评分 (0-25分) - 基于对话轮数
    const engagementScore = Math.min(totalTurns * 2.5, 25)

    // 2. 文化意识评分 (0-30分) - 基于收到的洞察数量
    const uniqueInsightTypes = new Set(insights.map(i => i.title)).size
    const culturalScore = Math.min(uniqueInsightTypes * 10, 30)

    // 3. 质量评分 (0-25分) - 基于消息长度和多样性
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length
    let qualityScore = 0

    // 消息长度评分
    if (avgLength > 100) qualityScore += 15 // 详细回复
    else if (avgLength > 50) qualityScore += 10 // 中等回复
    else if (avgLength > 20) qualityScore += 5 // 简短回复

    // 消息多样性评分（不重复使用相同的短语）
    const uniqueMessages = new Set(userMessages.map(m => m.content.toLowerCase()))
    const diversityRatio = uniqueMessages.size / userMessages.length
    qualityScore += diversityRatio * 10

    // 4. 响应性评分 (0-20分) - 适度使用快速回复（既不过度依赖也不完全忽略）
    let responsivenessScore = 0
    if (totalTurns > 0) {
      const quickReplyRatio = quickReplyUsed / totalTurns
      // 理想使用率：30-60%
      if (quickReplyRatio >= 0.3 && quickReplyRatio <= 0.6) {
        responsivenessScore = 20
      } else if (quickReplyRatio >= 0.2 && quickReplyRatio <= 0.7) {
        responsivenessScore = 15
      } else if (quickReplyRatio >= 0.1 && quickReplyRatio <= 0.8) {
        responsivenessScore = 10
      } else {
        responsivenessScore = 5
      }
    }

    // 总分计算
    const totalScore = Math.round(engagementScore + culturalScore + qualityScore + responsivenessScore)

    // 等级评定
    let grade: 'S' | 'A' | 'B' | 'C' | 'D'
    let feedback: string

    if (totalScore >= 90) {
      grade = 'S'
      feedback = '卓越！你展现了出色的跨文化沟通能力，既充分参与又注重文化细节。'
    } else if (totalScore >= 75) {
      grade = 'A'
      feedback = '优秀！你的对话质量很高，对文化差异有良好的认知。'
    } else if (totalScore >= 60) {
      grade = 'B'
      feedback = '良好！继续保持参与度，可以更多关注文化礼节建议。'
    } else if (totalScore >= 40) {
      grade = 'C'
      feedback = '及格。建议增加对话深度，多参考AI提供的策略建议。'
    } else {
      grade = 'D'
      feedback = '需要改进。尝试更详细的回复，并关注文化洞察提示。'
    }

    return {
      total: totalScore,
      engagement: Math.round(engagementScore),
      cultural: Math.round(culturalScore),
      quality: Math.round(qualityScore),
      responsiveness: Math.round(responsivenessScore),
      grade,
      feedback
    }
  }, [messages, insights, quickReplyUsed])

  return score
}
