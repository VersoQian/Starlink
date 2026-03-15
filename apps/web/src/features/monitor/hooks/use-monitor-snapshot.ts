'use client'

import { useMemo } from 'react'
import { useWorkspaceAssets, useWorkspaceFlowStepStates, useWorkspaceTaskRuns, type FlowStepStatus } from '@/entities'
import { workspaceFlowStages, type WorkspaceStageId } from '@/lib/workspace-flow'

type SourceHealth = 'loading' | 'ready' | 'error' | 'idle'

export type MonitorStageSnapshot = {
  id: WorkspaceStageId
  label: string
  accent: string
  description: string
  progress: number
  health: FlowStepStatus
  detail: string
  metrics: string[]
}

export type MonitorRisk = {
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
}

export type MonitorSourceSnapshot = {
  label: string
  status: SourceHealth
  detail: string
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

function toHealth(progress: number, hasError: boolean): FlowStepStatus {
  if (hasError) return 'blocked'
  if (progress >= 85) return 'complete'
  if (progress > 0) return 'active'
  return 'empty'
}

export function useMonitorSnapshot(workspaceId: string) {
  const {
    latestKnowledgeBase,
    summary: taskSummary,
    isLoading: taskLoading,
    isError: taskError
  } = useWorkspaceTaskRuns(workspaceId)
  const {
    assets,
    graph,
    iterations: timelineIterations,
    agentSnapshot,
    seminarSnapshot,
    runtime,
    isLoading: assetLoading,
    isError: assetError
  } = useWorkspaceAssets(workspaceId)
  const { stepStates } = useWorkspaceFlowStepStates(workspaceId)
  const graphNodes = graph?.nodes ?? []
  const graphEdges = graph?.edges ?? []
  const evidenceNodes = graphNodes.filter((node) => ['document', 'reference', 'web'].includes(node.type))
  const synthesisNodes = graphNodes.filter((node) => ['note', 'task'].includes(node.type))
  const analysisAssetCount = assets.filter((asset) => asset.assetType === 'research-brief').length
  const modelingAssetCount = assets.filter((asset) =>
    ['canvas-graph', 'agent-run-result'].includes(asset.assetType)
  ).length
  const seminarDecisionCount = (seminarSnapshot?.decision.length ?? 0) + (runtime.latestDecision ? 1 : 0)
  const seminarActivityCount =
    (seminarSnapshot?.planning.length ?? 0) +
    (seminarSnapshot?.execution.length ?? 0) +
    (seminarSnapshot?.review.length ?? 0) +
    (seminarSnapshot?.decision.length ?? 0) +
    runtime.seminarTurns.length

  const stages = useMemo<MonitorStageSnapshot[]>(() => {
    const intakeStep = stepStates.find((step) => step.stepKey === 'intake')
    const analysisStep = stepStates.find((step) => step.stepKey === 'analysis')
    const modelingStep = stepStates.find((step) => step.stepKey === 'modeling')
    const deliveryStep = stepStates.find((step) => step.stepKey === 'delivery')

    const intakeProgress = clamp(
      (latestKnowledgeBase ? 35 : 0) +
      (latestKnowledgeBase ? 15 : 0) +
      (latestKnowledgeBase?.status === 'ready' || latestKnowledgeBase?.publishedAt ? 20 : 0) +
      (taskSummary.success > 0 ? 20 : 0) +
      (taskSummary.running > 0 || taskSummary.queued > 0 ? 10 : 0) +
      (evidenceNodes.length > 0 ? 10 : 0) +
      ((intakeStep?.linkedAssets.length ?? 0) > 0 ? 10 : 0)
    )

    const analysisProgress = clamp(
      (analysisAssetCount > 0 ? 35 : 0) +
      (evidenceNodes.length > 0 ? 15 : 0) +
      (synthesisNodes.length > 0 ? 20 : 0) +
      (timelineIterations.length > 0 ? 20 : 0) +
      (graphNodes.length >= 6 ? 15 : 0) +
      ((analysisStep?.linkedAssets.length ?? 0) > 0 ? 10 : 0)
    )

    const modelingProgress = clamp(
      (graphNodes.length > 0 ? 25 : 0) +
      (graphEdges.length > 0 ? 20 : 0) +
      (modelingAssetCount > 0 ? 20 : 0) +
      ((agentSnapshot?.agents.length ?? 0) > 0 ? 15 : 0) +
      ((modelingStep?.linkedAssets.length ?? 0) > 0 ? 10 : 0) +
      (
        (agentSnapshot?.agents.reduce((sum, agent) => sum + agent.contributions.length, 0) ?? 0) >= 5
          ? 10
          : 0
      )
    )

    const deliveryProgress = clamp(
      ((deliveryStep?.linkedAssets.length ?? 0) > 0 ? 20 : 0) +
      ((seminarSnapshot?.openingStatements.length ?? 0) > 0 ? 20 : 0) +
      ((seminarSnapshot?.review.length ?? 0) > 0 ? 20 : 0) +
      (seminarDecisionCount > 0 ? 35 : 0) +
      (runtime.latestPhase === 'decision' ? 15 : 0) +
      (seminarActivityCount >= 3 ? 10 : 0)
    )

    return workspaceFlowStages.map((stage) => {
      if (stage.id === 'intake') {
        return {
          ...stage,
          progress: intakeProgress,
          health: intakeStep?.status ?? toHealth(intakeProgress, taskError),
          detail: latestKnowledgeBase
            ? `最近知识库：${latestKnowledgeBase.name} · ${taskSummary.success}/${taskSummary.total} 个任务已成功`
            : intakeStep?.blockers[0] ?? '尚未读取到知识库或导入任务。',
          metrics: [
            `knowledge assets ${intakeStep?.linkedAssets.length ?? 0}`,
            `successful tasks ${taskSummary.success}`,
            `evidence nodes ${evidenceNodes.length}`
          ]
        }
      }

      if (stage.id === 'analysis') {
        return {
          ...stage,
          progress: analysisProgress,
          health: analysisStep?.status ?? toHealth(analysisProgress, assetError),
          detail: analysisStep?.blockers[0]
            ?? (timelineIterations.length > 0
              ? `已记录 ${timelineIterations.length} 次分析迭代，结果开始沉淀到画布。`
              : '尚未看到稳定的分析迭代记录，当前主要依赖画布节点推断分析进度。'),
          metrics: [
            `timeline iterations ${timelineIterations.length}`,
            `analysis assets ${analysisStep?.linkedAssets.length ?? 0}`,
            `synthesis nodes ${synthesisNodes.length}`
          ]
        }
      }

      if (stage.id === 'modeling') {
        return {
          ...stage,
          progress: modelingProgress,
          health: modelingStep?.status ?? toHealth(modelingProgress, assetError),
          detail: modelingStep?.blockers[0]
            ?? (graphNodes.length > 0
              ? `当前工作区已有 ${graphNodes.length} 个节点、${graphEdges.length} 条连线。`
              : '画布还没有形成建模骨架。'),
          metrics: [
            `graph nodes ${graphNodes.length}`,
            `model assets ${modelingStep?.linkedAssets.length ?? 0}`,
            `agents ${(agentSnapshot?.agents.length ?? 0)}`
          ]
        }
      }

      return {
        ...stage,
        progress: deliveryProgress,
        health: deliveryStep?.status ?? toHealth(deliveryProgress, false),
        detail: deliveryStep?.blockers[0]
          ?? (seminarDecisionCount > 0
            ? `研讨阶段已经出现 ${seminarDecisionCount} 条决策结论。`
            : '尚未形成可追踪的决策结论，交付链路仍在早期。'),
        metrics: [
          `seminar events ${seminarActivityCount}`,
          `delivery assets ${deliveryStep?.linkedAssets.length ?? 0}`,
          `decisions ${seminarDecisionCount}`
        ]
      }
    })
  }, [
    analysisAssetCount,
    assetError,
    agentSnapshot,
    evidenceNodes.length,
    graphEdges.length,
    graphNodes.length,
    latestKnowledgeBase,
    modelingAssetCount,
    runtime.latestPhase,
    seminarActivityCount,
    seminarDecisionCount,
    seminarSnapshot,
    stepStates,
    synthesisNodes.length,
    taskError,
    taskSummary.queued,
    taskSummary.running,
    taskSummary.success,
    taskSummary.total,
    timelineIterations.length,
  ])

  const risks = useMemo<MonitorRisk[]>(() => {
    const next: MonitorRisk[] = []
    const intakeStep = stepStates.find((step) => step.stepKey === 'intake')
    const analysisStep = stepStates.find((step) => step.stepKey === 'analysis')
    const modelingStep = stepStates.find((step) => step.stepKey === 'modeling')
    const deliveryStep = stepStates.find((step) => step.stepKey === 'delivery')

    if (taskError) {
      next.push({
        title: '知识库数据源不可用',
        detail: '监控页无法稳定读取知识库和任务状态，资料归集阶段的完成度会失真。',
        severity: 'high'
      })
    } else if ((intakeStep?.linkedAssets.length ?? 0) === 0 && evidenceNodes.length === 0) {
      next.push({
        title: '资料归集仍为空',
        detail: '没有读到知识库，也没有从画布里看到文档/引用节点，当前系统缺少可追溯资料入口。',
        severity: 'medium'
      })
    }

    if (assetError) {
      next.push({
        title: '工作区图谱不可用',
        detail: '画布 GraphQL 数据读取失败，方案建模和研讨阶段无法被准确监控。',
        severity: 'high'
      })
    } else if (graphNodes.length === 0) {
      next.push({
        title: '工作区尚未形成建模骨架',
        detail: '当前工作区没有节点，后续 Agent 与研讨页面都缺少真实承接对象。',
        severity: 'medium'
      })
    }

    if (analysisStep?.blockers.length || (timelineIterations.length === 0 && synthesisNodes.length === 0)) {
      next.push({
        title: '研究阶段缺少沉淀记录',
        detail: analysisStep?.blockers[0] ?? '还没有看到分析迭代或综合节点，研究结果尚未形成稳定的可追踪产物。',
        severity: 'medium'
      })
    }

    if (modelingStep?.blockers.length || (agentSnapshot?.agents.length ?? 0) === 0) {
      next.push({
        title: 'Agent 协作尚未启动',
        detail: modelingStep?.blockers[0] ?? 'Agent 面板当前没有贡献记录，说明从画布到多智能体协作的链路还未闭合。',
        severity: 'low'
      })
    }

    if (deliveryStep?.blockers.length || seminarDecisionCount === 0) {
      next.push({
        title: '交付阶段未形成决策结论',
        detail: deliveryStep?.blockers[0] ?? '研讨会尚未产出明确决策，跨文化助手目前缺少稳定输入。',
        severity: 'low'
      })
    }

    return next
  }, [
    assetError,
    agentSnapshot?.agents.length,
    evidenceNodes.length,
    graphNodes.length,
    seminarDecisionCount,
    stepStates,
    synthesisNodes.length,
    taskError,
    timelineIterations.length,
  ])

  const dataSources = useMemo<MonitorSourceSnapshot[]>(() => [
    {
      label: 'Knowledge GraphQL',
      status: taskError
        ? 'error'
        : taskLoading
          ? 'loading'
          : latestKnowledgeBase
            ? 'ready'
            : 'idle',
      detail: latestKnowledgeBase
        ? `${latestKnowledgeBase.name} · ${latestKnowledgeBase.status}`
        : '暂无知识库数据'
    },
    {
      label: 'Workspace Graph',
      status: assetError
        ? 'error'
        : assetLoading
          ? 'loading'
          : graph
            ? 'ready'
            : 'idle',
      detail: graph
        ? `${graphNodes.length} nodes / ${graphEdges.length} edges`
        : '暂无画布图谱'
    },
    {
      label: 'Timeline History',
      status: assetError
        ? 'error'
        : assetLoading
          ? 'loading'
          : 'ready',
      detail: `${timelineIterations.length} iterations`
    },
    {
      label: 'Conversation Runtime',
      status: runtime.events.length > 0 ? 'ready' : 'idle',
      detail: runtime.latestPhase ? `latest phase ${runtime.latestPhase}` : 'waiting for runtime events'
    }
  ], [
    assetError,
    assetLoading,
    graph,
    graphEdges.length,
    graphNodes.length,
    latestKnowledgeBase,
    runtime.events.length,
    runtime.latestPhase,
    taskError,
    taskLoading,
    timelineIterations.length,
  ])

  return {
    latestKnowledgeBase,
    taskSummary,
    graph,
    graphNodes,
    graphEdges,
    evidenceNodes,
    synthesisNodes,
    timelineIterations,
    agentSnapshot,
    seminarSnapshot,
    runtime,
    stages,
    risks,
    dataSources,
    counts: {
      pages: assets.length,
      graphNodes: graphNodes.length,
      graphEdges: graphEdges.length,
      agents: agentSnapshot?.agents.length ?? 0,
      decisions: seminarDecisionCount
    }
  }
}
