import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import { DEMAND_CREATE_ROLES } from '@/lib/auth/roles'
import { detectDemandAnomalies, redactAnomalyRequesters } from '@/lib/demand'

export const dynamic = 'force-dynamic'

const MAX_CHECK_LINES = 20

export async function POST(req: Request) {
  const auth = await apiGuard(DEMAND_CREATE_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return noStoreJson({ error: 'Invalid payload' }, { status: 400 })
    }

    let deptId: number
    if (auth.user.role === 'admin' || auth.user.role === 'super_admin') {
      deptId = Number(body.deptId)
    } else if (auth.user.deptId) {
      // HODs and assigned requesters may only inspect their own department.
      deptId = auth.user.deptId
    } else if (auth.user.role === 'hod') {
      return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
    } else {
      deptId = Number(body.deptId)
    }

    if (!Number.isInteger(deptId) || deptId <= 0) {
      return noStoreJson({ error: 'Invalid department' }, { status: 400 })
    }

    const rawItems = Array.isArray(body.items) ? body.items : []
    const validLines: Array<{ itemId: number; quantity: number }> = []
    const seen = new Set<number>()

    for (const raw of rawItems) {
      if (typeof raw !== 'object' || raw === null) continue
      const line = raw as Record<string, unknown>
      const itemId = Number(line.itemId)
      const quantity = Number(line.quantity)
      if (!Number.isInteger(itemId) || itemId <= 0 || seen.has(itemId)) continue
      if (!Number.isFinite(quantity) || quantity <= 0) continue
      seen.add(itemId)
      validLines.push({ itemId, quantity })
      if (validLines.length >= MAX_CHECK_LINES) break
    }

    if (validLines.length === 0) {
      return noStoreJson({ hasAnomalies: false, anomalies: [] })
    }

    const anomalies = await detectDemandAnomalies(deptId, validLines)

    return noStoreJson({
      hasAnomalies: anomalies.length > 0,
      anomalies:
        auth.user.role === 'requester' ? redactAnomalyRequesters(anomalies) : anomalies,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/demands/check-anomalies error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}
