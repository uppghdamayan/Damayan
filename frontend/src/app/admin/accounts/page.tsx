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
const roleBadgeStyle = (role: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    ADMIN:  { background: '#EDE9FE', color: '#4C1D95', border: '1px solid #8B5CF6' },
    DOCTOR: { background: '#D4EDE9', color: '#085A4E', border: '1px solid #0A6E5F' },
    NURSE:  { background: '#DBEAFE', color: '#1E3A8A', border: '1px solid #3B82F6' },
  };
  return {
    ...( map[role] ?? {}),
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    padding: '2px 6px',
    borderRadius: 4,
    display: 'inline-block',
  };
};

const statusBadgeStyle = (isActive: boolean): React.CSSProperties => isActive
  ? { background: '#DCFCE7', color: '#14532D', border: '1px solid #22C55E', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }
  : { background: '#F7F8FA', color: '#6B7280', border: '1px solid #D1D5E0', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 6px', borderRadius: 4, display: 'inline-block' };

// ─── Button ───────────────────────────────────
const PrimaryBtn = ({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      height: 28,
      padding: '0 14px',
      background: disabled ? '#6B7280' : '#0A6E5F',
      color: '#FFFFFF',
      border: `1px solid ${disabled ? '#6B7280' : '#085A4E'}`,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: '0 2px 4px rgba(10,110,95,0.15)',
      flexShrink: 0,
    }}
  >
    {children}
  </button>
);

const SecBtn = ({ children, onClick, danger = false }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) => (
  <button
    onClick={onClick}
    style={{
      height: 28,
      padding: '0 12px',
      background: danger ? '#FEE2E2' : '#F7F8FA',
      color: danger ? '#991B1B' : '#374151',
      border: `1px solid ${danger ? '#EF4444' : '#D1D5E0'}`,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

// ─── Field ────────────────────────────────────
const Field = ({
  label, required = false, children,
}: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
      {label} {required && <span style={{ color: '#991B1B' }}>*</span>}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  height: 34, width: '100%', padding: '0 10px',
  background: '#FFFFFF', border: '1px solid #D1D5E0',
  borderRadius: 6, fontSize: 13, color: '#0D1117',
  outline: 'none', boxSizing: 'border-box',
};

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
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 10, maxWidth: 520, width: '100%',
          margin: '0 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Modal header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #D1D5E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0D1117' }}>Create User Account</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280', lineHeight: 1 }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '16px 20px' }}>
          {errors.submit && (
            <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#991B1B' }}>
              {errors.submit}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="First Name" required>
              <input style={{ ...inputStyle, borderColor: errors.firstName ? '#EF4444' : '#D1D5E0' }} value={form.firstName} onChange={set('firstName')} maxLength={30} />
              {errors.firstName && <p style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>{errors.firstName}</p>}
            </Field>
            <Field label="Last Name" required>
              <input style={{ ...inputStyle, borderColor: errors.lastName ? '#EF4444' : '#D1D5E0' }} value={form.lastName} onChange={set('lastName')} maxLength={30} />
              {errors.lastName && <p style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>{errors.lastName}</p>}
            </Field>
          </div>

          <Field label="Middle Name">
            <input style={inputStyle} value={form.middleName} onChange={set('middleName')} maxLength={30} placeholder="Optional" />
          </Field>

          <Field label="Email Address" required>
            <input style={{ ...inputStyle, borderColor: errors.email ? '#EF4444' : '#D1D5E0' }} type="email" value={form.email} onChange={set('email')} />
            {errors.email && <p style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>{errors.email}</p>}
          </Field>

          <Field label="Role" required>
            <select
              value={form.role}
              onChange={set('role')}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
            >
              <option value="DOCTOR">Doctor</option>
              <option value="NURSE">Nurse</option>
            </select>
          </Field>

          <p style={{ fontSize: 11, color: '#6B7280', marginTop: -6 }}>
            A 16-character temporary password will be generated. Share it securely — it is shown only once.
          </p>
        </div>

        {/* Modal footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #D1D5E0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
    <div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
        background: '#FFFFFF', border: '1px solid #22C55E', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '16px 20px',
        maxWidth: 380,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#14532D' }}>Password Generated</span>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <p style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
        {result.user.firstName} {result.user.lastName} ({result.user.role}) — {result.user.email}
      </p>
      <div style={{ background: '#F7F8FA', border: '1px solid #D1D5E0', borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
          Temporary Password (shown once)
        </p>
        <code style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', fontFamily: "'IBM Plex Mono', monospace" }}>
          {result.tempPassword}
        </code>
      </div>
      <p style={{ fontSize: 11, color: '#6B7280' }}>{result.note}</p>
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
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
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

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this account? The user will lose access immediately.')) return;
    setDeactivatingId(id);
    try {
      await apiRequest(`/accounts/${id}`, { method: 'DELETE' });
      fetchAccounts(meta.page);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeactivatingId(null);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0D1117', marginBottom: 4 }}>User Accounts</h1>
          <p style={{ fontSize: 12, color: '#6B7280' }}>
            {meta.total} account{meta.total !== 1 ? 's' : ''} total
          </p>
        </div>
        <PrimaryBtn onClick={() => setModalOpen(true)}>+ New Account</PrimaryBtn>
      </div>

      {/* Accounts table card */}
      <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {/* Card header */}
        <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>
            All Accounts
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F8FA' }}>
                {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151', borderBottom: '1px solid #D1D5E0' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account, i) => (
                <tr
                  key={account.id}
                  style={{ borderBottom: i < accounts.length - 1 ? '1px solid #D1D5E0' : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EFF1F5')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151', fontWeight: 500 }}>
                    {account.lastName}, {account.firstName}
                    {account.middleName ? ` ${account.middleName[0]}.` : ''}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151' }}>
                    {account.email}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={roleBadgeStyle(account.role)}>{account.role}</span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={statusBadgeStyle(account.isActive)}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {new Date(account.createdAt).toLocaleDateString('en-PH')}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {account.isActive && account.role !== 'ADMIN' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <SecBtn
                          onClick={() => handleResetPassword(account.id)}
                        >
                          {resettingId === account.id ? 'Resetting…' : 'Reset Password'}
                        </SecBtn>
                        <SecBtn
                          onClick={() => handleDeactivate(account.id)}
                          danger
                        >
                          {deactivatingId === account.id ? 'Deactivating…' : 'Deactivate'}
                        </SecBtn>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid #D1D5E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => fetchAccounts(p)}
                style={{
                  height: 28, width: 28,
                  background: p === meta.page ? '#0A6E5F' : '#F7F8FA',
                  color: p === meta.page ? '#FFFFFF' : '#374151',
                  border: `1px solid ${p === meta.page ? '#085A4E' : '#D1D5E0'}`,
                  borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
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
