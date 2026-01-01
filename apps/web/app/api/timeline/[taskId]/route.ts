import { NextResponse } from 'next/server'

const backendBaseUrl = process.env.BACKEND_API_BASE_URL ?? 'http://localhost:4000'

export async function GET(request: Request, { params }: { params: { taskId: string } }) {
  const url = new URL(request.url)
  const tenantId = url.searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ message: 'tenantId required' }, { status: 400 })
  }

  const endpoint = `${backendBaseUrl}/ai/tasks/${encodeURIComponent(params.taskId)}/iterations?tenantId=${encodeURIComponent(tenantId)}`

  try {
    const response = await fetch(endpoint)
    if (!response.ok) {
      const message = await response.text()
      console.warn('Backend timeline failed:', message)
      return NextResponse.json({ iterations: [] })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.warn('Backend timeline unreachable:', error)
    return NextResponse.json({ iterations: [] })
  }
}
