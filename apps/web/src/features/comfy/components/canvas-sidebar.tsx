import { Button } from '@/shared/components/ui/button'
import { AlertTriangle, Loader2, Wand2 } from 'lucide-react'
import { COMFY_NODE_PALETTE } from './canvas-config'

type CanvasSidebarProps = {
  isAnimating: boolean
  seedInput: string
  onSeedInputChange: (value: string) => void
  onAddNode: (type: string) => void
  onSeedGeneration: () => void
  onRunCritic: () => void
  isOrchestratorProcessing: boolean
  isCriticProcessing: boolean
  nodeCount: number
  knowledgeEvidence?: Array<{ docId?: string; snippet?: string }>
}

export function CanvasSidebar({
  isAnimating,
  seedInput,
  onSeedInputChange,
  onAddNode,
  onSeedGeneration,
  onRunCritic,
  isOrchestratorProcessing,
  isCriticProcessing,
  nodeCount,
  knowledgeEvidence,
}: CanvasSidebarProps) {
  return (
    <aside
      className={`w-80 flex flex-col glass-effect border-r border-white/10 z-10 ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.2s' }}
    >
      <div className="px-6 py-5 border-b border-white/10">
        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest title-font">节点库</h3>
        <p className="text-xs text-slate-400 mt-1.5">点击添加到画布</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
        {COMFY_NODE_PALETTE.map((node) => (
          <button
            key={node.type}
            onClick={() => onAddNode(node.type)}
            className="w-full group relative overflow-hidden"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl ${node.gradient}`}
              style={{ background: 'linear-gradient(to right, var(--tw-gradient-stops))' }}
            />
            <div className="relative flex items-center gap-4 p-4 rounded-2xl glass-effect border border-white/10 group-hover:border-white/30 transition-all group-hover:transform group-hover:scale-105 group-hover:shadow-xl">
              <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${node.gradient} shadow-lg text-2xl transform group-hover:rotate-12 transition-transform`}>
                {node.icon}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-white title-font">{node.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{node.description}</p>
              </div>
            </div>
          </button>
        ))}

        {knowledgeEvidence && knowledgeEvidence.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">知识库证据</h3>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
              {knowledgeEvidence.map((evidence, index) => (
                <div key={`${evidence.docId ?? 'evidence'}-${index}`} className="space-y-1">
                  <p className="text-amber-300 text-[11px] font-semibold truncate">
                    {evidence.docId ?? '未命名证据'}
                  </p>
                  <p className="text-slate-400 leading-snug">
                    {evidence.snippet ?? '暂无摘要'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-5 border-t border-white/10 space-y-3.5">
        <div className="space-y-2.5">
          <textarea
            value={seedInput}
            onChange={(event) => onSeedInputChange(event.target.value)}
            placeholder="用自然语言描述你的商业想法..."
            className="w-full h-28 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 placeholder:text-slate-500 text-slate-200 backdrop-blur-sm"
            disabled={isOrchestratorProcessing}
          />
          <Button
            onClick={onSeedGeneration}
            disabled={!seedInput.trim() || isOrchestratorProcessing}
            className={`w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold shadow-lg shadow-amber-500/30 rounded-xl py-6 ${
              isOrchestratorProcessing ? 'animate-pulse-glow' : ''
            }`}
          >
            {isOrchestratorProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                AI 思考中...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 mr-2" />
                生成画布
              </>
            )}
          </Button>
        </div>

        {nodeCount > 3 && (
          <Button
            onClick={onRunCritic}
            disabled={isCriticProcessing}
            variant="outline"
            className="w-full border-pink-400/30 bg-pink-400/10 text-pink-300 hover:bg-pink-400/20 hover:border-pink-400/50 rounded-xl py-5"
          >
            {isCriticProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                扫描中...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                冲突检测
              </>
            )}
          </Button>
        )}
      </div>
    </aside>
  )
}
