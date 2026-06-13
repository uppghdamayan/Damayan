'use client';

import { useState } from 'react';
import { useCreatePatient } from '@/hooks/usePatients';

interface NewPatientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (patient: unknown) => void;
}

const inputClassName = "h-[34px] w-full px-2.5 bg-white border rounded-md text-[13px] text-[#0D1117] outline-none box-border";
const errorClassName = "text-xs text-[#991B1B] mt-1";

function Field({
  label, required = false, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-[#374151] mb-1">
        {label} {required && <span className="text-[#991B1B]">*</span>}
      </label>
      {children}
      {error && <p className={errorClassName}>{error}</p>}
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
      className="fixed inset-0 bg-black/45 z-[1000] flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[10px] max-w-[560px] w-full mx-4 shadow-[0_20px_60px_rgba(0,0,0,0.2)] max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#D1D5E0] flex justify-between items-center shrink-0">
          <span className="text-[15px] font-bold text-[#0D1117]">Register New Patient</span>
          <button onClick={onClose} className="bg-transparent border-none text-xl cursor-pointer text-[#6B7280] leading-none" aria-label="Close">×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {errors.submit && (
            <div className="bg-[#FEE2E2] border border-[#EF4444] rounded-md px-3 py-2 mb-3.5 text-xs text-[#991B1B]">
              {errors.submit}
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Last Name" required error={errors.lastName}>
              <input className={`${inputClassName} ${errors.lastName ? 'border-[#EF4444]' : 'border-[#D1D5E0]'}`}
                value={form.lastName} onChange={set('lastName')} maxLength={30} />
            </Field>
            <Field label="First Name" required error={errors.firstName}>
              <input className={`${inputClassName} ${errors.firstName ? 'border-[#EF4444]' : 'border-[#D1D5E0]'}`}
                value={form.firstName} onChange={set('firstName')} maxLength={30} />
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_80px] gap-2.5">
            <Field label="Middle Name" error={errors.middleName}>
              <input className={`${inputClassName} border-[#D1D5E0]`} value={form.middleName} onChange={set('middleName')} maxLength={30} placeholder="Optional" />
            </Field>
            <Field label="Ext." error={errors.extension}>
              <input className={`${inputClassName} border-[#D1D5E0]`} value={form.extension} onChange={set('extension')} maxLength={3} placeholder="Jr." />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Date of Birth" required error={errors.dateOfBirth}>
              <input type="date" className={`${inputClassName} ${errors.dateOfBirth ? 'border-[#EF4444]' : 'border-[#D1D5E0]'}`}
                value={form.dateOfBirth} onChange={set('dateOfBirth')} max={new Date().toISOString().split('T')[0]} />
            </Field>
            <Field label="Sex" required error={errors.sex}>
              <select className={`${inputClassName} appearance-none cursor-pointer ${errors.sex ? 'border-[#EF4444]' : 'border-[#D1D5E0]'}`}
                value={form.sex} onChange={set('sex')}>
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>

          {/* Address section */}
          <div className="mt-1 mb-2.5 text-[10px] font-bold uppercase tracking-[0.6px] text-[#6B7280]">
            Address (Optional)
          </div>

          <Field label="Street">
            <input className={`${inputClassName} border-[#D1D5E0]`} value={form.addressStreet} onChange={set('addressStreet')} placeholder="House No., Street" />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Barangay">
              <input className={`${inputClassName} border-[#D1D5E0]`} value={form.addressBarangay} onChange={set('addressBarangay')} maxLength={100} />
            </Field>
            <Field label="City / Municipality">
              <input className={`${inputClassName} border-[#D1D5E0]`} value={form.addressCity} onChange={set('addressCity')} maxLength={100} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Region">
              <input className={`${inputClassName} border-[#D1D5E0]`} value={form.addressRegion} onChange={set('addressRegion')} maxLength={100} />
            </Field>
            <Field label="Country">
              <input className={`${inputClassName} bg-[#F7F8FA] text-[#6B7280] border-[#D1D5E0]`} value="Philippines" readOnly />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#D1D5E0] flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="h-7 px-3 bg-[#F7F8FA] text-[#374151] border border-[#D1D5E0] rounded-md text-[11px] font-semibold cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createPatient.isPending}
            className={`h-7 px-3.5 rounded-md text-[11px] font-semibold ${createPatient.isPending ? 'bg-[#6B7280] text-white border border-[#6B7280] cursor-not-allowed' : 'bg-[#0A6E5F] text-white border border-[#085A4E] cursor-pointer'}`}
          >
            {createPatient.isPending ? 'Saving…' : 'Register Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}
