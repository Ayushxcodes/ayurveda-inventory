import type { Prisma } from '@/generated/prisma/client';
import type { SessionUser } from './auth/roles';

export const demandInclude = {
  department: { select: { deptCode: true, deptName: true } },
  requester: { select: { userId: true, fullName: true, username: true } },
  reviewer: { select: { fullName: true } },
  hodApprover: { select: { fullName: true, role: true } },
  adminApprover: { select: { fullName: true, role: true } },
  rejecter: { select: { fullName: true, role: true } },
  fulfiller: { select: { fullName: true } },
  items: {
    orderBy: { demandItemId: 'asc' },
    select: {
      demandItemId: true,
      itemId: true,
      quantity: true,
      unit: true,
      notes: true,
      item: { select: { itemCode: true, itemName: true, category: true } },
    },
  },
  activityLogs: {
    orderBy: { createdAt: 'desc' },
    take: 50,
  },
} satisfies Prisma.DemandRequestInclude;

export type DemandPayload = Prisma.DemandRequestGetPayload<{ include: typeof demandInclude }>;

export function demandVisibilityWhere(user: SessionUser): Prisma.DemandRequestWhereInput | null {
  if (user.role === 'requester') return { requestedBy: user.userId };
  if (user.role === 'hod') return user.deptId ? { deptId: user.deptId } : null;
  if (user.role === 'procurement_officer') return { status: { in: ['approved', 'fulfilled'] } };
  if (user.role === 'admin' || user.role === 'super_admin') return {};
  return { requestedBy: -1 };
}

export function serializeDemand(row: DemandPayload) {
  return {
    requestId: row.requestId,
    requestNumber: row.requestNumber,
    deptId: row.deptId,
    status: row.status,
    stage: row.stage,
    neededBy: row.neededBy ? row.neededBy.toISOString().slice(0, 10) : null,
    justification: row.justification,
    reviewNotes: row.reviewNotes,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    hodApprovedBy: row.hodApprovedBy,
    hodApprovedAt: row.hodApprovedAt?.toISOString() ?? null,
    hodApproverName: row.hodApprover?.fullName ?? null,
    hodNotes: row.hodNotes,
    adminApprovedBy: row.adminApprovedBy,
    adminApprovedAt: row.adminApprovedAt?.toISOString() ?? null,
    adminApproverName: row.adminApprover?.fullName ?? null,
    adminNotes: row.adminNotes,
    rejectedBy: row.rejectedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejecterName: row.rejecter?.fullName ?? null,
    rejecterRole: row.rejecter?.role ?? null,
    rejectionStage: row.rejectionStage,
    rejectionReason: row.rejectionReason,
    outOfStock: row.outOfStock,
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    department: row.department,
    requester: row.requester,
    reviewerName: row.reviewer?.fullName ?? null,
    fulfillerName: row.fulfiller?.fullName ?? null,
    items: row.items.map((line) => ({
      demandItemId: line.demandItemId,
      itemId: line.itemId,
      itemCode: line.item.itemCode,
      itemName: line.item.itemName,
      category: line.item.category,
      quantity: Number(line.quantity),
      unit: line.unit,
      notes: line.notes,
    })),
    activityLogs: (row.activityLogs || []).map((log) => ({
      logId: log.logId,
      actorName: log.actorName,
      actorRole: log.actorRole,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      notes: log.notes,
      outOfStock: log.outOfStock,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export interface DemandLineInput {
  itemId: number;
  quantity: number;
  notes: string | null;
}

export interface DemandInput {
  deptId: number | null;
  neededBy: string | null;
  justification: string | null;
  items: DemandLineInput[];
}

type DemandParseResult = { ok: true; data: DemandInput } | { ok: false; errors: Record<string, string> };

export function parseDemandInput(raw: unknown): DemandParseResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: { form: 'Invalid request body.' } };
  }

  const body = raw as Record<string, unknown>;
  const errors: Record<string, string> = {};

  let deptId: number | null = null;
  if (body.deptId !== undefined && body.deptId !== null && body.deptId !== '') {
    const parsed = Number(body.deptId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.deptId = 'Select a valid department.';
    } else {
      deptId = parsed;
    }
  }

  let neededBy: string | null = null;
  if (typeof body.neededBy === 'string' && body.neededBy.trim()) {
    const value = body.neededBy.trim();
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      errors.neededBy = 'Enter a valid date.';
    } else {
      neededBy = value;
    }
  }

  let justification: string | null = null;
  if (typeof body.justification === 'string') {
    const value = body.justification.trim();
    if (value.length > 1000) {
      errors.justification = 'Justification must be 1000 characters or fewer.';
    } else {
      justification = value || null;
    }
  }

  const items: DemandLineInput[] = [];
  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.items = 'Add at least one item to the request.';
  } else if (body.items.length > 50) {
    errors.items = 'A request can contain at most 50 items.';
  } else {
    const seen = new Set<number>();
    for (const entry of body.items) {
      if (typeof entry !== 'object' || entry === null) {
        errors.items = 'One or more item lines are invalid.';
        break;
      }
      const line = entry as Record<string, unknown>;
      const itemId = Number(line.itemId);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        errors.items = 'Select a valid item on every line.';
        break;
      }
      if (seen.has(itemId)) {
        errors.items = 'Each item can only appear once in a request.';
        break;
      }
      seen.add(itemId);

      const rawQty = Number(line.quantity);
      const quantity = Math.round(rawQty * 1000) / 1000;
      if (!Number.isFinite(rawQty) || quantity <= 0 || quantity > 1_000_000) {
        errors.items = 'Quantities must be greater than zero.';
        break;
      }

      let notes: string | null = null;
      if (typeof line.notes === 'string' && line.notes.trim()) {
        const value = line.notes.trim();
        if (value.length > 500) {
          errors.items = 'Line notes must be 500 characters or fewer.';
          break;
        }
        notes = value;
      }

      items.push({ itemId, quantity, notes });
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: { deptId, neededBy, justification, items } };
}
