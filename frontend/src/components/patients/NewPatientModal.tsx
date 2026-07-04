'use client';

import { useCreatePatient } from '@/hooks/usePatients';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface NewPatientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (patient: unknown) => void;
}

const inputClassName = "h-[34px] w-full px-2.5 bg-surface border border-border rounded-md text-[13px] text-text-primary outline-none box-border";

const patientSchema = z.object({
  lastName: z.string().trim().min(1, 'Last name is required').max(30, 'Max 30 characters'),
  firstName: z.string().trim().min(1, 'First name is required').max(30, 'Max 30 characters'),
  middleName: z.string().trim().max(30, 'Max 30 characters').optional().or(z.literal('')),
  extension: z.string().trim().max(3, 'Max 3 characters').optional().or(z.literal('')),
  dateOfBirth: z.string().min(1, 'Date of birth is required').refine((val) => {
    return new Date(val) < new Date();
  }, { message: 'Date of birth must be in the past' }),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Sex is required' }),
  addressStreet: z.string().trim().optional().or(z.literal('')),
  addressBarangay: z.string().trim().max(100, 'Max 100 characters').optional().or(z.literal('')),
  addressCity: z.string().trim().max(100, 'Max 100 characters').optional().or(z.literal('')),
  addressRegion: z.string().trim().max(100, 'Max 100 characters').optional().or(z.literal('')),
});

type FormData = z.infer<typeof patientSchema>;

function Field({
  label, required = false, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-text-secondary mb-1">
        {label} {required && <span className="text-red">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red mt-1">{error}</p>}
    </div>
  );
}

export function NewPatientModal({ open, onClose, onCreated }: NewPatientModalProps) {
  const createPatient = useCreatePatient();
  
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      lastName: '', firstName: '', middleName: '', extension: '',
      dateOfBirth: '', sex: undefined,
      addressStreet: '', addressBarangay: '', addressCity: '', addressRegion: '',
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const patient = await createPatient.mutateAsync({
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName || undefined,
        extension: data.extension || undefined,
        dateOfBirth: data.dateOfBirth,
        sex: data.sex,
        addressStreet: data.addressStreet || undefined,
        addressBarangay: data.addressBarangay || undefined,
        addressCity: data.addressCity || undefined,
        addressRegion: data.addressRegion || undefined,
      });
      reset();
      onCreated(patient);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred.';
      setError('root.submit', { type: 'manual', message: msg });
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 bg-black/45 z-[1000] flex items-center justify-center"
    >
      <div
        className="bg-surface rounded-[10px] max-w-[560px] w-full mx-4 shadow-modal max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex justify-between items-center shrink-0">
          <span className="text-[15px] font-bold text-text-primary">Register New Patient</span>
          <button onClick={handleClose} className="bg-transparent border-none text-xl cursor-pointer text-text-muted leading-none" aria-label="Close">×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {errors.root?.submit && (
            <div className="bg-red-bg border border-red-border rounded-md px-3 py-2 mb-3.5 text-xs text-red">
              {errors.root.submit.message}
            </div>
          )}

          {/* Name row */}
          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-2.5">
            <Field label="Last Name" required error={errors.lastName?.message}>
              <input className={`${inputClassName} ${errors.lastName ? 'border-red-border' : 'border-border'}`}
                {...register('lastName')} maxLength={30} />
            </Field>
            <Field label="First Name" required error={errors.firstName?.message}>
              <input className={`${inputClassName} ${errors.firstName ? 'border-red-border' : 'border-border'}`}
                {...register('firstName')} maxLength={30} />
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_80px] @max-[1023px]:grid-cols-1 gap-2.5">
            <Field label="Middle Name" error={errors.middleName?.message}>
              <input className={`${inputClassName} border-border`} {...register('middleName')} maxLength={30} placeholder="Optional" />
            </Field>
            <Field label="Ext." error={errors.extension?.message}>
              <input className={`${inputClassName} border-border`} {...register('extension')} maxLength={3} placeholder="Jr." />
            </Field>
          </div>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-2.5">
            <Field label="Date of Birth" required error={errors.dateOfBirth?.message}>
              <input type="date" className={`${inputClassName} ${errors.dateOfBirth ? 'border-red-border' : 'border-border'}`}
                {...register('dateOfBirth')} max={new Date().toISOString().split('T')[0]} />
            </Field>
            <Field label="Sex" required error={errors.sex?.message}>
              <select className={`${inputClassName} appearance-none cursor-pointer ${errors.sex ? 'border-red-border' : 'border-border'}`}
                {...register('sex')}>
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>

          {/* Address section */}
          <div className="mt-1 mb-2.5 text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted">
            Address (Optional)
          </div>

          <Field label="Street">
            <input className={`${inputClassName} border-border`} {...register('addressStreet')} placeholder="House No., Street" />
          </Field>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-2.5">
            <Field label="Barangay">
              <input className={`${inputClassName} border-border`} {...register('addressBarangay')} maxLength={100} />
            </Field>
            <Field label="City / Municipality">
              <input className={`${inputClassName} border-border`} {...register('addressCity')} maxLength={100} />
            </Field>
          </div>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-2.5">
            <Field label="Region">
              <input className={`${inputClassName} border-border`} {...register('addressRegion')} maxLength={100} />
            </Field>
            <Field label="Country">
              <input className={`${inputClassName} bg-surface-2 text-text-muted border-border`} value="Philippines" readOnly />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <button onClick={handleClose} className="h-7 px-3 bg-surface-2 text-text-secondary border border-border rounded-md text-[11px] font-semibold cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || createPatient.isPending}
            className={`h-7 px-3.5 rounded-md text-[11px] font-semibold ${isSubmitting || createPatient.isPending ? 'bg-text-muted text-white border border-text-muted cursor-not-allowed' : 'bg-accent text-white border border-accent-hover cursor-pointer'}`}
          >
            {isSubmitting || createPatient.isPending ? 'Saving…' : 'Register Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}

