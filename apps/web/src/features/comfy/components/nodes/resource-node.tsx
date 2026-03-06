'use client'

import Image from 'next/image'
import { useCallback, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { useComfyStore } from '../../store'
import { FileIcon, Upload } from 'lucide-react'

export function ResourceNode({ id }: NodeProps) {
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
      <Card className="w-80 bg-white border-2 border-purple-100 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-br from-purple-50 to-white border-b border-purple-100">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-800 font-bold">
            <FileIcon className="w-4 h-4 text-purple-500" />
            资源节点
            {nodeData?.status === 'done' && (
              <Badge variant="success" className="ml-auto bg-green-100 text-green-700 border-green-200">已就绪</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {!nodeData?.resourceContent ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                transition-all duration-200
                ${isDragging
                  ? 'border-purple-500 bg-purple-50 shadow-lg scale-105'
                  : 'border-purple-200 bg-purple-50/30 hover:border-purple-400 hover:bg-purple-50'
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
                <Upload className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                <p className="text-sm text-slate-700 font-medium">拖放文件或点击上传</p>
                <p className="text-xs text-slate-500 mt-1">支持图片和文档</p>
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              {nodeData.resourceType === 'image' && nodeData.resourceContent instanceof File ? (
                <div className="rounded-xl overflow-hidden border-2 border-purple-100 shadow-md">
                  <Image
                    src={URL.createObjectURL(nodeData.resourceContent)}
                    alt="Preview"
                    width={640}
                    height={256}
                    className="w-full h-32 object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border-2 border-purple-100 shadow-sm">
                  <FileIcon className="w-6 h-6 text-purple-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 font-medium truncate">{nodeData.resourceName}</p>
                    <p className="text-xs text-slate-500">
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
                className="w-full text-xs text-slate-500 hover:text-purple-600 py-1.5 rounded-lg hover:bg-purple-50 transition-all font-medium"
              >
                清除
              </button>
            </div>
          )}
        </CardContent>
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-purple-500 border-2 border-white shadow-md"
        />
      </Card>
    </>
  )
}
