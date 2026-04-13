import { CanvasPage } from '@/features/comfy/components/comfy-canvas-page'

type ComfyPageProps = {
  params: { workspaceId: string }
}

export default function ComfyPage({ params }: ComfyPageProps) {
  return <CanvasPage workspaceId={params.workspaceId} />
}
