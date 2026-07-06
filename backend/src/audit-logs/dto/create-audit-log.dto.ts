import { AuditAction, Role } from '@prisma/client';

export class CreateAuditLogDto {
  userId: string;
  userRole: Role;
  action: AuditAction;
  tableName: string;
  recordId: string;
  patientId?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
}
