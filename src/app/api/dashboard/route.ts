import prisma from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { apiGuard, noStoreJson, resolveDepartmentScope } from '@/lib/auth/guards'
import { ROLES, type Role } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function fetchDashboardData(role: Role, deptId: number | null) {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  const in60 = new Date()
  in60.setDate(in60.getDate() + 60)

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      (SELECT COUNT(*)::int FROM items WHERE is_active = true AND (${deptId}::int IS NULL OR primary_dept_id = ${deptId}::int)) AS "totalItems",
      (SELECT COUNT(*)::int FROM items WHERE is_active = true AND category = 'CAPEX' AND (${deptId}::int IS NULL OR primary_dept_id = ${deptId}::int)) AS "capexCount",
      (SELECT COUNT(*)::int FROM items WHERE is_active = true AND category = 'OPEX' AND (${deptId}::int IS NULL OR primary_dept_id = ${deptId}::int)) AS "opexCount",
      (SELECT COUNT(*)::int FROM alerts a JOIN items i ON i.item_id = a.item_id WHERE a.status = 'active' AND (${deptId}::int IS NULL OR COALESCE(a.dept_id, i.primary_dept_id) = ${deptId}::int)) AS "activeAlerts",
      (SELECT COUNT(*)::int FROM grn_entries g JOIN items i ON i.item_id = g.item_id WHERE g.grn_date >= ${firstDayOfMonth} AND (${deptId}::int IS NULL OR i.primary_dept_id = ${deptId}::int)) AS "grnThisMonth",
      (
        SELECT COALESCE(json_agg(rg), '[]'::json) FROM (
          SELECT
            g.grn_id AS "grnId",
            g.grn_number AS "grnNumber",
            to_char(g.grn_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "grnDate",
            g.batch_number AS "batchNumber",
            g.quantity_received::text AS "quantityReceived",
            json_build_object('itemId', i.item_id, 'itemName', i.item_name) AS item
          FROM grn_entries g
          LEFT JOIN items i ON i.item_id = g.item_id
          WHERE (${deptId}::int IS NULL OR i.primary_dept_id = ${deptId}::int)
          ORDER BY g.grn_date DESC
          LIMIT 5
        ) rg
      ) AS "recentGrns",
      (
        SELECT COALESCE(json_agg(exp), '[]'::json) FROM (
          SELECT
            b.batch_id AS "batchId",
            b.batch_number AS "batchNumber",
            to_char(b.expiry_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "expiryDate",
            b.quantity_available::text AS "quantityAvailable",
            json_build_object('itemId', i.item_id, 'itemName', i.item_name) AS item
          FROM item_batches b
          JOIN items i ON i.item_id = b.item_id
          WHERE b.expiry_date >= CURRENT_DATE AND b.expiry_date <= ${in30} AND b.quantity_available > 0
            AND (${deptId}::int IS NULL OR i.primary_dept_id = ${deptId}::int)
          ORDER BY b.expiry_date ASC
          LIMIT 6
        ) exp
      ) AS "expiring",
      (
        SELECT COALESCE(json_agg(ls), '[]'::json) FROM (
          SELECT
            i.item_id AS "itemId",
            i.item_name AS "itemName",
            COALESCE(SUM(b.quantity_available), 0)::int AS "totalAvailable"
          FROM items i
          LEFT JOIN item_batches b ON b.item_id = i.item_id
          WHERE i.is_active = true AND (${deptId}::int IS NULL OR i.primary_dept_id = ${deptId}::int)
          GROUP BY i.item_id, i.item_name, i.min_stock_level
          HAVING i.min_stock_level > COALESCE(SUM(b.quantity_available), 0)
          ORDER BY i.item_id
          LIMIT 6
        ) ls
      ) AS "lowStock",
      (
        SELECT COALESCE(json_agg(ad), '[]'::json) FROM (
          SELECT
            a.amc_id AS "amcId",
            a.amc_number AS "amcNumber",
            to_char(a.contract_end, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "contractEnd",
            json_build_object('itemId', i.item_id, 'itemName', i.item_name) AS item
          FROM amc_contracts a
          JOIN items i ON i.item_id = a.item_id
          WHERE a.contract_end >= CURRENT_DATE AND a.contract_end <= ${in60} AND a.status = 'active'
            AND (${deptId}::int IS NULL OR i.primary_dept_id = ${deptId}::int)
          ORDER BY a.contract_end ASC
          LIMIT 6
        ) ad
      ) AS "amcDue"
  `

  const r = rows[0] || {}

  const counts = {
    totalItems: Number(r.totalItems ?? 0),
    capexCount: Number(r.capexCount ?? 0),
    opexCount: Number(r.opexCount ?? 0),
    activeAlerts: Number(r.activeAlerts ?? 0),
    grnThisMonth: Number(r.grnThisMonth ?? 0),
  }

  if (role === 'requester') {
    return counts
  }

  return {
    ...counts,
    recentGrns: Array.isArray(r.recentGrns) ? r.recentGrns : [],
    expiring: Array.isArray(r.expiring) ? r.expiring : [],
    lowStock: Array.isArray(r.lowStock) ? r.lowStock : [],
    amcDue: Array.isArray(r.amcDue) ? r.amcDue : [],
  }
}

export async function GET() {
  const auth = await apiGuard(ROLES)
  if (auth.response) return auth.response

  const scope = resolveDepartmentScope(auth.user)
  if (!scope) {
    return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
  }

  const cacheScope = auth.user.role === 'requester' ? 'requester' : scope.cacheScope

  try {
    const data = await getOrSetCache(
      `api:dashboard:${cacheScope}`,
      () => fetchDashboardData(auth.user.role, scope.deptId),
      20,
      ['dashboard']
    )

    return noStoreJson(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/dashboard error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
