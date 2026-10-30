import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import { ANOMALY_ROLES } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiGuard(ANOMALY_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const { id } = await params
    const body = await req.json()
    const { status, note } = body

    if (!['acknowledged', 'investigating', 'resolved', 'active'].includes(status)) {
      return noStoreJson({ error: 'Invalid status' }, { status: 400 })
    }

    return noStoreJson({
      ok: true,
      id,
      status,
      updatedBy: auth.user.fullName,
      updatedAt: new Date().toISOString(),
      note: note || undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('PATCH /api/anomalies/[id] error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}

