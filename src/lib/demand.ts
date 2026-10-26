import type { Prisma } from '@/generated/prisma/client';
import { AlertSeverity, AlertType } from '@/generated/prisma/client';
import type { SessionUser } from './auth/roles';
import prisma from './prisma';

export const demandInclude = {
  department: { select: { deptCode: true, deptName: true } },
  requester: { select: { userId: true, fullName: true, username: true } },
  reviewer: { select: { fullName: true } },
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
  anomalyAlerts: {
    where: { status: 'active', alertType: AlertType.anomaly },
    select: {
      alertId: true,
      alertTitle: true,
      alertMessage: true,
      severity: true,
      triggeredAt: true,
      relatedRequestId: true,
    },
  },
} satisfies Prisma.DemandRequestInclude;

export type DemandPayload = Prisma.DemandRequestGetPayload<{ include: typeof demandInclude }>;

export function demandVisibilityWhere(user: SessionUser): Prisma.DemandRequestWhereInput | null {
  if (user.role === 'requester') return { requestedBy: user.userId };
  if (user.role === 'hod') return user.deptId ? { deptId: user.deptId } : null;
  return {};
}

export function serializeDemand(row: DemandPayload) {
  const activeAlert =
    row.anomalyAlerts && row.anomalyAlerts.length > 0 ? row.anomalyAlerts[0] : null;

  return {
    requestId: row.requestId,
    requestNumber: row.requestNumber,
    status: row.status,
    neededBy: row.neededBy ? row.neededBy.toISOString().slice(0, 10) : null,
    justification: row.justification,
    reviewNotes: row.reviewNotes,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    department: row.department,
    requester: row.requester,
    reviewerName: row.reviewer?.fullName ?? null,
    fulfillerName: row.fulfiller?.fullName ?? null,
    hasActiveAnomaly: Boolean(activeAlert),
    anomaly: activeAlert
      ? {
          alertId: activeAlert.alertId,
          title: activeAlert.alertTitle,
          message: activeAlert.alertMessage,
          severity: activeAlert.severity,
          triggeredAt: activeAlert.triggeredAt.toISOString(),
          relatedRequestId: activeAlert.relatedRequestId,
        }
      : null,
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
  confirmAnomaly?: boolean;
  anomalyExplanation?: string | null;
  items: DemandLineInput[];
}

type DemandParseResult =
  | { ok: true; data: DemandInput }
  | { ok: false; errors: Record<string, string> };

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

  let anomalyExplanation: string | null = null;
  if (typeof body.anomalyExplanation === 'string') {
    const val = body.anomalyExplanation.trim();
    if (val.length > 1000) {
      errors.anomalyExplanation = 'Anomaly explanation must be 1000 characters or fewer.';
    } else {
      anomalyExplanation = val || null;
    }
  }

  const confirmAnomaly = body.confirmAnomaly === true;

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

  return {
    ok: true,
    data: {
      deptId,
      neededBy,
      justification,
      confirmAnomaly,
      anomalyExplanation,
      items,
    },
  };
}

export const DEMAND_ANOMALY_WINDOW_DAYS = 60;

export type DemandMatchType = 'same_item' | 'similar_name';

export type DemandAnomalyType = 'unconsumed_stock' | 'open_demand';

export interface DetectedDemandAnomaly {
  type: DemandAnomalyType;
  severity: AlertSeverity;
  lineIndex: number;
  matchType: DemandMatchType;
  score: number;
  newItem: {
    itemId: number;
    itemCode: string;
    itemName: string;
    requestedQty: number;
    unit: string;
  };
  priorItem: {
    itemId: number;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
  };
  priorRequest: {
    requestId: number;
    requestNumber: string;
    status: 'pending' | 'approved' | 'fulfilled';
    createdAt: string;
    fulfilledAt: string | null;
    requesterName: string;
    fulfilledQty?: number;
    consumedQty?: number;
    unconsumedQty?: number;
    unit: string;
  };
  title: string;
  message: string;
}

const PLURAL_TOKENS: Record<string, string> = {
  tablets: 'tablet',
  capsules: 'capsule',
  strips: 'strip',
  bottles: 'bottle',
  vials: 'vial',
  sachets: 'sachet',
  boxes: 'box',
  tubes: 'tube',
  pieces: 'piece',
  drops: 'drop',
};

const UNIT_TOKENS = new Set([
  'mg',
  'mcg',
  'gm',
  'g',
  'kg',
  'ml',
  'l',
  'iu',
  'pcs',
  'pc',
  'nos',
  'no',
]);

