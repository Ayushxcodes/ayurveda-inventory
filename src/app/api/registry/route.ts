import { prisma, withDbRetry } from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { apiGuard, noStoreJson } from '@/lib/auth/guards'
import { CATALOG_ROLES } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RegistryRawBatch = {
  batch?: string | null
  stock?: number | string | null
  expiry?: string | null
  supplier?: string | null
  price?: number | string | null
  location?: string | null
}

type RegistryRawRow = {
  iid: number
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
  amc?: string | null
  amc_expiry?: string | null
  price?: string | null
  stock?: number | string | null
  expiry?: string | null
  batch?: string | null
  batches?: RegistryRawBatch[] | null
}

async function fetchRegistryData() {
  const sql = `
    WITH amc_summary AS (
      SELECT DISTINCT ON (item_id)
        item_id,
        amc_number,
        contract_end
      FROM amc_contracts
      ORDER BY item_id, contract_end DESC
    ),
    batches_agg AS (
      SELECT
        ib.item_id,
        json_agg(
          json_build_object(
            'batch', ib.batch_number,
            'stock', ib.quantity_available,
            'expiry', to_char(ib.expiry_date, 'YYYY-MM-DD'),
            'supplier', sup.supplier_name,
            'price', ib.purchase_price,
            'location', ib.storage_location
          ) ORDER BY ib.expiry_date ASC NULLS LAST
        ) AS batches,
        SUM(ib.quantity_available)::numeric AS total_stock,
        to_char(MIN(ib.expiry_date), 'YYYY-MM-DD') AS earliest_expiry,
        (ARRAY_AGG(ib.batch_number ORDER BY ib.expiry_date ASC NULLS LAST))[1] AS first_batch
      FROM item_batches ib
      LEFT JOIN suppliers sup ON sup.supplier_id = ib.supplier_id
      GROUP BY ib.item_id
    )
    SELECT
      i.item_id AS iid,
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
      a.amc_number AS amc,
      to_char(a.contract_end, 'YYYY-MM-DD') AS amc_expiry,
      i.price_per_unit::text AS price,
      COALESCE(ba.total_stock, 0) AS stock,
      ba.earliest_expiry AS expiry,
      ba.first_batch AS batch,
      COALESCE(ba.batches, '[]'::json) AS batches
    FROM items i
    LEFT JOIN departments d ON d.dept_id = i.primary_dept_id
    LEFT JOIN suppliers s ON s.supplier_id = i.default_supplier_id
    LEFT JOIN amc_summary a ON a.item_id = i.item_id
    LEFT JOIN batches_agg ba ON ba.item_id = i.item_id
    WHERE i.is_active = true
    ORDER BY i.item_name ASC;
  `

  const rows = await withDbRetry(() => prisma.$queryRawUnsafe<RegistryRawRow[]>(sql))

  return rows.map((it) => {
    const rawBatches = Array.isArray(it.batches) ? it.batches : []
    const batches = rawBatches.map((b) => ({
      batch: String(b.batch ?? ''),
      stock: Number(b.stock ?? 0),
      expiry: b.expiry ? String(b.expiry) : null,
      supplier: b.supplier ? String(b.supplier) : null,
      price: b.price != null ? Number(b.price) : null,
      location: b.location ? String(b.location) : null,
    }))

    const earliestExpiry = batches
      .filter((b) => b.expiry)
      .map((b) => new Date(b.expiry!).toISOString())
      .sort()[0] || null

    return {
      id: it.id,
      name: it.name,
      sub: it.sub || '',
      category: it.category,
      subcat: it.subcat,
      stock: Number(it.stock ?? 0),
      min: Number(it.min_stock_level || 0),
      max: Number(it.max_stock_level || 0),
      unit: it.unit || '',
      expiry: earliestExpiry,
      dept: it.dept || '',
      batch: it.batch || batches[0]?.batch || null,
      batches,
      supplier: it.supplier || null,
      price: Number(it.price || 0),
      amc: it.amc || null,
      amcExpiry: it.amc_expiry || null,
      serial: null,
      purchase: null,
    }
  })
}

export async function GET() {
  const auth = await apiGuard(CATALOG_ROLES)
  if (auth.response) return auth.response

  try {
    const items = await getOrSetCache(
      'api:registry',
      () => fetchRegistryData(),
      30, // 30s TTL
      ['registry', 'items']
    )

    return noStoreJson(items)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/registry error:', err)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
