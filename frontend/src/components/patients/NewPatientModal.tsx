'use client';

import { useState } from 'react';
import { useCreatePatient } from '@/hooks/usePatients';

interface NewPatientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (patient: unknown) => void;
}

const inputStyle: React.CSSProperties = {
  height: 34, width: '100%', padding: '0 10px',
  background: '#FFFFFF', border: '1px solid #D1D5E0',
  borderRadius: 6, fontSize: 13, color: '#0D1117',
  outline: 'none', boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  fontSize: 12, color: '#991B1B', marginTop: 4,
};

function Field({
  label, required = false, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
        {label} {required && <span style={{ color: '#991B1B' }}>*</span>}
      </label>
      {children}
      {error && <p style={errorStyle}>{error}</p>}
    </div>
  );
}

type FormData = {
  lastName: string;
  firstName: string;
  middleName: string;
  extension: string;
  dateOfBirth: string;
  sex: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressRegion: string;
};

const initial: FormData = {
  lastName: '', firstName: '', middleName: '', extension: '',
  dateOfBirth: '', sex: '',
  addressStreet: '', addressBarangay: '', addressCity: '', addressRegion: '',
};

export function NewPatientModal({ open, onClose, onCreated }: NewPatientModalProps) {
  const [form, setForm] = useState<FormData>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'submit', string>>>({});
  const createPatient = useCreatePatient();

  const set = (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.lastName.trim()  || form.lastName.length  > 30) e.lastName  = 'Last name is required (max 30 characters).';
    if (!form.firstName.trim() || form.firstName.length > 30) e.firstName = 'First name is required (max 30 characters).';
    if (form.middleName.length > 30) e.middleName = 'Max 30 characters.';
    if (form.extension.length  > 3)  e.extension  = 'Max 3 characters.';
    if (!form.dateOfBirth) {
      e.dateOfBirth = 'Date of birth is required.';
    } else if (new Date(form.dateOfBirth) >= new Date()) {
      e.dateOfBirth = 'Date of birth must be in the past.';
    }
    if (!form.sex) e.sex = 'Sex is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      const patient = await createPatient.mutateAsync({
        lastName:        form.lastName.trim(),
        firstName:       form.firstName.trim(),
        middleName:      form.middleName.trim() || undefined,
        extension:       form.extension.trim()  || undefined,
        dateOfBirth:     form.dateOfBirth,
        sex:             form.sex,
        addressStreet:   form.addressStreet.trim()   || undefined,
        addressBarangay: form.addressBarangay.trim() || undefined,
        addressCity:     form.addressCity.trim()     || undefined,
        addressRegion:   form.addressRegion.trim()   || undefined,
      });
      setForm(initial);
      setErrors({});
      onCreated(patient);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred.';
      setErrors({ submit: msg });
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
          background: '#FFFFFF', borderRadius: 10, maxWidth: 560,
          width: '100%', margin: '0 16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #D1D5E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0D1117' }}>Register New Patient</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280', lineHeight: 1 }} aria-label="Close">×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {errors.submit && (
            <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#991B1B' }}>
              {errors.submit}
            </div>
          )}

          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Last Name" required error={errors.lastName}>
              <input style={{ ...inputStyle, borderColor: errors.lastName ? '#EF4444' : '#D1D5E0' }}
                value={form.lastName} onChange={set('lastName')} maxLength={30} />
            </Field>
            <Field label="First Name" required error={errors.firstName}>
              <input style={{ ...inputStyle, borderColor: errors.firstName ? '#EF4444' : '#D1D5E0' }}
                value={form.firstName} onChange={set('firstName')} maxLength={30} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
            <Field label="Middle Name" error={errors.middleName}>
              <input style={inputStyle} value={form.middleName} onChange={set('middleName')} maxLength={30} placeholder="Optional" />
            </Field>
            <Field label="Ext." error={errors.extension}>
              <input style={inputStyle} value={form.extension} onChange={set('extension')} maxLength={3} placeholder="Jr." />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Date of Birth" required error={errors.dateOfBirth}>
              <input type="date" style={{ ...inputStyle, borderColor: errors.dateOfBirth ? '#EF4444' : '#D1D5E0' }}
                value={form.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().split('T')[0]} />
            </Field>
            <Field label="Sex" required error={errors.sex}>
              <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', borderColor: errors.sex ? '#EF4444' : '#D1D5E0' }}
                value={form.sex} onChange={set('sex')}>
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>

          {/* Address section */}
          <div style={{ marginTop: 4, marginBottom: 10, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6B7280' }}>
            Address (Optional)
          </div>

          <Field label="Street">
            <input style={inputStyle} value={form.addressStreet} onChange={set('addressStreet')} placeholder="House No., Street" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Barangay">
              <input style={inputStyle} value={form.addressBarangay} onChange={set('addressBarangay')} maxLength={100} />
            </Field>
            <Field label="City / Municipality">
              <input style={inputStyle} value={form.addressCity} onChange={set('addressCity')} maxLength={100} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Region">
              <input style={inputStyle} value={form.addressRegion} onChange={set('addressRegion')} maxLength={100} />
            </Field>
            <Field label="Country">
              <input style={{ ...inputStyle, background: '#F7F8FA', color: '#6B7280' }} value="Philippines" readOnly />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #D1D5E0', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ height: 28, padding: '0 12px', background: '#F7F8FA', color: '#374151', border: '1px solid #D1D5E0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createPatient.isPending}
            style={{ height: 28, padding: '0 14px', background: createPatient.isPending ? '#6B7280' : '#0A6E5F', color: '#FFFFFF', border: `1px solid ${createPatient.isPending ? '#6B7280' : '#085A4E'}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: createPatient.isPending ? 'not-allowed' : 'pointer' }}
          >
            {createPatient.isPending ? 'Saving…' : 'Register Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}
