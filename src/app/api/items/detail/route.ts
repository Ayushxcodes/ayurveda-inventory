import prisma from '@/lib/prisma'
import { getOrSetCache } from '@/lib/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function fetchItemDetail(code: string) {
  const it = await prisma.item.findUnique({
    where: { itemCode: code },
    select: {
      itemCode: true,
      itemName: true,
      itemType: true,
      category: true,
      subCategory: true,
      unit: true,
      minStockLevel: true,
      itemBatches: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          batchId: true,
          batchNumber: true,
          quantityReceived: true,
          quantityAvailable: true,
          mfgDate: true,
          expiryDate: true,
          createdAt: true,
        },
      },
    },
  })

  if (!it) return null

  return {
    itemCode: it.itemCode,
    itemName: it.itemName,
    itemType: it.itemType,
    category: it.category,
    subCategory: it.subCategory,
    unit: it.unit,
    minStockLevel: it.minStockLevel?.toString?.() ?? '0',
    itemBatches: it.itemBatches.map((b) => ({
      batchId: b.batchId,
      batchNumber: b.batchNumber,
      quantityReceived: b.quantityReceived?.toString?.() ?? '0',
      quantityAvailable: b.quantityAvailable?.toString?.() ?? '0',
      mfgDate: b.mfgDate ? b.mfgDate.toISOString() : null,
      expiryDate: b.expiryDate ? b.expiryDate.toISOString() : null,
      createdAt: b.createdAt ? b.createdAt.toISOString() : null,
    })),
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const code = (url.searchParams.get('code') || '').trim()
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

    const mapped = await getOrSetCache(
      `api:items:detail:${code}`,
      () => fetchItemDetail(code),
      30,
      ['items', `item:${code}`]
    )

    if (!mapped) return NextResponse.json({ error: 'item not found' }, { status: 404 })

    return NextResponse.json(mapped, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=59',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/items/detail error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
