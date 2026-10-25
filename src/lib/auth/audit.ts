import prisma from '@/lib/prisma';
import { AuditAction } from '@/generated/prisma/client';

interface AuditInput {
  tableName: string;
  recordId: number;
  action: AuditAction;
  changedBy: number;
  sessionId?: string | null;
  ipAddress?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  notes?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tableName: input.tableName,
        recordId: input.recordId,
        action: input.action,
        changedBy: input.changedBy,
        sessionId: input.sessionId?.slice(0, 100) ?? null,
        ipAddress: input.ipAddress?.slice(0, 45) ?? null,
        oldValues: toJson(input.oldValues),
        newValues: toJson(input.newValues),
        notes: input.notes?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

function toJson(value: unknown) {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as object;
}
