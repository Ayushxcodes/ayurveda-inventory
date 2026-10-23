import { prisma, withDbRetry } from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type CapexRawRow = {
  id: string
  name: string
  sub?: string | null
  subcat?: string | null
  created_at?: string | null
  stock?: number | string | null
  expiry?: string | null
  batch?: string | null
  amc?: string | null
  amc_expiry?: string | null
  supplier?: string | null
  dept?: string | null
}

async function fetchCapexData() {
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
      i.sub_category AS subcat,
      i.created_at::date AS created_at,
      COALESCE(b.qty_sum, 0) AS stock,
      to_char(b.earliest_expiry, 'YYYY-MM-DD') AS expiry,
      b.batch_number AS batch,
      a.amc_number AS amc,
      to_char(a.contract_end, 'YYYY-MM-DD') AS amc_expiry,
      s.supplier_name AS supplier,
      COALESCE(d.dept_code, d.dept_name) AS dept
    FROM items i
    LEFT JOIN suppliers s ON s.supplier_id = i.default_supplier_id
    LEFT JOIN departments d ON d.dept_id = i.primary_dept_id
    LEFT JOIN batch_summary b ON b.item_id = i.item_id
    LEFT JOIN amc_summary a ON a.item_id = i.item_id
    WHERE i.is_active = true AND i.category = 'CAPEX'
    ORDER BY i.item_name ASC;
  `

  const raw = await withDbRetry(() => prisma.$queryRawUnsafe<CapexRawRow[]>(sql))

  return raw.map((it) => ({
    id: it.id,
    name: it.name,
    sub: it.sub || '',
    subcat: it.subcat,
    createdAt: it.created_at || null,
    stock: Number(it.stock || 0),
    expiry: it.expiry || null,
    batch: it.batch || null,
    amc: it.amc || null,
    amcExpiry: it.amc_expiry || null,
    supplier: it.supplier || null,
    dept: it.dept || null,
  }))
}

export async function GET() {
  try {
    const items = await getOrSetCache(
      'api:capex',
      () => fetchCapexData(),
      30, // 30s TTL
      ['capex', 'items']
    )

    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/capex error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
