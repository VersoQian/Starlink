# 实例指南：如何添加新 Agent

本指南通过一个完整示例，展示如何在 Braching Chat 中添加一个新的 Agent。

## 🎯 示例：添加 "Risk_Agent" （风险评估专家）

### 需求
创建一个新的 Risk Agent，专门分析商业模型中的风险因素，包括：
- 市场风险
- 技术风险
- 合规风险

---

## 第 1 步：定义 Agent 类型

**文件**: `apps/web/types/macra.ts`

```typescript
// 在 AGENT_TYPES 对象中添加新 Agent
export const AGENT_TYPES = {
  // ... 现有 Agent ...
  ORCHESTRATOR: 'Orchestrator',
  CRITIC: 'Adversarial_Critic',

  // ✨ 新增
  RISK: 'Risk_Agent'  // 添加这一行
} as const
```

✓ **验证**: TypeScript 会自动推导新类型 `AgentType = ... | 'Risk_Agent'`

---

## 第 2 步：定义输出数据结构

**文件**: `apps/web/types/macra.ts`

虽然所有输出都使用 `MacraNodeData`，但我们需要定义新的节点类型。在 `NodeType` 中扩展：

```typescript
export type NodeType =
  | 'cc-bmc-card'
  | CCBMCNodeType
  | 'agent-avatar'
  | 'conflict-alert'
  | 'insight-note'
  | 'data-source'
  | 'plan-node'
  | 'risk-alert'  // ✨ 新增：风险警告节点类型
```

定义风险警告节点的特有字段：

```typescript
export type RiskAlertNodeData = MacraNodeData & {
  type: 'risk-alert'
  riskCategory: 'market' | 'technology' | 'compliance'
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  mitigationStrategy?: string
}
```

---

## 第 3 步：在后端实现 Agent

**文件**: `packages/server/src/services/business-langgraph.ts`

### 3.1 扩展 LangGraph State

```typescript
// 在 BusinessState 定义中添加新字段
const BusinessState = Annotation.Root({
  // ... 现有字段 ...
  risks: Annotation<MacraNodeData[]>()  // ✨ 新增：风险输出
})
```

### 3.2 定义 Risk Agent Prompt

```typescript
private async runRiskAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
  const startedAt = Date.now()

  if (!this.model) {
    this.logTrace({
      step: 'riskAgent',
      traceId: state.traceId,
      workspaceId: state.workspaceId,
      userId: state.userId,
      status: 'completed',
      durationMs: Date.now() - startedAt,
      metadata: { reason: 'model-not-configured' }
    })
    return { risks: [] }
  }

  const prompt = `你是 Risk_Agent（风险评估专家），需要分析商业模型中的潜在风险。

分析用户提供的商业背景：
${state.question}

请识别并分析以下三类风险，为每个风险生成一个节点：

## 风险类别

1. **市场风险** (market)
   - 竞争加剧
   - 市场规模收缩
   - 消费者偏好变化

2. **技术风险** (technology)
   - 技术落后
   - 集成难度大
   - 维护成本高

3. **合规风险** (compliance)
   - 监管变化
   - 法律诉讼
   - 数据隐私问题

请生成 3 个 risk-alert 节点（JSON 数组格式），每个包含：
- id: 自动生成（格式 risk-xxxxx）
- type: "risk-alert"
- label: 风险标题（10字内）
- riskCategory: "market" | "technology" | "compliance"
- riskLevel: "critical" | "high" | "medium" | "low"
- content: 风险描述和缓解策略（Markdown）
- mitigationStrategy: 具体缓解方案
- metadata: { agent_signature: "Risk_Agent", confidence: "high|medium|low" }

示例：
[
  {
    "id": "risk-${nanoid(8)}",
    "type": "risk-alert",
    "label": "市场竞争加剧",
    "riskCategory": "market",
    "riskLevel": "high",
    "content": "## 风险描述\\n主要竞争对手在价格战压力下可能降价20-30%。\\n\\n## 影响范围\\n可能导致利润率下滑5-8%。\\n\\n## 缓解策略\\n加强品牌差异化...",
    "mitigationStrategy": "通过产品创新和服务升级建立品牌护城河",
    "metadata": {
      "agent_signature": "Risk_Agent",
      "confidence": "high",
      "source": "市场研究报告"
    }
  },
  // ... 其他2个风险节点
]
`

  try {
    const response = await this.model.invoke([
      new SystemMessage(prompt),
      new HumanMessage(state.question)
    ])

    const content = response.content as string
    const nodes = extractAndParseJSON(content, 'runRiskAgent')

    if (nodes.length === 0) {
      return { risks: [] }
    }

    // 验证和规范化
    const validatedNodes = nodes.map((node) => ({
      ...node,
      id: `risk-${nanoid(8)}`,
      type: 'risk-alert' as const,
      metadata: {
        ...node.metadata,
        agent_signature: AGENT_TYPES.RISK,
        stage: 'review' as const
      }
    }))

    this.logTrace({
      step: 'riskAgent',
      traceId: state.traceId,
      workspaceId: state.workspaceId,
      userId: state.userId,
      status: 'completed',
      durationMs: Date.now() - startedAt,
      metadata: {
        nodeCount: validatedNodes.length,
        categories: validatedNodes.map(n => n.riskCategory)
      }
    })

    return { risks: validatedNodes }
  } catch (error) {
    auditLogger.error({
      action: 'business-langgraph.runRiskAgent',
      requestId: state.traceId,
      workflowId: state.workspaceId,
      userId: state.userId,
      metadata: { error: String(error) },
      error
    })

    return { risks: [] }
  }
}
```

