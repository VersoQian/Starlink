import { ComfyCanvas } from '@/features/comfy/components/canvas'

type ComfyPageProps = {
  params: { workspaceId: string }
}

export default function ComfyPage({ params }: ComfyPageProps) {
  return <ComfyCanvas workspaceId={params.workspaceId} />
}
