import { CanvasPage } from '@/features/comfy/components/comfy-canvas-page'

type PageProps = {
  params: { workspaceId: string }
}

export default function WorkspaceCanvasRoute({ params }: PageProps) {
  return <CanvasPage workspaceId={params.workspaceId} />
}
