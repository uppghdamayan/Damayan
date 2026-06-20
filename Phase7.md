# DAMAYAN EMR — Phase 7: Vital Signs Module

**Audience:** An agentic coding AI executing this file end-to-end against the existing DAMAYAN repository (NestJS backend + Next.js App Router frontend, Supabase Postgres, Prisma ORM).

**Goal:** Implement the Vital Signs module per the MVP spec (Section 9.7 API, Section 11.7 Frontend, Section 12.7 Backend), wire it into the Patient Dashboard, and expose every integration point Phase 8 (Initial Note) requires so that phase can be built next with zero backend rework.

This file is self-contained. Read it fully before writing code. Do not skip the "Cross-Module Integration Contract" (Section 7) — it defines the exact shape Phase 8 will depend on.

---

## 0. Pre-flight: Repository Conventions to Follow Exactly

Before writing any code, internalize these conventions from the existing codebase (Problems and Medications modules are the closest analogues — mirror their patterns exactly):

- **Module structure:** `backend/src/vitals/` already exists as an empty `@Module({})` shell at `backend/src/vitals/vitals.module.ts`. Fill it in; do not relocate it.
- **DTO pattern:** `class-validator` decorators + `@nestjs/swagger` `@ApiProperty`/`@ApiPropertyOptional`, mirroring `backend/src/medications/dto/create-medication.dto.ts`.
- **Controller pattern:** `@ApiTags`, `@ApiBearerAuth('access_token')`, `@UseGuards(JwtAuthGuard)` at the controller level, with `@UseGuards(RolesGuard)` + `@Roles(...)` added per-route only where roles are restricted (mirror `MedicationsController`).
- **Service pattern:** Plain Prisma calls via `PrismaService`. Every internal helper method meant for cross-module use (i.e. for Phase 8) accepts an optional `client: Prisma.TransactionClient | PrismaService = this.prisma` parameter, exactly like `ProblemsService.findActiveForPatient` and `MedicationsService.findActiveForPatient`.
- **Route nesting:** All vitals routes are nested under `/patients/:patientId/vitals`, matching the existing `MedicationsController` and `ProblemsController` controller path pattern.
- **No soft-delete enum needed:** Vitals use a hard `DELETE` (per RBAC table, Doctor/Admin only) — there is no `VitalStatus` enum in the schema. Do not invent one.
- **Money/decimal handling:** `temperature` is a Prisma `Decimal` — it will serialize to JSON as a `string`, exactly like `Medication.dose`. Follow the same frontend handling pattern used in `frontend/src/types/medication.ts` (`dose: string`) and `frontend/src/lib/medication-utils.ts` (`Number(...)` before doing math).
- **Frontend data layer:** TanStack Query hooks in `frontend/src/hooks/`, following `useMedications.ts` / `useProblems.ts` exactly (query key arrays, `staleTime`, optimistic `onMutate`/`onError`/`onSettled` for mutations).
- **Design system:** Use only the tokens and component patterns defined in `frontend/design-standard.md` (Sections 6–7). Do not introduce new colors, spacing scales, or font sizes. Reuse the badge variants, card header pattern (icon + uppercase 10px label), and button classes already used in `MedicationsScreen.tsx` / `ProblemListScreen.tsx`.
- **Existing scaffold files to replace, not duplicate:**
  - `frontend/src/app/dashboard/[patientId]/vitals/page.tsx` (currently a placeholder — replace its contents)
  - `frontend/src/components/vitals/VitalsStripEmpty.tsx` (currently a static placeholder — replace with a real data-driven component, same file name)
  - `frontend/src/components/vitals/VitalsStripSkeleton.tsx` (already correct — reuse as-is, only adjust column count if needed for parity with the new live component)
  - Do not delete `frontend/src/app/dashboard/[patientId]/vitals/loading.tsx` — it already wires up `TabContentSkeleton`; you may swap it for a more specific skeleton if helpful, but it's optional.

---

## 1. Prisma Schema — No Migration Required

Verify (do not modify) that `backend/prisma/schema.prisma` already has the `VitalSign` model exactly as follows. It does — this was created in the initial schema migration (`20260612131311_init_full_schema`). **Do not run a new migration for this phase.**

