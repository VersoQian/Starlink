'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasViewport, type CanvasViewportHandle } from '@/components/workspace/canvas-viewport'
import { AssistantPanel } from '@/components/workspace/assistant-panel'
import { DocumentDrawer } from '@/components/workspace/document-drawer'
import { CanvasToolbar } from '@/components/workspace/canvas-toolbar'
import { NodePalette } from '@/components/workspace/node-palette'
import { useCanvasStore } from '@/store/canvas-store'
import { AnalysisModal } from '@/components/workspace/analysis-modal'
import { useTimelineHistory } from '@/hooks/use-timeline-history'
import { TimelineHistoryPanel } from '@/components/workspace/timeline-history-panel'

type WorkspacePageProps = {
  params: { workspaceId: string }
}

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const [paletteVisible, setPaletteVisible] = useState(true)
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(true)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisPending, setAnalysisPending] = useState(false)
  const activePanels = useCanvasStore((state) => state.activePanels)
  const taskId = useCanvasStore((state) => state.taskId)
  const setTaskId = useCanvasStore((state) => state.setTaskId)
  const iterations = useCanvasStore((state) => state.iterations)
  const setIterations = useCanvasStore((state) => state.setIterations)
  const isAssistantOpen = useMemo(() => activePanels.has('assistant'), [activePanels])
  const canvasRef = useRef<CanvasViewportHandle>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const resolvedTaskId = useMemo(() => taskId ?? `${params.workspaceId}-default`, [taskId, params.workspaceId])

  useEffect(() => {
    if (!taskId) {
      setTaskId(resolvedTaskId)
    }
  }, [resolvedTaskId, setTaskId, taskId])

  const { data: historyData, isLoading: historyLoading } = useTimelineHistory(params.workspaceId, resolvedTaskId)

  useEffect(() => {
    if (historyData?.iterations) {
      setIterations(historyData.iterations)
    }
  }, [historyData, setIterations])

  return (
    <div className="relative flex h-full min-h-[calc(100vh-80px)]">
      <div className="flex flex-1 flex-col">
        <CanvasToolbar
          onAddNode={async () => {
            if (!canvasRef.current) return
            await canvasRef.current.createMainNode('任务规划', '请描述你的目标或问题…')
          }}
          onToggleDocuments={() => setDocumentDrawerOpen((prev) => !prev)}
          onTogglePalette={() => setPaletteVisible((prev) => !prev)}
          onRunAnalysis={() => {
            setAnalysisError(null)
            setAnalysisOpen(true)
          }}
        />
        <div className="relative flex flex-1">
          <div className="flex flex-1">
            <CanvasViewport ref={canvasRef} workspaceId={params.workspaceId} />
            {paletteVisible && (
              <div className="absolute left-8 top-8 z-[200]">
                <NodePalette />
              </div>
            )}
          </div>
        </div>
      </div>
      {(historyLoading || iterations.length > 0) && (
        <div className="absolute right-[470px] top-24 z-[250]">
          <TimelineHistoryPanel
            iterations={iterations}
            loading={historyLoading}
            onRestore={(iteration) => {
              if (!canvasRef.current) return
              canvasRef.current.loadTimeline({ nodes: iteration.nodes, edges: iteration.edges })
            }}
          />
        </div>
      )}
      {isAssistantOpen && <AssistantPanel />}
      <DocumentDrawer open={documentDrawerOpen} onClose={() => setDocumentDrawerOpen(false)} />
      <AnalysisModal
        open={analysisOpen}
        pending={analysisPending}
        errorMessage={analysisError}
        onClose={() => {
          if (!analysisPending) {
            setAnalysisOpen(false)
            setAnalysisError(null)
          }
        }}
        onConfirm={async (question) => {
          if (!question.trim()) return
          if (!canvasRef.current) {
            setAnalysisError('画布尚未初始化，请稍后重试。')
            return
          }
          setAnalysisPending(true)
          setAnalysisError(null)
          try {
            await canvasRef.current.generateAnalysis(question)
            setAnalysisOpen(false)
          } catch (error) {
            console.error(error)
            setAnalysisError(error instanceof Error ? error.message : '分析失败，请稍后重试。')
          } finally {
            setAnalysisPending(false)
          }
        }}
      />
    </div>
  )
}
