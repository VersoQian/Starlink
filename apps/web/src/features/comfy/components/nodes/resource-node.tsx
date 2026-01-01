'use client'

import { useCallback, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { useComfyStore } from '../../store'
import { FileIcon, ImageIcon, Upload } from 'lucide-react'

export function ResourceNode({ id, data }: NodeProps) {
  const { updateNodeData, getNodeData } = useComfyStore()
  const nodeData = getNodeData(id)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')

    updateNodeData(id, {
      resourceContent: file,
      resourceType: isImage ? 'image' : 'document',
      resourceName: file.name,
      status: 'done'
    })
  }, [id, updateNodeData])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')

    updateNodeData(id, {
      resourceContent: file,
      resourceType: isImage ? 'image' : 'document',
      resourceName: file.name,
      status: 'done'
    })
  }, [id, updateNodeData])

  return (
    <>
      <Card className="w-80 bg-comfy-node border-comfy-nodeBorder shadow-lg comfy-node">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-zinc-100">
            <FileIcon className="w-4 h-4 text-blue-400" />
            Resource Node
            {nodeData?.status === 'done' && (
              <Badge variant="success" className="ml-auto">Ready</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!nodeData?.resourceContent ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                transition-colors
                ${isDragging
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-zinc-600 bg-zinc-800/50 hover:border-zinc-500'
                }
              `}
            >
              <input
                type="file"
                id={`file-input-${id}`}
                className="hidden"
                onChange={handleFileInput}
                accept="image/*,.pdf,.txt,.md,.doc,.docx"
              />
              <label htmlFor={`file-input-${id}`} className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-zinc-400" />
                <p className="text-sm text-zinc-400">拖放文件或点击上传</p>
                <p className="text-xs text-zinc-500 mt-1">支持图片和文档</p>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              {nodeData.resourceType === 'image' && nodeData.resourceContent instanceof File ? (
                <div className="rounded-lg overflow-hidden border border-zinc-700">
                  <img
                    src={URL.createObjectURL(nodeData.resourceContent)}
                    alt="Preview"
                    className="w-full h-32 object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg border border-zinc-700">
                  <FileIcon className="w-6 h-6 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-100 truncate">{nodeData.resourceName}</p>
                    <p className="text-xs text-zinc-500">
                      {nodeData.resourceContent instanceof File
                        ? `${(nodeData.resourceContent.size / 1024).toFixed(1)} KB`
                        : 'File'
                      }
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={() => updateNodeData(id, { resourceContent: undefined, status: 'idle' })}
                className="w-full text-xs text-zinc-400 hover:text-zinc-300 py-1"
              >
                清除
              </button>
            </div>
          )}
        </CardContent>
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-green-500 border-2 border-zinc-900"
        />
      </Card>
    </>
  )
}
