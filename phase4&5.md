# DAMAYAN EMR — Phase 4 & 5 Build Prompt
## Patient Management + Visit Management + Clinical Workspace Shell

**Version:** 1.0  
**Dependencies:** Phase 3 complete (Auth, RBAC, Admin Panel, Login all working)  
**Stack:** Next.js 16 · NestJS 11 · Supabase · Prisma · TypeScript · Tailwind CSS v4 · Shadcn UI

---

## Overview

This prompt executes **Phase 4 (Patient Management)** and **Phase 5 (Visit Management)** together. Because Phase 5 visits are only meaningful in the context of the clinical workspace shell that renders patient data, this prompt also includes the **full application shell** (Topbar, Sidebar, ScreenNav, patient workspace layout) and the **Dashboard screen** with the patient banner and visit history section. This is the gateway that connects logged-in users (Doctor/Nurse roles) to their working environment.

**Phase 4 Deliverables:**
- NestJS `PatientsModule` — full CRUD API with patient code auto-generation
- Frontend sidebar patient list with alphabetical grouping, search, and allergy indicators
- `NewPatientModal` with React Hook Form + Zod validation
- Patient selection updates `patientStore` and loads Dashboard

**Phase 5 Deliverables:**
- NestJS `VisitsModule` — visit CRUD, paired with note creation
- Visit history section on Dashboard (5 latest, expandable)
- Visit record displays physician name, datetime, visit type, status
- `problem_changes` and `medication_changes` JSONB snapshot support on visit

**Shell Deliverables (prerequisite for both phases to be usable):**
- Topbar — logo, global patient search, role pill, `+ New Note` button, user avatar with sign-out
- Sidebar — patient search, shared patient list (all users), `New Patient` modal trigger
- ScreenNav — per-patient tab bar (Dashboard, Vital Signs, Note Timeline, Initial Note, Problem List, Medications, Documents, Logs)
- Patient workspace layout (`/dashboard/[patientId]/...`)
- Dashboard screen — Patient Banner, Vitals strip (empty state), Problem List card (empty state), Medication List card (empty state), Visit History

---

## Design System Reference

All visual output MUST use these design tokens from `frontend/design-standard.md`. **Never hardcode hex values.** Use CSS custom properties or the inline equivalents listed below for inline-style components.

### Color Tokens
```
--bg: #F0F2F5              (page background)
--surface: #FFFFFF         (cards, sidebar, topbar)
--surface-2: #F7F8FA       (card headers, input fields, hover states)
--surface-3: #EFF1F5       (hover states, selected rows)
--border: #D1D5E0          (default borders)
--border-strong: #9BA3B5   (focus rings, hover borders)
--text-primary: #0D1117    (page titles, patient names)
--text-secondary: #374151  (body text, form values)
--text-muted: #6B7280      (timestamps, helper text)
--accent: #0A6E5F          (primary action — teal-green)
--accent-hover: #085A4E    (hover on primary actions)
--accent-light: #D4EDE9    (accent backgrounds, role pills)
--accent-mid: #0D9E8C      (screen nav labels)
--amber: #92400E / --amber-bg: #FEF3C7 / --amber-border: #F59E0B
--red: #991B1B / --red-bg: #FEE2E2 / --red-border: #EF4444
--green: #14532D / --green-bg: #DCFCE7 / --green-border: #22C55E
--purple: #4C1D95 / --purple-bg: #EDE9FE / --purple-border: #8B5CF6
```

### Layout Dimensions
```
--topbar-h: 56px
--sidebar-w: 280px (collapsed: 0px)
```

### Typography
- **Primary font:** IBM Plex Sans (already loaded in `frontend/src/app/layout.tsx`)
- **Mono font:** IBM Plex Mono (for IDs, timestamps, vitals values)
- Min body text: 13px. Card header labels: 10px/700/UPPERCASE. Badges: 9px/700/UPPERCASE.

### Key Component Rules
- Cards: `background: #FFFFFF`, `border: 1px solid #D1D5E0`, `border-radius: 8px`, `box-shadow: 0 4px 12px rgba(0,0,0,0.05)`
- Card headers: `background: #F7F8FA`, `border-bottom: 1px solid #D1D5E0`, `padding: 10px 14px`, label `10px/700/UPPERCASE`
- Primary buttons: `height: 28px`, `background: #0A6E5F`, `color: #fff`, `border-radius: 6px`, `font: 11px/600`
- Secondary buttons: `height: 28px`, `background: #F7F8FA`, `color: #374151`, `border: 1px solid #D1D5E0`, `border-radius: 6px`, `font: 11px/600`
- Inputs: `height: 34px`, `border: 1px solid #D1D5E0`, `border-radius: 6px`, `font: 13px`, focus: `border-color: #0A6E5F`, `box-shadow: 0 0 0 3px rgba(10,110,95,0.12)`

---

## Part 1: Backend — PatientsModule

### 1.1 Create `backend/src/patients/dto/create-patient.dto.ts`

```typescript
import {
  IsString, IsEmail, IsEnum, IsOptional, IsDateString,
  MinLength, MaxLength, IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sex } from '@prisma/client';

export class CreatePatientDto {
  @ApiProperty({ example: 'Dela Cruz' })
  @IsString() @IsNotEmpty() @MaxLength(30)
  lastName: string;

  @ApiProperty({ example: 'Juan' })
  @IsString() @IsNotEmpty() @MaxLength(30)
  firstName: string;

  @ApiPropertyOptional({ example: 'Santos' })
  @IsOptional() @IsString() @MaxLength(30)
  middleName?: string;

  @ApiPropertyOptional({ example: 'Jr.' })
  @IsOptional() @IsString() @MaxLength(3)
  extension?: string;

  @ApiProperty({ example: '1985-03-14' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Sex })
  @IsEnum(Sex)
  sex: Sex;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  addressStreet?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  addressBarangay?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  addressCity?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  addressRegion?: string;
}
```

