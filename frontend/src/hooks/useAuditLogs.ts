import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'GENERATE' | 'DRAFT';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userRole: 'ADMIN' | 'DOCTOR' | 'NURSE';
  action: AuditAction;
  tableName: string;
  recordId: string;
  patientId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
}

export interface AuditLogsResponse {
  data: AuditLogEntry[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AuditLogFilters {
  userId?: string;
  patientId?: string;
  action?: AuditAction;
  tableName?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  page?: number;
  limit?: number;
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return apiRequest<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
    },
    staleTime: 30_000, // logs are append-only; 30s is fine
    refetchOnWindowFocus: true, // also refresh when user re-focuses the browser tab
    placeholderData: keepPreviousData, // keep current page/filter results visible while the next combination loads
  });
}
