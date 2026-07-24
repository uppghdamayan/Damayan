'use client';

import { useCreatePatient } from '@/hooks/usePatients';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AddressCombobox } from './AddressCombobox';
import {
  getRegionNames,
  getCitiesByRegion,
  getBarangaysByCity,
} from '@/lib/ph-locations';

interface NewPatientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (patient: unknown) => void;
}

const inputClassName =
  'h-[34px] w-full px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none box-border transition-all focus:border-accent focus:shadow-accent-focus';

const patientSchema = z.object({
  lastName: z.string().trim().min(1, 'Last name is required').max(30, 'Max 30 characters'),
  firstName: z.string().trim().min(1, 'First name is required').max(30, 'Max 30 characters'),
  middleName: z.string().trim().max(30, 'Max 30 characters').optional().or(z.literal('')),
  extension: z.string().trim().max(3, 'Max 3 characters').optional().or(z.literal('')),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((val) => new Date(val) < new Date(), { message: 'Date of birth must be in the past' }),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Sex is required' }),
  addressStreet: z.string().trim().min(1, 'Street address is required'),
  addressBarangay: z
    .string()
    .trim()
    .min(1, 'Barangay is required')
    .max(100, 'Max 100 characters'),
  addressCity: z
    .string()
    .trim()
    .min(1, 'City / Municipality is required')
    .max(100, 'Max 100 characters'),
  addressRegion: z
    .string()
    .trim()
    .min(1, 'Region is required')
    .max(100, 'Max 100 characters'),
});

type FormData = z.infer<typeof patientSchema>;

