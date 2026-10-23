import { prisma, withDbRetry } from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type OpexRawRow = {
  id: string
  name: string
  sub?: string | null
  category: string
  subcat?: string | null
  unit?: string | null
  min_stock_level?: string | null
  max_stock_level?: string | null
  dept?: string | null
  supplier?: string | null
  stock?: number | string | null
  expiry?: string | null
  batch?: string | null
  amc?: string | null
  amc_expiry?: string | null
  price?: string | null
  created_at?: string | null
}

async function fetchOpexData() {
  const sql = `
    WITH batch_summary AS (
      SELECT
        item_id,
        SUM(quantity_available)::numeric AS qty_sum,
        MIN(expiry_date) AS earliest_expiry,
        (ARRAY_AGG(batch_number ORDER BY expiry_date ASC NULLS LAST))[1] AS batch_number
      FROM item_batches
      GROUP BY item_id
    ),
    amc_summary AS (
      SELECT DISTINCT ON (item_id)
        item_id,
        amc_number,
        contract_end
      FROM amc_contracts
      ORDER BY item_id, contract_end DESC
    )
    SELECT
      i.item_code AS id,
      i.item_name AS name,
      i.item_type AS sub,
      i.category,
      i.sub_category AS subcat,
      i.unit,
      i.min_stock_level::text AS min_stock_level,
      i.max_stock_level::text AS max_stock_level,
      COALESCE(d.dept_code, d.dept_name) AS dept,
      s.supplier_name AS supplier,
      COALESCE(b.qty_sum, 0) AS stock,
      to_char(b.earliest_expiry, 'YYYY-MM-DD') AS expiry,
      b.batch_number AS batch,
      a.amc_number AS amc,
      to_char(a.contract_end, 'YYYY-MM-DD') AS amc_expiry,
      i.price_per_unit::text AS price,
      i.created_at::date::text AS created_at
    FROM items i
    LEFT JOIN departments d ON d.dept_id = i.primary_dept_id
    LEFT JOIN suppliers s ON s.supplier_id = i.default_supplier_id
    LEFT JOIN batch_summary b ON b.item_id = i.item_id
    LEFT JOIN amc_summary a ON a.item_id = i.item_id
    WHERE i.is_active = true AND i.category = 'OPEX'
    ORDER BY i.item_name ASC;
  `

  const raw = await withDbRetry(() => prisma.$queryRawUnsafe<OpexRawRow[]>(sql))

  return raw.map((it) => ({
    id: it.id,
    name: it.name,
    sub: it.sub || '',
    category: it.category,
    subcat: it.subcat,
    stock: Number(it.stock || 0),
    min: Number(it.min_stock_level || 0),
    max: Number(it.max_stock_level || 0),
    unit: it.unit || '',
    expiry: it.expiry || null,
    dept: it.dept || '',
    batch: it.batch || null,
    supplier: it.supplier || null,
    price: Number(it.price || 0),
    amc: it.amc || null,
    amcExpiry: it.amc_expiry || null,
    createdAt: it.created_at || null,
  }))
}

export async function GET() {
  try {
    const items = await getOrSetCache(
      'api:opex',
      () => fetchOpexData(),
      30, // 30s TTL
      ['opex', 'items']
    )

    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/opex error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
