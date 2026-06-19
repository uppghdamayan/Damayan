# PHASE 6: Medication Management

**Project:** DAMAYAN — Problem-Oriented EMR for Philippine Primary Care
**Depends on:** Phase 1 (scaffold), Phase 2 (auth/RBAC), Phase 3 (database), Phase 5 (Problem List — pattern reference only, no runtime dependency)
**Required by:** Phase 8 (Initial Note), Phase 9 (Progress Notes), Phase 11 (Documents — Prescription), Phase 13 (48h indicators), Phase 14 (Admin Analytics)
**Deliverables:** Medication list CRUD with soft delete, Dashboard Medication List card, dedicated Medications management screen, `MedicationEntry`/`MedicationForm` components, and a reusable cross-module integration point so Initial Note (Phase 8) and Progress Notes (Phase 9) can read/seed/snapshot the medication list.

---

## 0. Context You Must Respect

DAMAYAN already has a **global per-patient Medication List** — there is no per-visit medication table. This mirrors the existing Problem List pattern in `backend/src/problems/`. Read `backend/src/problems/problems.service.ts`, `problems.controller.ts`, and `problems.module.ts` in full before writing any code — Phase 6 must follow the exact same conventions (NestJS module shape, Prisma transaction usage, RBAC decorator placement, internal-helper-method pattern for cross-module calls).

Key facts already fixed by Phase 3's schema (`backend/prisma/schema.prisma`) — **do not alter the schema**:

```prisma
enum MedUnit { MG G MCG ML UNITS }

model Medication {
  id           String   @id @default(uuid()) @db.Uuid
  patientId    String   @map("patient_id") @db.Uuid
  name         String   @db.VarChar(255)
  dose         Decimal  @db.Decimal(8, 2)
  unit         MedUnit  @default(MG)
  instructions String?  @db.VarChar(50)
  quantity     Int?
  isActive     Boolean  @default(true) @map("is_active")
  addedBy      String?  @map("added_by") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt      @map("updated_at")

  patient     Patient @relation(fields: [patientId], references: [id])
  addedByUser User?   @relation("MedicationAddedBy", fields: [addedBy], references: [id])

  @@index([patientId, isActive])
  @@map("medications")
}
```

There is **no medication formulary/lookup table** in the schema. The "autocomplete from list" requirement (Section 11.6 of the MVP doc) must be satisfied client-side using (a) a small static common-medications list shipped in the frontend, merged with (b) the distinct medication names already on file for the current patient (via the same `GET /patients/:patientId/medications` response, including inactive ones — fetch with a query flag, see §2.1). Do not invent a new backend table or endpoint for this.

API contract (Section 9.6 of the MVP doc — implement exactly this):

| Method | Route | Roles |
|---|---|---|
| GET | `/patients/:patientId/medications` | All roles (DOCTOR, NURSE, ADMIN) |
| POST | `/patients/:patientId/medications` | DOCTOR, ADMIN |
| PATCH | `/patients/:patientId/medications/:id` | DOCTOR, ADMIN |
| DELETE | `/patients/:patientId/medications/:id` | DOCTOR, ADMIN |

RBAC matrix (Section 8.1): Nurse may **view** medications only — never add/edit/delete. Doctor and Admin have full CRUD. This matches Problems exactly except Medications has no "reorder" or "nest" concept — it is a flat, append-only list with soft delete.

---

## 1. Backend — `backend/src/medications/`

The module currently exists as an empty stub (`@Module({})`). Replace its contents entirely.

### 1.1 `dto/create-medication.dto.ts`

```ts
import { IsString, IsNotEmpty, MaxLength, IsEnum, IsNumber, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedUnit } from '@prisma/client';

export class CreateMedicationDto {
  @ApiProperty({ example: 'Losartan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 50, description: 'Numeric dose amount, > 0' })
  @IsNumber()
  @Min(0.01)
  @Max(99999.99)
  dose: number;

  @ApiProperty({ enum: MedUnit, example: MedUnit.MG })
  @IsEnum(MedUnit)
  unit: MedUnit;

  @ApiPropertyOptional({ example: 'Once daily with food' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  instructions?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
```

### 1.2 `dto/update-medication.dto.ts`

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateMedicationDto } from './create-medication.dto';

