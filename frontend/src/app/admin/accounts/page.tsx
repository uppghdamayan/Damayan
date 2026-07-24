'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { X } from 'lucide-react';

interface Account {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  isActive: boolean;
  requiresPasswordChange: boolean;
  temporaryPassword?: string;
  createdAt: string;
}

interface AccountsResponse {
  data: Account[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CreateResult {
  user: Account;
  tempPassword: string;
  note: string;
}

// ─── Badge (Section 6.3) ───────────────────────
const RoleBadge = ({ role }: { role: string }) => {
  const map: Record<string, string> = {
    ADMIN: 'bg-purple-bg text-purple border-purple-border',
    DOCTOR: 'bg-accent-light text-accent-hover border-accent',
    NURSE: 'bg-blue-bg text-blue border-blue-border',
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center ${map[role] || ''}`}>
      {role}
    </span>
  );
};

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span className={`text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center ${isActive ? 'bg-green-bg text-green border-green-border' : 'bg-surface-2 text-text-muted border-border'}`}>
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

// ─── Button (Section 6.2) ──────────────────────
const PrimaryBtn = ({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center justify-center gap-[5px] whitespace-nowrap min-w-[80px] cursor-pointer disabled:bg-text-muted disabled:border-border-strong disabled:cursor-not-allowed"
  >
    {children}
  </button>
);

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

// ─── Field (Section 6.4) ───────────────────────
const Field = ({
  label, required = false, children,
}: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5 mb-3.5">
    <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
      {label} {required && <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>}
    </label>
    {children}
  </div>
);

const inputClassName = "w-full h-[34px] px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:bg-surface placeholder:text-text-muted";

// ─── Modal (Section 6.7) ───────────────────────
function CreateAccountModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: CreateResult) => void;
}) {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', middleName: '', role: 'DOCTOR' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Valid email is required.';
    }
    if (!form.firstName || form.firstName.trim().length < 2) {
      e.firstName = 'First name must be at least 2 characters.';
    } else if (form.firstName.length > 30) {
      e.firstName = 'First name must not exceed 30 characters.';
    }
    if (!form.lastName || form.lastName.trim().length < 2) {
      e.lastName = 'Last name must be at least 2 characters.';
    } else if (form.lastName.length > 30) {
      e.lastName = 'Last name must not exceed 30 characters.';
    }
    if (form.middleName && form.middleName.length > 30) {
      e.middleName = 'Middle name must not exceed 30 characters.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await apiRequest<CreateResult>('/accounts', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          middleName: form.middleName || undefined,
          role: form.role,
        }),
      });
      toast.success('Account created successfully');
      onCreated(result);
      onClose();
      setForm({ email: '', firstName: '', lastName: '', middleName: '', role: 'DOCTOR' });
    } catch (err: any) {
      setErrors({ submit: err.message });
      toast.error(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150"
    >
      <div
        className="bg-surface border border-border rounded-[10px] w-[500px] @max-[1439px]:w-[460px] max-h-[80vh] overflow-y-auto shadow-modal"
      >
        {/* Modal header */}
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">Create User Account</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="px-[18px] py-[18px]">
          {errors.submit && (
            <div className="bg-red-bg border border-red-border rounded-btn px-3 py-2 mb-3.5 text-[12px] text-red font-medium">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required>
              <input
                className={cn(
                  inputClassName,
                  errors.firstName
                    ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                    : 'border-border focus:border-accent focus:shadow-accent-focus'
                )}
                value={form.firstName}
                onChange={set('firstName')}
                maxLength={30}
              />
              {errors.firstName && <p className="text-[12px] text-red mt-1">{errors.firstName}</p>}
            </Field>
            <Field label="Last Name" required>
              <input
                className={cn(
                  inputClassName,
                  errors.lastName
                    ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                    : 'border-border focus:border-accent focus:shadow-accent-focus'
                )}
                value={form.lastName}
                onChange={set('lastName')}
                maxLength={30}
              />
              {errors.lastName && <p className="text-[12px] text-red mt-1">{errors.lastName}</p>}
            </Field>
          </div>

          <Field label="Middle Name">
            <input
              className={cn(
                inputClassName,
                errors.middleName
                  ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                  : 'border-border focus:border-accent focus:shadow-accent-focus'
              )}
              value={form.middleName}
              onChange={set('middleName')}
              maxLength={30}
              placeholder="Optional"
            />
            {errors.middleName && <p className="text-[12px] text-red mt-1">{errors.middleName}</p>}
          </Field>

          <Field label="Email Address" required>
            <input
              className={cn(
                inputClassName,
                errors.email
                  ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                  : 'border-border focus:border-accent focus:shadow-accent-focus'
              )}
              type="email"
              value={form.email}
              onChange={set('email')}
            />
            {errors.email && <p className="text-[12px] text-red mt-1">{errors.email}</p>}
          </Field>

          <Field label="Role" required>
            <select
              value={form.role}
              onChange={set('role')}
              className={cn(
                inputClassName,
                "cursor-pointer focus:border-accent focus:shadow-accent-focus border-border"
              )}
            >
              <option value="DOCTOR">Doctor</option>
              <option value="NURSE">Nurse</option>
            </select>
          </Field>

          <p className="text-[11px] text-text-muted mt-2">
            A 16-character temporary password will be generated. Share it securely — it is shown only once.
          </p>
        </div>

        {/* Modal footer */}
        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border">
          <SecBtn onClick={onClose}>Cancel</SecBtn>
          <PrimaryBtn onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating…' : 'Create Account'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Temp Password Display (Section 8.1 / Toast Style) ──
function TempPasswordToast({ result, onDismiss }: { result: CreateResult; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[2000] bg-surface border border-green-border rounded-card shadow-[0_8px_24px_rgba(0,0,0,0.12)] px-5 py-4 w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex justify-between items-start mb-2.5">
        <span className="text-[13px] font-bold text-green flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />
          Password Generated
        </span>
        <button
          onClick={onDismiss}
          className="w-5 h-5 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer text-sm leading-none"
        >
          ×
        </button>
      </div>
      <p className="text-[12px] text-text-secondary mb-2.5">
        {result.user.firstName} {result.user.lastName} ({result.user.role}) — {result.user.email}
      </p>
      <div className="bg-surface-2 border border-border rounded-btn px-3 py-2 mb-2.5">
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.6px] mb-1">
          Temporary Password (shown once)
        </p>
        <code className="text-[15px] font-bold text-text-primary font-mono select-all">
          {result.tempPassword}
        </code>
      </div>
      <p className="text-[11px] text-text-muted">{result.note}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tempResult, setTempResult] = useState<CreateResult | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  // Only show the full-table skeleton on the very first load. Pagination and
  // post-mutation refetches keep the current rows visible instead of blanking
  // the whole table into a skeleton on every click.
  const hasLoadedRef = useRef(false);

  const fetchAccounts = useCallback(async (page = 1) => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const res = await apiRequest<AccountsResponse>(`/accounts?page=${page}&limit=20`);
      setAccounts(res.data);
      setMeta(res.meta);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      await apiRequest(`/accounts/${id}`, { method: 'DELETE' });
      toast.success('Account deleted successfully');
      fetchAccounts(meta.page);
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete account');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm("Are you sure you want to reset this user's password? Their current password will be invalidated immediately.")) return;
    setResettingId(id);
    try {
      const res = await apiRequest<CreateResult>(`/accounts/${id}/reset-password`, { method: 'POST' });
      toast.success('Password reset successfully');
      handleCreated(res);
    } catch (e: any) {
      toast.error(e.message || 'Failed to reset password');
    } finally {
      setResettingId(null);
    }
  };

  const handleCreated = (result: CreateResult) => {
    setTempResult(result);
    fetchAccounts();
    setTimeout(() => setTempResult(null), 60000); // auto-dismiss after 1 min
  };

  return (
    <>
      {/* Page header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary mb-1">User Accounts</h1>
          <p className="text-[12px] text-text-muted">
            {meta.total} account{meta.total !== 1 ? 's' : ''} total
          </p>
        </div>
        <PrimaryBtn onClick={() => setModalOpen(true)}>+ New Account</PrimaryBtn>
      </div>

      {/* Accounts table card (Section 6.1 / 6.5) */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
        {/* Card header */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
          <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
            👤
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
            All Accounts
          </span>
        </div>

        {/* Table */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2">
              {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
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
                    <Skeleton width={120} height={12} borderRadius={4} />
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
                      <Skeleton width={48} height={24} borderRadius={6} />
                    </div>
                  </td>
                </tr>
              ))
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[13px] text-text-muted">
                  No accounts found.
                </td>
              </tr>
            ) : (
              accounts.map((account, i) => (
                <tr
                  key={account.id}
                  className="hover:bg-surface-3 transition-colors border-b border-border last:border-b-0"
                >
                  <td className="px-2.5 py-2 text-[12px] text-text-secondary font-medium">
                    {account.lastName}, {account.firstName}
                    {account.middleName ? ` ${account.middleName[0]}.` : ''}
                  </td>
                  <td className="px-2.5 py-2 text-[12px] text-text-secondary">
                    {account.email}
                  </td>
                  <td className="px-2.5 py-2">
                    <RoleBadge role={account.role} />
                  </td>
                  <td className="px-2.5 py-2">
                    <StatusBadge isActive={account.isActive} />
                  </td>
                  <td className="px-2.5 py-2 text-[11px] text-text-muted font-mono">
                    {new Date(account.createdAt).toLocaleDateString('en-PH')}
                  </td>
                  <td className="px-2.5 py-2">
                    {account.isActive && account.role !== 'ADMIN' && (
                      <div className="flex gap-1.5">
                        <SecBtn
                          onClick={() => handleResetPassword(account.id)}
                        >
                          {resettingId === account.id ? 'Resetting…' : 'Reset Password'}
                        </SecBtn>
                        <SecBtn
                          onClick={() => handleDelete(account.id)}
                          danger
                        >
                          {deletingId === account.id ? 'Deleting…' : 'Delete'}
                        </SecBtn>
                        {account.requiresPasswordChange && account.temporaryPassword && (
                          <SecBtn
                            onClick={() => {
                              navigator.clipboard.writeText(account.temporaryPassword!);
                              toast.success(`Copied temp password: ${account.temporaryPassword}`);
                            }}
                          >
                            Copy Temp PW
                          </SecBtn>
                        )}
                      </div>
                    )}
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
                onClick={() => fetchAccounts(p)}
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

      {/* Modal */}
      <CreateAccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />

      {/* Temp password toast */}
      {tempResult && (
        <TempPasswordToast result={tempResult} onDismiss={() => setTempResult(null)} />
      )}
    </>
  );
}

