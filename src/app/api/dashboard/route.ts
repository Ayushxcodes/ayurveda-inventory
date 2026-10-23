import prisma from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function fetchDashboardData() {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  const in60 = new Date()
  in60.setDate(in60.getDate() + 60)

  // Single unified mega-query: runs all counts, recent GRNs, expiring batches,
  // low stock items, and upcoming AMC contracts in ONE database round-trip!
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      (SELECT COUNT(*)::int FROM items WHERE is_active = true) AS "totalItems",
      (SELECT COUNT(*)::int FROM items WHERE is_active = true AND category = 'CAPEX') AS "capexCount",
      (SELECT COUNT(*)::int FROM items WHERE is_active = true AND category = 'OPEX') AS "opexCount",
      (SELECT COUNT(*)::int FROM alerts WHERE status = 'active') AS "activeAlerts",
      (SELECT COUNT(*)::int FROM grn_entries WHERE grn_date >= ${firstDayOfMonth}) AS "grnThisMonth",
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
          WHERE i.is_active = true
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
          ORDER BY a.contract_end ASC
          LIMIT 6
        ) ad
      ) AS "amcDue"
  `

  const r = rows[0] || {}

  return {
    totalItems: Number(r.totalItems ?? 0),
    capexCount: Number(r.capexCount ?? 0),
    opexCount: Number(r.opexCount ?? 0),
    activeAlerts: Number(r.activeAlerts ?? 0),
    grnThisMonth: Number(r.grnThisMonth ?? 0),
    recentGrns: Array.isArray(r.recentGrns) ? r.recentGrns : [],
    expiring: Array.isArray(r.expiring) ? r.expiring : [],
    lowStock: Array.isArray(r.lowStock) ? r.lowStock : [],
    amcDue: Array.isArray(r.amcDue) ? r.amcDue : [],
  }
}

export async function GET() {
  try {
    const data = await getOrSetCache(
      'api:dashboard',
      () => fetchDashboardData(),
      20, // 20s TTL
      ['dashboard']
    )

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=59',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/dashboard error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
