# Phase 4: Patient Management — Implementation Guide

**Project:** DAMAYAN EMR  
**Stack:** Next.js 16 · NestJS 11 · Supabase · Prisma · TypeScript · Tailwind CSS · shadcn/ui  
**Dependencies:** Phase 3 complete (Auth, RBAC, Admin Provisioning all working)  
**Goal:** Full patient CRUD API, sidebar patient list, new patient modal, patient dashboard shell

---

## What Is Already Done

Before writing a single line of code, read this carefully. The following is **already implemented** and must not be recreated or overwritten:

### Backend (already complete)
- `backend/src/patients/patients.controller.ts` — `GET /patients`, `POST /patients`, `GET /patients/:id`, `PATCH /patients/:id`
- `backend/src/patients/patients.service.ts` — `findAll` (with search/pagination), `findOne`, `create` (with patient code generator), `update`
- `backend/src/patients/dto/create-patient.dto.ts` and `update-patient.dto.ts`
- `backend/src/patients/patients.module.ts`
- Patient code generation: `PT-0001` sequential format — already in service
- `GET /patients` returns `allergies` field surfaced from the most recent initial note

### Frontend (already complete)
- `frontend/src/types/patient.ts` — `Patient` and `PatientsResponse` interfaces
- `frontend/src/hooks/usePatients.ts` — `usePatients`, `usePatient`, `useCreatePatient`
- `frontend/src/lib/patient-utils.ts` — `calcAge`, `displayName`, `initials`, `groupByLetter`
- `frontend/src/stores/patientStore.ts` — `activePatient`, `setActivePatient`
- `frontend/src/components/layout/Sidebar.tsx` — full sidebar with search, alphabetical grouping, allergy indicator, prefetch on hover
- `frontend/src/components/patients/NewPatientModal.tsx` — React Hook Form + Zod, full validation, POST /patients integration
- `frontend/src/components/patients/PatientBanner.tsx` and `PatientBannerSkeleton.tsx`
- `frontend/src/app/dashboard/[patientId]/layout.tsx` — `PatientWorkspaceLayout` with `ScreenNav` and `PatientContext`
- `frontend/src/app/dashboard/[patientId]/page.tsx` — patient dashboard page with `PatientBanner`, `VitalsStripEmpty`, `ProblemListCardEmpty`, `MedicationListCardEmpty`, `VisitHistoryCard`
- `frontend/src/app/dashboard/page.tsx` — index page with empty state and "New Patient" CTA

**Phase 4 is therefore largely already built.** The remaining work is fixing gaps, wiring loose ends, and ensuring everything is correctly integrated end-to-end.

---

## Remaining Work

### 1. Backend — Verify and Harden

#### 1.1 Confirm PatientsModule is registered in AppModule
Check `backend/src/app.module.ts`. `PatientsModule` must appear in the `imports` array. It already does — no action needed unless a build error says otherwise.

#### 1.2 Add `temporaryPassword` to schema (migration already done)
The migration `20260613034747_add_requires_password_change` added `requires_password_change`. The `schema.prisma` already includes `temporaryPassword String? @map("temporary_password") @db.VarChar(50)`. Confirm `npx prisma generate` has been run so the Prisma client reflects this column.

#### 1.3 Patient code race condition — make it safe
The current `generatePatientCode()` in `patients.service.ts` finds the last-created patient and increments. Under concurrent requests this can produce duplicate codes. Wrap in a Prisma transaction or add a DB-level unique constraint retry:

```typescript
// backend/src/patients/patients.service.ts
// Replace generatePatientCode with:
private async generatePatientCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 5) {
    const last = await this.prisma.patient.findFirst({
      orderBy: { patientCode: 'desc' },
      select: { patientCode: true },
    });
    const next = last
      ? parseInt(last.patientCode.replace('PT-', ''), 10) + 1
      : 1;
    const code = `PT-${String(next).padStart(4, '0')}`;
    // Check it doesn't already exist (handles gaps from deletions)
    const exists = await this.prisma.patient.findUnique({
      where: { patientCode: code },
    });
    if (!exists) return code;
    attempts++;
  }
  throw new Error('Failed to generate unique patient code after 5 attempts.');
}
```