---

## 第 4 步：集成到 LangGraph 工作流

**文件**: `packages/server/src/services/business-langgraph.ts`

### 4.1 在 createGraph() 中添加节点

```typescript
private createGraph() {
  return new StateGraph(BusinessState)
    .addNode('routerAgent', async (state) => this.routeIntent(state))
    .addNode('marketAgent', async (state) => this.runMarketAgent(state))
    .addNode('productAgent', async (state) => this.runProductAgent(state))
    .addNode('financeAgent', async (state) => this.runFinanceAgent(state))
    // ✨ 新增 Risk Agent
    .addNode('riskAgent', async (state) => this.runRiskAgent(state))
    .addNode('orchestrator', async (state) => this.orchestrate(state))
    .addNode('critic', async (state) => this.runCritic(state))
    .addEdge(START, 'routerAgent')
    .addConditionalEdges('routerAgent', (state) => {
      const intent = state.intent?.intent || 'general'
      if (intent === 'generate_bmc') {
        // ✨ 添加 riskAgent 到并行执行列表
        return ['marketAgent', 'productAgent', 'financeAgent', 'riskAgent']
      }
      if (intent === 'detect_conflicts') {
        return ['critic']
      }
      return ['orchestrator']
    })
    // ✨ 新增边连接：Risk Agent 输出 → Orchestrator
    .addEdge(['marketAgent', 'productAgent', 'financeAgent', 'riskAgent'], 'orchestrator')
    .addEdge('orchestrator', 'critic')
    .addEdge('critic', END)
    .compile()
}
```

### 4.2 在 streamConversation() 中处理输出

```typescript
async *streamConversation(context: {...}): AsyncGenerator<BusinessStreamUpdate> {
  // ... 现有代码 ...

  for await (const update of stream) {
    const entries = Object.entries(update as Record<string, Record<string, unknown>>)

    for (const [nodeName, payload] of entries) {
      // ... 现有 Agent 处理 ...

      // ✨ 新增：Risk Agent 处理
      if (nodeName === 'riskAgent' && payload.risks) {
        const risks = payload.risks as MacraNodeData[]
        for (const risk of risks) {
          yield { type: 'delta', delta: builder.addMacraNode(risk) }
        }
      }

      // ... 其他处理 ...
    }
  }
}
```

---

## 第 5 步：在前端实现风险节点组件

**文件**: `apps/web/src/features/comfy/components/nodes/risk-alert-node.tsx`

