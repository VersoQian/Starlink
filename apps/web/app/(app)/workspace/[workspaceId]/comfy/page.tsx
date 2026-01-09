import { ComfyCanvas } from '@/features/comfy'

type ComfyPageProps = {
  params: { workspaceId: string }
}

export default function ComfyPage({ params }: ComfyPageProps) {
  return <ComfyCanvas workspaceId={params.workspaceId} />
}