function normalizeItemName(name: string) {
  const tokens = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/-/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !/^\d+(\.\d+)?$/.test(token))
    .filter((token) => !/^\d+(\.\d+)?(mg|mcg|gm|kg|ml|g|l|iu|pcs)$/.test(token))
    .map((token) => PLURAL_TOKENS[token] ?? token)
    .filter((token) => !UNIT_TOKENS.has(token));

  return { tokens, key: tokens.join(' '), compact: tokens.join('') };
}

export function scoreNameMatch(leftName: string, rightName: string): number | null {
  const left = normalizeItemName(leftName);
  const right = normalizeItemName(rightName);
  if (!left.key || !right.key) return null;

  if (left.compact === right.compact) return 1;

  const leftSet = new Set(left.tokens);
  const rightSet = new Set(right.tokens);

  if (leftSet.size >= 2 && rightSet.size >= 2) {
    const [small, large] =
      leftSet.size <= rightSet.size ? [leftSet, rightSet] : [rightSet, leftSet];
    if ([...small].every((token) => large.has(token))) return 0.85;
  }

  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const dice = (2 * intersection) / (leftSet.size + rightSet.size);
  return dice >= 0.75 ? dice : null;
}

interface MatchableItem {
  itemId: number;
  itemName: string;
  subCategory: string;
}

function matchPriorItem(
  priorItem: MatchableItem,
  requestedItem: MatchableItem
): { matchType: DemandMatchType; score: number } | null {
  if (priorItem.itemId === requestedItem.itemId) {
    return { matchType: 'same_item', score: 1 };
  }
  if (priorItem.subCategory !== requestedItem.subCategory) return null;

  const nameScore = scoreNameMatch(priorItem.itemName, requestedItem.itemName);
  if (nameScore === null) return null;
  return { matchType: 'similar_name', score: Math.round(nameScore * 1000) / 1000 };
}

const roundQty = (value: number) => Math.round(value * 1000) / 1000;

export function severityRank(severity: AlertSeverity): number {
  switch (severity) {
    case AlertSeverity.critical:
      return 0;
    case AlertSeverity.high:
      return 1;
    case AlertSeverity.medium:
      return 2;
    case AlertSeverity.low:
      return 3;
    default:
      return 4;
  }
}

export function redactAnomalyRequesters(
  anomalies: DetectedDemandAnomaly[]
): DetectedDemandAnomaly[] {
  const anonymous = 'A colleague in your department';
  return anomalies.map((anomaly) => {
    const name = anomaly.priorRequest.requesterName;
    return {
      ...anomaly,
      priorRequest: { ...anomaly.priorRequest, requesterName: anonymous },
      message: name ? anomaly.message.split(name).join(anonymous) : anomaly.message,
    };
  });
}

interface FulfilledItemGroup {
  priorItem: {
    itemId: number;
    itemCode: string;
    itemName: string;
    unit: string;
  };
  matchType: DemandMatchType;
  score: number;
  unit: string;
  fulfilledQty: number;
  earliestFulfillment: Date;
  latestFulfillment: Date;
  latestRequest: {
    requestId: number;
    requestNumber: string;
    createdAt: Date;
    fulfilledAt: Date;
    requesterName: string;
  };
}

/**
 * Smart anomaly engine for a department within DEMAND_ANOMALY_WINDOW_DAYS:
 * 1. UNCONSUMED_STOCK: a matching item was fulfilled recently, but stock issues since
 *    that fulfilment are less than the fulfilled quantity.
 * 2. OPEN_DEMAND: a matching item is still pending or approved.
 * Matching is exact item, or same sub-category plus a strong name match.
 */