### 1.2 Create `backend/src/patients/dto/update-patient.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';
export class UpdatePatientDto extends PartialType(CreatePatientDto) {}
```

### 1.3 Create `backend/src/patients/patients.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  // ── Patient code generator: PT-XXXX (zero-padded sequential) ──────────────

  private async generatePatientCode(): Promise<string> {
    const last = await this.prisma.patient.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { patientCode: true },
    });
    if (!last) return 'PT-0001';
    const match = last.patientCode.match(/PT-(\d+)/);
    if (!match) return 'PT-0001';
    const next = parseInt(match[1], 10) + 1;
    return `PT-${String(next).padStart(4, '0')}`;
  }

  // ── List / search ──────────────────────────────────────────────────────────

  async findAll(filters: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = { isActive: true };
    if (search) {
      where.OR = [
        { lastName:    { contains: search, mode: 'insensitive' } },
        { firstName:   { contains: search, mode: 'insensitive' } },
        { patientCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        // Include latest allergy flag from initial note if it exists
        include: {
          visits: {
            where: { visitType: 'INITIAL' },
            include: { initialNote: { select: { allergies: true } } },
            orderBy: { visitDatetime: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data: data.map((p) => ({
        ...p,
        allergies: p.visits?.[0]?.initialNote?.allergies ?? null,
        visits: undefined, // strip raw visits from list response
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Single patient (with counts for banner) ────────────────────────────────

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        visits: {
          where: { visitType: 'INITIAL' },
          include: { initialNote: { select: { allergies: true } } },
          orderBy: { visitDatetime: 'desc' },
          take: 1,
        },
        _count: {
          select: { problems: true, medications: true, visits: true },
        },
      },
    });
    if (!patient) throw new NotFoundException(`Patient ${id} not found.`);
    return {
      ...patient,
      allergies: patient.visits?.[0]?.initialNote?.allergies ?? null,
      visits: undefined,
    };
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(dto: CreatePatientDto, userId: string) {
    const patientCode = await this.generatePatientCode();
    return this.prisma.patient.create({
      data: {
        patientCode,
        lastName:        dto.lastName,
        firstName:       dto.firstName,
        middleName:      dto.middleName,
        extension:       dto.extension,
        dateOfBirth:     new Date(dto.dateOfBirth),
        sex:             dto.sex,
        addressStreet:   dto.addressStreet,
        addressBarangay: dto.addressBarangay,
        addressCity:     dto.addressCity,
        addressRegion:   dto.addressRegion,
        createdBy:       userId,
      },
    });
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePatientDto) {
    await this.findOne(id);
    return this.prisma.patient.update({
      where: { id },
      data: {
        ...(dto.lastName        !== undefined && { lastName:        dto.lastName }),
        ...(dto.firstName       !== undefined && { firstName:       dto.firstName }),
        ...(dto.middleName      !== undefined && { middleName:      dto.middleName }),
        ...(dto.extension       !== undefined && { extension:       dto.extension }),
        ...(dto.dateOfBirth     !== undefined && { dateOfBirth:     new Date(dto.dateOfBirth) }),
        ...(dto.sex             !== undefined && { sex:             dto.sex }),
        ...(dto.addressStreet   !== undefined && { addressStreet:   dto.addressStreet }),
        ...(dto.addressBarangay !== undefined && { addressBarangay: dto.addressBarangay }),
        ...(dto.addressCity     !== undefined && { addressCity:     dto.addressCity }),
        ...(dto.addressRegion   !== undefined && { addressRegion:   dto.addressRegion }),
      },
    });
  }
}
```

### 1.4 Create `backend/src/patients/patients.controller.ts`

```typescript
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiCreatedResponse, ApiOkResponse,
} from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Patients')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'List / search all active patients' })
  @ApiOkResponse({ description: 'Paginated patient list.' })
  async findAll(
    @Query('search') search?: string,
    @Query('page')   page?:   number,
    @Query('limit')  limit?:  number,
  ) {
    return this.patientsService.findAll({ search, page, limit });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new patient (Doctor, Admin)' })
  @ApiCreatedResponse({ description: 'Patient created.' })
  async create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: User,
  ) {
    return this.patientsService.create(dto, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single patient with banner data' })
  async findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Update patient demographics (Doctor, Admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(id, dto);
  }
}
```

### 1.5 Update `backend/src/patients/patients.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
```

---

## Part 2: Backend — VisitsModule

### 2.1 Create `backend/src/visits/dto/create-visit.dto.ts`

```typescript
import { IsEnum, IsDateString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitType } from '@prisma/client';

export class CreateVisitDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ example: '2026-06-12T09:00:00.000Z' })
  @IsDateString()
  visitDatetime: string;

  @ApiProperty({ enum: VisitType })
  @IsEnum(VisitType)
  visitType: VisitType;
}
```

### 2.2 Create `backend/src/visits/visits.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { VisitType } from '@prisma/client';

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  async findAllByPatient(patientId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.visit.findMany({
        where: { patientId },
        skip,
        take: limit,
        orderBy: { visitDatetime: 'desc' },
        include: {
          physician: {
            select: { firstName: true, lastName: true, middleName: true },
          },
          initialNote:  { select: { status: true, chiefComplaint: true } },
          progressNote: { select: { status: true, subjective: true } },
        },
      }),
      this.prisma.visit.count({ where: { patientId } }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      include: {
        physician: {
          select: { firstName: true, lastName: true, middleName: true },
        },
        initialNote:  true,
        progressNote: true,
      },
    });
    if (!visit) throw new NotFoundException(`Visit ${id} not found.`);
    return visit;
  }

  // Called internally by InitialNotes and ProgressNotes modules.
  // Not exposed directly for standalone visit creation —
  // visits are always created alongside a note.
  async createForNote(
    patientId: string,
    physicianId: string,
    visitType: VisitType,
    visitDatetime: Date,
  ) {
    return this.prisma.visit.create({
      data: {
        patientId,
        physicianId,
        visitDatetime,
        visitType,
        status: 'DRAFT',
      },
    });
  }

  async updateChangeSummary(
    visitId: string,
    problemChanges?: object,
    medicationChanges?: object,
  ) {
    return this.prisma.visit.update({
      where: { id: visitId },
      data: {
        ...(problemChanges    && { problemChanges }),
        ...(medicationChanges && { medicationChanges }),
      },
    });
  }
}
```

### 2.3 Create `backend/src/visits/visits.controller.ts`

```typescript
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Visits')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @ApiOperation({ summary: 'List visits for a patient (newest first)' })
  async findAll(
    @Param('patientId') patientId: string,
    @Query('page')      page?:      number,
    @Query('limit')     limit?:     number,
  ) {
    return this.visitsService.findAllByPatient(patientId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single visit with note summary' })
  async findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }
}
```

### 2.4 Update `backend/src/visits/visits.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
```

---

## Part 3: Frontend — Stores

### 3.1 Create `frontend/src/stores/patientStore.ts`

```typescript
import { create } from 'zustand';

interface PatientSummary {
  id: string;
  patientCode: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  extension?: string | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  allergies?: string | null;
  addressBarangay?: string | null;
  addressCity?: string | null;
  addressRegion?: string | null;
}

interface PatientState {
  activePatient: PatientSummary | null;
  setActivePatient: (patient: PatientSummary | null) => void;
}

export const usePatientStore = create<PatientState>((set) => ({
  activePatient: null,
  setActivePatient: (patient) => set({ activePatient: patient }),
}));
```

### 3.2 Create `frontend/src/stores/uiStore.ts`

```typescript
import { create } from 'zustand';

type ActiveScreen =
  | 'dashboard'
  | 'vitals'
  | 'note-timeline'
  | 'initial-note'
  | 'problems'
  | 'medications'
  | 'documents'
  | 'logs';

interface UiState {
  sidebarCollapsed: boolean;
  documentationPanelOpen: boolean;
  activeScreen: ActiveScreen;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setDocumentationPanelOpen: (v: boolean) => void;
  setActiveScreen: (s: ActiveScreen) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  documentationPanelOpen: false,
  activeScreen: 'dashboard',
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setDocumentationPanelOpen: (v) => set({ documentationPanelOpen: v }),
  setActiveScreen: (s) => set({ activeScreen: s }),
}));
```

---

## Part 4: Frontend — Types

### 4.1 Create `frontend/src/types/patient.ts`

```typescript
export interface Patient {
  id: string;
  patientCode: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  extension?: string | null;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  addressStreet?: string | null;
  addressBarangay?: string | null;
  addressCity?: string | null;
  addressRegion?: string | null;
  addressCountry: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  allergies?: string | null;
  _count?: {
    problems: number;
    medications: number;
    visits: number;
  };
}

