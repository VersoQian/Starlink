'use client'

import { Loader2, Send, Sparkles } from 'lucide-react'
import { useComfyStore } from '../../store'
import { getToolPaletteItems, type ToolDescriptor } from '../../registries/tool-registry'
import { useToolInvoker } from '../tools/use-tool-runner'
import { useComfyShellContext } from '../workspace-shell-context'

export function ChatInputPanel() {
  const { onSendChat } = useComfyShellContext()
  const chatInput = useComfyStore((state) => state.chatInput)
  const setChatInput = useComfyStore((state) => state.setChatInput)
  const isOrchestratorProcessing = useComfyStore((state) => state.isOrchestratorProcessing)
  const setWorkflowStage = useComfyStore((state) => state.setWorkflowStage)
  const openToolDrawer = useComfyStore((state) => state.openToolDrawer)
  const invokeTool = useToolInvoker()
  const tools = getToolPaletteItems()

  const handleSubmit = () => {
    const trimmedInput = chatInput.trim()
    const matchedTool = findCommandTool(trimmedInput, tools)

    if (!matchedTool) {
      onSendChat()
      return
    }

    if (matchedTool.DrawerComponent) {
      openToolDrawer(matchedTool.id)
    }
    const commandText = trimmedInput.slice(matchedTool.command.length).trim()
    if (!commandText && (
      matchedTool.id === 'knowledge'
      || matchedTool.id === 'research'
      || matchedTool.id === 'translate'
    )) {
      return
    }

    void invokeTool(matchedTool, buildCommandInput(matchedTool.id, commandText), {
      summarize: summarizeInlineToolResult
    })
    setChatInput('')
  }

  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-950/80 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
      <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
          <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
          Canvas Command
        </span>
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => {
                if (tool.DrawerComponent) {
                  openToolDrawer(tool.id)
                }
                setChatInput(`${tool.command} `)
              }}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
              title={tool.description}
            >
              <Icon className="h-3.5 w-3.5" />
              {tool.command}
            </button>
          )
        })}
      </div>

      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <input
          value={chatInput}
          onChange={(event) => {
            const nextValue = event.target.value
            setChatInput(nextValue)
            if (nextValue.trim()) {
              setWorkflowStage('input', 'chat-draft')
            }
          }}
          onKeyUp={(event) => {
            const matchedTool = tools.find((tool) => event.currentTarget.value.trim() === tool.command)
            if (event.key === ' ' && matchedTool?.DrawerComponent) {
              openToolDrawer(matchedTool.id)
            }
          }}
          placeholder="询问业务模式，或输入 @ 唤起工具..."
          className="w-full rounded-3xl border border-white/15 bg-white/[0.06] py-4 pl-5 pr-16 text-sm text-slate-100 shadow-inner outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/25"
          disabled={isOrchestratorProcessing}
        />
        <button
          type="submit"
          disabled={!chatInput.trim() || isOrchestratorProcessing}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50"
          aria-label="发送"
        >
          {isOrchestratorProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <Send className="h-4 w-4 text-white" />
          )}
        </button>
      </form>
    </section>
  )
}

function findCommandTool(input: string, tools: ToolDescriptor[]) {
  return tools.find((tool) => input === tool.command || input.startsWith(`${tool.command} `))
}

function buildCommandInput(toolId: string, commandText: string) {
  if (toolId === 'research') {
    return {
      query: commandText,
      researchType: 'comprehensive',
      depth: 'medium',
      sources: ['academic', 'news'],
      language: 'zh'
    }
  }

  if (toolId === 'knowledge') {
    return {
      query: commandText,
      topK: 5
    }
  }

  if (toolId === 'memory') {
    const normalized = commandText.trim()
    if (!normalized || normalized === 'list' || normalized.startsWith('list ')) {
      return {
        query: normalized.replace(/^list\s*/, ''),
        mode: 'list'
      }
    }

    return {
      query: commandText,
      mode: 'context'
    }
  }

  if (toolId === 'translate') {
    return {
      text: commandText,
      sourceLanguage: 'auto',
      targetLanguage: 'en',
      mode: 'professional'
    }
  }

  return {}
}

function summarizeInlineToolResult(result: unknown) {
  if (isRecord(result) && typeof result.summary === 'string') {
    return result.summary
  }

  if (isRecord(result) && typeof result.translation === 'string') {
    return `已生成翻译：${result.translation.slice(0, 64)}`
  }

  return '工具执行完成'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