export async function detectDemandAnomalies(
  deptId: number,
  items: Array<{ itemId: number; quantity: number }>,
  db = prisma
): Promise<DetectedDemandAnomaly[]> {
  if (!deptId || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  const itemIds = [...new Set(items.map((item) => item.itemId))];
  const catalogRows = await db.item.findMany({
    where: { itemId: { in: itemIds } },
    select: {
      itemId: true,
      itemCode: true,
      itemName: true,
      subCategory: true,
      unit: true,
    },
  });
  const catalogMap = new Map(catalogRows.map((item) => [item.itemId, item]));

  const lookbackDate = new Date(Date.now() - DEMAND_ANOMALY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const priorDemands = await db.demandRequest.findMany({
    where: {
      deptId,
      OR: [
        { status: { in: ['pending', 'approved'] } },
        {
          status: 'fulfilled',
          OR: [
            { createdAt: { gte: lookbackDate } },
            { fulfilledAt: { gte: lookbackDate } },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      requestId: true,
      requestNumber: true,
      status: true,
      createdAt: true,
      fulfilledAt: true,
      updatedAt: true,
      requester: { select: { fullName: true } },
      items: {
        select: {
          quantity: true,
          unit: true,
          item: {
            select: {
              itemId: true,
              itemCode: true,
              itemName: true,
              subCategory: true,
              unit: true,
            },
          },
        },
      },
    },
  });

  if (priorDemands.length === 0) {
    return [];
  }

  const recentIssues = await db.stockIssue.findMany({
    where: { deptId, createdAt: { gte: lookbackDate } },
    select: { itemId: true, quantityIssued: true, createdAt: true },
  });

  const issuesByItem = new Map<number, Array<{ quantity: number; createdAt: Date }>>();
  for (const issue of recentIssues) {
    const list = issuesByItem.get(issue.itemId) ?? [];
    list.push({ quantity: Number(issue.quantityIssued), createdAt: issue.createdAt });
    issuesByItem.set(issue.itemId, list);
  }

  const anomalies: DetectedDemandAnomaly[] = [];
  const seenOpenKeys = new Set<string>();

  for (let idx = 0; idx < items.length; idx++) {
    const reqLine = items[idx];
    const catalogItem = catalogMap.get(reqLine.itemId);
    if (!catalogItem) continue;

    const fulfilledGroups = new Map<number, FulfilledItemGroup>();

    for (const demand of priorDemands) {
      for (const line of demand.items) {
        const match = matchPriorItem(line.item, catalogItem);
        if (!match) continue;

        const unit = line.unit || line.item.unit || catalogItem.unit || '';
        const priorQty = Number(line.quantity);

        if (demand.status === 'pending' || demand.status === 'approved') {
          const uniqueKey = `${idx}:${line.item.itemId}:${demand.requestId}`;
          if (seenOpenKeys.has(uniqueKey)) continue;
          seenOpenKeys.add(uniqueKey);

          anomalies.push({
            type: 'open_demand',
            severity: match.matchType === 'same_item' ? AlertSeverity.high : AlertSeverity.medium,
            lineIndex: idx,
            matchType: match.matchType,
            score: match.score,
            newItem: {
              itemId: catalogItem.itemId,
              itemCode: catalogItem.itemCode,
              itemName: catalogItem.itemName,
              requestedQty: reqLine.quantity,
              unit: catalogItem.unit || '',
            },
            priorItem: {
              itemId: line.item.itemId,
              itemCode: line.item.itemCode,
              itemName: line.item.itemName,
              quantity: priorQty,
              unit,
            },
            priorRequest: {
              requestId: demand.requestId,
              requestNumber: demand.requestNumber,
              status: demand.status,
              createdAt: demand.createdAt.toISOString(),
              fulfilledAt: null,
              requesterName: demand.requester.fullName,
              unit,
            },
            title: `Duplicate open demand: ${demand.requestNumber}`,
            message:
              `${demand.requestNumber} (${demand.status}) requested ${priorQty} ${unit} on ` +
              `${demand.createdAt.toISOString().slice(0, 10)} by ${demand.requester.fullName} ` +
              'and is not yet fulfilled.',
          });
          continue;
        }

        const fulfillmentTime = demand.fulfilledAt ?? demand.updatedAt ?? demand.createdAt;
        if (fulfillmentTime < lookbackDate) continue;

        const existing = fulfilledGroups.get(line.item.itemId);
        const group: FulfilledItemGroup = existing ?? {
          priorItem: {
            itemId: line.item.itemId,
            itemCode: line.item.itemCode,
            itemName: line.item.itemName,
            unit,
          },
          matchType: match.matchType,
          score: match.score,
          unit,
          fulfilledQty: 0,
          earliestFulfillment: fulfillmentTime,
          latestFulfillment: fulfillmentTime,
          latestRequest: {
            requestId: demand.requestId,
            requestNumber: demand.requestNumber,
            createdAt: demand.createdAt,
            fulfilledAt: fulfillmentTime,
            requesterName: demand.requester.fullName,
          },
        };

        group.fulfilledQty = roundQty(group.fulfilledQty + priorQty);
        if (match.score > group.score) {
          group.matchType = match.matchType;
          group.score = match.score;
        }
        if (fulfillmentTime < group.earliestFulfillment) {
          group.earliestFulfillment = fulfillmentTime;
        }
        if (fulfillmentTime >= group.latestFulfillment) {
          group.latestFulfillment = fulfillmentTime;
          group.latestRequest = {
            requestId: demand.requestId,
            requestNumber: demand.requestNumber,
            createdAt: demand.createdAt,
            fulfilledAt: fulfillmentTime,
            requesterName: demand.requester.fullName,
          };
        }
        fulfilledGroups.set(line.item.itemId, group);
      }
    }

    for (const group of fulfilledGroups.values()) {
      const consumedQty = roundQty(
        (issuesByItem.get(group.priorItem.itemId) ?? [])
          .filter((issue) => issue.createdAt >= group.earliestFulfillment)
          .reduce((sum, issue) => sum + issue.quantity, 0)
      );
      const unconsumedQty = roundQty(Math.max(0, group.fulfilledQty - consumedQty));
      if (unconsumedQty <= 0) continue;

      const fulfilledDate = group.latestFulfillment.toISOString().slice(0, 10);

      anomalies.push({
        type: 'unconsumed_stock',
        severity: group.matchType === 'same_item' ? AlertSeverity.high : AlertSeverity.medium,
        lineIndex: idx,
        matchType: group.matchType,
        score: group.score,
        newItem: {
          itemId: catalogItem.itemId,
          itemCode: catalogItem.itemCode,
          itemName: catalogItem.itemName,
          requestedQty: reqLine.quantity,
          unit: catalogItem.unit || '',
        },
        priorItem: {
          ...group.priorItem,
          quantity: group.fulfilledQty,
        },
        priorRequest: {
          requestId: group.latestRequest.requestId,
          requestNumber: group.latestRequest.requestNumber,
          status: 'fulfilled',
          createdAt: group.latestRequest.createdAt.toISOString(),
          fulfilledAt: group.latestFulfillment.toISOString(),
          requesterName: group.latestRequest.requesterName,
          fulfilledQty: group.fulfilledQty,
          consumedQty,
          unconsumedQty,
          unit: group.unit,
        },
        title: `Unconsumed recent stock: ${unconsumedQty} ${group.unit} remaining`,
        message:
          `${group.priorItem.itemName} was fulfilled recently via ` +
          `${group.latestRequest.requestNumber} (${group.fulfilledQty} ${group.unit} across ` +
          `fulfilled requests); ${consumedQty} ${group.unit} consumed to date, ` +
          `${unconsumedQty} ${group.unit} unconsumed (latest fulfilment ${fulfilledDate}).`,
      });
    }
  }

  return anomalies.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'unconsumed_stock' ? -1 : 1;
    const rankDiff = severityRank(a.severity) - severityRank(b.severity);
    if (rankDiff !== 0) return rankDiff;
    return b.priorRequest.createdAt.localeCompare(a.priorRequest.createdAt);
  });
}

export function formatAnomalyAlertSummary(
  requestNumber: string,
  anomalies: DetectedDemandAnomaly[],
  requesterExplanation?: string | null
): string {
  const parts = anomalies.slice(0, 3).map((a) => {
    if (a.type === 'unconsumed_stock') {
      return (
        `${a.newItem.itemName} was fulfilled on ${a.priorRequest.fulfilledAt?.slice(0, 10) ?? 'recent date'} ` +
        `via ${a.priorRequest.requestNumber} (${a.priorRequest.fulfilledQty} ${a.priorRequest.unit}), with ` +
        `${a.priorRequest.unconsumedQty} ${a.priorRequest.unit} still unconsumed (${a.priorRequest.consumedQty} consumed)`
      );
    }
    return (
      `${a.newItem.itemName} overlaps with open ${a.priorRequest.requestNumber} (${a.priorRequest.status}, ` +
      `${a.priorItem.quantity} ${a.priorItem.unit} requested by ${a.priorRequest.requesterName})`
    );
  });

  const more = anomalies.length > 3 ? ` and ${anomalies.length - 3} more` : '';
  let msg = `New demand ${requestNumber} flagged for anomaly: ${parts.join('; ')}${more}.`;
  if (requesterExplanation && requesterExplanation.trim()) {
    msg += ` Requester reason: "${requesterExplanation.trim()}".`;
  }
  return msg;
}