#### 1.4 Soft-delete endpoint (PATCH /:id/deactivate)
The schema has `isActive: boolean`. Add a deactivate endpoint for Admin use. Add to `patients.controller.ts`:

```typescript
@Patch(':id/deactivate')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@ApiOperation({ summary: 'Deactivate patient record (Admin only)' })
async deactivate(@Param('id') id: string) {
  return this.patientsService.deactivate(id);
}
```

Add to `patients.service.ts`:

```typescript
async deactivate(id: string) {
  await this.findOne(id); // throws if not found
  return this.prisma.patient.update({
    where: { id },
    data: { isActive: false },
  });
}
```

#### 1.5 Confirm Swagger tags are correct
`patients.controller.ts` already has `@ApiTags('Patients')` and `@ApiBearerAuth('access_token')`. No changes needed.

---

### 2. Frontend — Gaps to Close

#### 2.1 NewPatientModal — Address fields use plain inputs, not dropdowns
The MVP spec calls for Barangay and City as searchable comboboxes from Philippine address data. For Phase 4, plain text inputs are acceptable (as already implemented). Add a `TODO` comment noting that Phase 13 will upgrade these to searchable comboboxes:

```tsx
{/* TODO Phase 13: upgrade to searchable Combobox with PSGC data */}
<input className={...} {...register('addressBarangay')} />
```

No functional change needed now.

#### 2.2 NewPatientModal — optimistic update after creation
In `useCreatePatient` (already in `usePatients.ts`), `onSuccess` calls `qc.invalidateQueries({ queryKey: ['patients'] })`. This is correct. However the modal's `onCreated` callback currently does not navigate to the new patient. Update `dashboard/page.tsx` — it already does `router.push(`/dashboard/${(p as Patient).id}`)`. Verify the `onCreated` prop in `Sidebar.tsx` also calls `handleSelect(p as Patient)` before navigation. Current code does this — no change needed.

#### 2.3 PatientBanner — missing edit button
The `PatientBanner` component renders demographics but has no edit action. Add an edit button (Doctor + Admin only) that opens a `EditPatientModal`. This is a **required deliverable for Phase 4**.