```typescript
import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { AlertTriangle, TrendingDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const RISK_LEVEL_CONFIG = {
  critical: {
    label: '严重风险',
    gradient: 'from-red-500 to-red-600',
    accent: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.6)'
  },
  high: {
    label: '高风险',
    gradient: 'from-orange-500 to-orange-600',
    accent: '#f97316',
    glow: 'rgba(249, 115, 22, 0.6)'
  },
  medium: {
    label: '中风险',
    gradient: 'from-yellow-500 to-yellow-600',
    accent: '#eab308',
    glow: 'rgba(234, 179, 8, 0.6)'
  },
  low: {
    label: '低风险',
    gradient: 'from-blue-500 to-blue-600',
    accent: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.6)'
  }
}

export const RiskAlertNode = memo(function RiskAlertNode({ id, data }: NodeProps) {
  const { getMacraNode } = useComfyStore()
  const nodeData = getMacraNode(id) || (data as MacraNodeData)
  const [isHovered, setIsHovered] = useState(false)

  const riskLevel = (data as Record<string, unknown>).riskLevel as keyof typeof RISK_LEVEL_CONFIG || 'medium'
  const riskCategory = (data as Record<string, unknown>).riskCategory as string || '未分类'
  const config = RISK_LEVEL_CONFIG[riskLevel]

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: `linear-gradient(135deg, ${config.accent}, ${config.accent}cc)`,
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: `0 4px 12px ${config.glow}`
        }}
      />

      <div
        className="w-[360px] rounded-3xl overflow-hidden transition-all duration-500 relative group"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${config.accent}35`,
          boxShadow: isHovered
            ? `0 20px 60px -15px ${config.glow}, 0 0 0 1px ${config.accent}30, inset 0 1px 0 rgba(255,255,255,0.1)`
            : `0 10px 30px -10px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 装饰性光晕 */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-2xl"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${config.accent}25, transparent 70%)`
          }}
        />

        {/* 顶部栏 */}
        <div
          className="relative px-5 py-4 border-b border-white/10"
          style={{
            background: `linear-gradient(135deg, ${config.accent}20, transparent)`
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${config.gradient} shadow-lg border-2 border-white/20`}
              style={{ boxShadow: `0 10px 30px ${config.glow}` }}
            >
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-white title-font">
                  {nodeData?.label || '风险警告'}
                </h3>
                <span
                  className="px-3 py-1 rounded-full text-[11px] font-bold border"
                  style={{
                    background: `${config.accent}20`,
                    color: config.accent,
                    borderColor: `${config.accent}40`
                  }}
                >
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 mono-font">{riskCategory} 风险</p>
            </div>
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-5 space-y-4">
          <div className="prose prose-sm prose-invert max-w-none text-slate-200 bg-white/5 rounded-xl p-4 border border-white/10 shadow-inner max-h-56 overflow-y-auto">
            <ReactMarkdown>{nodeData?.content || '*暂无风险详情*'}</ReactMarkdown>
          </div>

          {/* 缓解策略 */}
          {(data as Record<string, unknown>).mitigationStrategy && (
            <div
              className="rounded-lg px-4 py-3 border text-sm"
              style={{
                background: `${config.accent}10`,
                borderColor: `${config.accent}30`
              }}
            >
              <div className="flex items-start gap-2">
                <TrendingDown className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: config.accent }} />
                <div>
                  <p className="font-semibold text-slate-300">缓解策略</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {(data as Record<string, unknown>).mitigationStrategy as string}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部装饰线 */}
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, transparent, ${config.accent}80, ${config.accent}60, transparent)`
          }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: `linear-gradient(135deg, ${config.accent}, ${config.accent}cc)`,
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: `0 4px 12px ${config.glow}`
        }}
      />
    </>
  )
})
```

---

## 第 6 步：注册节点组件

**文件**: `apps/web/src/features/comfy/components/canvas.tsx`

```typescript
import { RiskAlertNode } from './nodes/risk-alert-node'  // ✨ 新增导入

const nodeTypes = {
  resource: ResourceNode,
  agent: AgentNode,
  result: ResultNode,
  'agent-avatar': AgentAvatarNode,
  'cc-bmc-card': CCBMCCardNode,
  // ... 其他节点类型 ...
  'risk-alert': RiskAlertNode  // ✨ 新增注册
}
```

---

## 第 7 步：测试

### 7.1 后端测试

在 Postman 或 GraphQL IDE 中测试：

```graphql
mutation TestRisk {
  startConversation(
    workspaceId: "test-workspace"
    question: "分析新能源汽车初创公司的风险因素"
  ) {
    metadata { id }
    graph {
      nodes {
        id
        type
        data
      }
    }
  }
}
```

预期响应：应该包含 `risk-alert` 类型的节点

### 7.2 前端测试

1. 启动开发服务器
2. 在画布中输入种子问题
3. 检查是否有新的风险节点出现
4. 验证颜色编码（critical=红, high=橙, etc.)
5. 点击节点确认缓解策略显示正确

---

## 第 8 步：优化（可选）

### 缓存 Risk 分析

如果相同的商业背景频繁被分析，可以缓存结果：

```typescript
private riskAnalysisCache = new Map<string, MacraNodeData[]>()

private async runRiskAgent(state: BusinessStateType) {
  const cacheKey = state.question
  if (this.riskAnalysisCache.has(cacheKey)) {
    return { risks: this.riskAnalysisCache.get(cacheKey)! }
  }
  // ... 执行分析 ...
  this.riskAnalysisCache.set(cacheKey, validatedNodes)
  return { risks: validatedNodes }
}
```

### 并行优化

确保 Risk Agent 与其他 Agent 一起并行运行（已在第 4.1 步配置）

---

## 完整检查清单

- [ ] 在 `macra.ts` 中添加 `RISK: 'Risk_Agent'`
- [ ] 定义 `'risk-alert'` 节点类型
- [ ] 在 `BusinessState` 中添加 `risks` 字段
- [ ] 实现 `runRiskAgent()` 方法
- [ ] 在 `createGraph()` 中添加节点和边
- [ ] 在 `streamConversation()` 中处理输出
- [ ] 创建 `risk-alert-node.tsx` 组件
- [ ] 在 `canvas.tsx` 中注册节点组件
- [ ] 后端编译通过
- [ ] 前端编译通过
- [ ] 手动测试

---

## 总结

通过这个例子，你现在知道如何：

✅ 定义新 Agent 类型
✅ 在 LangGraph 中添加节点
✅ 编写 LLM Prompt 产生结构化输出
✅ 在前端创建自定义节点组件
✅ 集成到完整的工作流中

相同的模式可以应用于：
- **Sustainability_Agent** - 环保评估
- **Scalability_Agent** - 可扩展性分析
- **Partnership_Agent** - 合作伙伴推荐
- **Trend_Agent** - 行业趋势预测

等等！

