'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { Patient } from '@/types/patient';
import { cn } from '@/lib/utils';

const schema = z.object({
  lastName:        z.string().trim().min(1, 'Required').max(30),
  firstName:       z.string().trim().min(1, 'Required').max(30),
  middleName:      z.string().trim().max(30).optional().or(z.literal('')),
  extension:       z.string().trim().max(3).optional().or(z.literal('')),
  dateOfBirth:     z.string().min(1, 'Required').refine(v => new Date(v) < new Date(), { message: 'Must be in the past' }),
  sex:             z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Required' }),
  addressStreet:   z.string().trim().optional().or(z.literal('')),
  addressBarangay: z.string().trim().max(100).optional().or(z.literal('')),
  addressCity:     z.string().trim().max(100).optional().or(z.literal('')),
  addressRegion:   z.string().trim().max(100).optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface EditPatientModalProps {
  open: boolean;
  onClose: () => void;
  patient: Patient;
  onUpdated: (patient: Patient) => void;
}

const inputCn = (err?: boolean) =>
  cn(
    'h-[34px] w-full px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all focus:border-accent focus:shadow-accent-focus disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-2',
    err ? 'border-red-border' : 'border-border',
  );

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px] mb-1.5">
        {label} {required && <span className="text-red font-bold">*</span>}
      </label>
      {children}
      {error && <p className="text-[12px] text-red mt-1">{error}</p>}
    </div>
  );
}

export function EditPatientModal({ open, onClose, patient, onUpdated }: EditPatientModalProps) {
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      lastName:        patient.lastName,
      firstName:       patient.firstName,
      middleName:      patient.middleName ?? '',
      extension:       patient.extension ?? '',
      dateOfBirth:     patient.dateOfBirth.split('T')[0],
      sex:             patient.sex,
      addressStreet:   patient.addressStreet ?? '',
      addressBarangay: patient.addressBarangay ?? '',
      addressCity:     patient.addressCity ?? '',
      addressRegion:   patient.addressRegion ?? '',
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const updated = await apiRequest<Patient>(`/patients/${patient.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...data,
          middleName:      data.middleName  || undefined,
          extension:       data.extension   || undefined,
          addressStreet:   data.addressStreet   || undefined,
          addressBarangay: data.addressBarangay || undefined,
          addressCity:     data.addressCity     || undefined,
          addressRegion:   data.addressRegion   || undefined,
        }),
      });
      toast.success('Patient record updated.');
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['patient', patient.id] });
      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed.';
      setError('root.submit', { message: msg });
      toast.error(msg);
    }
  };

  if (!open) return null;

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center"
    >
      <div className="bg-surface border border-border rounded-[10px] w-[520px] max-[1439px]:w-[460px] max-h-[85vh] flex flex-col shadow-modal">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border shrink-0">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">Edit Patient Record</h2>
          <button onClick={onClose} aria-label="Close"
            className="w-6 h-6 rounded-btn hover:bg-surface-2 inline-flex items-center justify-center text-text-muted cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-[18px] py-4 overflow-y-auto flex-1">
          <fieldset disabled={isSubmitting} className="border-none p-0 m-0 w-full min-w-0">
            {(errors as any).root?.submit && (
            <div className="bg-red-bg border border-red-border rounded-btn px-3 py-2 mb-3 text-[12px] text-red">
              {(errors as any).root.submit.message}
            </div>
          )}
          <div className="grid grid-cols-2 max-[1023px]:grid-cols-1 gap-3">
            <Field label="First Name" required error={errors.firstName?.message}>
              <input className={inputCn(!!errors.firstName)} {...register('firstName')} maxLength={30} />
            </Field>
            <Field label="Last Name" required error={errors.lastName?.message}>
              <input className={inputCn(!!errors.lastName)} {...register('lastName')} maxLength={30} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_80px] max-[1023px]:grid-cols-1 gap-3">
            <Field label="Middle Name" error={errors.middleName?.message}>
              <input className={inputCn(!!errors.middleName)} {...register('middleName')} maxLength={30} placeholder="Optional" />
            </Field>
            <Field label="Ext." error={errors.extension?.message}>
              <input className={inputCn(!!errors.extension)} {...register('extension')} maxLength={3} placeholder="Jr." />
            </Field>
          </div>
          <div className="grid grid-cols-2 max-[1023px]:grid-cols-1 gap-3">
            <Field label="Date of Birth" required error={errors.dateOfBirth?.message}>
              <input type="date" className={inputCn(!!errors.dateOfBirth)} {...register('dateOfBirth')}
                max={new Date().toISOString().split('T')[0]} />
            </Field>
            <Field label="Sex" required error={errors.sex?.message}>
              <select className={cn(inputCn(!!errors.sex), 'cursor-pointer')} {...register('sex')}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>
          <div className="mt-1 mb-2 text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted">Address (Optional)</div>
          <Field label="Street">
            <input className={inputCn()} {...register('addressStreet')} placeholder="House No., Street" />
          </Field>
          <div className="grid grid-cols-2 max-[1023px]:grid-cols-1 gap-3">
            <Field label="Barangay">
              <input className={inputCn()} {...register('addressBarangay')} maxLength={100} />
            </Field>
            <Field label="City / Municipality">
              <input className={inputCn()} {...register('addressCity')} maxLength={100} />
            </Field>
          </div>
          <div className="grid grid-cols-2 max-[1023px]:grid-cols-1 gap-3">
            <Field label="Region">
              <input className={inputCn()} {...register('addressRegion')} maxLength={100} />
            </Field>
            <Field label="Country">
              <input value="Philippines" readOnly
                className="h-[34px] w-full px-2.5 bg-surface-2 border border-border rounded-btn text-[13px] text-text-muted outline-none" />
            </Field>
          </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border shrink-0">
          <button onClick={onClose}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all cursor-pointer disabled:bg-text-muted disabled:border-border-strong disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isSubmitting ? (
              <>
                <Spinner size="xs" className="text-white" />
                <span>Saving…</span>
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
