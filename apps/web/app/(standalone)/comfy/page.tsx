'use client'

import { ComfyCanvas } from '@/features/comfy'

export default function ComfyStandalonePage() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <ComfyCanvas />
    </div>
  )
}
