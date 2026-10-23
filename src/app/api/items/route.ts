import prisma from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type ItemRawRow = {
  id: string
  name: string
  sub?: string | null
  category: string
  subcat?: string | null
  unit?: string | null
  dept?: string | null
  stock?: number | string | null
  min_stock_level?: string | null
  expiry?: string | null
  batch?: string | null
}

async function queryItems(q: string) {
  const pattern = `%${q}%`

  const sqlWithQ = `
    WITH batch_summary AS (
      SELECT
        item_id,
        SUM(quantity_available)::numeric AS qty_sum,
        MIN(expiry_date) AS earliest_expiry,
        (ARRAY_AGG(batch_number ORDER BY expiry_date ASC NULLS LAST))[1] AS batch_number
      FROM item_batches
      GROUP BY item_id
    )
    SELECT
      i.item_code AS id,
      i.item_name AS name,
      i.item_type AS sub,
      i.category,
      i.sub_category AS subcat,
      i.unit,
      COALESCE(d.dept_code, d.dept_name) AS dept,
      COALESCE(b.qty_sum, 0) AS stock,
      i.min_stock_level::text AS min_stock_level,
      to_char(b.earliest_expiry, 'YYYY-MM-DD') AS expiry,
      b.batch_number AS batch
    FROM items i
    LEFT JOIN departments d ON d.dept_id = i.primary_dept_id
    LEFT JOIN batch_summary b ON b.item_id = i.item_id
    WHERE i.is_active = true
      AND (i.item_name ILIKE $1 OR i.item_code ILIKE $1 OR COALESCE(d.dept_code,'') ILIKE $1)
    ORDER BY i.item_name ASC
    LIMIT 100;
  `

  const sqlNoQ = `
    WITH batch_summary AS (
      SELECT
        item_id,
        SUM(quantity_available)::numeric AS qty_sum,
        MIN(expiry_date) AS earliest_expiry,
        (ARRAY_AGG(batch_number ORDER BY expiry_date ASC NULLS LAST))[1] AS batch_number
      FROM item_batches
      GROUP BY item_id
    )
    SELECT
      i.item_code AS id,
      i.item_name AS name,
      i.item_type AS sub,
      i.category,
      i.sub_category AS subcat,
      i.unit,
      COALESCE(d.dept_code, d.dept_name) AS dept,
      COALESCE(b.qty_sum, 0) AS stock,
      i.min_stock_level::text AS min_stock_level,
      to_char(b.earliest_expiry, 'YYYY-MM-DD') AS expiry,
      b.batch_number AS batch
    FROM items i
    LEFT JOIN departments d ON d.dept_id = i.primary_dept_id
    LEFT JOIN batch_summary b ON b.item_id = i.item_id
    WHERE i.is_active = true
    ORDER BY i.item_name ASC
    LIMIT 100;
  `

  const raw = q
    ? await prisma.$queryRawUnsafe<ItemRawRow[]>(sqlWithQ, pattern)
    : await prisma.$queryRawUnsafe<ItemRawRow[]>(sqlNoQ)

  return raw.map((it) => ({
    id: it.id,
    name: it.name,
    sub: it.sub || '',
    category: it.category,
    subcat: it.subcat,
    unit: it.unit || '',
    dept: it.dept || '',
    currentStock: Number(it.stock || 0),
    minStock: Number(it.min_stock_level || 0),
    batches: it.batch
      ? [{ batchNo: it.batch, qty: Number(it.stock || 0), expiry: it.expiry || null }]
      : [],
  }))
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim()

    const items = await getOrSetCache(
      `api:items:${q}`,
      () => queryItems(q),
      20,
      ['items']
    )

    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=59',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/items error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