```prisma
model VitalSign {
  id                String   @id @default(uuid()) @db.Uuid
  patientId         String   @map("patient_id") @db.Uuid
  visitId           String?  @map("visit_id") @db.Uuid
  sbp               Int?
  dbp               Int?
  heartRate         Int?     @map("heart_rate")
  respiratoryRate   Int?     @map("respiratory_rate")
  temperature       Decimal? @db.Decimal(4, 1)
  oxygenSaturation  Int?     @map("oxygen_saturation")
  measuredBy        String?  @map("measured_by") @db.Uuid
  measuredAt        DateTime @map("measured_at")
  createdAt         DateTime @default(now()) @map("created_at")

  patient        Patient   @relation(fields: [patientId], references: [id])
  visit          Visit?    @relation(fields: [visitId], references: [id])
  measuredByUser User?     @relation("VitalMeasuredBy", fields: [measuredBy], references: [id])

  @@index([patientId, measuredAt(sort: Desc)])
  @@map("vital_signs")
}
```

Key facts that drive every decision below:
- `visitId` is **nullable** — vitals can be recorded standalone (from the Vitals screen) or, later, linked to a visit. Phase 7 always records **standalone** vitals (`visitId: null`). Linking vitals to a visit is not part of this phase's UI flow and is not required for Phase 8.
- All six measures are individually nullable — **partial entry is allowed**. The form must not force all six fields to be filled.
- `measuredAt` is **required** — every record needs a timestamp, defaulting to "now" in the UI but editable.
- `measuredBy` is nullable but should always be populated by the backend from the JWT-authenticated user on create.

---

## 2. Backend — VitalsModule

### 2.1 DTOs

Create `backend/src/vitals/dto/create-vitals.dto.ts`:

```typescript
import {
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateVitalsDto {
  @ApiPropertyOptional({ example: 120, description: 'Systolic BP, mmHg' })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(300)
  sbp?: number;

  @ApiPropertyOptional({ example: 80, description: 'Diastolic BP, mmHg' })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  dbp?: number;

  @ApiPropertyOptional({ example: 72, description: 'Heart rate, bpm' })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(300)
  heartRate?: number;

  @ApiPropertyOptional({ example: 16, description: 'Respiratory rate, breaths/min' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @ApiPropertyOptional({ example: 36.8, description: 'Temperature, Celsius' })
  @IsOptional()
  @IsNumber()
  @Min(30.0)
  @Max(45.0)
  @Type(() => Number)
  temperature?: number;

  @ApiPropertyOptional({ example: 98, description: 'Oxygen saturation, SpO2 %' })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  oxygenSaturation?: number;

  @ApiProperty({ example: '2026-06-20T09:30:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  measuredAt: string;
}
```

Validation ranges above come from `frontend/design-standard.md` Section 11 (Validation Rules table) — keep backend and frontend ranges in sync exactly:

| Field | Range |
|---|---|
| Systolic BP | 50–300 |
| Diastolic BP | 20–200 |
| Heart Rate | 20–300 |
| Resp. Rate | 5–60 |
| Temperature | 30.0–45.0 |
| O₂ Saturation | 50–100 |

Create `backend/src/vitals/dto/update-vitals.dto.ts`:

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateVitalsDto } from './create-vitals.dto';

