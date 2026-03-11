/**
 * Context passed into domain services for audit and outbox.
 * S2 (Object-Level Authorization) and S5 (Outbox) use this.
 */
export interface AuditContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}
