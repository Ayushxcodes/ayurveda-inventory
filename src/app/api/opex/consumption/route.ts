import prisma from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function fetchConsumptionData() {
  const sql = `
    WITH top_items AS (
      SELECT i.item_id, i.item_name, i.unit
      FROM items i
      LEFT JOIN stock_issues si ON si.item_id = i.item_id AND si.issue_date >= date_trunc('month', current_date) - interval '5 months'
      WHERE i.category = 'OPEX'
      GROUP BY i.item_id, i.item_name, i.unit
      ORDER BY COALESCE(SUM(si.quantity_issued), 0) DESC NULLS LAST
      LIMIT 6
    ),
    months AS (
      SELECT generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') AS m
    ),
    item_months AS (
      SELECT ti.item_id, m.m
      FROM top_items ti
      CROSS JOIN months m
    ),
    monthly_issued AS (
      SELECT si.item_id, date_trunc('month', si.issue_date) AS m, SUM(si.quantity_issued) AS sum_qty
      FROM stock_issues si
      WHERE si.item_id IN (SELECT item_id FROM top_items)
        AND si.issue_date >= date_trunc('month', current_date) - interval '5 months'
      GROUP BY si.item_id, date_trunc('month', si.issue_date)
    )
    SELECT
      ti.item_id,
      ti.item_name,
      ti.unit,
      (
        SELECT json_agg(COALESCE(mi.sum_qty, 0) ORDER BY im.m)
        FROM item_months im
        LEFT JOIN monthly_issued mi ON mi.item_id = im.item_id AND mi.m = im.m
        WHERE im.item_id = ti.item_id
      ) AS data
    FROM top_items ti;
  `

type ConsumptionRawRow = {
  item_id: number
  item_name: string
  unit?: string | null
  data?: (number | string)[] | null
}

  const raw = await prisma.$queryRawUnsafe<ConsumptionRawRow[]>(sql)

  const palette = ['#185FA5', '#1A6B3C', '#92400E', '#78600A', '#3d5a6c', '#B91C1C']
  return raw.map((r, idx) => ({
    id: r.item_id,
    name: r.item_name,
    unit: r.unit || '',
    color: palette[idx % palette.length],
    data: Array.isArray(r.data) ? r.data.map((n) => Number(n || 0)) : [],
    note: null,
  }))
}

export async function GET() {
  try {
    const items = await getOrSetCache(
      'api:opex:consumption',
      () => fetchConsumptionData(),
      30,
      ['opex', 'consumption']
    )

    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/opex/consumption error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