**Create `frontend/src/components/patients/EditPatientModal.tsx`:**

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X } from 'lucide-react';
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
    'h-[34px] w-full px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all focus:border-accent focus:shadow-accent-focus',
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
          {(errors as any).root?.submit && (
            <div className="bg-red-bg border border-red-border rounded-btn px-3 py-2 mb-3 text-[12px] text-red">
              {(errors as any).root.submit.message}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Last Name" required error={errors.lastName?.message}>
              <input className={inputCn(!!errors.lastName)} {...register('lastName')} maxLength={30} />
            </Field>
            <Field label="First Name" required error={errors.firstName?.message}>
              <input className={inputCn(!!errors.firstName)} {...register('firstName')} maxLength={30} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <Field label="Middle Name" error={errors.middleName?.message}>
              <input className={inputCn(!!errors.middleName)} {...register('middleName')} maxLength={30} placeholder="Optional" />
            </Field>
            <Field label="Ext." error={errors.extension?.message}>
              <input className={inputCn(!!errors.extension)} {...register('extension')} maxLength={3} placeholder="Jr." />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Barangay">
              <input className={inputCn()} {...register('addressBarangay')} maxLength={100} />
            </Field>
            <Field label="City / Municipality">
              <input className={inputCn()} {...register('addressCity')} maxLength={100} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Region">
              <input className={inputCn()} {...register('addressRegion')} maxLength={100} />
            </Field>
            <Field label="Country">
              <input className={inputCn()} value="Philippines" readOnly
                className="h-[34px] w-full px-2.5 bg-surface-2 border border-border rounded-btn text-[13px] text-text-muted outline-none" />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border shrink-0">
          <button onClick={onClose}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all cursor-pointer disabled:bg-text-muted disabled:border-border-strong disabled:cursor-not-allowed">
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 2.4 PatientBanner — wire in the edit button and modal

Update `frontend/src/components/patients/PatientBanner.tsx` to:
1. Import `EditPatientModal` and `useAuthStore`
2. Show an "Edit" button in the banner only for Doctor and Admin roles
3. Open the modal on click

Add the following to `PatientBanner.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { calcAge, initials } from '@/lib/patient-utils';
import { useAuthStore } from '@/stores/authStore';
import { usePatientStore } from '@/stores/patientStore';
import { EditPatientModal } from './EditPatientModal';
import { Pencil } from 'lucide-react';
import type { Patient } from '@/types/patient';

export function PatientBanner({ patient }: { patient: Patient }) {
  const { user } = useAuthStore();
  const { setActivePatient } = usePatientStore();
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  // ... existing render logic unchanged ...

  return (
    <div className="bg-surface border border-border rounded-card p-4 flex gap-5 items-stretch flex-wrap shadow-card">
      {/* All existing columns unchanged */}
      
      {/* Edit button — top-right of banner */}
      {canEdit && (
        <button
          onClick={() => setEditOpen(true)}
          title="Edit patient demographics"
          className="absolute top-3 right-3 h-[28px] px-2.5 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
      )}

      {/* Position the outer div relatively so the edit button can anchor */}
      {/* Add relative to the outer wrapper */}

      <EditPatientModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        patient={patient}
        onUpdated={(updated) => {
          setActivePatient(updated);
          setEditOpen(false);
        }}
      />
    </div>
  );
}
```

**Important:** Make the outer `<div>` of `PatientBanner` `relative` (add `relative` to its className) so the absolutely positioned edit button anchors correctly.

#### 2.5 Patient dashboard — wire `PatientContext` to child components

`frontend/src/app/dashboard/[patientId]/layout.tsx` already provides `PatientProvider`. The `PatientBanner` in `page.tsx` currently uses `usePatient` directly. This is fine — leave it as is to avoid duplicate fetch.

#### 2.6 Validate sidebar search debounce

`Sidebar.tsx` currently passes `search` directly to `usePatients`. Add a debounce to prevent hitting the API on every keystroke. **Install `use-debounce`** if not present, or implement inline:

```tsx
// In Sidebar.tsx, replace the direct search state with debounced:
const [search, setSearch] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(search), 350);
  return () => clearTimeout(t);
}, [search]);

const { data, isLoading } = usePatients(debouncedSearch, 1, 200);
```

#### 2.7 Dashboard index page — NewPatientModal navigation

`frontend/src/app/dashboard/page.tsx` already opens `NewPatientModal` and on creation calls `router.push(`/dashboard/${(p as Patient).id}`)`. Verify that after the push, `setActivePatient` is also called so the topbar chip shows immediately. Update `onCreated`:

```tsx
onCreated={(p) => {
  const patient = p as Patient;
  setNewPatientOpen(false);
  // Import and call setActivePatient from usePatientStore
  usePatientStore.getState().setActivePatient(patient);
  router.push(`/dashboard/${patient.id}`);
}}
```

Import `usePatientStore` at the top:
```tsx
import { usePatientStore } from '@/stores/patientStore';
```

#### 2.8 Sidebar patient list — handle empty state after search

Current code shows "No patients found." as a plain paragraph. Make it slightly more polished:

```tsx
{!isLoading && patients.length === 0 && (
  <div className="px-3.5 py-6 text-center">
    <p className="text-[12px] text-text-muted">
      {search ? `No patients match "${search}"` : 'No patients registered yet.'}
    </p>
    {!search && canCreatePatient && (
      <button
        onClick={() => setNewPatientOpen(true)}
        className="mt-2 text-[11px] text-accent hover:underline cursor-pointer"
      >
        Register first patient →
      </button>
    )}
  </div>
)}
```

---

### 3. Validation Rules (Enforcement Checklist)

These must all pass in `NewPatientModal` and `EditPatientModal`. Verify Zod schemas enforce:

| Field | Rule | Status |
|---|---|---|
| `lastName` | Required, max 30 chars | ✅ in NewPatientModal |
| `firstName` | Required, max 30 chars | ✅ in NewPatientModal |
| `middleName` | Optional, max 30 chars | ✅ in NewPatientModal |
| `extension` | Optional, max 3 chars | ✅ in NewPatientModal |
| `dateOfBirth` | Required, must be in the past | ✅ in NewPatientModal |
| `sex` | Required, MALE/FEMALE/OTHER | ✅ in NewPatientModal |
| `addressBarangay` | Optional, max 100 chars | ✅ in NewPatientModal |
| `addressCity` | Optional, max 100 chars | ✅ in NewPatientModal |
| `addressRegion` | Optional, max 100 chars | ✅ in NewPatientModal |

All the above must also be present in `EditPatientModal` (see schema above).

---

### 4. RBAC Enforcement (Frontend)

| Action | Admin | Doctor | Nurse |
|---|---|---|---|
| View patient list (sidebar) | ✅ | ✅ | ✅ |
| Search patients | ✅ | ✅ | ✅ |
| Register new patient | ✅ | ✅ | ❌ |
| Edit patient demographics | ✅ | ✅ | ❌ |
| Deactivate patient | ✅ | ❌ | ❌ |

**Frontend enforcement:**
- "New Patient" button in `Sidebar.tsx`: already guarded by `canCreatePatient = user?.role === 'DOCTOR' || user?.role === 'ADMIN'`
- "New Patient" button in `dashboard/page.tsx`: already guarded by same check
- "Edit" button in `PatientBanner.tsx`: guard with `user?.role === 'DOCTOR' || user?.role === 'ADMIN'`
- Nurses see the banner but no edit button — they can still view all patient information

**Backend enforcement (already in place):**
- `POST /patients`: `@Roles(Role.DOCTOR, Role.ADMIN)` ✅
- `PATCH /patients/:id`: `@Roles(Role.DOCTOR, Role.ADMIN)` ✅
- `GET /patients` and `GET /patients/:id`: any authenticated user ✅

---

### 5. API Integration Points

All API calls go through `frontend/src/lib/api.ts` `apiRequest()`. No direct `fetch` calls anywhere in patient components.

| Frontend Action | API Call | Hook |
|---|---|---|
| Load sidebar list | `GET /patients?search=&page=1&limit=200` | `usePatients` |
| Load patient banner | `GET /patients/:id` | `usePatient` |
| Register patient | `POST /patients` | `useCreatePatient` |
| Edit patient | `PATCH /patients/:id` | direct `apiRequest` in `EditPatientModal` |
| Deactivate patient | `PATCH /patients/:id/deactivate` | Phase 4 only adds endpoint; UI for this is out of scope |

---

### 6. Design Token Compliance

All patient components must use the DAMAYAN design tokens from `design-standard.md`. Key requirements:

- Font: `font-sans` (IBM Plex Sans) for all text; `font-mono` for patient code, age
- Colors: use CSS variables via Tailwind (`bg-surface`, `text-text-primary`, `border-border`, etc.) — **never hardcode hex values**
- Patient avatar initials: `bg-accent-light border-2 border-accent text-accent-hover` (active), `bg-surface-2 border-border text-text-secondary` (inactive)
- Allergy pill: `bg-red-bg text-red border border-red-border px-[7px] py-[2px] rounded-[4px] text-[9px] font-bold`
- Patient code badge: `font-mono text-[10px] text-text-muted bg-surface-2 border border-border rounded px-1.5 py-[1px]`
- "New Patient" button height: `h-[28px]` (section button size) in sidebar; `h-[34px]` (topbar button size) in dashboard index
- Modal width: `w-[520px] max-[1439px]:w-[460px]`
- All inputs: `h-[34px] px-2.5 border border-border rounded-btn text-[13px]` with `focus:border-accent focus:shadow-accent-focus`

---

### 7. File Checklist — What to Create / Modify

#### New files to create:
- `frontend/src/components/patients/EditPatientModal.tsx` ← full implementation above

#### Files to modify:
- `frontend/src/components/patients/PatientBanner.tsx` ← add edit button + `EditPatientModal` integration, add `relative` to outer div
- `frontend/src/components/layout/Sidebar.tsx` ← add debounce for search, improve empty state
- `frontend/src/app/dashboard/page.tsx` ← call `setActivePatient` in `onCreated` callback
- `backend/src/patients/patients.service.ts` ← harden `generatePatientCode` for concurrency
- `backend/src/patients/patients.controller.ts` ← add `PATCH :id/deactivate`

#### Files to verify (no changes expected):
- `frontend/src/hooks/usePatients.ts` — `usePatients`, `usePatient`, `useCreatePatient` all correct
- `frontend/src/components/patients/NewPatientModal.tsx` — already complete with validation
- `frontend/src/stores/patientStore.ts` — correct
- `frontend/src/app/dashboard/[patientId]/layout.tsx` — correct
- `frontend/src/app/dashboard/[patientId]/page.tsx` — correct
- `backend/src/patients/patients.controller.ts` (existing routes) — correct
- `backend/src/patients/patients.service.ts` (existing methods) — correct after concurrency fix

---

### 8. End-to-End Test Scenarios

After all changes are applied, manually verify:

#### 8.1 Doctor flow
1. Log in as a Doctor
2. Sidebar shows all patients alphabetically grouped
3. Typing in search filters the list (with debounce — no API call until ~350ms after typing stops)
4. Clicking "New Patient" opens the registration modal
5. Submit with valid data → patient appears in sidebar, app navigates to `/dashboard/:id`
6. Patient banner shows correct demographics and no edit button race
7. Clicking "Edit" in the banner opens the edit modal pre-filled with existing data
8. Saving edit updates the banner immediately without page reload

#### 8.2 Nurse flow
1. Log in as a Nurse
2. Sidebar is visible with all patients
3. "New Patient" button is NOT visible in sidebar
4. "New Patient" button is NOT visible on dashboard index
5. Patient banner loads correctly
6. "Edit" button is NOT visible in patient banner

#### 8.3 Admin flow
1. Log in as Admin → redirected to `/admin/accounts` (Phase 3 behavior)
2. Admin does NOT see the clinical dashboard — this is correct per Phase 3

#### 8.4 Validation
1. Submit new patient with empty last name → inline error shown
2. Submit with DOB in the future → inline error shown
3. Submit with sex not selected → inline error shown
4. Submit with middle name > 30 chars → inline error shown

#### 8.5 Patient code
1. Register patient → gets code `PT-0001`
2. Register another → gets `PT-0002`
3. Code appears in sidebar row (monospace, after `·`)
4. Code appears in patient banner

---

### 9. Known Deferred Items (Not in Phase 4)

These are explicitly deferred to later phases per the MVP roadmap:

- Barangay/City/Region as searchable PSGC comboboxes → Phase 13 (UI Refinement)
- Allergy field on registration form → allergies come from Initial Note, not patient registration; surfaces on banner from Phase 9 onwards
- Patient deactivation UI (button/confirmation) → Admin-only feature, defer to Phase 13
- `_count` fields on patient banner (Problems, Meds, Visits counters) → show as `0` until Phase 6/7/9 populate data; the counts are already being fetched by `findOne` in the backend
- Visit history card on dashboard → `VisitHistoryCard` is already rendered but shows "No visits recorded yet." until Phase 5 creates visits

---

### 10. Quick Reference — Key Paths

```
backend/
  src/patients/
    patients.controller.ts    ← GET, POST, PATCH routes
    patients.service.ts       ← business logic, patient code generator
    patients.module.ts
    dto/
      create-patient.dto.ts
      update-patient.dto.ts

frontend/
  src/
    types/patient.ts
    hooks/usePatients.ts
    stores/patientStore.ts
    lib/patient-utils.ts
    components/
      patients/
        PatientBanner.tsx         ← add edit button
        PatientBannerSkeleton.tsx
        NewPatientModal.tsx
        EditPatientModal.tsx      ← CREATE THIS
      layout/
        Sidebar.tsx               ← add search debounce + empty state
    app/
      dashboard/
        page.tsx                  ← wire setActivePatient on patient creation
        [patientId]/
          layout.tsx
          page.tsx
```

---

### 11. Do Not Touch

The following are **out of scope for Phase 4** and must not be modified:

- `VitalsStripEmpty` — placeholder for Phase 8; leave as is
- `ProblemListCardEmpty` — placeholder for Phase 6; leave as is
- `MedicationListCardEmpty` — placeholder for Phase 7; leave as is
- `VisitHistoryCard` — already implemented for Phase 5; leave as is
- Any auth flows (`/login`, `/change-password`, `authStore`, JWT guard)
- Admin layout and accounts page
- Database migrations — no new migrations needed for Phase 4
- Prisma schema — already complete for patient management

---

*Phase 4 is complete when: a Doctor can register a patient, view their dashboard with the banner, edit their demographics, and search for them in the sidebar — with all RBAC rules enforced and all design tokens applied.*