export class UpdateVitalsDto extends PartialType(CreateVitalsDto) {}
```

**Business rule:** A `CreateVitalsDto` (and by extension `UpdateVitalsDto`) must not be accepted if **all six measures are null/undefined** — there must be at least one measurement present, otherwise the record is meaningless. Enforce this in the service layer (see 2.3), not the DTO, since DTO-level cross-field validation with `class-validator` is awkward; a clear `BadRequestException` in the service is simpler and matches the style used elsewhere in this codebase (e.g. `ProblemsService.assertValidParent` throws `BadRequestException` directly rather than via custom validators).

### 2.2 Controller

Create `backend/src/vitals/vitals.controller.ts`:

```typescript
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
import { VitalsService } from './vitals.service';
import { CreateVitalsDto } from './dto/create-vitals.dto';
import { UpdateVitalsDto } from './dto/update-vitals.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Vitals')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/vitals')
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Get()
  @ApiOperation({ summary: 'List vital signs history for a patient, newest first — All roles' })
  @ApiOkResponse({ description: 'Paginated vitals history.' })
  async findAll(
    @Param('patientId') patientId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.vitalsService.findAll(patientId, page, limit);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get the single most recent vital signs record — All roles' })
  @ApiOkResponse({ description: 'Latest vitals record, or null if none recorded.' })
  async findLatest(@Param('patientId') patientId: string) {
    return this.vitalsService.findLatest(patientId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record vital signs (Doctor, Nurse, Admin)' })
  @ApiCreatedResponse({ description: 'Vitals record created.' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreateVitalsDto,
    @CurrentUser() user: User,
  ) {
    return this.vitalsService.create(patientId, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  @ApiOperation({ summary: 'Edit a vital signs record (Doctor, Nurse, Admin)' })
  async update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVitalsDto,
  ) {
    return this.vitalsService.update(patientId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a vital signs record (Doctor, Admin — Nurse cannot delete)' })
  async remove(@Param('patientId') patientId: string, @Param('id') id: string) {
    return this.vitalsService.remove(patientId, id);
  }
}
```

RBAC note: per the MVP spec RBAC matrix and Section 9.7, Nurses can add/edit vitals but **not delete** — only `DELETE` excludes `Role.NURSE`. Double-check this matches `frontend/design-standard.md` Section 12 ("Add/Edit Vital Signs: ✓ all roles; Delete Vital Signs: ✓ Admin, ✓ Doctor, ✗ Nurse").

### 2.3 Service

Create `backend/src/vitals/vitals.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, VitalSign } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVitalsDto } from './dto/create-vitals.dto';
import { UpdateVitalsDto } from './dto/update-vitals.dto';

type PrismaTx = Prisma.TransactionClient;

const MEASURE_FIELDS = ['sbp', 'dbp', 'heartRate', 'respiratoryRate', 'temperature', 'oxygenSaturation'] as const;

@Injectable()
export class VitalsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // LIST — paginated, newest first
  // ─────────────────────────────────────────────
  async findAll(patientId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.vitalSign.findMany({
        where: { patientId },
        skip,
        take: limit,
        orderBy: { measuredAt: 'desc' },
        include: {
          measuredByUser: { select: { firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.vitalSign.count({ where: { patientId } }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────
  // LATEST — single most recent record (or null)
  // Used by: Dashboard VitalsCard, and Phase 8 Initial Note pre-fill.
  // ─────────────────────────────────────────────
  async findLatest(patientId: string): Promise<VitalSign | null> {
    return this.prisma.vitalSign.findFirst({
      where: { patientId },
      orderBy: { measuredAt: 'desc' },
      include: {
        measuredByUser: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  /**
   * Internal helper — NOT exposed as a route. Used by:
   *  - Phase 8 (Initial Note) to pre-fill the VitalsSummaryRow on note load
   *  - Phase 9 (Progress Notes) for the same pre-fill behavior
   * Accepts an optional transaction client so calling modules can read inside
   * their own $transaction if needed. See Section 7 ("Cross-Module
   * Integration Contract") in PHASE_7_VITAL_SIGNS.md for the full contract.
   */
  async findLatestForPatient(
    patientId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<VitalSign | null> {
    return client.vitalSign.findFirst({
      where: { patientId },
      orderBy: { measuredAt: 'desc' },
    });
  }

  async findOne(patientId: string, id: string): Promise<VitalSign> {
    const record = await this.prisma.vitalSign.findFirst({ where: { id, patientId } });
    if (!record) throw new NotFoundException(`Vital signs record ${id} not found for this patient.`);
    return record;
  }

  // ─────────────────────────────────────────────
  // CREATE — standalone vitals (visitId always null in Phase 7)
  // ─────────────────────────────────────────────
  async create(patientId: string, dto: CreateVitalsDto, userId: string): Promise<VitalSign> {
    this.assertAtLeastOneMeasure(dto);
    return this.prisma.vitalSign.create({
      data: {
        patientId,
        visitId: null,
        sbp: dto.sbp ?? null,
        dbp: dto.dbp ?? null,
        heartRate: dto.heartRate ?? null,
        respiratoryRate: dto.respiratoryRate ?? null,
        temperature: dto.temperature ?? null,
        oxygenSaturation: dto.oxygenSaturation ?? null,
        measuredBy: userId,
        measuredAt: new Date(dto.measuredAt),
      },
    });
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(patientId: string, id: string, dto: UpdateVitalsDto): Promise<VitalSign> {
    const existing = await this.findOne(patientId, id);

    const merged: CreateVitalsDto = {
      sbp: dto.sbp !== undefined ? dto.sbp : existing.sbp ?? undefined,
      dbp: dto.dbp !== undefined ? dto.dbp : existing.dbp ?? undefined,
      heartRate: dto.heartRate !== undefined ? dto.heartRate : existing.heartRate ?? undefined,
      respiratoryRate:
        dto.respiratoryRate !== undefined ? dto.respiratoryRate : existing.respiratoryRate ?? undefined,
      temperature:
        dto.temperature !== undefined ? dto.temperature : existing.temperature ? Number(existing.temperature) : undefined,
      oxygenSaturation:
        dto.oxygenSaturation !== undefined ? dto.oxygenSaturation : existing.oxygenSaturation ?? undefined,
      measuredAt: dto.measuredAt ?? existing.measuredAt.toISOString(),
    };
    this.assertAtLeastOneMeasure(merged);

    const data: Prisma.VitalSignUpdateInput = {};
    if (dto.sbp !== undefined) data.sbp = dto.sbp;
    if (dto.dbp !== undefined) data.dbp = dto.dbp;
    if (dto.heartRate !== undefined) data.heartRate = dto.heartRate;
    if (dto.respiratoryRate !== undefined) data.respiratoryRate = dto.respiratoryRate;
    if (dto.temperature !== undefined) data.temperature = dto.temperature;
    if (dto.oxygenSaturation !== undefined) data.oxygenSaturation = dto.oxygenSaturation;
    if (dto.measuredAt !== undefined) data.measuredAt = new Date(dto.measuredAt);

    return this.prisma.vitalSign.update({ where: { id }, data });
  }

  // ─────────────────────────────────────────────
  // DELETE — hard delete (no soft-delete field on this model)
  // ─────────────────────────────────────────────
  async remove(patientId: string, id: string): Promise<VitalSign> {
    await this.findOne(patientId, id);
    return this.prisma.vitalSign.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  private assertAtLeastOneMeasure(dto: Partial<CreateVitalsDto>): void {
    const hasAny = MEASURE_FIELDS.some((field) => dto[field] !== undefined && dto[field] !== null);
    if (!hasAny) {
      throw new BadRequestException(
        'At least one vital sign measurement (SBP, DBP, heart rate, respiratory rate, temperature, or oxygen saturation) is required.',
      );
    }
  }
}
```

### 2.4 Module

Update `backend/src/vitals/vitals.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';

@Module({
  controllers: [VitalsController],
  providers: [VitalsService],
  exports: [VitalsService], // required so Phase 8/9 modules can inject it later
})
export class VitalsModule {}
```

`backend/src/app.module.ts` already imports `VitalsModule` — no change needed there.

### 2.5 Swagger Tag

In `backend/src/main.ts`, the `.addTag('Vitals', 'Vital signs recording and history')` entry already exists in the `DocumentBuilder` config — no change needed.

---

## 3. Frontend — Types and API Layer

### 3.1 Types

Create `frontend/src/types/vitals.ts`:

```typescript
export interface VitalsMeasuredByUser {
  firstName: string;
  lastName: string;
  role: 'DOCTOR' | 'NURSE' | 'ADMIN';
}

export interface VitalSign {
  id: string;
  patientId: string;
  visitId: string | null;
  sbp: number | null;
  dbp: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperature: string | null; // Prisma Decimal serializes as string
  oxygenSaturation: number | null;
  measuredBy: string | null;
  measuredAt: string;
  createdAt: string;
  measuredByUser?: VitalsMeasuredByUser | null;
}

export interface VitalsResponse {
  data: VitalSign[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateVitalsInput {
  sbp?: number;
  dbp?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  measuredAt: string;
}

export type UpdateVitalsInput = Partial<CreateVitalsInput>;
```

### 3.2 Utility helpers

Create `frontend/src/lib/vitals-utils.ts`:

```typescript
import type { VitalSign } from '@/types/vitals';

export function isRecentlyUpdated(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
}

/** True if the reading is from a date earlier than today (local time). */
export function isStaleReading(measuredAt: string | null | undefined): boolean {
  if (!measuredAt) return true;
  const measured = new Date(measuredAt);
  const now = new Date();
  return now.getTime() - measured.getTime() > 24 * 60 * 60 * 1000;
}

export function formatTemperature(temperature: string | number | null | undefined): string {
  if (temperature === null || temperature === undefined) return '—';
  const num = Number(temperature);
  return num.toFixed(1);
}

export function formatBloodPressure(sbp: number | null, dbp: number | null): string {
  if (sbp == null && dbp == null) return '—/—';
  return `${sbp ?? '—'}/${dbp ?? '—'}`;
}

/**
 * Vital range classification, mirrored on both Dashboard card and Vitals form
 * for the colored-status treatment described in design-standard.md Section 7.2.
 * These are coarse clinical thresholds for visual triage only — not diagnostic.
 */
export function classifyBloodPressure(sbp: number | null, dbp: number | null): 'normal' | 'warn' | 'critical' {
  if (sbp == null || dbp == null) return 'normal';
  if (sbp >= 180 || dbp >= 120) return 'critical';
  if (sbp >= 140 || dbp >= 90) return 'warn';
  return 'normal';
}

export function classifyHeartRate(hr: number | null): 'normal' | 'warn' | 'critical' {
  if (hr == null) return 'normal';
  if (hr < 40 || hr > 150) return 'critical';
  if (hr < 60 || hr > 100) return 'warn';
  return 'normal';
}

export function classifyOxygenSaturation(spo2: number | null): 'normal' | 'warn' | 'critical' {
  if (spo2 == null) return 'normal';
  if (spo2 < 90) return 'critical';
  if (spo2 < 95) return 'warn';
  return 'normal';
}

export function classifyTemperature(temp: string | number | null): 'normal' | 'warn' | 'critical' {
  if (temp == null) return 'normal';
  const num = Number(temp);
  if (num >= 39.5 || num <= 35.0) return 'critical';
  if (num >= 38.0 || num < 36.0) return 'warn';
  return 'normal';
}

export function classifyRespiratoryRate(rr: number | null): 'normal' | 'warn' | 'critical' {
  if (rr == null) return 'normal';
  if (rr < 8 || rr > 30) return 'critical';
  if (rr < 12 || rr > 20) return 'warn';
  return 'normal';
}
```

### 3.3 TanStack Query Hooks

Create `frontend/src/hooks/useVitals.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { VitalSign, VitalsResponse, CreateVitalsInput, UpdateVitalsInput } from '@/types/vitals';

export function useVitals(patientId: string | null, page = 1, limit = 10) {
  return useQuery<VitalsResponse>({
    queryKey: ['vitals', patientId, page, limit],
    queryFn: () => apiRequest<VitalsResponse>(`/patients/${patientId}/vitals?page=${page}&limit=${limit}`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

export function useLatestVitals(patientId: string | null) {
  return useQuery<VitalSign | null>({
    queryKey: ['vitals', patientId, 'latest'],
    queryFn: () => apiRequest<VitalSign | null>(`/patients/${patientId}/vitals/latest`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

function invalidateVitals(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['vitals', patientId] });
}

export function useCreateVitals(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVitalsInput) =>
      apiRequest<VitalSign>(`/patients/${patientId}/vitals`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateVitals(qc, patientId),
  });
}

export function useUpdateVitals(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateVitalsInput & { id: string }) =>
      apiRequest<VitalSign>(`/patients/${patientId}/vitals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateVitals(qc, patientId),
  });
}

export function useDeleteVitals(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<VitalSign>(`/patients/${patientId}/vitals/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateVitals(qc, patientId),
  });
}
```

Note: unlike `useMedications`/`useProblems`, vitals mutations do **not** use optimistic `onMutate` cache patching. Each create/edit/delete touches `measuredAt`-ordered pagination and the separate `latest` query key simultaneously — patching both consistently is more error-prone than the gain is worth for a form that already shows its own loading state. Simple invalidate-on-success is correct here; do not add optimistic updates unless explicitly asked.

---

## 4. Frontend — Components

Build these in `frontend/src/components/vitals/`. Follow the exact card-header / table patterns from `frontend/src/components/medications/MedicationsScreen.tsx` and `frontend/src/components/problems/ProblemListScreen.tsx` — uppercase 10px section labels, the `📋`-style emoji-in-rounded-box icon slot, badge pill counts, etc.

### 4.1 `VitalsForm.tsx`

A form (not a modal — vitals get their own full screen, unlike problems/medications which use modals) with:
- A read-only **patient identifier banner** at the top: name, age, sex, patient code — reuse the same visual pattern as `PatientBanner.tsx`'s left column (avatar + name + code chip), but as a slim single-row strip, not a full duplicate banner. Pull patient data via `usePatient(patientId)` (already exists).
- A `datetime-local` input for `measuredAt`, defaulting to `new Date()` formatted for the input, per design-standard.md Section 13 pattern (`new Date()` default on creation forms).
- Six measure inputs, each using the "input with unit addon" pattern from `design-standard.md` Section 6.4 (`flex` container, input + suffix span for unit, e.g. "mmHg", "bpm", "breaths/min", "°C", "%").
- Validation: client-side ranges must mirror the backend table in Section 2.1 of this file exactly. Show inline errors per `design-standard.md` Section 11 styling (`text-[12px] text-red mt-1`, border turns `border-red-border`).
- Enforce "at least one field filled" client-side too, with a single form-level error message if all six are empty (mirrors the backend's `BadRequestException`).
- Two modes: **create** (default) and **edit** (when editing an existing row from the history table — pass the record in as a prop, similar to how `MedicationFormModal` takes an `editing` prop). Unlike medications, do **not** wrap this in a modal — render it inline at the top of `VitalsScreen`, collapsible/closable, OR use a modal if that better matches existing UX; **prefer inline form panel above the history table** to match the "form + history table" framing from Section 11.7 of the spec (`VitalsScreen — record form + history table`).

### 4.2 `VitalsHistoryTable.tsx`

Paginated table below the form:
- Columns: Date/Time (mono font, like other date columns in this codebase), SBP/DBP, HR, RR, Temp, SpO2, Recorded By (name + role badge), Actions.
- Use the colored-value-by-severity classification helpers from `vitals-utils.ts` (`classifyBloodPressure`, etc.) to color individual cell values `text-red`/`text-amber`/inherit, matching the `design-standard.md` Section 6.5 "Value coloring utilities" convention (critical → `text-red font-semibold`, warning → `text-amber font-medium`, normal → default text color — do **not** use `text-green` for normal vitals values, that's reserved for explicitly positive/active states elsewhere in the app).
- Edit/Delete buttons per row, role-gated:
  - Edit: visible to Doctor, Nurse, Admin.
  - Delete: visible to Doctor, Admin only (use `useAuthStore` role check, same pattern as `MedicationsScreen.tsx`'s `canManage` boolean, but split into two booleans here: `canEdit` and `canDelete`, since the two actions have different RBAC).
- Pagination controls matching the numbered-button pattern from `AccountsPage.tsx`.

### 4.3 `VitalsScreen.tsx`

Container component, the default export wired into the page route:

```typescript
'use client';

import { useParams } from 'next/navigation';
import { VitalsScreen } from '@/components/vitals/VitalsScreen';

export default function VitalsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  return <VitalsScreen patientId={patientId} />;
}
```

Replace the contents of `frontend/src/app/dashboard/[patientId]/vitals/page.tsx` with the above, then build `VitalsScreen.tsx` to:
- Hold `editing: VitalSign | null` state (mirrors `ProblemListScreen`'s `editing` state for its modal).
- Render `VitalsForm` (create or edit mode), then `VitalsHistoryTable` below it.
- Wire `useCreateVitals`, `useUpdateVitals`, `useDeleteVitals`, `useVitals` together with `toast.success`/`toast.error` (sonner) exactly like `MedicationsScreen.tsx` does — same message tone ("Vitals recorded.", "Vitals updated.", "Vitals record deleted.").
- Confirm before delete using the same `confirm(...)` pattern used in `MedicationsScreen.handleDelete` (this codebase does not yet use a custom confirm dialog component — stay consistent, don't introduce one for this phase).

### 4.4 `VitalsCard.tsx` (Dashboard widget) — replaces `VitalsStripEmpty.tsx`

This is the component referenced by the spec as `VitalsCard — latest 6 measurements with datetime; 48h highlight; 'Record Vitals' button` (Section 11.2).

Replace `frontend/src/components/vitals/VitalsStripEmpty.tsx` with a real, data-driven version (keep the same export name `VitalsStripEmpty` so the existing import in `frontend/src/app/dashboard/[patientId]/page.tsx` continues to work, **or** rename the file/export to `VitalsCard` and update that one import site — prefer renaming to `VitalsCard.tsx` / `VitalsCard` for clarity, since it now has real content, and update the import in `page.tsx`'s `VitalsSection` accordingly):

- Uses `useLatestVitals(patientId)`.
- Loading state: render `VitalsStripSkeleton` (already exists, reuse as-is).
- Empty state (no vitals ever recorded): keep the existing placeholder visual treatment from `VitalsStripEmpty.tsx` (amber "No reading today" badge, em-dash placeholders) but make the "No reading today" badge conditional — only show it if there truly is no latest record OR the latest record's `measuredAt` is not from today (use `isStaleReading` semantics, but specifically "not today" rather than "not within 24h" for this particular badge, since the spec explicitly says "No reading today").
- Populated state: 5-column grid (`grid-cols-5`, matching `design-standard.md` Section 7.2 exactly), each cell showing one vital with its unit and severity-based coloring (reuse the `classify*` helpers).
- 48-hour highlight: wrap the whole card with the `recent` conditional border treatment used in `ProblemListCard.tsx` / `MedicationListCard.tsx` (`border-l-[3px] border-l-accent` when `isRecentlyUpdated(latest.measuredAt)` is true) for visual consistency with those two dashboard cards — even though the spec separately calls out a "48-hour indicator" specifically for this card, reuse the existing pattern rather than inventing a new visual treatment.
- A **"Record Vitals"** button in the card header (next to or replacing where `MedicationListCard`/`ProblemListCard` put their "Manage" button) that routes to `/dashboard/${patientId}/vitals`.
- Card header icon: keep `❤️` to match the existing placeholder.

Update the import and JSX in `frontend/src/app/dashboard/[patientId]/page.tsx`'s `VitalsSection` function if you renamed the component/file.

### 4.5 Skeleton

`VitalsStripSkeleton.tsx` already exists and matches the 5-column grid layout. No changes required unless the final `VitalsCard` layout diverges from a 5-column grid, in which case update the skeleton to match column-for-column.

---

## 5. Dashboard Wiring

In `frontend/src/app/dashboard/[patientId]/page.tsx`:
- The `VitalsSection` function currently renders `<VitalsStripEmpty patientId={patientId} />` unconditionally — this already correctly defers all loading/empty/populated logic into the component itself, matching the Suspense-boundary pattern used for the other cards. Keep this structure; just update the import/JSX to point at the new component if renamed per Section 4.4.
- No other change to the dashboard page is needed — `ProblemListCard` and `MedicationListCard` already sit in the grid below; `VitalsCard` sits above them per the spec's required section order (Banner → Vitals Strip → Problem/Medication grid → Visit History).

---

## 6. RBAC Summary (verify against `design-standard.md` Section 12)

| Action | Admin | Doctor | Nurse |
|---|---|---|---|
| View vitals (history, latest, dashboard card) | ✓ | ✓ | ✓ |
| Add vitals | ✓ | ✓ | ✓ |
| Edit vitals | ✓ | ✓ | ✓ |
| Delete vitals | ✓ | ✓ | ✗ |

Enforce this identically on the backend (`@Roles` decorators in Section 2.2) and frontend (button visibility in Section 4.2/4.3). UI elements the current role cannot access must be **hidden entirely**, not disabled — per `design-standard.md` Section 12's closing rule.

---

## 7. Cross-Module Integration Contract (Required Reading Before Phase 8)

Phase 8 (Initial Note) depends on this module in exactly one way: **pre-filling the `VitalsSummaryRow` component at the top of the Initial Note form with the patient's most recent vitals**, per spec Section 11.3 (`VitalsSummaryRow — pre-filled read-only vitals at top`) and the Phase 7 deliverable "Pre-fill latest vitals into Initial Note and Progress Note forms on load."

To make that a zero-friction addition in Phase 8, this phase must ship with both of the following already in place — **do not defer either of them**:

### 7.1 Backend contract: `VitalsService.findLatestForPatient`

Already specified in Section 2.3 above. This is the **only** method Phase 8's `InitialNotesService` will call. Its signature:

```typescript
async findLatestForPatient(
  patientId: string,
  client: Prisma.TransactionClient | PrismaService = this.prisma,
): Promise<VitalSign | null>
```

This mirrors `ProblemsService.findActiveForPatient` and `MedicationsService.findActiveForPatient` exactly — same optional-transaction-client parameter pattern — so that when `InitialNotesModule` is built in Phase 8 and injects `VitalsService` (after adding it to `InitialNotesModule`'s `imports: [VitalsModule]` alongside `ProblemsModule` and `MedicationsModule`), the call site looks identical across all three:

```typescript
// Phase 8 InitialNotesService, illustrative only — do not implement in this phase
const [activeProblems, activeMedications, latestVitals] = await Promise.all([
  this.problemsService.findActiveForPatient(patientId),
  this.medicationsService.findActiveForPatient(patientId),
  this.vitalsService.findLatestForPatient(patientId),
]);
```

`VitalsModule` already `exports: [VitalsService]` per Section 2.4 — this is what allows Phase 8 to import and inject it. **Verify this export is present; it is the single most important line in this phase for unblocking Phase 8.**

### 7.2 Frontend contract: `useLatestVitals` hook

Already specified in Section 3.3 above. Phase 8's `InitialNoteForm` will call `useLatestVitals(patientId)` directly — the exact same hook the Dashboard `VitalsCard` uses — to populate its read-only `VitalsSummaryRow`. No new hook is needed in Phase 8; this is the reason `useLatestVitals` must return the full `VitalSign | null` shape (including `measuredAt` and `measuredByUser`) rather than a stripped-down summary type, since the `VitalsSummaryRow` will also want to display "as of [datetime], recorded by [name]" alongside the read-only values.

### 7.3 What Phase 8 will build on top (informational — not built in this phase)

So the boundary is unambiguous: Phase 8 owns building the `VitalsSummaryRow` component itself (a read-only strip rendered inside `InitialNoteForm`, using `useLatestVitals` from this phase) and the decision of whether/how to let the clinician jump to the Vitals screen to record fresh vitals before completing the note. **This phase does not build `VitalsSummaryRow` and must not add an "Initial Note" link or button anywhere in the Vitals module** — that linkage is Phase 8's responsibility, kept one-directional (Initial Note reads from Vitals; Vitals does not know about Initial Note) to avoid a circular module dependency between `VitalsModule` and `InitialNotesModule`.

### 7.4 Why `visitId` stays null in this phase

The `VitalSign.visitId` column exists for a future linkage between a specific visit's vitals and that visit's note, but **Phase 7's UI never sets it** — vitals recorded via the Vitals screen are always standalone (`visitId: null`). Phase 8 does not need vitals linked to its visit; it only needs the *latest* reading regardless of which visit (or no visit) it came from. Do not add visit-linking UI or logic in this phase — it is out of scope and not required by Phase 8's pre-fill requirement.

---

## 8. Acceptance Checklist

Before considering this phase complete, verify:

- [ ] `GET /patients/:patientId/vitals` returns paginated, `measuredAt DESC` ordered records, accessible to all three roles.
- [ ] `GET /patients/:patientId/vitals/latest` returns the single most recent record or `null`, accessible to all three roles.
- [ ] `POST /patients/:patientId/vitals` is blocked for roles other than Doctor/Nurse/Admin, rejects all-empty-measures payloads with a 400, and always sets `measuredBy` from the JWT user and `visitId: null`.
- [ ] `PATCH /patients/:patientId/vitals/:id` is blocked for roles other than Doctor/Nurse/Admin, and the merged result still can't end up with all six measures null.
- [ ] `DELETE /patients/:patientId/vitals/:id` is blocked for Nurse (403), allowed for Doctor/Admin.
- [ ] All six measure validation ranges match exactly between `CreateVitalsDto` (backend) and `VitalsForm` (frontend).
- [ ] Dashboard `VitalsCard` shows skeleton → empty/populated state correctly, with the 48-hour accent border and "No reading today" badge behaving as specified.
- [ ] `VitalsScreen` shows the patient identifier banner, the create/edit form, and a paginated history table, with role-gated Edit/Delete buttons hidden (not disabled) for unauthorized roles.
- [ ] `VitalsService.findLatestForPatient` exists, accepts an optional transaction client, and `VitalsService` is exported from `VitalsModule`.
- [ ] `useLatestVitals` hook exists in `frontend/src/hooks/useVitals.ts` and returns the full `VitalSign` shape (not a reduced projection).
- [ ] No migration was created or run — the `vital_signs` table and `VitalSign` Prisma model are already correct from Phase 2.
- [ ] No code in this phase references `InitialNote`, `initial-note`, or any Phase 8 route/table — the dependency direction is strictly Phase 8 → Phase 7, never the reverse.