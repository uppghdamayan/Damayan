'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  isActive: boolean;
  createdAt: string;
}

interface PatientsResponse {
  data: Patient[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Badge (Section 6.3) ───────────────────────
const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span className={`text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center ${isActive ? 'bg-green-bg text-green border-green-border' : 'bg-surface-2 text-text-muted border-border'}`}>
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

// ─── Button (Section 6.2) ──────────────────────
const SecBtn = ({ children, onClick, danger = false }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) => (
  <button
    onClick={onClick}
    className={cn(
      "h-[28px] px-3 rounded-btn text-[11px] font-semibold transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap min-w-[80px] cursor-pointer border",
      danger
        ? "bg-red-bg text-red border-red-border hover:bg-red/15 hover:border-red/80"
        : "bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong"
    )}
  >
    {children}
  </button>
);

// ─── Main Page ───────────────────────────────
export default function PatientAccountsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'deactivate' | 'reactivate'; patient: Patient } | null>(null);

  // Only show the full-table skeleton on the very first load. Pagination and
  // post-action refetches keep the current rows visible instead of blanking the
  // whole table into a skeleton on every click.
  const hasLoadedRef = useRef(false);

  const fetchPatients = useCallback(async (page = 1) => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const res = await apiRequest<PatientsResponse>(`/patients?page=${page}&limit=20&includeInactive=true`);
      setPatients(res.data);
      setMeta(res.meta);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, patient } = confirmAction;

    if (type === 'deactivate') {
      setDeactivatingId(patient.id);
      try {
        await apiRequest(`/patients/${patient.id}/deactivate`, { method: 'PATCH' });
        toast.success('Patient deactivated successfully');
        fetchPatients(meta.page);
      } catch (e: any) {
        toast.error(e.message || 'Failed to deactivate patient');
      } finally {
        setDeactivatingId(null);
        setConfirmAction(null);
      }
    } else {
      setReactivatingId(patient.id);
      try {
        await apiRequest(`/patients/${patient.id}/reactivate`, { method: 'PATCH' });
        toast.success('Patient reactivated successfully');
        fetchPatients(meta.page);
      } catch (e: any) {
        toast.error(e.message || 'Failed to reactivate patient');
      } finally {
        setReactivatingId(null);
        setConfirmAction(null);
      }
    }
  };

  return (
    <>
      {/* Page header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary mb-1">Patient Accounts</h1>
          <p className="text-[12px] text-text-muted">
            {meta.total} patient{meta.total !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      {/* Patients table card */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
          <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
            👥
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
            All Patients
          </span>
        </div>

        {/* Table */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2">
              {['Code', 'Name', 'Sex', 'Status', 'Registered Date', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-2.5 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-border last:border-b-0 animate-pulse"
                >
                  <td className="px-2.5 py-3">
                    <Skeleton width={80} height={12} borderRadius={4} />
                  </td>
                  <td className="px-2.5 py-3">
                    <Skeleton width={160} height={12} borderRadius={4} />
                  </td>
                  <td className="px-2.5 py-3">
                    <Skeleton width={50} height={16} borderRadius={4} />
                  </td>
                  <td className="px-2.5 py-3">
                    <Skeleton width={45} height={16} borderRadius={4} />
                  </td>
                  <td className="px-2.5 py-3">
                    <Skeleton width={70} height={12} borderRadius={4} />
                  </td>
                  <td className="px-2.5 py-3">
                    <div className="flex gap-1.5">
                      <Skeleton width={92} height={24} borderRadius={6} />
                    </div>
                  </td>
                </tr>
              ))
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[13px] text-text-muted">
                  No patients found.
                </td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-surface-3 transition-colors border-b border-border last:border-b-0"
                >
                  <td className="px-2.5 py-2 text-[12px] text-text-primary font-mono font-medium">
                    {patient.patientCode}
                  </td>
                  <td className="px-2.5 py-2 text-[12px] text-text-secondary font-medium">
                    {patient.lastName}, {patient.firstName}
                    {patient.middleName ? ` ${patient.middleName[0]}.` : ''}
                  </td>
                  <td className="px-2.5 py-2 text-[12px] text-text-secondary capitalize">
                    {patient.sex.toLowerCase()}
                  </td>
                  <td className="px-2.5 py-2">
                    <StatusBadge isActive={patient.isActive} />
                  </td>
                  <td className="px-2.5 py-2 text-[11px] text-text-muted font-mono">
                    {new Date(patient.createdAt).toLocaleDateString('en-PH')}
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex gap-1.5">
                      {patient.isActive ? (
                        <SecBtn
                          onClick={() => setConfirmAction({ type: 'deactivate', patient })}
                          danger
                        >
                          {deactivatingId === patient.id ? 'Deactivating…' : 'Deactivate'}
                        </SecBtn>
                      ) : (
                        <SecBtn
                          onClick={() => setConfirmAction({ type: 'reactivate', patient })}
                        >
                          {reactivatingId === patient.id ? 'Reactivating…' : 'Reactivate'}
                        </SecBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="px-3.5 py-2.5 border-t border-border flex gap-2 justify-end bg-surface-2">
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => fetchPatients(p)}
                className={cn(
                  "w-7 h-7 rounded-btn text-[11px] font-semibold cursor-pointer border flex items-center justify-center transition-all duration-150",
                  p === meta.page
                    ? "bg-accent text-white border-accent-hover shadow-btn-primary"
                    : "bg-surface text-text-secondary border-border hover:bg-surface-2 hover:border-border-strong hover:text-text-primary"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeConfirmAction}
        title={confirmAction?.type === 'deactivate' ? 'Confirm Deactivate' : 'Confirm Reactivate'}
        message={
          confirmAction?.type === 'deactivate'
            ? 'Are you sure you want to deactivate this patient record? They will no longer be visible in standard searches.'
            : 'Are you sure you want to reactivate this patient record? They will be visible again in standard searches.'
        }
        confirmLabel={confirmAction?.type === 'deactivate' ? 'Deactivate' : 'Reactivate'}
        cancelLabel="Cancel"
        isDeleting={!!deactivatingId || !!reactivatingId}
        intent={confirmAction?.type === 'deactivate' ? 'destructive' : 'primary'}
        loadingLabel={confirmAction?.type === 'deactivate' ? 'Deactivating...' : 'Reactivating...'}
      />
    </>
  );
}