function Field({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px] mb-1">
        {label} {required && <span className="text-red font-bold">*</span>}
      </label>
      {children}
      {error && <p className="text-[12px] text-red mt-1">{error}</p>}
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
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      lastName: '',
      firstName: '',
      middleName: '',
      extension: '',
      dateOfBirth: '',
      sex: undefined,
      addressStreet: '',
      addressBarangay: '',
      addressCity: '',
      addressRegion: '',
    },
  });

  const selectedRegion = watch('addressRegion');
  const selectedCity = watch('addressCity');

  const regionOptions = getRegionNames();
  const cityOptions = getCitiesByRegion(selectedRegion);
  const barangayOptions = getBarangaysByCity(selectedCity, selectedRegion);

  const onSubmit = async (data: FormData) => {
    try {
      const patient = await createPatient.mutateAsync({
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName || undefined,
        extension: data.extension || undefined,
        dateOfBirth: data.dateOfBirth,
        sex: data.sex,
        addressStreet: data.addressStreet,
        addressBarangay: data.addressBarangay,
        addressCity: data.addressCity,
        addressRegion: data.addressRegion,
      });
      toast.success('Patient registered successfully.');
      reset();
      onCreated(patient);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register patient.';
      setError('root.submit', { type: 'manual', message: msg });
      toast.error(msg);
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
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[1000] flex items-center justify-center"
    >
      <div className="bg-surface border border-border rounded-[10px] max-w-[560px] w-full mx-4 shadow-modal max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-text-primary">Register New Patient</span>
            <span className="text-[10px] font-semibold bg-accent-light text-accent border border-accent/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              New Record
            </span>
          </div>
          <button
            onClick={handleClose}
            className="bg-transparent border-none text-xl cursor-pointer text-text-muted hover:text-text-primary leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {errors.root?.submit && (
            <div className="bg-red-bg border border-red-border rounded-btn px-3 py-2 mb-3.5 text-xs text-red font-medium">
              {errors.root.submit.message}
            </div>
          )}

          {/* Section: Personal Information */}
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted border-b border-border/60 pb-1">
            Personal Information
          </div>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-2.5">
            <Field label="Last Name" required error={errors.lastName?.message}>
              <input
                className={`${inputClassName} ${errors.lastName ? 'border-red-border' : 'border-border'}`}
                {...register('lastName')}
                maxLength={30}
                placeholder="e.g. Dela Cruz"
              />
            </Field>
            <Field label="First Name" required error={errors.firstName?.message}>
              <input
                className={`${inputClassName} ${errors.firstName ? 'border-red-border' : 'border-border'}`}
                {...register('firstName')}
                maxLength={30}
                placeholder="e.g. Juan"
              />
            </Field>
          </div>

          <div className="grid grid-cols-[1fr_80px] @max-[1023px]:grid-cols-1 gap-2.5">
            <Field label="Middle Name" error={errors.middleName?.message}>
              <input
                className={`${inputClassName} border-border`}
                {...register('middleName')}
                maxLength={30}
                placeholder="Optional"
              />
            </Field>
            <Field label="Ext." error={errors.extension?.message}>
              <input
                className={`${inputClassName} border-border`}
                {...register('extension')}
                maxLength={3}
                placeholder="Jr."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-2.5">
            <Field label="Date of Birth" required error={errors.dateOfBirth?.message}>
              <input
                type="date"
                className={`${inputClassName} ${errors.dateOfBirth ? 'border-red-border' : 'border-border'}`}
                {...register('dateOfBirth')}
                max={new Date().toISOString().split('T')[0]}
              />
            </Field>
            <Field label="Sex" required error={errors.sex?.message}>
              <select
                className={`${inputClassName} appearance-none cursor-pointer ${
                  errors.sex ? 'border-red-border' : 'border-border'
                }`}
                {...register('sex')}
              >
                <option value="">— Select —</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
          </div>

          {/* Section: Address Information */}
          <div className="mt-4 mb-2.5 text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted border-b border-border/60 pb-1 flex justify-between items-center">
            <span>Address Information</span>
            <span className="text-[10px] font-medium text-red lowercase font-sans">* required</span>
          </div>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-2.5 mb-3">
            <Controller
              name="addressRegion"
              control={control}
              render={({ field }) => (
                <AddressCombobox
                  label="Region"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={regionOptions}
                  placeholder="Select or type region..."
                  error={errors.addressRegion?.message}
                />
              )}
            />
            <Controller
              name="addressCity"
              control={control}
              render={({ field }) => (
                <AddressCombobox
                  label="City / Municipality"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={cityOptions}
                  placeholder="Select or type city..."
                  error={errors.addressCity?.message}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 @max-[1023px]:grid-cols-1 gap-2.5 mb-3">
            <Controller
              name="addressBarangay"
              control={control}
              render={({ field }) => (
                <AddressCombobox
                  label="Barangay"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={barangayOptions}
                  placeholder="Select or type barangay..."
                  error={errors.addressBarangay?.message}
                />
              )}
            />
            <Field label="Country">
              <input
                className={`${inputClassName} bg-surface-2 text-text-muted border-border cursor-not-allowed`}
                value="Philippines"
                readOnly
              />
            </Field>
          </div>

          <Field label="Street / House No." required error={errors.addressStreet?.message}>
            <input
              className={`${inputClassName} ${errors.addressStreet ? 'border-red-border' : 'border-border'}`}
              {...register('addressStreet')}
              placeholder="e.g. 123 Taft Ave, Bldg A, Unit 4B"
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 shrink-0">
          <button
            onClick={handleClose}
            className="h-8 px-3 bg-surface-2 text-text-secondary border border-border rounded-btn text-[11px] font-semibold cursor-pointer hover:bg-surface-3 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || createPatient.isPending}
            className={`h-8 px-4 rounded-btn text-[11px] font-semibold transition-all shadow-btn-primary ${
              isSubmitting || createPatient.isPending
                ? 'bg-text-muted text-white border border-text-muted cursor-not-allowed'
                : 'bg-accent text-white border border-accent-hover hover:bg-accent-hover cursor-pointer'
            }`}
          >
            {isSubmitting || createPatient.isPending ? 'Registering...' : 'Register Patient'}
          </button>
        </div>
      </div>
    </div>
  );
}