export interface PatientsResponse {
  data: Patient[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### 4.2 Create `frontend/src/types/visit.ts`

```typescript
export interface VisitPhysician {
  firstName: string;
  lastName: string;
  middleName?: string | null;
}

export interface Visit {
  id: string;
  patientId: string;
  physicianId: string;
  visitDatetime: string;
  visitType: 'INITIAL' | 'PROGRESS';
  status: 'DRAFT' | 'PUBLISHED';
  problemChanges?: unknown;
  medicationChanges?: unknown;
  createdAt: string;
  updatedAt: string;
  physician?: VisitPhysician;
  initialNote?: { status: string; chiefComplaint: string } | null;
  progressNote?: { status: string; subjective: string } | null;
}

export interface VisitsResponse {
  data: Visit[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

---

## Part 5: Frontend — Hooks

### 5.1 Create `frontend/src/hooks/usePatients.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { PatientsResponse, Patient } from '@/types/patient';

export function usePatients(search = '', page = 1, limit = 100) {
  const params = new URLSearchParams({
    ...(search && { search }),
    page: String(page),
    limit: String(limit),
  });
  return useQuery<PatientsResponse>({
    queryKey: ['patients', search, page, limit],
    queryFn: () => apiRequest<PatientsResponse>(`/patients?${params}`),
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function usePatient(id: string | null) {
  return useQuery<Patient>({
    queryKey: ['patient', id],
    queryFn: () => apiRequest<Patient>(`/patients/${id}`),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: unknown) =>
      apiRequest<Patient>('/patients', { method: 'POST', body: JSON.stringify(dto) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patients'] }),
  });
}
```

### 5.2 Create `frontend/src/hooks/useVisits.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { VisitsResponse } from '@/types/visit';

export function useVisits(patientId: string | null, page = 1, limit = 5) {
  return useQuery<VisitsResponse>({
    queryKey: ['visits', patientId, page, limit],
    queryFn: () =>
      apiRequest<VisitsResponse>(
        `/patients/${patientId}/visits?page=${page}&limit=${limit}`,
      ),
    enabled: !!patientId,
    staleTime: 1000 * 30,
  });
}
```

---

## Part 6: Frontend — QueryProvider

### 6.1 Create `frontend/src/components/providers/QueryProvider.tsx`

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 20,
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

### 6.2 Update `frontend/src/app/layout.tsx`

Wrap `{children}` with `<QueryProvider>`:

```typescript
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/QueryProvider";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: "DAMAYAN EMR",
  description: "Problem-Oriented Dynamic Clinical Note Interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", ibmPlexSans.variable, ibmPlexMono.variable)}>
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

---

## Part 7: Frontend — Utility Helpers

### 7.1 Create `frontend/src/lib/patient-utils.ts`

```typescript
/**
 * Calculates age in years from a date of birth string (ISO 8601 or date string).
 */
export function calcAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * Returns patient display name in "Last, First [Middle initial]." format.
 */
export function displayName(p: {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  extension?: string | null;
}): string {
  const parts = [p.lastName + ',', p.firstName];
  if (p.middleName) parts.push(p.middleName[0] + '.');
  if (p.extension) parts.push(p.extension);
  return parts.join(' ');
}

/**
 * Returns initials for an avatar from first and last name.
 */
export function initials(firstName: string, lastName: string): string {
  return `${(firstName[0] ?? '').toUpperCase()}${(lastName[0] ?? '').toUpperCase()}`;
}

/**
 * Groups an array of patients alphabetically by first letter of last name.
 * Returns an array of { letter, patients } buckets, sorted A–Z.
 */
export function groupByLetter<T extends { lastName: string }>(
  patients: T[],
): { letter: string; patients: T[] }[] {
  const map = new Map<string, T[]>();
  for (const p of patients) {
    const letter = (p.lastName[0] ?? '#').toUpperCase();
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, patients]) => ({ letter, patients }));
}
```

---

## Part 8: Frontend — Application Shell Components

### 8.1 Create `frontend/src/components/layout/Topbar.tsx`

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { createSupabaseClient } from '@/lib/supabase/client';
import { initials } from '@/lib/patient-utils';

export function Topbar() {
  const { user, clear } = useAuthStore();
  const { toggleSidebar } = useUiStore();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    window.location.href = '/login';
  };

  const userInitials = user ? initials(user.firstName, user.lastName) : '??';
  const roleLabel = user?.role ?? 'USER';

  return (
    <header
      style={{
        height: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid #D1D5E0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 10,
        position: 'sticky',
        top: 0,
        zIndex: 200,
        flexShrink: 0,
      }}
    >
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
        style={{
          width: 32, height: 32, border: 'none', background: 'none',
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 5,
          borderRadius: 6, flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F8FA')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 16, height: 2, background: '#374151', borderRadius: 2 }} />
        ))}
      </button>

      {/* Logo */}
      <div style={{ width: 22, height: 22, background: '#0A6E5F', borderRadius: 5, flexShrink: 0 }} />
      <span style={{ fontSize: 16, fontWeight: 700, color: '#0D1117', letterSpacing: '-0.3px', flexShrink: 0 }}>
        DAMAYAN
      </span>

      {/* Role pill */}
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.6px', background: '#D4EDE9', color: '#0A6E5F',
        border: '1px solid #0A6E5F', borderRadius: 20, padding: '2px 8px',
        flexShrink: 0,
      }}>
        {roleLabel}
      </span>

      <div style={{ flex: 1 }} />

      {/* + New Note button */}
      <button
        onClick={() => {/* Phase 6+ — note creation flow */}}
        style={{
          height: 34, padding: '0 14px', background: '#0A6E5F', color: '#FFFFFF',
          border: '1px solid #085A4E', borderRadius: 6, fontSize: 11,
          fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          boxShadow: '0 2px 4px rgba(10,110,95,0.15)',
        }}
      >
        + New Note
      </button>

      {/* User avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: '#085A4E',
        color: '#FFFFFF', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0,
        cursor: 'default',
      }}
        title={user ? `${user.firstName} ${user.lastName}` : ''}
      >
        {userInitials}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        style={{
          height: 28, padding: '0 12px', background: '#F7F8FA',
          border: '1px solid #D1D5E0', borderRadius: 6, fontSize: 11,
          fontWeight: 600, color: '#374151', cursor: 'pointer', flexShrink: 0,
        }}
      >
        Sign Out
      </button>
    </header>
  );
}
```

### 8.2 Create `frontend/src/components/layout/Sidebar.tsx`

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUiStore } from '@/stores/uiStore';
import { usePatientStore } from '@/stores/patientStore';
import { usePatients } from '@/hooks/usePatients';
import { useAuthStore } from '@/stores/authStore';
import { groupByLetter, calcAge, initials } from '@/lib/patient-utils';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import type { Patient } from '@/types/patient';

export function Sidebar() {
  const { sidebarCollapsed } = useUiStore();
  const { activePatient, setActivePatient } = usePatientStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const params = useParams();

  const [search, setSearch] = useState('');
  const [newPatientOpen, setNewPatientOpen] = useState(false);

  const { data, isLoading } = usePatients(search, 1, 200);
  const patients = data?.data ?? [];

  const grouped = useMemo(() => groupByLetter(patients), [patients]);

  const canCreatePatient = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const handleSelect = (p: Patient) => {
    setActivePatient(p);
    router.push(`/dashboard/${p.id}`);
  };

  if (sidebarCollapsed) return null;

  return (
    <>
      <aside style={{
        width: 280, background: '#FFFFFF', borderRight: '1px solid #D1D5E0',
        display: 'flex', flexDirection: 'column', height: '100%',
        flexShrink: 0, overflow: 'hidden',
      }}>
        {/* Search + Add zone */}
        <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid #D1D5E0', flexShrink: 0 }}>
          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients…"
            style={{
              width: '100%', height: 34, padding: '0 10px',
              background: '#F7F8FA', border: '1px solid #D1D5E0',
              borderRadius: 6, fontSize: 12, color: '#0D1117',
              outline: 'none', boxSizing: 'border-box', marginBottom: 8,
            }}
            onFocus={(e) => { e.target.style.borderColor = '#0A6E5F'; e.target.style.boxShadow = '0 0 0 3px rgba(10,110,95,0.12)'; }}
            onBlur={(e)  => { e.target.style.borderColor = '#D1D5E0'; e.target.style.boxShadow = 'none'; }}
          />
          {/* Add new patient */}
          {canCreatePatient && (
            <button
              onClick={() => setNewPatientOpen(true)}
              style={{
                width: '100%', height: 30, background: '#0A6E5F', color: '#FFFFFF',
                border: '1px solid #085A4E', borderRadius: 6, fontSize: 11,
                fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box',
              }}
            >
              + New Patient
            </button>
          )}
        </div>

        {/* Patient list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {isLoading && (
            <p style={{ padding: '16px 12px', fontSize: 12, color: '#6B7280' }}>Loading…</p>
          )}
          {!isLoading && patients.length === 0 && (
            <p style={{ padding: '16px 12px', fontSize: 12, color: '#6B7280' }}>No patients found.</p>
          )}
          {grouped.map(({ letter, patients: group }) => (
            <div key={letter}>
              {/* Letter marker */}
              <div style={{
                padding: '6px 12px 2px',
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.6px', color: '#6B7280',
                position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 1,
              }}>
                {letter}
              </div>

              {group.map((p) => {
                const isActive = activePatient?.id === p.id;
                const age = calcAge(p.dateOfBirth);
                const sexLabel = p.sex === 'MALE' ? 'M' : p.sex === 'FEMALE' ? 'F' : 'O';
                const hasAllergy = !!p.allergies;
                const ini = initials(p.firstName, p.lastName);

                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      gap: 8, padding: '7px 12px', border: 'none',
                      borderLeft: isActive ? '3px solid #0A6E5F' : '3px solid transparent',
                      background: isActive ? '#F7F8FA' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#F7F8FA'; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: isActive ? '#085A4E' : '#D4EDE9',
                      color: isActive ? '#FFFFFF' : '#0A6E5F',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {ini}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#0D1117' : '#374151',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.lastName}, {p.firstName}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', gap: 4 }}>
                        <span>{sexLabel}</span>
                        <span>·</span>
                        <span>{age}y</span>
                        <span>·</span>
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{p.patientCode}</span>
                      </div>
                    </div>

                    {/* Allergy indicator */}
                    {hasAllergy && (
                      <span
                        title={`Allergies: ${p.allergies}`}
                        style={{ fontSize: 13, flexShrink: 0, color: '#F59E0B' }}
                        aria-label={`Allergies: ${p.allergies}`}
                      >
                        ⚠
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      <NewPatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        onCreated={(p) => {
          setNewPatientOpen(false);
          handleSelect(p as Patient);
        }}
      />
    </>
  );
}
```

### 8.3 Create `frontend/src/components/layout/ScreenNav.tsx`

```tsx
'use client';

import { useRouter, useParams, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

const ALL_TABS = [
  { id: 'dashboard',     label: 'Dashboard',     path: '' },
  { id: 'vitals',        label: 'Vital Signs',   path: '/vitals' },
  { id: 'note-timeline', label: 'Note Timeline ★', path: '/notes' },
  { id: 'initial-note',  label: 'Initial Note',  path: '/initial-note' },
  { id: 'problems',      label: 'Problem List',  path: '/problems' },
  { id: 'medications',   label: 'Medications',   path: '/medications' },
  { id: 'documents',     label: 'Documents',     path: '/documents' },
  { id: 'logs',          label: 'Logs',          path: '/logs' },
] as const;

export function ScreenNav({ patientId }: { patientId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();

  // Hide Logs tab for non-Admin
  const tabs = ALL_TABS.filter(
    (t) => t.id !== 'logs' || user?.role === 'ADMIN',
  );

  const basePath = `/dashboard/${patientId}`;

  const isActive = (tab: (typeof ALL_TABS)[number]) => {
    if (tab.id === 'dashboard') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(`${basePath}${tab.path}`);
  };

  return (
    <nav style={{
      height: 52, background: '#FFFFFF', borderBottom: '1px solid #D1D5E0',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6,
      flexShrink: 0, overflowX: 'auto',
    }}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.id}
            onClick={() => router.push(`${basePath}${tab.path}`)}
            style={{
              height: 32, padding: '0 12px', border: '1px solid',
              borderColor: active ? 'transparent' : '#D1D5E0',
              borderRadius: 6, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              background: active ? '#0A6E5F' : '#F7F8FA',
              color: active ? '#FFFFFF' : '#374151',
              boxShadow: active ? '0 4px 12px rgba(10,110,95,0.25)' : 'none',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = '#EFF1F5'; e.currentTarget.style.borderColor = '#9BA3B5'; } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = '#F7F8FA'; e.currentTarget.style.borderColor = '#D1D5E0'; } }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
```

---

## Part 9: Frontend — NewPatientModal

### 9.1 Create `frontend/src/components/patients/NewPatientModal.tsx`

This is a full React Hook Form + client-side Zod-style validation modal. Because the Zod `v4` import is `import { z } from 'zod'` (note the existing `package.json` has `"zod": "^4.4.3"`), use RHF's `register` + manual validation rather than `zodResolver` to avoid import issues.

```tsx
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
```

---

## Part 10: Frontend — Dashboard Screen Components

### 10.1 Create `frontend/src/components/patients/PatientBanner.tsx`

```tsx
import { calcAge, initials } from '@/lib/patient-utils';
import type { Patient } from '@/types/patient';

export function PatientBanner({ patient }: { patient: Patient }) {
  const age = calcAge(patient.dateOfBirth);
  const dob = new Date(patient.dateOfBirth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const ini = initials(patient.firstName, patient.lastName);
  const allergyList = patient.allergies
    ? patient.allergies.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const addressParts = [
    patient.addressBarangay,
    patient.addressCity,
    patient.addressRegion,
    'Philippines',
  ].filter(Boolean);

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #D1D5E0',
      borderRadius: 8, padding: 16,
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      display: 'flex', gap: 16, alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: '#085A4E', color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, flexShrink: 0,
      }}>
        {ini}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0D1117' }}>
            {patient.lastName}, {patient.firstName}
            {patient.middleName ? ` ${patient.middleName}` : ''}
            {patient.extension ? ` ${patient.extension}` : ''}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280', background: '#F7F8FA', border: '1px solid #D1D5E0', borderRadius: 4, padding: '1px 6px' }}>
            {patient.patientCode}
          </span>
        </div>

        <div style={{ fontSize: 12, color: '#374151', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>{patient.sex === 'MALE' ? 'Male' : patient.sex === 'FEMALE' ? 'Female' : 'Other'}</span>
          <span style={{ color: '#D1D5E0' }}>|</span>
          <span>DOB: {dob}</span>
          <span style={{ color: '#D1D5E0' }}>|</span>
          <span>{age} years old</span>
          {addressParts.length > 0 && (
            <>
              <span style={{ color: '#D1D5E0' }}>|</span>
              <span>{addressParts.join(', ')}</span>
            </>
          )}
        </div>

        {/* Allergy tags */}
        {allergyList.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', alignSelf: 'center' }}>Allergies:</span>
            {allergyList.map((a) => (
              <span key={a} style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: '#FEE2E2', color: '#991B1B', border: '1px solid #EF4444',
              }}>
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 10.2 Create `frontend/src/components/visits/VisitHistoryCard.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useVisits } from '@/hooks/useVisits';
import type { Visit } from '@/types/visit';

function VisitRow({ visit }: { visit: Visit }) {
  const dt = new Date(visit.visitDatetime);
  const dateStr = dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const physician = visit.physician
    ? `Dr. ${visit.physician.lastName}, ${visit.physician.firstName}`
    : 'Unknown Physician';
  const notePreview = visit.initialNote?.chiefComplaint
    ? `CC: ${visit.initialNote.chiefComplaint}`
    : visit.progressNote?.subjective?.slice(0, 80)
    ? visit.progressNote.subjective.slice(0, 80) + '…'
    : null;
  const statusColor = visit.status === 'PUBLISHED' ? '#4C1D95' : '#92400E';
  const statusBg    = visit.status === 'PUBLISHED' ? '#EDE9FE' : '#FEF3C7';
  const statusBorder= visit.status === 'PUBLISHED' ? '#8B5CF6' : '#F59E0B';

  return (
    <div style={{
      padding: '10px 14px', borderBottom: '1px solid #D1D5E0',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      {/* Date column */}
      <div style={{ width: 90, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0D1117' }}>{dateStr}</div>
        <div style={{ fontSize: 11, color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace" }}>{timeStr}</div>
      </div>

      {/* Detail column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 12, color: '#374151' }}>{physician}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
            padding: '1px 5px', borderRadius: 4,
            background: visit.visitType === 'INITIAL' ? '#DBEAFE' : '#D4EDE9',
            color: visit.visitType === 'INITIAL' ? '#1E3A8A' : '#085A4E',
            border: `1px solid ${visit.visitType === 'INITIAL' ? '#3B82F6' : '#0A6E5F'}`,
          }}>
            {visit.visitType === 'INITIAL' ? 'Initial' : 'Progress'}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
            padding: '1px 5px', borderRadius: 4,
            background: statusBg, color: statusColor, border: `1px solid ${statusBorder}`,
          }}>
            {visit.status}
          </span>
        </div>
        {notePreview && (
          <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {notePreview}
          </div>
        )}
      </div>
    </div>
  );
}

export function VisitHistoryCard({ patientId }: { patientId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useVisits(patientId, 1, expanded ? 20 : 5);
  const visits = data?.data ?? [];
  const total  = data?.meta.total ?? 0;

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      {/* Card header */}
      <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#EFF1F5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🗒</div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>Visit History</span>
          {total > 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 6px', borderRadius: 4, background: '#D4EDE9', color: '#085A4E', border: '1px solid #0A6E5F' }}>
              {total} visit{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div style={{ padding: '16px 14px', fontSize: 12, color: '#6B7280' }}>Loading visit history…</div>
      ) : visits.length === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
          No visits recorded yet.
        </div>
      ) : (
        <>
          {visits.map((v) => <VisitRow key={v.id} visit={v} />)}
          {total > 5 && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid #D1D5E0' }}>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{ background: 'none', border: 'none', fontSize: 12, color: '#0A6E5F', cursor: 'pointer', fontWeight: 600 }}
              >
                {expanded ? '▲ Show less' : `▼ Show all ${total} visits`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### 10.3 Create `frontend/src/components/vitals/VitalsStripEmpty.tsx`

This renders the vitals strip with empty states — to be replaced by real data in Phase 10.

```tsx
import { useRouter } from 'next/navigation';

const VITALS = [
  { label: 'Blood Pressure', unit: 'mmHg', placeholder: '—/—' },
  { label: 'Heart Rate',     unit: 'bpm',         placeholder: '—' },
  { label: 'Resp. Rate',     unit: 'breaths/min',  placeholder: '—' },
  { label: 'Temperature',    unit: '°C',           placeholder: '—' },
  { label: 'O₂ Saturation',  unit: '%',            placeholder: '—' },
];

export function VitalsStripEmpty({ patientId }: { patientId: string }) {
  // This component renders a placeholder until Phase 10 implements real vitals.
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#EFF1F5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>❤️</div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>Latest Vital Signs</span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
          No reading today
        </span>
      </div>
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {VITALS.map((v) => (
          <div key={v.label} style={{ background: '#F7F8FA', border: '1px solid #D1D5E0', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6B7280', marginBottom: 6 }}>{v.label}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#9BA3B5', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>{v.placeholder}</div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>{v.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 10.4 Create `frontend/src/components/problems/ProblemListCardEmpty.tsx`

```tsx
export function ProblemListCardEmpty() {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#EFF1F5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📋</div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>Problem List</span>
        </div>
        <button style={{ height: 28, padding: '0 12px', background: '#F7F8FA', color: '#374151', border: '1px solid #D1D5E0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          Manage
        </button>
      </div>
      <div style={{ padding: '20px 14px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
        No problems recorded. Problems are added when the Initial Note assessment is published.
      </div>
    </div>
  );
}
```

### 10.5 Create `frontend/src/components/medications/MedicationListCardEmpty.tsx`

```tsx
export function MedicationListCardEmpty() {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#EFF1F5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>💊</div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>Medications</span>
        </div>
        <button style={{ height: 28, padding: '0 12px', background: '#F7F8FA', color: '#374151', border: '1px solid #D1D5E0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          Manage
        </button>
      </div>
      <div style={{ padding: '20px 14px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
        No medications recorded yet.
      </div>
    </div>
  );
}
```

---

## Part 11: Frontend — Route Structure

### 11.1 Create `frontend/src/app/dashboard/layout.tsx`

This is the clinical workspace shell layout. It wraps all `/dashboard/...` routes with Topbar + Sidebar. It does NOT apply to `/admin` routes.

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Redirect admins back to their panel; redirect unauthenticated users to login
    if (user === null) {
      // user is null means not yet loaded from zustand — don't redirect yet
      return;
    }
    if (user.role === 'ADMIN') {
      router.replace('/admin/accounts');
    }
  }, [user, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F0F2F5',
        fontFamily: "'IBM Plex Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Topbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 56px)' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 11.2 Create `frontend/src/app/dashboard/page.tsx`

The default dashboard page (no patient selected).

```tsx
export default function DashboardIndexPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 12, padding: 32,
    }}>
      <div style={{ width: 48, height: 48, background: '#D4EDE9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
        👤
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', margin: 0 }}>
        No patient selected
      </h2>
      <p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 320, margin: 0 }}>
        Select a patient from the sidebar to view their record, or register a new patient using the <strong>+ New Patient</strong> button.
      </p>
    </div>
  );
}
```

### 11.3 Create `frontend/src/app/dashboard/[patientId]/layout.tsx`

Per-patient workspace layout with ScreenNav.

```tsx
'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { usePatientStore } from '@/stores/patientStore';
import { ScreenNav } from '@/components/layout/ScreenNav';

export default function PatientWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patient } = usePatient(patientId);
  const { setActivePatient } = usePatientStore();

  // Sync patient data into store when loaded (handles direct URL navigation)
  useEffect(() => {
    if (patient) setActivePatient(patient);
  }, [patient, setActivePatient]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenNav patientId={patientId} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}
```

### 11.4 Create `frontend/src/app/dashboard/[patientId]/page.tsx`

The patient Dashboard screen — the landing page after selecting a patient.

```tsx
'use client';

import { useParams } from 'next/navigation';
import { usePatient } from '@/hooks/usePatients';
import { PatientBanner } from '@/components/patients/PatientBanner';
import { VitalsStripEmpty } from '@/components/vitals/VitalsStripEmpty';
import { ProblemListCardEmpty } from '@/components/problems/ProblemListCardEmpty';
import { MedicationListCardEmpty } from '@/components/medications/MedicationListCardEmpty';
import { VisitHistoryCard } from '@/components/visits/VisitHistoryCard';

export default function PatientDashboardPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patient, isLoading, isError } = usePatient(patientId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>Loading patient record…</span>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <span style={{ fontSize: 13, color: '#991B1B' }}>Patient record not found.</span>
      </div>
    );
  }

  return (
    <>
      {/* Patient Banner */}
      <PatientBanner patient={patient} />

      {/* Vitals Strip (empty state — Phase 10 will replace) */}
      <VitalsStripEmpty patientId={patientId} />

      {/* Problem List + Medications — side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ProblemListCardEmpty />
        <MedicationListCardEmpty />
      </div>

      {/* Visit History */}
      <VisitHistoryCard patientId={patientId} />
    </>
  );
}
```

### 11.5 Create placeholder pages for all other patient screens

Create the following files with minimal placeholder content. Each will be filled in during Phases 6–12.

**`frontend/src/app/dashboard/[patientId]/vitals/page.tsx`**
```tsx
export default function VitalsPage() {
  return <div style={{ padding: 20, fontSize: 13, color: '#6B7280' }}>Vital Signs — Phase 10</div>;
}
```

**`frontend/src/app/dashboard/[patientId]/notes/page.tsx`**
```tsx
export default function NoteTimelinePage() {
  return <div style={{ padding: 20, fontSize: 13, color: '#6B7280' }}>Note Timeline — Phase 7</div>;
}
```

**`frontend/src/app/dashboard/[patientId]/initial-note/page.tsx`**
```tsx
export default function InitialNotePage() {
  return <div style={{ padding: 20, fontSize: 13, color: '#6B7280' }}>Initial Note — Phase 6</div>;
}
```

**`frontend/src/app/dashboard/[patientId]/problems/page.tsx`**
```tsx
export default function ProblemsPage() {
  return <div style={{ padding: 20, fontSize: 13, color: '#6B7280' }}>Problem List — Phase 8</div>;
}
```

**`frontend/src/app/dashboard/[patientId]/medications/page.tsx`**
```tsx
export default function MedicationsPage() {
  return <div style={{ padding: 20, fontSize: 13, color: '#6B7280' }}>Medications — Phase 9</div>;
}
```

**`frontend/src/app/dashboard/[patientId]/documents/page.tsx`**
```tsx
export default function DocumentsPage() {
  return <div style={{ padding: 20, fontSize: 13, color: '#6B7280' }}>Documents — Phase 11</div>;
}
```

**`frontend/src/app/dashboard/[patientId]/logs/page.tsx`**
```tsx
export default function LogsPage() {
  return <div style={{ padding: 20, fontSize: 13, color: '#6B7280' }}>Audit Logs — Phase 12</div>;
}
```

---

## Part 12: Frontend — Middleware Update

### 12.1 Update `frontend/src/proxy.ts` → rename to `frontend/src/middleware.ts`

The current file is `proxy.ts` but Next.js middleware must be at `src/middleware.ts`. If it does not already exist at that path, create it. Also update the redirect logic to handle Doctor/Nurse users going to `/dashboard` instead of `/admin/accounts`.

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export default async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();
  const pathname = new URL(request.url).pathname;

  const isLoginRoute     = pathname === '/login' || pathname === '/';
  const isAdminRoute     = pathname.startsWith('/admin');
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isProtected      = isAdminRoute || isDashboardRoute;

  // Unauthenticated: redirect to login
  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Authenticated on login/root: redirect to appropriate workspace
  if (session && isLoginRoute) {
    // Default redirect for authenticated users — login page handles role-based routing
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/dashboard/:path*'],
};
```

**Important:** Delete `frontend/src/proxy.ts` if it exists (or ensure `src/middleware.ts` is the active file, not `proxy.ts`). Next.js only recognizes `src/middleware.ts` as the middleware entry point.

---

## Part 13: Frontend — Update Login Page Role Routing

### 13.1 Update `frontend/src/app/login/page.tsx` routing block

Find the routing section near the end of the login handler and update it so Doctors and Nurses are sent to `/dashboard` (not a non-existent route):

```typescript
// Route by role — replace the existing routing block
if (profile.role === 'ADMIN') {
  router.replace('/admin/accounts');
} else {
  // Doctor and Nurse both go to the clinical workspace
  router.replace('/dashboard');
}
```

---

## Part 14: Validation Checklist

After completing all steps above, verify the following before marking Phase 4 & 5 complete:

### Backend Verification
- [ ] `GET /patients` returns paginated list with `allergies` field included
- [ ] `POST /patients` auto-generates `patientCode` in `PT-XXXX` format and associates `createdBy` from JWT
- [ ] `GET /patients/:id` returns patient with `_count` and allergy info
- [ ] `GET /patients/:patientId/visits` returns visits ordered newest-first with physician relation
- [ ] All patient endpoints return 401 for unauthenticated requests
- [ ] `POST /patients` returns 403 for Nurse role
- [ ] Swagger docs at `/api` reflect all new endpoints

### Frontend Verification
- [ ] Doctor/Nurse login redirects to `/dashboard` (not admin panel)
- [ ] Sidebar renders the patient list grouped A–Z with allergy ⚠ icon
- [ ] Patient search filters the list in real time with ≤30ms debounce
- [ ] Clicking a patient row navigates to `/dashboard/[patientId]` and loads the Dashboard
- [ ] ScreenNav renders all tabs; active tab is highlighted in teal
- [ ] Logs tab is hidden for Doctor and Nurse roles
- [ ] `NewPatientModal` opens, validates all fields inline, submits to API, and navigates to the new patient
- [ ] Dashboard shows: PatientBanner (name, DOB, age, sex, code, address, allergy tags), VitalsStrip (empty state), ProblemListCard (empty state), MedicationListCard (empty state), VisitHistoryCard
- [ ] VisitHistoryCard shows "No visits recorded yet" for a new patient
- [ ] VisitHistoryCard shows real visit rows after visits exist (from Phases 6+)
- [ ] Direct URL navigation to `/dashboard/[knownPatientId]` loads patient data without requiring sidebar click
- [ ] Sidebar collapse toggle (hamburger in Topbar) hides the sidebar and expands the main area
- [ ] Design tokens are applied consistently: IBM Plex Sans typeface, teal accent color, correct border radii

### Regression Check
- [ ] Admin login still redirects to `/admin/accounts`
- [ ] Admin panel still lists accounts and can create/deactivate users
- [ ] No TypeScript errors (`npx tsc --noEmit` passes in both frontend and backend)

---

## Notes for the Implementing Agent

1. **Do not modify** `backend/prisma/schema.prisma` or any migration file. The schema is already complete and deployed. Work only within the service/controller/DTO layer.

2. **Preserve all existing JavaScript/TypeScript logic** in `accounts.service.ts`, `auth.service.ts`, `jwt-auth.guard.ts`, and `roles.guard.ts`. These are complete from Phase 3.

3. **Inline styles** are used intentionally for shell/layout components to match the design system. Do not refactor to Tailwind unless the component is a Shadcn UI integration.

4. **The `proxy.ts` file** must be renamed/replaced by `middleware.ts` for Next.js middleware to function. They cannot coexist — remove `proxy.ts` after creating `middleware.ts`.

5. **TanStack Query `QueryProvider`** must wrap the root layout body. Without it, all `useQuery` hooks in Client Components will fail with "No QueryClient" errors.

6. **Patient code generation** uses a simple sequential strategy (`PT-0001`, `PT-0002`, …). This is safe for MVP scale. For production, a database sequence or advisory lock would be preferable to avoid race conditions under concurrent creation.

7. **Allergy data** is sourced from `initial_notes.allergies` (a free-text field). The sidebar and banner display this only after the Initial Note has been published. For now, the `findAll` / `findOne` service methods join on the initial note via the INITIAL visit.

8. **The `VitalsStripEmpty`, `ProblemListCardEmpty`, and `MedicationListCardEmpty` components** are intentional placeholders. They will be replaced with live-data components in Phases 8, 9, and 10 respectively. Do not add mock data to these components.