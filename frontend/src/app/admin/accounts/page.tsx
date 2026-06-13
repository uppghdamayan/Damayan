'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

interface Account {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  isActive: boolean;
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

// ─── Badge ────────────────────────────────────
const RoleBadge = ({ role }: { role: string }) => {
  const map: Record<string, string> = {
    ADMIN: 'bg-[#EDE9FE] text-[#4C1D95] border-[#8B5CF6]',
    DOCTOR: 'bg-[#D4EDE9] text-[#085A4E] border-[#0A6E5F]',
    NURSE: 'bg-[#DBEAFE] text-[#1E3A8A] border-[#3B82F6]',
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-[0.6px] px-1.5 py-0.5 rounded border inline-block ${map[role] || ''}`}>
      {role}
    </span>
  );
};

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span className={`text-[9px] font-bold uppercase tracking-[0.6px] px-1.5 py-0.5 rounded border inline-block ${isActive ? 'bg-[#DCFCE7] text-[#14532D] border-[#22C55E]' : 'bg-[#F7F8FA] text-[#6B7280] border-[#D1D5E0]'}`}>
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

// ─── Button ───────────────────────────────────
const PrimaryBtn = ({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`h-7 px-3.5 rounded-md text-[11px] font-semibold shrink-0 shadow-[0_2px_4px_rgba(10,110,95,0.15)] ${disabled ? 'bg-[#6B7280] text-white border border-[#6B7280] cursor-not-allowed' : 'bg-[#0A6E5F] text-white border border-[#085A4E] cursor-pointer'}`}
  >
    {children}
  </button>
);

const SecBtn = ({ children, onClick, danger = false }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) => (
  <button
    onClick={onClick}
    className={`h-7 px-3 rounded-md text-[11px] font-semibold cursor-pointer border ${danger ? 'bg-[#FEE2E2] text-[#991B1B] border-[#EF4444]' : 'bg-[#F7F8FA] text-[#374151] border-[#D1D5E0]'}`}
  >
    {children}
  </button>
);

// ─── Field ────────────────────────────────────
const Field = ({
  label, required = false, children,
}: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="mb-3.5">
    <label className="block text-[11px] font-semibold text-[#374151] mb-1.5">
      {label} {required && <span className="text-[#991B1B]">*</span>}
    </label>
    {children}
  </div>
);

const inputClassName = "h-[34px] w-full px-2.5 bg-white border rounded-md text-[13px] text-[#0D1117] outline-none box-border";

// ─── Modal ────────────────────────────────────
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
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required.';
    if (!form.firstName || form.firstName.length < 2) e.firstName = 'First name must be at least 2 characters.';
    if (!form.lastName || form.lastName.length < 2) e.lastName = 'Last name must be at least 2 characters.';
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
      onCreated(result);
      onClose();
      setForm({ email: '', firstName: '', lastName: '', middleName: '', role: 'DOCTOR' });
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/45 z-[1000] flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[10px] max-w-[520px] w-full mx-4 shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
      >
        {/* Modal header */}
        <div className="px-5 py-4 border-b border-[#D1D5E0] flex justify-between items-center">
          <span className="text-[15px] font-bold text-[#0D1117]">Create User Account</span>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-lg cursor-pointer text-[#6B7280] leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Modal body */}
        <div className="px-5 py-4">
          {errors.submit && (
            <div className="bg-[#FEE2E2] border border-[#EF4444] rounded-md px-3 py-2 mb-3.5 text-xs text-[#991B1B]">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" required>
              <input className={`${inputClassName} ${errors.firstName ? 'border-[#EF4444]' : 'border-[#D1D5E0]'}`} value={form.firstName} onChange={set('firstName')} maxLength={30} />
              {errors.firstName && <p className="text-xs text-[#991B1B] mt-1">{errors.firstName}</p>}
            </Field>
            <Field label="Last Name" required>
              <input className={`${inputClassName} ${errors.lastName ? 'border-[#EF4444]' : 'border-[#D1D5E0]'}`} value={form.lastName} onChange={set('lastName')} maxLength={30} />
              {errors.lastName && <p className="text-xs text-[#991B1B] mt-1">{errors.lastName}</p>}
            </Field>
          </div>

          <Field label="Middle Name">
            <input className={`${inputClassName} border-[#D1D5E0]`} value={form.middleName} onChange={set('middleName')} maxLength={30} placeholder="Optional" />
          </Field>

          <Field label="Email Address" required>
            <input className={`${inputClassName} ${errors.email ? 'border-[#EF4444]' : 'border-[#D1D5E0]'}`} type="email" value={form.email} onChange={set('email')} />
            {errors.email && <p className="text-xs text-[#991B1B] mt-1">{errors.email}</p>}
          </Field>

          <Field label="Role" required>
            <select
              value={form.role}
              onChange={set('role')}
              className={`${inputClassName} border-[#D1D5E0] appearance-none cursor-pointer`}
            >
              <option value="DOCTOR">Doctor</option>
              <option value="NURSE">Nurse</option>
            </select>
          </Field>

          <p className="text-[11px] text-[#6B7280] mt-[-6px]">
            A 16-character temporary password will be generated. Share it securely — it is shown only once.
          </p>
        </div>

        {/* Modal footer */}
        <div className="px-5 py-3 border-t border-[#D1D5E0] flex justify-end gap-2">
          <SecBtn onClick={onClose}>Cancel</SecBtn>
          <PrimaryBtn onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating…' : 'Create Account'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Temp Password Display ───────────────────
function TempPasswordToast({ result, onDismiss }: { result: CreateResult; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[2000] bg-white border border-[#22C55E] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] px-5 py-4 max-w-[380px]">
      <div className="flex justify-between items-start mb-2.5">
        <span className="text-[13px] font-bold text-[#14532D]">Password Generated</span>
        <button onClick={onDismiss} className="bg-transparent border-none cursor-pointer text-[#6B7280] text-base leading-none">×</button>
      </div>
      <p className="text-xs text-[#374151] mb-2.5">
        {result.user.firstName} {result.user.lastName} ({result.user.role}) — {result.user.email}
      </p>
      <div className="bg-[#F7F8FA] border border-[#D1D5E0] rounded-md px-3 py-2 mb-2.5">
        <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.6px] mb-1">
          Temporary Password (shown once)
        </p>
        <code className="text-[15px] font-bold text-[#0D1117] font-mono">
          {result.tempPassword}
        </code>
      </div>
      <p className="text-[11px] text-[#6B7280]">{result.note}</p>
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

  const fetchAccounts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiRequest<AccountsResponse>(`/accounts?page=${page}&limit=20`);
      setAccounts(res.data);
      setMeta(res.meta);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      await apiRequest(`/accounts/${id}`, { method: 'DELETE' });
      fetchAccounts(meta.page);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!confirm("Are you sure you want to reset this user's password? Their current password will be invalidated immediately.")) return;
    setResettingId(id);
    try {
      const res = await apiRequest<CreateResult>(`/accounts/${id}/reset-password`, { method: 'POST' });
      handleCreated(res);
    } catch (e: any) {
      alert(e.message);
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
          <h1 className="text-xl font-bold text-[#0D1117] mb-1">User Accounts</h1>
          <p className="text-xs text-[#6B7280]">
            {meta.total} account{meta.total !== 1 ? 's' : ''} total
          </p>
        </div>
        <PrimaryBtn onClick={() => setModalOpen(true)}>+ New Account</PrimaryBtn>
      </div>

      {/* Accounts table card */}
      <div className="bg-white border border-[#D1D5E0] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Card header */}
        <div className="bg-[#F7F8FA] border-b border-[#D1D5E0] px-3.5 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#374151]">
            All Accounts
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-8 text-center text-[#6B7280] text-[13px]">Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F7F8FA]">
                {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-2.5 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-[#374151] border-b border-[#D1D5E0]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account, i) => (
                <tr
                  key={account.id}
                  className={`hover:bg-[#EFF1F5] ${i < accounts.length - 1 ? 'border-b border-[#D1D5E0]' : ''}`}
                >
                  <td className="px-2.5 py-2 text-xs text-[#374151] font-medium">
                    {account.lastName}, {account.firstName}
                    {account.middleName ? ` ${account.middleName[0]}.` : ''}
                  </td>
                  <td className="px-2.5 py-2 text-xs text-[#374151]">
                    {account.email}
                  </td>
                  <td className="px-2.5 py-2">
                    <RoleBadge role={account.role} />
                  </td>
                  <td className="px-2.5 py-2">
                    <StatusBadge isActive={account.isActive} />
                  </td>
                  <td className="px-2.5 py-2 text-[11px] text-[#6B7280] font-mono">
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
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[13px] text-[#6B7280]">
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="px-3.5 py-2.5 border-t border-[#D1D5E0] flex gap-2 justify-end">
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => fetchAccounts(p)}
                className={`w-7 h-7 rounded-md text-[11px] font-semibold cursor-pointer border ${p === meta.page ? 'bg-[#0A6E5F] text-white border-[#085A4E]' : 'bg-[#F7F8FA] text-[#374151] border-[#D1D5E0]'}`}
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
