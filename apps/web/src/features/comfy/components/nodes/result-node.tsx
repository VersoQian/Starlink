'use client'

import { useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card'
import { useComfyStore } from '../../store'
import { FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export function ResultNode({ id }: NodeProps) {
  const { edges, nodeDataMap } = useComfyStore()
  const [result, setResult] = useState<string>('')

  useEffect(() => {
    // 查找连接到此节点的Agent节点
    const inputEdge = edges.find(e => e.target === id)
    if (inputEdge) {
      const sourceData = nodeDataMap.get(inputEdge.source)
      if (sourceData?.agentResult) {
        setResult(sourceData.agentResult)
      }
    }
  }, [edges, id, nodeDataMap])

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-zinc-900"
      />
      <Card className="w-96 bg-comfy-node border-comfy-nodeBorder shadow-lg comfy-node">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-zinc-100">
            <FileText className="w-4 h-4 text-green-400" />
            Result Node
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-sm bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 max-h-96 overflow-y-auto text-zinc-300">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => {
                      void node
                      return <h1 className="text-lg font-bold mb-2 text-zinc-100" {...props} />
                    },
                    h2: ({ node, ...props }) => {
                      void node
                      return <h2 className="text-base font-bold mb-2 text-zinc-100" {...props} />
                    },
                    h3: ({ node, ...props }) => {
                      void node
                      return <h3 className="text-sm font-bold mb-1 text-zinc-100" {...props} />
                    },
                    p: ({ node, ...props }) => {
                      void node
                      return <p className="mb-2 text-zinc-300" {...props} />
                    },
                    ul: ({ node, ...props }) => {
                      void node
                      return <ul className="list-disc list-inside mb-2 text-zinc-300" {...props} />
                    },
                    ol: ({ node, ...props }) => {
                      void node
                      return <ol className="list-decimal list-inside mb-2 text-zinc-300" {...props} />
                    },
                    strong: ({ node, ...props }) => {
                      void node
                      return <strong className="font-semibold text-zinc-100" {...props} />
                    },
                    code: ({ node, ...props }) => {
                      void node
                      return <code className="bg-zinc-900 px-1 py-0.5 rounded text-green-400" {...props} />
                    }
                  }}
                >
                  {result}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">等待上游Agent处理...</p>
              <p className="text-xs mt-1">连接一个Agent节点以查看结果</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
