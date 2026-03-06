'use client'

import { ComfyCanvas } from '@/features/comfy/components/canvas'

export default function ComfyStandalonePage() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <ComfyCanvas workspaceId="comfy-standalone" />
    </div>
  )
}
