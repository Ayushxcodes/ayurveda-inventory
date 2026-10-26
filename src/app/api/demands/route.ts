import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { apiGuard, assertSameOrigin, noStoreJson } from '@/lib/auth/guards'
import { DEMAND_CREATE_ROLES, DEMAND_ROLES } from '@/lib/auth/roles'
import { writeAudit } from '@/lib/auth/audit'
import {
  demandInclude,
  demandVisibilityWhere,
  detectDemandAnomalies,
  formatAnomalyAlertSummary,
  parseDemandInput,
  redactAnomalyRequesters,
  serializeDemand,
  severityRank,
} from '@/lib/demand'
import { AlertType, AuditAction, type Prisma } from '@/generated/prisma/client'

export const dynamic = 'force-dynamic'

const STATUSES = ['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'] as const

export async function GET(req: Request) {
  const auth = await apiGuard(DEMAND_ROLES)
  if (auth.response) return auth.response

  const scope = demandVisibilityWhere(auth.user)
  if (!scope) {
    return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
  }

  try {
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100)
    const statusParam = url.searchParams.get('status') ?? ''

    const where: Prisma.DemandRequestWhereInput = { ...scope }
    if ((STATUSES as readonly string[]).includes(statusParam)) {
      where.status = statusParam as (typeof STATUSES)[number]
    }
    if (q) {
      where.OR = [
        { requestNumber: { contains: q, mode: 'insensitive' } },
        { justification: { contains: q, mode: 'insensitive' } },
        { requester: { fullName: { contains: q, mode: 'insensitive' } } },
        { department: { deptName: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const rows = await prisma.demandRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: demandInclude,
    })

    return noStoreJson({ requests: rows.map(serializeDemand) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GET /api/demands error:', err)
    return noStoreJson({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await apiGuard(DEMAND_CREATE_ROLES)
  if (auth.response) return auth.response

  const originError = assertSameOrigin(req)
  if (originError) return originError

  try {
    const body = await req.json().catch(() => null)
    const parsed = parseDemandInput(body)
    if (!parsed.ok) {
      return noStoreJson(
        { error: 'Please fix the highlighted fields', fields: parsed.errors },
        { status: 400 }
      )
    }

    let targetDeptId: number
    if (auth.user.role === 'hod' || auth.user.role === 'requester') {
      if (auth.user.deptId) {
        targetDeptId = auth.user.deptId
      } else if (auth.user.role === 'hod') {
        return noStoreJson({ error: 'No department assigned to this HOD account' }, { status: 403 })
      } else if (parsed.data.deptId) {
        targetDeptId = parsed.data.deptId
      } else {
        return noStoreJson(
          { error: 'Select a department for this request', fields: { deptId: 'Department is required.' } },
          { status: 400 }
        )
      }
    } else if (parsed.data.deptId) {
      targetDeptId = parsed.data.deptId
    } else {
      return noStoreJson(
        { error: 'Select a department for this request', fields: { deptId: 'Department is required.' } },
        { status: 400 }
      )
    }

    const dept = await prisma.department.findFirst({
      where: { deptId: targetDeptId, isActive: true },
      select: { deptId: true },
    })
    if (!dept) {
      return noStoreJson(
        { error: 'Department not found or inactive', fields: { deptId: 'Select an active department.' } },
        { status: 400 }
      )
    }

    const itemIds = parsed.data.items.map((line) => line.itemId)
    const itemRows = await prisma.item.findMany({
      where: { itemId: { in: itemIds }, isActive: true },
      select: { itemId: true, unit: true },
    })
    if (itemRows.length !== itemIds.length) {
      return noStoreJson(
        { error: 'One or more selected items are unavailable', fields: { items: 'Remove unavailable items.' } },
        { status: 400 }
      )
    }
    const units = new Map(itemRows.map((item) => [item.itemId, item.unit]))

    // Run smart anomaly detection (unconsumed stock + open overlapping demands)
    const detectedAnomalies = await detectDemandAnomalies(
      targetDeptId,
      parsed.data.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
      prisma
    )

    let anomalyExplanation: string | null = null

    if (detectedAnomalies.length > 0) {
      if (!parsed.data.confirmAnomaly) {
        const hasUnconsumed = detectedAnomalies.some((a) => a.type === 'unconsumed_stock')
        const errorMessage = hasUnconsumed
          ? 'Similar stock was recently fulfilled for this department and has not yet been consumed.'
          : detectedAnomalies.length === 1
          ? 'A similar request is already open for this department.'
          : `${detectedAnomalies.length} similar requests are already open for this department.`

        return noStoreJson(
          {
            error: errorMessage,
            code: 'DEMAND_ANOMALY',
            anomalies:
              auth.user.role === 'requester'
                ? redactAnomalyRequesters(detectedAnomalies)
                : detectedAnomalies,
          },
          { status: 409 }
        )
      }

      anomalyExplanation = (parsed.data.anomalyExplanation ?? '').trim()
      if (!anomalyExplanation) {
        return noStoreJson(
          {
            error: 'Explain why this request is needed before overriding the anomaly.',
            fields: { anomalyExplanation: 'An explanation is required.' },
          },
          { status: 400 }
        )
      }
    }

    const finalJustification = anomalyExplanation
      ? parsed.data.justification
        ? `${parsed.data.justification}\n\n[Anomaly Justification]: ${anomalyExplanation}`
        : `[Anomaly Justification]: ${anomalyExplanation}`
      : parsed.data.justification || ''

    const created = await prisma.$transaction(async (tx) => {
      const seq = await tx.$queryRaw<{ request_id: number | bigint }[]>`
        SELECT nextval(pg_get_serial_sequence('demand_requests', 'request_id')) AS request_id
      `
      const requestId = Number(seq[0]?.request_id ?? 0)
      if (!requestId) throw new Error('Failed to allocate demand request id')

      const demand = await tx.demandRequest.create({
        data: {
          requestId,
          requestNumber: `DEMAND-${new Date().getFullYear()}-${String(requestId).padStart(4, '0')}`,
          deptId: targetDeptId,
          requestedBy: auth.user.userId,
          neededBy: parsed.data.neededBy ? new Date(`${parsed.data.neededBy}T00:00:00.000Z`) : null,
          justification: finalJustification || null,
          items: {
            create: parsed.data.items.map((line) => ({
              itemId: line.itemId,
              quantity: line.quantity,
              unit: units.get(line.itemId) ?? '',
              notes: line.notes,
            })),
          },
        },
        include: demandInclude,
      })

      const primaryAnomaly =
        detectedAnomalies.length > 0
          ? detectedAnomalies.reduce((worst, current) =>
              severityRank(current.severity) < severityRank(worst.severity) ? current : worst
            )
          : null

      const anomalyAlert =
        primaryAnomaly && anomalyExplanation
          ? await tx.alert.create({
              data: {
                alertType: AlertType.anomaly,
                itemId: primaryAnomaly.newItem.itemId,
                severity: primaryAnomaly.severity,
                alertTitle:
                  primaryAnomaly.type === 'unconsumed_stock'
                    ? `Unconsumed Stock Anomaly: ${demand.requestNumber}`
                    : `Possible duplicate demand: ${demand.requestNumber}`,
                alertMessage: formatAnomalyAlertSummary(
                  demand.requestNumber,
                  detectedAnomalies,
                  anomalyExplanation
                ),
                deptId: targetDeptId,
                demandRequestId: demand.requestId,
                relatedRequestId: primaryAnomaly.priorRequest.requestId,
              },
              select: { alertId: true, severity: true },
            })
          : null

      const refreshedDemand = await tx.demandRequest.findUniqueOrThrow({
        where: { requestId: demand.requestId },
        include: demandInclude,
      })

      return { demand: refreshedDemand, anomalyAlert, primaryAnomaly }
    }, { timeout: 20000 })

    await writeAudit({
      tableName: 'demand_requests',
      recordId: created.demand.requestId,
      action: AuditAction.CREATE,
      changedBy: auth.user.userId,
      newValues: {
        requestNumber: created.demand.requestNumber,
        deptId: created.demand.deptId,
        status: created.demand.status,
        neededBy: created.demand.neededBy,
        items: created.demand.items.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity.toString(),
        })),
        anomalyRaised: Boolean(created.anomalyAlert),
        anomalyTypes: created.primaryAnomaly
          ? [...new Set(detectedAnomalies.map((anomaly) => anomaly.type))]
          : undefined,
        anomalyExplanation: created.anomalyAlert ? anomalyExplanation : undefined,
      },
      notes: created.anomalyAlert
        ? `Demand request raised with anomaly alert for HOD (${created.demand.requestNumber})`
        : 'Demand request raised',
    })

    if (created.anomalyAlert) {
      await writeAudit({
        tableName: 'alerts',
        recordId: created.anomalyAlert.alertId,
        action: AuditAction.CREATE,
        changedBy: auth.user.userId,
        newValues: {
          alertType: AlertType.anomaly,
          severity: created.anomalyAlert.severity,
          deptId: targetDeptId,
          demandRequestId: created.demand.requestId,
          relatedRequestId: created.primaryAnomaly?.priorRequest.requestId ?? null,
        },
        notes: `Demand anomaly raised to HOD for ${created.demand.requestNumber}`,
      })
    }

    return noStoreJson(
      {
        request: serializeDemand(created.demand),
        anomalyRaised: Boolean(created.anomalyAlert),
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('POST /api/demands error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
