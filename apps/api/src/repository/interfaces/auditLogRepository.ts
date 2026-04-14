import { AuditLogEntry, AuditLogEntryInput, AuditLogFilters } from "../types";

export interface AuditLogRepository {
  append(entry: AuditLogEntryInput): Promise<AuditLogEntry>;
  list(filters?: AuditLogFilters): Promise<AuditLogEntry[]>;
}
