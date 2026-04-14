import type { AuditLogRepository } from "../../interfaces";
import type {
  AuditLogEntry,
  AuditLogEntryInput,
  AuditLogFilters,
} from "../../types";
import type { PrismaDb } from "./prismaTypes";

function toAudit(row: {
  id: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValue: unknown | null;
  newValue: unknown | null;
  ipAddress: string | null;
  userAgent: string | null;
  actorId: string | null;
  createdAt: Date;
}): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    resource: row.resource,
    resourceId: row.resourceId,
    oldValue: row.oldValue,
    newValue: row.newValue,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    actorId: row.actorId,
    createdAt: row.createdAt,
  };
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  public constructor(private readonly db: PrismaDb) {}

  async append(entry: AuditLogEntryInput): Promise<AuditLogEntry> {
    const row = await this.db.auditLog.create({
      data: {
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        oldValue: entry.oldValue as any,
        newValue: entry.newValue as any,
        actorId: entry.actorId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });

    return toAudit(row);
  }

  async list(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
    const where: Record<string, unknown> = {};
    if (filters?.actorId) where.actorId = filters.actorId;
    if (filters?.resource) where.resource = filters.resource;
    if (filters?.resourceId) where.resourceId = filters.resourceId;
    if (filters?.action) where.action = filters.action;
    if (filters?.from || filters?.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) createdAt.gte = filters.from;
      if (filters.to) createdAt.lte = filters.to;
      where.createdAt = createdAt;
    }

    const rows = await this.db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });

    return rows.map(toAudit);
  }
}
