import prisma from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { apiGuard, noStoreJson, resolveDepartmentScope } from '@/lib/auth/guards'
import { REPORT_ROLES } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type WastageRowItem = {
  name: string
  qty: number | string
  value: number | string
}

type WastageQueryResult = {
  total_qty?: number | string | null
  total_value?: number | string | null
  rows?: WastageRowItem[] | null
}

async function fetchWastageData(deptId: number | null) {
  const res = await prisma.$queryRaw<WastageQueryResult[]>`
    SELECT
      COALESCE((
        SELECT SUM(d.quantity_disposed)::numeric
        FROM disposal_log d
        JOIN items i ON i.item_id = d.item_id
        WHERE date_trunc('month', d.disposal_date) = date_trunc('month', current_date)
          AND (${deptId}::int IS NULL OR i.primary_dept_id = ${deptId}::int)
      ), 0) AS total_qty,
      COALESCE((
        SELECT SUM(COALESCE(d.value_written_off, 0))::numeric
        FROM disposal_log d
        JOIN items i ON i.item_id = d.item_id
        WHERE date_trunc('month', d.disposal_date) = date_trunc('month', current_date)
          AND (${deptId}::int IS NULL OR i.primary_dept_id = ${deptId}::int)
      ), 0) AS total_value,
      (
        SELECT COALESCE(json_agg(r), '[]'::json) FROM (
          SELECT i.item_name AS name, SUM(d.quantity_disposed)::numeric AS qty, SUM(COALESCE(d.value_written_off, 0))::numeric AS value
          FROM disposal_log d
          JOIN items i ON i.item_id = d.item_id
          WHERE date_trunc('month', d.disposal_date) = date_trunc('month', current_date)
            AND (${deptId}::int IS NULL OR i.primary_dept_id = ${deptId}::int)
          GROUP BY i.item_name
          ORDER BY qty DESC
          LIMIT 6
        ) r
      ) AS rows;
  `

  const first = res[0] || {}
  const totalQty = Number(first.total_qty || 0)
  const totalValue = Number(first.total_value || 0)
  const rawRows: WastageRowItem[] = Array.isArray(first.rows) ? first.rows : []

  const rows = rawRows.map((r) => {
    const qty = Number(r.qty || 0)
    const val = Number(r.value || 0)
    const pct = totalQty ? Math.round((qty / totalQty) * 100) : 0
    return [r.name, `${qty} ${qty > 1 ? 'units' : 'unit'}`, `₹${Math.round(val)}`, pct]
  })

  return { totalQty, totalValue, rows }
}

export async function GET() {
  const auth = await apiGuard(REPORT_ROLES)
  if (auth.response) return auth.response

  const scope = resolveDepartmentScope(auth.user)
  if (!scope) {
    return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
  }

  try {
    const data = await getOrSetCache(
      `api:opex:wastage:${scope.cacheScope}`,
      () => fetchWastageData(scope.deptId),
      30,
      ['opex', 'wastage']
    )

    return noStoreJson(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/opex/wastage error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
