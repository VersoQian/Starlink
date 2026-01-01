'use client'

import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { AlertTriangle, Zap } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export function ConflictAlertNode({ id, data }: NodeProps) {
  const { getMacraNode } = useComfyStore()
  const nodeData = getMacraNode(id) || (data as MacraNodeData)

  const severity = nodeData?.severity || 'medium'

  // 根据严重程度设置颜色
  const severityConfig = {
    high: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-700',
      icon: 'text-red-500',
      badge: 'bg-red-500 text-white',
      glow: 'shadow-red-500/50'
    },
    medium: {
      bg: 'bg-orange-50',
      border: 'border-orange-400',
      text: 'text-orange-700',
      icon: 'text-orange-500',
      badge: 'bg-orange-500 text-white',
      glow: 'shadow-orange-500/50'
    },
    low: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-400',
      text: 'text-yellow-700',
      icon: 'text-yellow-500',
      badge: 'bg-yellow-500 text-white',
      glow: 'shadow-yellow-500/50'
    }
  }

  const config = severityConfig[severity]

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className={`w-3 h-3 bg-red-500 border-2 border-white animate-pulse`}
      />

      <Card
        className={`
          w-80 border-2 ${config.border} ${config.bg}
          shadow-xl ${config.glow}
          animate-shake
          transition-all
        `}
        style={{
          animation: 'shake 0.5s ease-in-out infinite'
        }}
      >
        <CardContent className="p-4 space-y-3">
          {/* 标题栏 */}
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${config.bg} border ${config.border}`}>
              {severity === 'high' ? (
                <Zap className={`w-5 h-5 ${config.icon} animate-pulse`} />
              ) : (
                <AlertTriangle className={`w-5 h-5 ${config.icon}`} />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold text-sm ${config.text}`}>
                  {nodeData?.label || '冲突警告'}
                </h3>
                <Badge className={`text-xs ${config.badge}`}>
                  {severity === 'high' ? '高风险' : severity === 'medium' ? '中风险' : '低风险'}
                </Badge>
              </div>

              {nodeData?.conflictType && (
                <p className="text-xs text-gray-500 mt-0.5">
                  类型: {
                    nodeData.conflictType === 'resource-goal' ? '资源-目标冲突' :
                    nodeData.conflictType === 'compliance-business' ? '合规-业务冲突' :
                    nodeData.conflictType === 'channel-product' ? '渠道-产品冲突' :
                    '其他冲突'
                  }
                </p>
              )}
            </div>
          </div>

          {/* 内容区域 */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{nodeData?.content || '*未提供详细信息*'}</ReactMarkdown>
            </div>
          </div>

          {/* 元数据 */}
          {nodeData?.metadata?.agent_signature && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>检测者:</span>
              <Badge variant="outline" className="text-xs">
                {nodeData.metadata.agent_signature}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-red-500 border-2 border-white animate-pulse"
      />

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>
    </>
  )
}
