import { memo } from 'react'
import { useComfyStore } from '../store'
import { AgentRuntimePanel } from './agent-runtime-panel'
import { History, Send, Sparkles } from 'lucide-react'

type CanvasChatPanelProps = {
  workspaceId: string
  isAnimating: boolean
  onSendChat: () => void
}

export const CanvasChatPanel = memo(function CanvasChatPanel({
  workspaceId,
  isAnimating,
  onSendChat,
}: CanvasChatPanelProps) {
  const chatMessages = useComfyStore((state) => state.chatMessages)
  const chatInput = useComfyStore((state) => state.chatInput)
  const setChatInput = useComfyStore((state) => state.setChatInput)
  const isOrchestratorProcessing = useComfyStore((state) => state.isOrchestratorProcessing)

  return (
    <aside
      className={`w-96 flex flex-col glass-effect border-l border-white/10 z-10 ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.4s' }}
    >
      <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center border-2 border-white/20 shadow-lg shadow-emerald-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-sm font-bold text-white title-font">AI 商业顾问</h3>
          </div>
          <button className="p-2 rounded-xl glass-effect border border-white/10 hover:bg-white/10 transition-colors">
            <History className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="px-5 pt-5">
        <AgentRuntimePanel workspaceId={workspaceId} />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {chatMessages.map((message, index) => (
          <div key={`${message.timestamp}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                message.role === 'assistant'
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30'
                  : 'glass-effect border border-white/20'
              }`}
            >
              {message.role === 'assistant' ? (
                <Sparkles className="w-4 h-4 text-white" />
              ) : (
                <span className="text-amber-400 text-xs font-bold mono-font">U</span>
              )}
            </div>

            <div className={`flex flex-col gap-1.5 max-w-[80%] ${message.role === 'user' ? 'items-end' : ''}`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  message.role === 'assistant'
                    ? 'glass-effect border border-white/10 text-slate-200 rounded-tl-none shadow-xl'
                    : 'bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-tr-none shadow-lg shadow-amber-500/30'
                }`}
              >
                {message.content}
              </div>
              <span className="text-[10px] text-slate-500 px-2 mono-font">{message.timestamp}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 border-t border-white/10 bg-gradient-to-t from-slate-900/30 to-transparent">
        <div className="relative">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSendChat()
            }}
            placeholder="询问关于你的商业模式..."
            className="w-full glass-effect border border-white/20 rounded-2xl pl-5 pr-14 py-4 text-sm focus:outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/30 transition-all placeholder-slate-500 text-slate-200 shadow-inner"
            disabled={isOrchestratorProcessing}
          />
          <button
            onClick={onSendChat}
            disabled={!chatInput.trim() || isOrchestratorProcessing}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </aside>
  )
})