export class UpdateMedicationDto extends PartialType(CreateMedicationDto) {}
```

`PartialType` makes every field optional for PATCH while keeping the same validation constraints when a field is present — matches the `UpdatePatientDto` pattern already used in `backend/src/patients/dto/update-patient.dto.ts`.

### 1.3 `medications.service.ts`

Implement with the same shape as `ProblemsService`:

```ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, Medication } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class MedicationsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // LIST — active by default; ?includeInactive=true returns the full history
  // (used by the frontend autocomplete merge and by Visit History detail views).
  // ─────────────────────────────────────────────
  async findAll(patientId: string, includeInactive = false): Promise<Medication[]> {
    return this.prisma.medication.findMany({
      where: { patientId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Internal helper — NOT exposed as a route. Used by:
   *  - Phase 8 (Initial Note) to seed the medication list on publish
   *  - Phase 9 (Progress Notes) to build medicationSnapshot on note creation/publish
   * See Section 2 ("Cross-Module Integration Contract") below.
   */
  async findActiveForPatient(
    patientId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<Medication[]> {
    return client.medication.findMany({
      where: { patientId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(patientId: string, id: string): Promise<Medication> {
    const med = await this.prisma.medication.findFirst({ where: { id, patientId } });
    if (!med) throw new NotFoundException(`Medication ${id} not found for this patient.`);
    return med;
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(patientId: string, dto: CreateMedicationDto, userId: string): Promise<Medication> {
    return this.prisma.medication.create({
      data: {
        patientId,
        name: dto.name.trim(),
        dose: dto.dose,
        unit: dto.unit,
        instructions: dto.instructions?.trim() || null,
        quantity: dto.quantity ?? null,
        isActive: true,
        addedBy: userId,
      },
    });
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(patientId: string, id: string, dto: UpdateMedicationDto): Promise<Medication> {
    await this.findOne(patientId, id); // throws if not found / not owned by patient

    const data: Prisma.MedicationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.dose !== undefined) data.dose = dto.dose;
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.instructions !== undefined) data.instructions = dto.instructions?.trim() || null;
    if (dto.quantity !== undefined) data.quantity = dto.quantity ?? null;

    return this.prisma.medication.update({ where: { id }, data });
  }

  // ─────────────────────────────────────────────
  // SOFT DELETE — sets is_active = false; row is retained for audit/history.
  // ─────────────────────────────────────────────
  async remove(patientId: string, id: string): Promise<Medication> {
    await this.findOne(patientId, id);
    return this.prisma.medication.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─────────────────────────────────────────────
  // PHASE 8/9 INTEGRATION POINT — see Section 2 of this file for the full contract.
  //
  // Upserts medications from a note's medication list on publish/save.
  // Case-insensitive match on (name, dose, unit) against the patient's existing
  // ACTIVE medications:
  //   - exact match (name+dose+unit) → no-op (already on the list)
  //   - name matches but dose/unit differs → treated as a NEW entry (dose
  //     changes are clinically significant; never silently overwrite a dose)
  //   - no match → create new active medication
  // Medications removed from the note's list compared to the patient's current
  // active list are NOT auto-deactivated here — deactivation is always an
  // explicit clinician action via DELETE, performed by the calling module if
  // its own business rules require it (Initial Note does not; see Section 2).
  // ─────────────────────────────────────────────
  async upsertFromNoteMedications(
    patientId: string,
    items: { name: string; dose: number; unit: string; instructions?: string; quantity?: number }[],
    userId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<void> {
    if (!items?.length) return;

    const existing = await client.medication.findMany({
      where: { patientId, isActive: true },
    });

    for (const item of items) {
      const match = existing.find(
        (m) =>
          m.name.toLowerCase() === item.name.trim().toLowerCase() &&
          Number(m.dose) === Number(item.dose) &&
          m.unit === item.unit,
      );
      if (match) continue;

      await client.medication.create({
        data: {
          patientId,
          name: item.name.trim(),
          dose: item.dose,
          unit: item.unit as any,
          instructions: item.instructions?.trim() || null,
          quantity: item.quantity ?? null,
          isActive: true,
          addedBy: userId,
        },
      });
    }
  }
}
```

### 1.4 `medications.controller.ts`

```ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { MedicationsService } from './medications.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Medications')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/medications')
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List medications for a patient — All roles' })
  @ApiOkResponse({ description: 'Active medications by default; pass includeInactive=true for full history.' })
  async findAll(
    @Param('patientId') patientId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const data = await this.medicationsService.findAll(patientId, !!includeInactive);
    return { data };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add medication (Doctor, Admin)' })
  @ApiCreatedResponse({ description: 'Medication added.' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreateMedicationDto,
    @CurrentUser() user: User,
  ) {
    return this.medicationsService.create(patientId, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Edit medication (Doctor, Admin)' })
  async update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.medicationsService.update(patientId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete medication — sets is_active false (Doctor, Admin)' })
  async remove(@Param('patientId') patientId: string, @Param('id') id: string) {
    return this.medicationsService.remove(patientId, id);
  }
}
```

### 1.5 `medications.module.ts`

```ts
import { Module } from '@nestjs/common';
import { MedicationsController } from './medications.controller';
import { MedicationsService } from './medications.service';

@Module({
  controllers: [MedicationsController],
  providers: [MedicationsService],
  exports: [MedicationsService], // required so Phase 8/9 modules can inject it later
})
export class MedicationsModule {}
```

`app.module.ts` already imports `MedicationsModule` — no change needed there.

### 1.6 Backend verification

```bash
cd backend
npm run build
npm run start:dev
```

Confirm via Swagger (`http://localhost:3001/api`) that the **Medications** tag shows exactly the four routes above with the correct role restrictions, and that `GET` with a Nurse token succeeds while `POST`/`PATCH`/`DELETE` with a Nurse token return 403.

---

## 2. Cross-Module Integration Contract (read before starting Phase 8 or 9)

This section is the binding contract other phases rely on. Do not change these signatures without updating the dependent phase prompts.

- **`MedicationsService.findActiveForPatient(patientId, client?)`** — returns the patient's current active medication list. Phase 9 (Progress Notes) calls this when creating a new visit to build `medicationSnapshot` JSON on the `ProgressNote` row. Phase 8 (Initial Note) calls this to pre-populate the `MedicationListEditor` when the form first loads (read-only context, not part of the note's own fields — there is no `medications` column on `InitialNote`).
- **`MedicationsService.upsertFromNoteMedications(patientId, items, userId, client?)`** — called by `InitialNotesService.publish()` (Phase 8) inside the same `$transaction` that flips the note to `PUBLISHED`, passing whatever the clinician entered in the Initial Note's Medication List section. This is the **only** way Initial Note writes to the global medication list — it never calls `create`/`update`/`delete` directly, exactly as `ProblemsService.upsertFromAssessment` is the only path Initial Note uses to write problems.
- Both helpers accept an optional Prisma transaction client (`PrismaTx | PrismaService`) so the calling module can run them inside its own `$transaction` — follow the exact pattern already established in `ProblemsService`.
- Medications module must be added to the **imports** array of `InitialNotesModule` and `ProgressNotesModule` (via `MedicationsModule` export) when those phases are implemented — Phase 6 only needs to `export: [MedicationsService]` from `MedicationsModule`, which is already done in §1.5.

---

## 3. Frontend Types & API Hooks

### 3.1 `frontend/src/types/medication.ts` (new file)

```ts
export type MedUnitValue = 'MG' | 'G' | 'MCG' | 'ML' | 'UNITS';

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dose: string; // Prisma Decimal serializes as string over JSON
  unit: MedUnitValue;
  instructions: string | null;
  quantity: number | null;
  isActive: boolean;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationsResponse {
  data: Medication[];
}
```

> **Decimal handling note:** Prisma's `Decimal` type serializes to a JSON string, not a number. Every place the frontend reads `medication.dose` for display or math (sorting, totals) must `Number(medication.dose)` first. Every place the frontend sends a dose to the API sends a plain JS `number` — `class-validator`'s `@IsNumber()` on the DTO accepts the JSON number the browser sends; it is only the *response* that comes back as a string.

### 3.2 `frontend/src/hooks/useMedications.ts` (new file)

Mirror `frontend/src/hooks/useProblems.ts` exactly — same optimistic-update pattern for update/delete, same invalidation of the `['patient', patientId]` query so `Patient._count` style banner data and the Dashboard card stay in sync.

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Medication, MedicationsResponse, MedUnitValue } from '@/types/medication';

export function useMedications(patientId: string | null, includeInactive = false) {
  return useQuery<MedicationsResponse>({
    queryKey: ['medications', patientId, includeInactive],
    queryFn: () =>
      apiRequest<MedicationsResponse>(
        `/patients/${patientId}/medications${includeInactive ? '?includeInactive=true' : ''}`,
      ),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

interface CreateMedicationInput {
  name: string;
  dose: number;
  unit: MedUnitValue;
  instructions?: string;
  quantity?: number;
}
interface UpdateMedicationInput {
  id: string;
  name?: string;
  dose?: number;
  unit?: MedUnitValue;
  instructions?: string | null;
  quantity?: number | null;
}

function invalidateMedications(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['medications', patientId] });
  qc.invalidateQueries({ queryKey: ['patient', patientId] }); // refreshes any banner-level counts
}

export function useCreateMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMedicationInput) =>
      apiRequest<Medication>(`/patients/${patientId}/medications`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateMedications(qc, patientId),
  });
}

export function useUpdateMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateMedicationInput) =>
      apiRequest<Medication>(`/patients/${patientId}/medications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ['medications', patientId, false] });
      const previous = qc.getQueryData<MedicationsResponse>(['medications', patientId, false]);
      if (previous) {
        qc.setQueryData<MedicationsResponse>(['medications', patientId, false], {
          data: previous.data.map((m) => (m.id === variables.id ? { ...m, ...variables, dose: variables.dose !== undefined ? String(variables.dose) : m.dose } : m)),
        });
      }
      return { previous };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) qc.setQueryData(['medications', patientId, false], context.previous);
    },
    onSettled: () => invalidateMedications(qc, patientId),
  });
}

export function useDeleteMedication(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<Medication>(`/patients/${patientId}/medications/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateMedications(qc, patientId),
  });
}
```

### 3.3 `frontend/src/lib/medication-utils.ts` (new file)

```ts
import type { Medication } from '@/types/medication';

export const COMMON_MEDICATIONS = [
  'Amoxicillin', 'Amlodipine', 'Losartan', 'Metformin', 'Paracetamol',
  'Cetirizine', 'Mefenamic Acid', 'Salbutamol', 'Omeprazole', 'Atorvastatin',
  'Captopril', 'Clopidogrel', 'Metoprolol', 'Simvastatin', 'Co-Amoxiclav',
  'Cefalexin', 'Ascorbic Acid', 'Multivitamins', 'Loperamide', 'Ibuprofen',
] as const;

/** Merge the static common list with names already on file for this patient
 *  (active + inactive), de-duplicated case-insensitively, for the
 *  MedicationForm name-field autocomplete. */
export function buildMedicationSuggestions(patientMedications: Medication[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of [...patientMedications.map((m) => m.name), ...COMMON_MEDICATIONS]) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

export function isRecentlyUpdated(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
}

export function mostRecentMedicationUpdate(medications: Medication[]): string | null {
  if (medications.length === 0) return null;
  return medications.reduce((latest, m) => (m.updatedAt > latest ? m.updatedAt : latest), medications[0].updatedAt);
}

export function formatDose(medication: Pick<Medication, 'dose' | 'unit'>): string {
  const num = Number(medication.dose);
  const trimmed = num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${trimmed} ${medication.unit.toLowerCase()}`;
}
```

`isRecentlyUpdated` and `mostRecentMedicationUpdate` deliberately duplicate the logic in `frontend/src/lib/problem-utils.ts` rather than importing from it — keep the modules independent so Phase 6 has zero coupling to the Problems module's internals (only the *pattern* is shared, per the project's existing convention of one utils file per domain).

---

## 4. Frontend Components

### 4.1 `frontend/src/components/medications/MedicationForm.tsx` (new file)

A controlled form used both standalone (Medications screen "Add/Edit" modal) and embedded inline (Phase 8 `MedicationListEditor` will reuse this same component — keep props generic, no screen-specific assumptions).

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildMedicationSuggestions } from '@/lib/medication-utils';
import type { Medication, MedUnitValue } from '@/types/medication';

interface MedicationFormValues {
  name: string;
  dose: string;   // kept as string in form state for free typing; parsed to number on submit
  unit: MedUnitValue;
  instructions: string;
  quantity: string;
}

interface MedicationFormModalProps {
  open: boolean;
  onClose: () => void;
  editing: Medication | null;
  suggestions: Medication[]; // pass the patient's full (active+inactive) medication list for autocomplete
  saving: boolean;
  onSave: (values: { name: string; dose: number; unit: MedUnitValue; instructions?: string; quantity?: number }) => void;
}

const UNIT_OPTIONS: MedUnitValue[] = ['MG', 'G', 'MCG', 'ML', 'UNITS'];

const emptyValues: MedicationFormValues = { name: '', dose: '', unit: 'MG', instructions: '', quantity: '' };

export function MedicationFormModal({ open, onClose, editing, suggestions, saving, onSave }: MedicationFormModalProps) {
  const [values, setValues] = useState<MedicationFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setValues(
        editing
          ? {
              name: editing.name,
              dose: String(Number(editing.dose)),
              unit: editing.unit,
              instructions: editing.instructions ?? '',
              quantity: editing.quantity != null ? String(editing.quantity) : '',
            }
          : emptyValues,
      );
      setErrors({});
    }
  }, [open, editing]);

  if (!open) return null;

  const nameOptions = buildMedicationSuggestions(suggestions);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = 'Medication name is required.';
    else if (values.name.length > 255) e.name = 'Max 255 characters.';

    const doseNum = parseFloat(values.dose);
    if (!values.dose || isNaN(doseNum) || doseNum <= 0) e.dose = 'Dose must be a number greater than 0.';
    else if (doseNum > 99999.99) e.dose = 'Dose is too large.';

    if (values.instructions && values.instructions.length > 50) e.instructions = 'Max 50 characters.';

    if (values.quantity) {
      const qtyNum = parseInt(values.quantity, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) e.quantity = 'Quantity must be a whole number greater than 0.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSave({
      name: values.name.trim(),
      dose: parseFloat(values.dose),
      unit: values.unit,
      instructions: values.instructions.trim() || undefined,
      quantity: values.quantity ? parseInt(values.quantity, 10) : undefined,
    });
  };

  const inputCn = (hasError?: boolean) =>
    cn(
      'h-[34px] w-full px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150',
      hasError
        ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
        : 'border-border focus:border-accent focus:shadow-accent-focus',
    );

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150"
    >
      <div className="bg-surface border border-border rounded-[10px] w-[460px] max-h-[80vh] overflow-y-auto shadow-modal">
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">
            {editing ? 'Edit Medication' : 'Add Medication'}
          </h2>
          <button onClick={onClose} aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-[18px] py-[18px]">
          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Medication Name <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <input
              autoFocus
              list="medication-name-suggestions"
              value={values.name}
              onChange={(e) => { setValues((v) => ({ ...v, name: e.target.value })); setErrors((er) => ({ ...er, name: '' })); }}
              placeholder="e.g. Losartan"
              className={inputCn(!!errors.name)}
            />
            <datalist id="medication-name-suggestions">
              {nameOptions.map((n) => <option key={n} value={n} />)}
            </datalist>
            {errors.name && <p className="text-[12px] text-red mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
                Dose <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
              </label>
              <input
                type="number" step="0.01" min="0.01"
                value={values.dose}
                onChange={(e) => { setValues((v) => ({ ...v, dose: e.target.value })); setErrors((er) => ({ ...er, dose: '' })); }}
                placeholder="50"
                className={inputCn(!!errors.dose)}
              />
              {errors.dose && <p className="text-[12px] text-red mt-1">{errors.dose}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Unit</label>
              <select
                value={values.unit}
                onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value as MedUnitValue }))}
                className={cn(inputCn(), 'cursor-pointer')}
              >
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u.toLowerCase()}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Instructions</label>
            <input
              value={values.instructions}
              onChange={(e) => { setValues((v) => ({ ...v, instructions: e.target.value })); setErrors((er) => ({ ...er, instructions: '' })); }}
              placeholder="e.g. Once daily with food"
              maxLength={50}
              className={inputCn(!!errors.instructions)}
            />
            {errors.instructions && <p className="text-[12px] text-red mt-1">{errors.instructions}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">Quantity</label>
            <input
              type="number" step="1" min="1"
              value={values.quantity}
              onChange={(e) => { setValues((v) => ({ ...v, quantity: e.target.value })); setErrors((er) => ({ ...er, quantity: '' })); }}
              placeholder="e.g. 30"
              className={inputCn(!!errors.quantity)}
            />
            {errors.quantity && <p className="text-[12px] text-red mt-1">{errors.quantity}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border">
          <button onClick={onClose}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer disabled:bg-text-muted disabled:border-border-strong disabled:cursor-not-allowed">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Medication'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 4.2 `frontend/src/components/medications/MedicationEntry.tsx` (new file)

Single-row display used by both the Medications screen list and (in Phase 8/9) the inline `MedicationListEditor`.

```tsx
'use client';

import { cn } from '@/lib/utils';
import { formatDose } from '@/lib/medication-utils';
import type { Medication } from '@/types/medication';

interface MedicationEntryProps {
  medication: Medication;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function MedicationEntry({ medication, canManage, onEdit, onDelete }: MedicationEntryProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 px-3.5 py-2.5 border-b border-border last:border-b-0',
      !medication.isActive && 'opacity-60',
    )}>
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', medication.isActive ? 'bg-accent-mid' : 'bg-border-strong')} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-text-primary">{medication.name}</span>
          <span className="font-mono text-[12px] text-text-secondary">{formatDose(medication)}</span>
        </div>
        {medication.instructions && (
          <div className="text-[11px] text-text-muted mt-0.5 truncate">{medication.instructions}</div>
        )}
      </div>

      {medication.quantity != null && (
        <span className="font-mono text-[11px] text-text-muted whitespace-nowrap">Qty: {medication.quantity}</span>
      )}

      {canManage && medication.isActive && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={onEdit}
            className="h-[22px] px-2 rounded text-[10px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer">
            Edit
          </button>
          <button onClick={onDelete}
            className="h-[22px] px-2 rounded text-[10px] font-semibold bg-red-bg text-red border border-red-border hover:bg-red-bg/80 transition-all duration-150 cursor-pointer">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
```

### 4.3 `frontend/src/components/medications/MedicationsScreen.tsx` (new file)

Full-page screen mounted at `/dashboard/[patientId]/medications`, replacing the current placeholder.

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  useMedications,
  useCreateMedication,
  useUpdateMedication,
  useDeleteMedication,
} from '@/hooks/useMedications';
import { useAuthStore } from '@/stores/authStore';
import { MedicationEntry } from './MedicationEntry';
import { MedicationFormModal } from './MedicationForm';
import { MedicationListSkeleton } from './MedicationListSkeleton';
import type { Medication, MedUnitValue } from '@/types/medication';

export function MedicationsScreen({ patientId }: { patientId: string }) {
  const { user } = useAuthStore();
  const canManage = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const { data, isLoading } = useMedications(patientId, true); // full history for autocomplete + inactive rows
  const createMedication = useCreateMedication(patientId);
  const updateMedication = useUpdateMedication(patientId);
  const deleteMedication = useDeleteMedication(patientId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);

  const all = data?.data ?? [];
  const active = all.filter((m) => m.isActive);
  const inactive = all.filter((m) => !m.isActive);

  const handleAdd = () => { setEditing(null); setModalOpen(true); };
  const handleEdit = (m: Medication) => { setEditing(m); setModalOpen(true); };

  const handleSave = async (values: { name: string; dose: number; unit: MedUnitValue; instructions?: string; quantity?: number }) => {
    try {
      if (editing) {
        await updateMedication.mutateAsync({ id: editing.id, ...values });
        toast.success('Medication updated.');
      } else {
        await createMedication.mutateAsync(values);
        toast.success('Medication added to the list.');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save medication.');
    }
  };

  const handleDelete = (m: Medication) => {
    if (!confirm(`Remove ${m.name} from the active medication list?`)) return;
    deleteMedication.mutate(m.id, {
      onSuccess: () => toast.success('Medication removed.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove medication.'),
    });
  };

  if (isLoading) return <MedicationListSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <div className="flex justify-end -mb-2">
          <button
            onClick={handleAdd}
            className="h-8 px-4 rounded-btn text-[12px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer"
          >
            + Add Medication
          </button>
        </div>
      )}

      <div className="bg-surface border border-border border-l-[3px] border-l-accent rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2">
          <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">💊</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Active Medications</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-accent text-accent-hover bg-accent-light">
            {active.length} Active
          </span>
        </div>

        {active.length === 0 ? (
          <div className="py-8 px-[14px] text-center text-[13px] text-text-muted italic">
            No active medications recorded.
          </div>
        ) : (
          active.map((m) => (
            <MedicationEntry key={m.id} medication={m} canManage={canManage} onEdit={() => handleEdit(m)} onDelete={() => handleDelete(m)} />
          ))
        )}
      </div>

      {inactive.length > 0 && (
        <div className="bg-surface border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex items-center gap-[9px] px-[14px] py-[10px] bg-surface-2">
            <div className="w-[26px] h-[26px] rounded-[6px] bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">🗒</div>
            <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Discontinued Medications</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.5px] px-2 py-0.5 rounded border border-border text-text-secondary bg-surface-2 ml-auto">
              {inactive.length}
            </span>
          </div>
          {inactive.map((m) => (
            <MedicationEntry key={m.id} medication={m} canManage={false} onEdit={() => {}} onDelete={() => {}} />
          ))}
        </div>
      )}

      <MedicationFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        suggestions={all}
        onSave={handleSave}
        saving={createMedication.isPending || updateMedication.isPending}
      />
    </div>
  );
}
```

### 4.4 `frontend/src/components/medications/MedicationListSkeleton.tsx` (new file)

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function MedicationListSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex items-center gap-2">
        <Skeleton width={26} height={26} borderRadius={6} />
        <Skeleton width={140} height={10} borderRadius={4} />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-3.5 py-2.5 flex items-center gap-3 animate-pulse">
            <Skeleton width={8} height={8} borderRadius="50%" />
            <div className="flex-1 flex flex-col gap-1">
              <Skeleton width={i % 2 === 0 ? 160 : 120} height={12} borderRadius={4} />
              <Skeleton width={100} height={10} borderRadius={4} />
            </div>
            <Skeleton width={60} height={22} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4.5 Update `frontend/src/app/dashboard/[patientId]/medications/page.tsx`

Replace the Phase 9 placeholder entirely:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { MedicationsScreen } from '@/components/medications/MedicationsScreen';

export default function MedicationsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  return <MedicationsScreen patientId={patientId} />;
}
```

