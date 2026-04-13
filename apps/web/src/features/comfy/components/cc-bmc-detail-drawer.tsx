'use client'

import { useState } from 'react'
import { useComfyStore } from '../store'
import { X, FileText, MessageSquare, Edit3, Link2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { QuizPanel, type QuizQuestion } from './quiz-panel'

type TabType = 'overview' | 'quiz' | 'edit' | 'resources'

export function CCBMCDetailDrawer() {
  const detailPanel = useComfyStore((state) => state.detailPanel)
  const closeDetailPanel = useComfyStore((state) => state.closeDetailPanel)
  const nodeData = useComfyStore((state) => {
    if (!state.detailPanel?.nodeId) return null
    return state.macraNodes.get(state.detailPanel.nodeId) ?? null
  })
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  if (!detailPanel?.isOpen || !detailPanel?.nodeId) {
    return null
  }

  const nodeWithDetails = nodeData as (typeof nodeData & { summary?: string; fullContent?: string }) | null

  if (!nodeData) {
    return null
  }

  const fullContent = nodeWithDetails?.fullContent || nodeData.content || ''
  const summary = nodeWithDetails?.summary || nodeData.content || ''

  // Quiz 生成处理函数 - 调用真实的 AI API
  const handleGenerateQuiz = async (): Promise<QuizQuestion[]> => {
    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nodeLabel: nodeData.label,
          nodeDomain: nodeData.domain || '',
          nodeContent: fullContent || summary || nodeData.content || ''
        })
      })

      if (!response.ok) {
        console.error('Quiz API 调用失败:', response.status)
        throw new Error(`Quiz API error: ${response.status}`)
      }

      const questions = await response.json()

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid quiz response format')
      }

      return questions
    } catch (error) {
      console.error('生成 Quiz 失败:', error)
      // 降级：返回 Mock 数据
      return [
        {
          id: '1',
          question: `关于 ${nodeData.domain} 维度，以下哪个描述最符合 ${nodeData.label} 的核心价值？`,
          options: [
            '通过降低成本提升竞争力',
            '通过创新服务增强客户粘性',
            '通过规模化运营提高效率',
            '通过差异化定位占领市场'
          ],
          correctAnswer: 1,
          explanation: `基于 ${nodeData.label} 的内容分析，该方案的核心在于通过创新服务来增强客户粘性，这与 ${nodeData.domain} 的战略定位高度一致。`,
          difficulty: 'medium'
        },
        {
          id: '2',
          question: `在 ${nodeData.domain} 的实施过程中，最关键的风险因素是什么？`,
          options: [
            '市场需求不确定性',
            '技术实现复杂度',
            '资源投入不足',
            '竞争对手模仿'
          ],
          correctAnswer: 0,
          explanation: '市场需求的不确定性是该维度最需要关注的风险因素，需要通过持续的市场验证和快速迭代来降低风险。',
          difficulty: 'hard'
        },
        {
          id: '3',
          question: `${nodeData.label} 与哪个 CC-BMC 维度的协同效应最强？`,
          options: [
            '价值主张 (Value Propositions)',
            '客户细分 (Customer Segments)',
            '关键资源 (Key Resources)',
            '成本结构 (Cost Structure)'
          ],
          correctAnswer: 0,
          explanation: '价值主张与该要素之间存在强协同关系，两者相互支撑构成商业模式的核心逻辑。',
          difficulty: 'easy'
        }
      ]
    }
  }

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: '概览', icon: <FileText className="w-4 h-4" /> },
    { id: 'quiz', label: 'Quiz', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'edit', label: '编辑', icon: <Edit3 className="w-4 h-4" /> },
    { id: 'resources', label: '资源', icon: <Link2 className="w-4 h-4" /> }
  ]

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={closeDetailPanel}
      />

      {/* 抽屉主体 */}
      <div
        className="fixed right-0 top-0 bottom-0 w-[500px] glass-effect border-l border-white/20 z-50 flex flex-col animate-slide-in-right shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
        }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white title-font">{nodeData.label}</h2>
              <p className="text-xs text-slate-400 mono-font">{nodeData.domain}</p>
            </div>
          </div>
          <button
            onClick={closeDetailPanel}
            className="p-2 rounded-xl glass-effect border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 标签栏 */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-white/10 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/30'
                  : 'glass-effect border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 摘要 */}
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-3 title-font">核心摘要</h3>
                <div className="glass-effect border border-white/10 rounded-2xl p-5">
                  <div className="prose prose-sm prose-invert max-w-none text-slate-300">
                    <ReactMarkdown>{summary}</ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* 完整内容 */}
              <div>
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-3 title-font">详细分析</h3>
                <div className="glass-effect border border-white/10 rounded-2xl p-5">
                  <div className="prose prose-sm prose-invert max-w-none text-slate-300 leading-relaxed">
                    <ReactMarkdown>{fullContent}</ReactMarkdown>
                  </div>
                </div>
              </div>

              {/* 元数据 */}
              {nodeData.metadata && (
                <div>
                  <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-3 title-font">元信息</h3>
                  <div className="glass-effect border border-white/10 rounded-2xl p-5 space-y-3">
                    {nodeData.metadata.agent_signature && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-semibold">创建者:</span>
                        <span className="text-amber-400 font-bold mono-font">{nodeData.metadata.agent_signature}</span>
                      </div>
                    )}
                    {nodeData.metadata.confidence && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 font-semibold">置信度:</span>
                        <span className="px-3 py-1 rounded-lg bg-amber-400/20 text-amber-400 font-bold text-xs uppercase border border-amber-400/30">
                          {nodeData.metadata.confidence}
                        </span>
                      </div>
                    )}
                    {nodeData.metadata.source && (
                      <div className="flex flex-col gap-2 text-sm">
                        <span className="text-slate-400 font-semibold">数据来源:</span>
                        <span className="text-slate-300 mono-font text-xs bg-white/5 p-3 rounded-xl border border-white/10">
                          {nodeData.metadata.source}
                        </span>
                      </div>
                    )}
                    {nodeData.metadata.cultural_context && (
                      <div className="flex flex-col gap-2 text-sm">
                        <span className="text-slate-400 font-semibold">跨文化适配:</span>
                        <span className="text-slate-300 mono-font text-xs bg-white/5 p-3 rounded-xl border border-white/10">
                          {nodeData.metadata.cultural_context}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quiz' && (
            <QuizPanel
              nodeId={detailPanel.nodeId}
              nodeLabel={nodeData.label}
              domain={nodeData.domain || ''}
              onGenerateQuiz={handleGenerateQuiz}
            />
          )}

          {activeTab === 'edit' && (
            <div className="space-y-4">
              <div className="glass-effect border border-white/20 rounded-2xl p-6 text-center">
                <Edit3 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                <p className="text-slate-300 text-sm">编辑功能即将推出...</p>
                <p className="text-slate-500 text-xs mt-2">您将能够直接修改节点内容和属性</p>
              </div>
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="space-y-4">
              <div className="glass-effect border border-white/20 rounded-2xl p-6 text-center">
                <Link2 className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <p className="text-slate-300 text-sm">资源链接功能即将推出...</p>
                <p className="text-slate-500 text-xs mt-2">相关研究资料和参考链接将显示在此处</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