### 4.6 Update `frontend/src/app/dashboard/[patientId]/medications/loading.tsx`

```tsx
import { MedicationListSkeleton } from '@/components/medications/MedicationListSkeleton';

export default function Loading() {
  return <MedicationListSkeleton />;
}
```

---

## 5. Dashboard Integration (Patient Landing Page)

The Dashboard currently renders `MedicationListCardEmpty` unconditionally (`frontend/src/app/dashboard/[patientId]/page.tsx`, inside `ProblemsAndMedsSection`). Phase 6 must replace this with a real, data-driven card that mirrors `ProblemListCard` (`frontend/src/components/problems/ProblemListCard.tsx`) feature-for-feature: loading skeleton, empty state, 48-hour highlight, truncated preview list, and a "Manage" link to the full screen.

### 5.1 `frontend/src/components/medications/MedicationListCard.tsx` (new file)

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMedications } from '@/hooks/useMedications';
import { isRecentlyUpdated, mostRecentMedicationUpdate, formatDose } from '@/lib/medication-utils';
import { MedicationListCardEmpty } from './MedicationListCardEmpty';
import { MedicationListSkeleton } from './MedicationListSkeleton';

export function MedicationListCard({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { data, isLoading } = useMedications(patientId);

  if (isLoading) return <MedicationListSkeleton />;

  const active = data?.data ?? [];
  if (active.length === 0) return <MedicationListCardEmpty patientId={patientId} />;

  const lastUpdated = mostRecentMedicationUpdate(active);
  const recent = isRecentlyUpdated(lastUpdated);

  return (
    <div
      className={cn(
        'bg-surface border rounded-card shadow-card overflow-hidden',
        recent ? 'border-l-[3px] border-l-accent border-border' : 'border-border',
      )}
    >
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-surface-3 rounded-md flex items-center justify-center text-[13px]">💊</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Medications</span>
          {lastUpdated && (
            <span className={cn('font-mono text-[9px]', recent ? 'text-text-secondary' : 'text-text-muted')}>
              {recent && <span className="w-2 h-2 rounded-full bg-accent-mid inline-block mr-1" />}
              {new Date(lastUpdated).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <button
          onClick={() => router.push(`/dashboard/${patientId}/medications`)}
          className="h-7 px-3 bg-surface-2 text-text-secondary border border-border rounded-md text-[11px] font-semibold cursor-pointer hover:bg-surface-3 hover:text-text-primary transition-colors"
        >
          Manage
        </button>
      </div>

      <div className="divide-y divide-border">
        {active.slice(0, 6).map((m) => (
          <div key={m.id} className="flex items-center gap-2 px-3.5 py-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-accent-mid" />
            <span className="text-[12px] text-text-primary truncate flex-1">{m.name}</span>
            <span className="font-mono text-[11px] text-text-muted whitespace-nowrap">{formatDose(m)}</span>
          </div>
        ))}
        {active.length > 6 && (
          <div className="px-3.5 py-2 text-[11px] text-text-muted text-center">
            +{active.length - 6} more — view full list
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5.2 Update `frontend/src/components/medications/MedicationListCardEmpty.tsx`

Replace the existing static placeholder (currently in `frontend/src/components/medications/MedicationListCardEmpty.tsx`) so its "Manage" button actually navigates, matching `ProblemListCardEmpty`'s real behavior:

```tsx
'use client';

import { useRouter } from 'next/navigation';

export function MedicationListCardEmpty({ patientId }: { patientId: string }) {
  const router = useRouter();
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-surface-3 rounded-md flex items-center justify-center text-[13px]">💊</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Medications</span>
        </div>
        <button
          onClick={() => router.push(`/dashboard/${patientId}/medications`)}
          className="h-7 px-3 bg-surface-2 text-text-secondary border border-border rounded-md text-[11px] font-semibold cursor-pointer hover:bg-surface-3 hover:text-text-primary transition-colors"
        >
          Manage
        </button>
      </div>
      <div className="py-5 px-3.5 text-xs text-text-muted text-center">
        No medications recorded yet.
      </div>
    </div>
  );
}
```

> Note the prop signature changes from no-args to `{ patientId }` — update the import call site in §5.3 accordingly. This is a breaking change to an existing component; do not leave the old no-arg version in place elsewhere.

### 5.3 Update `frontend/src/app/dashboard/[patientId]/page.tsx`

Replace the `ProblemsAndMedsSection` function's `MedicationListCardEmpty` usage with the new data-driven `MedicationListCard`:

```tsx
import { MedicationListCard } from '@/components/medications/MedicationListCard';
// remove: import { MedicationListCardEmpty } from '@/components/medications/MedicationListCardEmpty';

function ProblemsAndMedsSection({ patientId }: { patientId: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ProblemListCard patientId={patientId} />
      <MedicationListCard patientId={patientId} />
    </div>
  );
}
```

Leave the rest of the file (Suspense boundaries, `PatientBannerSection`, `VitalsSection`, `VisitHistorySection`) untouched.

### 5.4 Sidebar / Patient list consistency check (no code change expected)

`frontend/src/components/layout/Sidebar.tsx` and `patients.service.ts` (`findAll`/`findOne`) currently surface `allergies` from the patient's most recent Initial Note, **not** medications — this is correct per the MVP doc and must remain unchanged. Do not add a medication-derived badge to the sidebar in this phase; that is out of scope.

---

## 6. 48-Hour Visual Indicator — Confirm Consistency

This phase's `isRecentlyUpdated` / `recent` styling in `MedicationListCard` must visually match `ProblemListCard`'s pattern exactly (`border-l-[3px] border-l-accent` + dot + `bg-accent-mid`), per Appendix C of the MVP doc and `frontend/design-standard.md` §6.1. Do not introduce the literal `ring-2 ring-amber-400 bg-amber-50` classes mentioned in the MVP doc's appendix pseudocode — those are illustrative only; the actual shipped convention (already implemented in `ProblemListCard`) uses the accent-colored left border + dot, not amber. Follow the codebase's real pattern, not the doc's simplified example.

---

## 7. Validation Rules Cross-Check (from `frontend/design-standard.md` §11)

Confirm these exact constraints are enforced in both the backend DTO (§1.1) and the frontend form (§4.1) — they must match on both sides:

| Field | Rule |
|---|---|
| Medication Name | required, max 255 chars (DTO) — design doc says "free text" with no explicit cap beyond the column width; enforce 255 to match `@db.VarChar(255)` |
| Medication Dose | float > 0 |
| Medication Unit | `mg` \| `g` \| `mcg` \| `ml` \| `units` (stored uppercase as `MedUnit` enum; displayed lowercase per design doc) |
| Medication Instructions | free text, max 50 chars |
| Medication Quantity | integer > 0, optional |

---

## 8. Manual Verification Checklist

Run through this checklist before marking Phase 6 complete. Use three browser sessions (or incognito tabs) logged in as Doctor, Nurse, and Admin respectively.

1. **Backend**
   - `GET /patients/:id/medications` returns `{ data: [] }` for a patient with no medications, as Doctor, Nurse, and Admin.
   - `POST /patients/:id/medications` as Doctor succeeds (201) with a valid payload; as Nurse returns 403.
   - `PATCH /patients/:id/medications/:medId` as Doctor updates only the supplied fields; unsupplied fields are unchanged.
   - `DELETE /patients/:id/medications/:medId` as Doctor sets `isActive: false` but the row still exists in the DB (soft delete) — verify via `?includeInactive=true`.
   - Sending `dose: -5`, `dose: "abc"`, or omitting `name` all return 400 with a clear `class-validator` message.
   - Sending an unknown field (e.g. `foo: "bar"`) returns 400 due to the global `forbidNonWhitelisted` pipe.

2. **Medications screen** (`/dashboard/[patientId]/medications`)
   - As Doctor/Admin: "+ Add Medication" opens the modal; saving a valid entry shows a success toast and appears in the Active list immediately.
   - As Nurse: no "+ Add Medication" button is rendered, and no Edit/Remove buttons appear on any row (UI elements hidden entirely, not disabled, per design doc §12).
   - Editing a medication and changing only the instructions field leaves dose/unit/quantity intact.
   - Removing a medication moves it from "Active Medications" into "Discontinued Medications" without a page reload.
   - The name field's datalist shows previously-entered medication names for this patient merged with the common list, with no duplicates (case-insensitive).

3. **Dashboard**
   - A patient with zero medications shows `MedicationListCardEmpty` with a working "Manage" button that navigates to the Medications screen.
   - A patient with 1+ active medications shows `MedicationListCard` with up to 6 rows, a "+N more" footer when there are more than 6, and the correct last-updated date.
   - Adding/editing/removing a medication from the Medications screen and then navigating back to the Dashboard reflects the change (TanStack Query invalidation works — no manual refresh needed).
   - A medication added within the last 48 hours shows the accent left-border + dot treatment on the Dashboard card; one older than 48 hours does not.

4. **Cross-module readiness for Phase 8**
   - `MedicationsService` is exported from `MedicationsModule` and importable by name — confirm by temporarily injecting it into any other service's constructor and running `npm run build` (then revert the temporary injection; this is just a compile-time sanity check, not a permanent change).
   - `findActiveForPatient` and `upsertFromNoteMedications` exist with the exact signatures in §1.3 / §2 — Phase 8's prompt will reference them by name and will not redefine them.

---

## 9. Explicitly Out of Scope for Phase 6

- Medication formulary/lookup table or a dedicated `/medications/lookup` endpoint — not in the schema, not in this phase.
- Drug interaction checking, dosage-range warnings, or any clinical decision support — none of this is in the MVP doc for Medications.
- Linking medications to a specific `Visit` or note row directly — medications remain patient-global; per-visit context is captured later via `medication_snapshot` (Progress Notes, Phase 9) and `medication_changes` (Visit history diff, Phase 9/13), not by Phase 6.
- Prescription PDF generation — that is Phase 11 (Documents), which will read from `MedicationsService.findActiveForPatient` but is not implemented here.
- Admin analytics aggregation of medication counts — that is Phase 14, which queries the `medications` table directly via Prisma `groupBy`, with no dependency on anything built in this phase beyond the table itself.