# DAMAYAN EMR — Phase 5 Implementation Instructions: Problem List

**Audience:** Agentic coding AI (e.g. Claude Code) with write access to this repository.
**Source of truth:** `DAMAYAN_MVP_V6.docx`, Section 10 (Development Roadmap), Section 9.5 (API Design), Section 11.5 / 12.5 (Frontend/Backend Breakdown), Appendix B (Problem List Tree Rendering), and `frontend/design-standard.md` Section 7.4.
**Repo state assumed:** Phase 1 (project setup), Phase 2 (schema + migrations), Phase 3 (auth/RBAC/admin), and Phase 4 (Patient Management) are complete and working as shown in the current codebase.

---

## 0. Important note on roadmap numbering

The MVP document's Table of Contents and its actual Section 10 body disagree on phase ordering. **Follow Section 10's body, not the ToC** — this is also what the current codebase's module stubs reflect. Under that ordering:

| Phase | Scope |
|---|---|
| 4 | Patient Management — **done** |
| **5** | **Problem List — this document** |
| 6 | Medication Management — not started, out of scope here |
| 7 | Vital Signs — not started, out of scope here |
| 8 | Initial Note — depends on 5, 6, 7 (the doc's "Dependencies: Phase 5,6,7 & 8" line is a typo; Phase 8 cannot depend on itself) |
| 9 | Progress Notes |

Do **not** touch Medications, Vitals, Visits, Initial Notes, or Progress Notes modules in this pass. The only forward-looking work is making sure `ProblemsService` exposes a stable, documented contract that Phase 8 (and later Phase 9) can call into without modification — see Section 7 below.

---

## 1. Scope & Deliverables (verbatim from MVP doc, Phase 5)

> Deliverables: Problem List screen, nesting, ordering, status change, Dashboard section
> - NestJS: ProblemsModule — CRUD, reorder endpoint (batch PATCH sort_order), status change
> - Frontend: Problems screen with drag-and-drop reordering (use @dnd-kit/core)
> - Nest/un-nest problems: parent_id picker in edit modal
> - Status change: Active → Resolved (moves to end) → Removed (soft delete)
> - Dashboard Problem List section: show active problems, last updated indicator
> - 48-hour visual indicator (amber highlight) if problem list updated in last 48 hours

The `problems` table, `ProblemStatus` enum, and Prisma `Problem` model **already exist** (migration `20260612131311_init_full_schema`). **No Prisma migration is required for this phase.**

---

## 2. Business-rule decisions (the MVP doc is ambiguous here — implement exactly as resolved below, so behavior is unambiguous and Phase 8 can rely on it)

1. **Nesting depth is limited to one level.** A problem with a non-null `parentId` can never itself be used as a `parentId` for another problem. This matches `design-standard.md` Section 7.4, which only defines styling for one level of indentation (`ml-6 border-l-2 ... pl-2.5`), and keeps the tree-building/reordering logic tractable. Reject attempts to nest a child under a child with `400 Bad Request`.
2. **`sortOrder` is a single flat counter per patient**, not scoped per parent — this matches the DB index `problems(patient_id, sort_order)`. New problems and "moved to end" problems get `MAX(sortOrder for patient) + 1`.
3. **"Resolved → moves to end" and "Removed (soft delete)" both bump `sortOrder` to the end of the patient's list** at the moment the status transitions away from `ACTIVE`. Reactivating a `RESOLVED` problem (manually, or via Phase 8's assessment upsert) also bumps it to the end.
4. **Soft delete means the row is never deleted.** `DELETE /problems/:id` only sets `status = REMOVED`. The Problem screen still renders removed problems (with a "Removed" badge) — this matches the explicit screen spec: *"ProblemItem — title, status badge (Active/Resolved/Removed)"*. Only the **Dashboard** card filters down to `ACTIVE` only, per the Phase 5 deliverable text.
5. **Removing a parent cascades `REMOVED` to its direct children** (since nesting is capped at one level, this is a simple `updateMany`).
6. **The reorder endpoint always receives the full, recomputed array** of `{ id, sortOrder }` for whichever sibling group changed (root list or — not used until a later phase — a children group), rather than a partial diff. This keeps the contract trivial to verify (`owned.length === ids.length` check against `patientId`).

---

## 3. Backend — files to create

```
backend/src/problems/
├── problems.module.ts        (replace existing empty stub)
├── problems.controller.ts    (new)
├── problems.service.ts       (new)
└── dto/
    ├── create-problem.dto.ts     (new)
    ├── update-problem.dto.ts     (new)
    └── reorder-problems.dto.ts   (new)
```

No changes are needed to `app.module.ts` (it already imports `ProblemsModule`), `prisma/schema.prisma` (the model already exists), or `main.ts` (the Swagger tag `Problems` is already registered).

### 3.1 `backend/src/problems/dto/create-problem.dto.ts`

```typescript
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProblemDto {
  @ApiProperty({ example: 'Hypertension, Stage 2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description:
      'Root-level problem ID to nest this new problem under. Omit for a root-level problem.',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
```

### 3.2 `backend/src/problems/dto/update-problem.dto.ts`

```typescript
import { IsString, IsOptional, MaxLength, IsUUID, IsEnum, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProblemStatus } from '@prisma/client';

export class UpdateProblemDto {
  @ApiPropertyOptional({ example: 'Hypertension, Stage 2 — controlled' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ enum: ProblemStatus })
  @IsOptional()
  @IsEnum(ProblemStatus)
  status?: ProblemStatus;

  @ApiPropertyOptional({
    description:
      'Root-level problem ID to nest under. Pass null to un-nest (move to root level). Omit entirely to leave unchanged.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsUUID()
  parentId?: string | null;
}
```

### 3.3 `backend/src/problems/dto/reorder-problems.dto.ts`

```typescript
import { IsArray, ArrayMinSize, ValidateNested, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ReorderItemDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderProblemsDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
```

### 3.4 `backend/src/problems/problems.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Problem, ProblemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { ReorderProblemsDto } from './dto/reorder-problems.dto';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class ProblemsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // LIST — flat, sort-ordered. Tree is built client-side (Appendix B).
  // ─────────────────────────────────────────────

  async findAll(patientId: string): Promise<Problem[]> {
    return this.prisma.problem.findMany({
      where: { patientId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Internal helper — NOT exposed as a route. Used by:
   *  - the Dashboard problem count / 48h-indicator logic (called from this module only)
   *  - Phase 9 (Progress Notes) copy-forward / problemListSnapshot
   * See Section 7 of PHASE_5_PROBLEM_LIST.md for the cross-module contract.
   */
  async findActiveForPatient(
    patientId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<Problem[]> {
    return client.problem.findMany({
      where: { patientId, status: ProblemStatus.ACTIVE },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(patientId: string, dto: CreateProblemDto, userId: string): Promise<Problem> {
    if (dto.parentId) {
      await this.assertValidParent(patientId, dto.parentId);
    }
    const sortOrder = await this.getNextSortOrder(patientId);
    return this.prisma.problem.create({
      data: {
        patientId,
        parentId: dto.parentId ?? null,
        title: dto.title.trim(),
        status: ProblemStatus.ACTIVE,
        sortOrder,
        addedBy: userId,
      },
    });
  }

  // ─────────────────────────────────────────────
  // UPDATE — title, status, parentId (all optional, independently settable)
  // ─────────────────────────────────────────────

  async update(patientId: string, id: string, dto: UpdateProblemDto): Promise<Problem> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.problem.findFirst({ where: { id, patientId } });
      if (!existing) {
        throw new NotFoundException(`Problem ${id} not found for this patient.`);
      }

      if (dto.parentId !== undefined && dto.parentId !== existing.parentId && dto.parentId !== null) {
        if (dto.parentId === id) {
          throw new BadRequestException('A problem cannot be its own parent.');
        }
        await this.assertValidParent(patientId, dto.parentId, tx);
      }

      const data: Prisma.ProblemUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title.trim();
      if (dto.parentId !== undefined) {
        data.parent = dto.parentId ? { connect: { id: dto.parentId } } : { disconnect: true };
      }

      if (dto.status !== undefined && dto.status !== existing.status) {
        data.status = dto.status;

        // Business rule 3: Resolved/Removed always bump to the end of the list.
        if (dto.status === ProblemStatus.RESOLVED || dto.status === ProblemStatus.REMOVED) {
          data.sortOrder = await this.getNextSortOrder(patientId, tx);
        }

        // Business rule 5: removing a parent cascades to its direct children.
        if (dto.status === ProblemStatus.REMOVED) {
          await tx.problem.updateMany({
            where: { patientId, parentId: id, status: { not: ProblemStatus.REMOVED } },
            data: { status: ProblemStatus.REMOVED },
          });
        }
      }

      return tx.problem.update({ where: { id }, data });
    });
  }

  // ─────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────

  async remove(patientId: string, id: string): Promise<Problem> {
    return this.update(patientId, id, { status: ProblemStatus.REMOVED });
  }

  // ─────────────────────────────────────────────
  // REORDER (batch)
  // ─────────────────────────────────────────────

  async reorder(patientId: string, dto: ReorderProblemsDto): Promise<{ updated: number }> {
    const ids = dto.items.map((i) => i.id);
    const owned = await this.prisma.problem.count({ where: { id: { in: ids }, patientId } });
    if (owned !== ids.length) {
      throw new ForbiddenException('One or more problems do not belong to this patient.');
    }
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.problem.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }),
      ),
    );
    return { updated: dto.items.length };
  }

  // ─────────────────────────────────────────────
  // PHASE 8 INTEGRATION POINT — see Section 7 for the full contract.
  //
  // Upserts problems from an Initial Note's assessment list on publish.
  // Case-insensitive title match against the patient's existing ACTIVE/RESOLVED
  // problems (REMOVED problems are never matched — a clinician must re-add
  // deliberately):
  //   - ACTIVE match   → no-op (already on the list)
  //   - RESOLVED match → reactivate to ACTIVE, bumped to end of list
  //   - no match       → create new root-level ACTIVE problem
  //
  // Accepts an optional transaction client so InitialNotesService can call this
  // from inside the same $transaction it uses to flip the note to PUBLISHED.
  // ─────────────────────────────────────────────

  async upsertFromAssessment(
    patientId: string,
    assessmentTitles: string[],
    userId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<void> {
    const titles = [...new Set(assessmentTitles.map((t) => t.trim()).filter(Boolean))];
    if (titles.length === 0) return;

    const existing = await client.problem.findMany({
      where: { patientId, status: { in: [ProblemStatus.ACTIVE, ProblemStatus.RESOLVED] } },
    });

    for (const title of titles) {
      const match = existing.find((p) => p.title.toLowerCase() === title.toLowerCase());

      if (match && match.status === ProblemStatus.ACTIVE) {
        continue;
      }

      if (match && match.status === ProblemStatus.RESOLVED) {
        const sortOrder = await this.getNextSortOrder(patientId, client);
        await client.problem.update({
          where: { id: match.id },
          data: { status: ProblemStatus.ACTIVE, sortOrder },
        });
        continue;
      }

      const sortOrder = await this.getNextSortOrder(patientId, client);
      await client.problem.create({
        data: { patientId, title, status: ProblemStatus.ACTIVE, sortOrder, addedBy: userId },
      });
    }
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private async getNextSortOrder(
    patientId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<number> {
    const last = await client.problem.findFirst({
      where: { patientId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async assertValidParent(
    patientId: string,
    parentId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<void> {
    const parent = await client.problem.findFirst({ where: { id: parentId, patientId } });
    if (!parent) {
      throw new NotFoundException('Parent problem not found for this patient.');
    }
    if (parent.parentId !== null) {
      throw new BadRequestException(
        'MVP nesting is limited to one level — the selected parent is itself a child problem.',
      );
    }
  }
}
```

### 3.5 `backend/src/problems/problems.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { ReorderProblemsDto } from './dto/reorder-problems.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Problems')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get()
  @ApiOperation({ summary: 'List problem list for a patient, flat & sort-ordered — All roles' })
  @ApiOkResponse({ description: 'Flat list; build the parent/child tree client-side.' })
  async findAll(@Param('patientId') patientId: string) {
    const data = await this.problemsService.findAll(patientId);
    return { data };
  }

  @Post('reorder')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch update sort_order after drag-and-drop (Doctor, Admin)' })
  async reorder(@Param('patientId') patientId: string, @Body() dto: ReorderProblemsDto) {
    return this.problemsService.reorder(patientId, dto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a problem (Doctor, Admin)' })
  @ApiCreatedResponse({ description: 'Problem created.' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreateProblemDto,
    @CurrentUser() user: User,
  ) {
    return this.problemsService.create(patientId, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Edit problem title, status, or parent (Doctor, Admin)' })
  async update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProblemDto,
  ) {
    return this.problemsService.update(patientId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a problem — sets status to REMOVED (Doctor, Admin)' })
  async remove(@Param('patientId') patientId: string, @Param('id') id: string) {
    return this.problemsService.remove(patientId, id);
  }
}
```

### 3.6 `backend/src/problems/problems.module.ts` (replaces the current empty stub)

```typescript
import { Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Module({
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService], // required so Phase 8/9 modules can inject it later
})
export class ProblemsModule {}
```

### 3.7 RBAC verification

This matches `design-standard.md` Section 12 exactly:

| Action | Admin | Doctor | Nurse |
|---|---|---|---|
| View problem list | ✓ (`JwtAuthGuard` only) | ✓ | ✓ |
| Add / edit / status / reorder / remove | ✓ (`@Roles(DOCTOR, ADMIN)`) | ✓ | ✗ |

---

## 4. Frontend — package install

```bash
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

These are not yet in `frontend/package.json` and are required for the drag-and-drop reordering called for in the MVP doc.

---

## 5. Frontend — files to create

```
frontend/src/types/problem.ts                          (new)
frontend/src/lib/problem-utils.ts                       (new)
frontend/src/hooks/useProblems.ts                        (new)
frontend/src/components/problems/ProblemListScreen.tsx   (new)
frontend/src/components/problems/ProblemTree.tsx          (new)
frontend/src/components/problems/ProblemItem.tsx          (new)
frontend/src/components/problems/ProblemEditModal.tsx     (new)
frontend/src/components/problems/ProblemListCard.tsx      (new — populated Dashboard card)
```

Reuse as-is, do not modify:
- `frontend/src/components/problems/ProblemListCardEmpty.tsx` (already built; used as the empty-state fallback inside the new `ProblemListCard`)
- `frontend/src/components/problems/ProblemListSkeleton.tsx` (already built, currently unused; wire it in per Section 6)

### 5.1 `frontend/src/types/problem.ts`

```typescript
export type ProblemStatusValue = 'ACTIVE' | 'RESOLVED' | 'REMOVED';

export interface Problem {
  id: string;
  patientId: string;
  parentId: string | null;
  title: string;
  status: ProblemStatusValue;
  sortOrder: number;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemNode extends Problem {
  children: ProblemNode[];
}

export interface ProblemsResponse {
  data: Problem[];
}
```

### 5.2 `frontend/src/lib/problem-utils.ts`

Implements Appendix B of the MVP doc, with children also sorted by `sortOrder` (a small correctness improvement over the doc's snippet, which only sorts roots) and Appendix C's 48-hour helper.

```typescript
import type { Problem, ProblemNode } from '@/types/problem';

export function buildProblemTree(problems: Problem[]): ProblemNode[] {
  const map = new Map<string, ProblemNode>(problems.map((p) => [p.id, { ...p, children: [] }]));
  const roots: ProblemNode[] = [];

  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const bySortOrder = (a: ProblemNode, b: ProblemNode) => a.sortOrder - b.sortOrder;
  map.forEach((node) => node.children.sort(bySortOrder));
  roots.sort(bySortOrder);

  return roots;
}

export function isRecentlyUpdated(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
}

export function mostRecentUpdate(problems: Problem[]): string | null {
  if (problems.length === 0) return null;
  return problems.reduce((latest, p) => (p.updatedAt > latest ? p.updatedAt : latest), problems[0].updatedAt);
}
```

### 5.3 `frontend/src/hooks/useProblems.ts`

Follows the exact `apiRequest` + TanStack Query conventions already used in `hooks/usePatients.ts` and `hooks/useVisits.ts`.

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type { Problem, ProblemsResponse, ProblemStatusValue } from '@/types/problem';

export function useProblems(patientId: string | null) {
  return useQuery<ProblemsResponse>({
    queryKey: ['problems', patientId],
    queryFn: () => apiRequest<ProblemsResponse>(`/patients/${patientId}/problems`),
    enabled: !!patientId,
    staleTime: 1000 * 20,
  });
}

interface CreateProblemInput {
  title: string;
  parentId?: string;
}
interface UpdateProblemInput {
  id: string;
  title?: string;
  status?: ProblemStatusValue;
  parentId?: string | null;
}
interface ReorderInput {
  items: { id: string; sortOrder: number }[];
}

function invalidateProblems(qc: ReturnType<typeof useQueryClient>, patientId: string) {
  qc.invalidateQueries({ queryKey: ['problems', patientId] });
  qc.invalidateQueries({ queryKey: ['patient', patientId] }); // refreshes Patient._count.problems
}

export function useCreateProblem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProblemInput) =>
      apiRequest<Problem>(`/patients/${patientId}/problems`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateProblems(qc, patientId),
  });
}

export function useUpdateProblem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProblemInput) =>
      apiRequest<Problem>(`/patients/${patientId}/problems/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateProblems(qc, patientId),
  });
}

export function useDeleteProblem(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<Problem>(`/patients/${patientId}/problems/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateProblems(qc, patientId),
  });
}

export function useReorderProblems(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReorderInput) =>
      apiRequest<{ updated: number }>(`/patients/${patientId}/problems/reorder`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onMutate: async (input: ReorderInput) => {
      await qc.cancelQueries({ queryKey: ['problems', patientId] });
      const previous = qc.getQueryData<ProblemsResponse>(['problems', patientId]);
      if (previous) {
        const sortMap = new Map(input.items.map((i) => [i.id, i.sortOrder]));
        qc.setQueryData<ProblemsResponse>(['problems', patientId], {
          data: previous.data.map((p) => (sortMap.has(p.id) ? { ...p, sortOrder: sortMap.get(p.id)! } : p)),
        });
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(['problems', patientId], context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['problems', patientId] }),
  });
}
```

### 5.4 `frontend/src/components/problems/ProblemItem.tsx`

Visual spec lifted directly from `design-standard.md` Section 7.4 (status dot, nested child indent/accent line, drag handle).

```tsx
'use client';

import { cn } from '@/lib/utils';
import { Pencil, Trash2, GripVertical, RotateCcw } from 'lucide-react';
import type { Problem, ProblemStatusValue } from '@/types/problem';

const statusBadgeClass: Record<ProblemStatusValue, string> = {
  ACTIVE: 'bg-accent-light text-accent-hover border-accent',
  RESOLVED: 'bg-surface-2 text-text-secondary border-border',
  REMOVED: 'bg-surface-2 text-text-muted border-border',
};

const statusDotClass: Record<ProblemStatusValue, string> = {
  ACTIVE: 'bg-accent-mid',
  RESOLVED: 'bg-border-strong',
  REMOVED: 'bg-border-strong',
};

const statusLabel: Record<ProblemStatusValue, string> = {
  ACTIVE: 'Active',
  RESOLVED: 'Resolved',
  REMOVED: 'Removed',
};

interface ProblemItemProps {
  problem: Problem;
  isChild?: boolean;
  canManage: boolean;
  dragHandleProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined };
  onEdit: () => void;
  onStatusChange: (status: ProblemStatusValue) => void;
  onDelete: () => void;
}

export function ProblemItem({
  problem,
  isChild = false,
  canManage,
  dragHandleProps,
  onEdit,
  onStatusChange,
  onDelete,
}: ProblemItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 border-b border-border last:border-b-0',
        isChild && 'ml-6 border-l-2 border-accent-light pl-2.5',
      )}
    >
      {canManage && problem.status === 'ACTIVE' && dragHandleProps && (
        <span
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
          className="text-border-strong cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDotClass[problem.status])} title={problem.status} />
      <div className="flex-1 text-[12px] text-text-primary truncate">{problem.title}</div>
      <span
        className={cn(
          'text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border flex-shrink-0',
          statusBadgeClass[problem.status],
        )}
      >
        {statusLabel[problem.status]}
      </span>
      {canManage && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {problem.status !== 'REMOVED' && (
            <button
              onClick={onEdit}
              title="Edit"
              aria-label="Edit problem"
              className="w-6 h-6 rounded-btn hover:bg-surface-2 inline-flex items-center justify-center text-text-muted cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {problem.status === 'ACTIVE' && (
            <button
              onClick={() => onStatusChange('RESOLVED')}
              title="Mark resolved"
              aria-label="Mark resolved"
              className="w-6 h-6 rounded-btn hover:bg-surface-2 inline-flex items-center justify-center text-text-muted cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 rotate-180" />
            </button>
          )}
          {problem.status === 'RESOLVED' && (
            <button
              onClick={() => onStatusChange('ACTIVE')}
              title="Reactivate"
              aria-label="Reactivate problem"
              className="w-6 h-6 rounded-btn hover:bg-surface-2 inline-flex items-center justify-center text-accent cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          {problem.status !== 'REMOVED' && (
            <button
              onClick={onDelete}
              title="Remove"
              aria-label="Remove problem"
              className="w-6 h-6 rounded-btn hover:bg-red-bg inline-flex items-center justify-center text-red cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

### 5.5 `frontend/src/components/problems/ProblemTree.tsx`

Root-level problems are draggable (via `@dnd-kit/sortable`'s `PointerSensor` **and** `KeyboardSensor` — the latter already satisfies `design-standard.md` Section 10's *"Problem list reorder: arrow-key buttons in addition to drag"* requirement out of the box: Tab to focus a drag handle, Space to pick up, Arrow keys to move, Space to drop. **Do not build a separate up/down-button control** — it would duplicate functionality `KeyboardSensor` already provides accessibly.

Children are rendered statically beneath their parent (not draggable) — consistent with the one-level-nesting decision in Section 2.

```tsx
'use client';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ProblemItem } from './ProblemItem';
import type { Problem, ProblemNode, ProblemStatusValue } from '@/types/problem';

interface ProblemTreeProps {
  nodes: ProblemNode[];
  canManage: boolean;
  onEdit: (p: Problem) => void;
  onStatusChange: (p: Problem, status: ProblemStatusValue) => void;
  onDelete: (p: Problem) => void;
  onReorder: (items: { id: string; sortOrder: number }[]) => void;
}

function SortableRoot({
  node,
  canManage,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  node: ProblemNode;
  canManage: boolean;
  onEdit: (p: Problem) => void;
  onStatusChange: (p: Problem, s: ProblemStatusValue) => void;
  onDelete: (p: Problem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: !canManage || node.status !== 'ACTIVE',
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 opacity-70 bg-surface' : 'relative'}
    >
      <ProblemItem
        problem={node}
        canManage={canManage}
        dragHandleProps={{ attributes, listeners }}
        onEdit={() => onEdit(node)}
        onStatusChange={(s) => onStatusChange(node, s)}
        onDelete={() => onDelete(node)}
      />
      {node.children.map((child) => (
        <ProblemItem
          key={child.id}
          problem={child}
          isChild
          canManage={canManage}
          onEdit={() => onEdit(child)}
          onStatusChange={(s) => onStatusChange(child, s)}
          onDelete={() => onDelete(child)}
        />
      ))}
    </div>
  );
}

export function ProblemTree({ nodes, canManage, onEdit, onStatusChange, onDelete, onReorder }: ProblemTreeProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = nodes.map((n) => n.id);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = nodes.findIndex((n) => n.id === active.id);
    const newIndex = nodes.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(nodes, oldIndex, newIndex);
    onReorder(reordered.map((n, index) => ({ id: n.id, sortOrder: index })));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => (
          <SortableRoot
            key={node.id}
            node={node}
            canManage={canManage}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

> **Note for the implementing agent:** verify the exact prop names returned by `useSortable()` against the installed `@dnd-kit/sortable` version (`attributes`, `listeners`, `setNodeRef`, `transform`, `transition`, `isDragging` as of dnd-kit v6/v10 — these have been stable across major versions, but run `npx tsc --noEmit` after install and fix any drift before proceeding).

### 5.6 `frontend/src/components/problems/ProblemEditModal.tsx`

Modal chrome follows the exact pattern used in `EditPatientModal.tsx` / `CreateAccountModal` (overlay, header, body, footer, `max-h-[80vh]`).

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Problem } from '@/types/problem';

interface ProblemEditModalProps {
  open: boolean;
  onClose: () => void;
  editing: Problem | null;
  rootOptions: Problem[];
  saving: boolean;
  onSave: (values: { title: string; parentId?: string | null }) => void;
}

export function ProblemEditModal({ open, onClose, editing, rootOptions, saving, onSave }: ProblemEditModalProps) {
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '');
      setParentId(editing?.parentId ?? '');
      setError('');
    }
  }, [open, editing]);

  if (!open) return null;

  // Backend enforces one-level nesting — only root-level, non-removed problems
  // (excluding the problem being edited itself) are valid parent choices.
  const selectableParents = rootOptions.filter((p) => p.id !== editing?.id && p.status !== 'REMOVED');

  const handleSubmit = () => {
    if (!title.trim()) {
      setError('Problem title is required.');
      return;
    }
    onSave({ title: title.trim(), parentId: parentId || null });
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150"
    >
      <div className="bg-surface border border-border rounded-[10px] w-[460px] max-h-[80vh] overflow-y-auto shadow-modal">
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">
            {editing ? 'Edit Problem' : 'Add Problem'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-[18px] py-[18px]">
          <div className="flex flex-col gap-1.5 mb-3.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Problem Title <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              placeholder="e.g. Hypertension, Stage 2"
              className={cn(
                'h-[34px] w-full px-2.5 bg-surface border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150',
                error
                  ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
                  : 'border-border focus:border-accent focus:shadow-accent-focus',
              )}
            />
            {error && <p className="text-[12px] text-red mt-1">{error}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.5px]">
              Parent Problem (optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-[34px] w-full px-2.5 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none cursor-pointer focus:border-accent focus:shadow-accent-focus"
            >
              <option value="">— None (root-level problem) —</option>
              {selectableParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-text-muted mt-1">
              Nesting is limited to one level — only root-level problems can be selected as a parent.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-[18px] py-3 border-t border-border">
          <button
            onClick={onClose}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-all duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover transition-all duration-150 cursor-pointer disabled:bg-text-muted disabled:border-border-strong disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Problem'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5.7 `frontend/src/components/problems/ProblemListScreen.tsx`

The main container for the `/dashboard/[patientId]/problems` route.

```tsx
'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useProblems,
  useCreateProblem,
  useUpdateProblem,
  useDeleteProblem,
  useReorderProblems,
} from '@/hooks/useProblems';
import { buildProblemTree } from '@/lib/problem-utils';
import { useAuthStore } from '@/stores/authStore';
import { ProblemTree } from './ProblemTree';
import { ProblemEditModal } from './ProblemEditModal';
import { ProblemListSkeleton } from './ProblemListSkeleton';
import type { Problem, ProblemStatusValue } from '@/types/problem';

export function ProblemListScreen({ patientId }: { patientId: string }) {
  const { user } = useAuthStore();
  const canManage = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const { data, isLoading } = useProblems(patientId);
  const createProblem = useCreateProblem(patientId);
  const updateProblem = useUpdateProblem(patientId);
  const deleteProblem = useDeleteProblem(patientId);
  const reorderProblems = useReorderProblems(patientId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Problem | null>(null);

  const problems = data?.data ?? [];
  const tree = useMemo(() => buildProblemTree(problems), [problems]);
  const rootOptions = useMemo(() => problems.filter((p) => p.parentId === null), [problems]);

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const handleEdit = (p: Problem) => {
    setEditing(p);
    setModalOpen(true);
  };

  const handleSave = async (values: { title: string; parentId?: string | null }) => {
    try {
      if (editing) {
        await updateProblem.mutateAsync({ id: editing.id, title: values.title, parentId: values.parentId });
        toast.success('Problem updated.');
      } else {
        await createProblem.mutateAsync({ title: values.title, parentId: values.parentId ?? undefined });
        toast.success('Problem added to the list.');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save problem.');
    }
  };

  const handleStatusChange = async (p: Problem, status: ProblemStatusValue) => {
    try {
      await updateProblem.mutateAsync({ id: p.id, status });
      const messages: Record<ProblemStatusValue, string> = {
        ACTIVE: 'Problem reactivated.',
        RESOLVED: 'Problem marked resolved.',
        REMOVED: 'Problem removed from the active list.',
      };
      toast.success(messages[status]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleDelete = (p: Problem) => {
    deleteProblem.mutate(p.id, {
      onSuccess: () => toast.success('Problem removed.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove problem.'),
    });
  };

  const handleReorder = (items: { id: string; sortOrder: number }[]) => {
    reorderProblems.mutate({ items });
  };

  if (isLoading) return <ProblemListSkeleton />;

  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px]">
          📋
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
          Problem List
        </span>
        {canManage && (
          <button
            onClick={handleAdd}
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 cursor-pointer"
          >
            + Add Problem
          </button>
        )}
      </div>

      {tree.length === 0 ? (
        <div className="py-8 px-3.5 text-center text-[13px] text-text-muted">
          No problems recorded yet. Problems are also added automatically when an Initial Note
          assessment is published.
        </div>
      ) : (
        <ProblemTree
          nodes={tree}
          canManage={canManage}
          onEdit={handleEdit}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onReorder={handleReorder}
        />
      )}

      <ProblemEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        rootOptions={rootOptions}
        onSave={handleSave}
        saving={createProblem.isPending || updateProblem.isPending}
      />
    </div>
  );
}
```

### 5.8 `frontend/src/components/problems/ProblemListCard.tsx` (new — populated Dashboard card)

This is distinct from the existing `ProblemListCardEmpty.tsx`, which it falls back to when there are zero problems on file.

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useProblems } from '@/hooks/useProblems';
import { isRecentlyUpdated, mostRecentUpdate } from '@/lib/problem-utils';
import { ProblemListCardEmpty } from './ProblemListCardEmpty';
import { ProblemListSkeleton } from './ProblemListSkeleton';

const statusDotClass: Record<string, string> = {
  ACTIVE: 'bg-accent-mid',
  RESOLVED: 'bg-border-strong',
  REMOVED: 'bg-border-strong',
};

export function ProblemListCard({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { data, isLoading } = useProblems(patientId);

  if (isLoading) return <ProblemListSkeleton />;

  const allProblems = data?.data ?? [];
  if (allProblems.length === 0) return <ProblemListCardEmpty />;

  const active = allProblems.filter((p) => p.status === 'ACTIVE');
  const lastUpdated = mostRecentUpdate(active.length > 0 ? active : allProblems);
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
          <div className="w-[26px] h-[26px] bg-surface-3 rounded-md flex items-center justify-center text-[13px]">
            📋
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">
            Problem List
          </span>
          {lastUpdated && (
            <span className={cn('font-mono text-[9px]', recent ? 'text-text-secondary' : 'text-text-muted')}>
              {recent && <span className="w-2 h-2 rounded-full bg-accent-mid inline-block mr-1" />}
              {new Date(lastUpdated).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <button
          onClick={() => router.push(`/dashboard/${patientId}/problems`)}
          className="h-7 px-3 bg-surface-2 text-text-secondary border border-border rounded-md text-[11px] font-semibold cursor-pointer hover:bg-surface-3 hover:text-text-primary transition-colors"
        >
          Manage
        </button>
      </div>

      {active.length === 0 ? (
        <div className="py-5 px-3.5 text-xs text-text-muted text-center">
          No active problems. {allProblems.length} resolved/removed entr{allProblems.length === 1 ? 'y' : 'ies'} on file.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {active.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-3.5 py-2">
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusDotClass[p.status])} />
              <span className="text-[12px] text-text-primary truncate">{p.title}</span>
            </div>
          ))}
          {active.length > 6 && (
            <div className="px-3.5 py-2 text-[11px] text-text-muted text-center">
              +{active.length - 6} more — view full list
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 6. Frontend — files to modify

### 6.1 `frontend/src/app/dashboard/[patientId]/problems/page.tsx`

Replace the Phase-8-placeholder text with the real screen:

```tsx
'use client';

import { useParams } from 'next/navigation';
import { ProblemListScreen } from '@/components/problems/ProblemListScreen';

export default function ProblemsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  return <ProblemListScreen patientId={patientId} />;
}
```

### 6.2 `frontend/src/app/dashboard/[patientId]/problems/loading.tsx`

Swap the generic `TabContentSkeleton` for the purpose-built (already existing, currently unused) `ProblemListSkeleton`:

```tsx
import { ProblemListSkeleton } from '@/components/problems/ProblemListSkeleton';

export default function Loading() {
  return <ProblemListSkeleton />;
}
```

### 6.3 `frontend/src/app/dashboard/[patientId]/page.tsx`

Two changes:

1. Swap the `ProblemListCardEmpty` import for `ProblemListCard`.
2. Thread `patientId` into `ProblemsAndMedsSection` (it currently takes no props).

```diff
- import { ProblemListCardEmpty } from '@/components/problems/ProblemListCardEmpty';
+ import { ProblemListCard } from '@/components/problems/ProblemListCard';
  import { MedicationListCardEmpty } from '@/components/medications/MedicationListCardEmpty';
```

```diff
- function ProblemsAndMedsSection() {
+ function ProblemsAndMedsSection({ patientId }: { patientId: string }) {
    return (
      <div className="grid grid-cols-2 gap-4">
-       <ProblemListCardEmpty />
+       <ProblemListCard patientId={patientId} />
        <MedicationListCardEmpty />
      </div>
    );
  }
```

```diff
      {/* Suspense 3: Problem List + Medications */}
      <Suspense fallback={null}>
-       <ProblemsAndMedsSection />
+       <ProblemsAndMedsSection patientId={patientId} />
      </Suspense>
```

`MedicationListCardEmpty` is intentionally left untouched — that's Phase 6's job.

---

## 7. Contract for Phase 8 (Initial Note) — read this before starting Phase 8

This is the part the user specifically asked to keep linear. Phase 8's deliverable text says:

> Assessment field: dynamic tag list component feeding into Problem List on publish
> ...
> publish(id, userId) — set status PUBLISHED; upsert problems from assessment[]

To honor that without modifying anything built in this phase:

1. **Import `ProblemsModule` into `InitialNotesModule`'s `imports` array** (the empty `InitialNotesModule` stub currently has no imports — add `imports: [ProblemsModule]`), then inject `ProblemsService` into `InitialNotesService`'s constructor.
2. Inside `InitialNotesService.publish(id, userId)`, wrap the status flip and the problem upsert in the **same** `this.prisma.$transaction(async (tx) => { ... })`:
   ```typescript
   await this.prisma.$transaction(async (tx) => {
     const note = await tx.initialNote.update({
       where: { id },
       data: { status: 'PUBLISHED' },
     });
     const titles = note.assessment /* whatever shape Phase 8 settles on */
       .map((item: { title: string }) => item.title);
     await this.problemsService.upsertFromAssessment(note.patientId, titles, userId, tx);
   });
   ```
3. The exact JSON shape of `InitialNote.assessment` is Phase 8's to design — `upsertFromAssessment` only needs a flat `string[]` of problem titles extracted from whatever shape is chosen, so Phase 8 has full freedom there without coming back to touch this module.
4. **Do not change `upsertFromAssessment`'s signature** (`patientId, assessmentTitles: string[], userId, client?`) without updating this call site. If Phase 8 needs different matching behavior (e.g. matching by an ICD code instead of title), extend the method with an additional optional parameter rather than altering the existing ones, to avoid breaking this contract retroactively.
5. Phase 9 (Progress Notes) will similarly need `ProblemsModule` imported into `ProgressNotesModule`, calling `problemsService.findActiveForPatient(patientId)` to build `problemListSnapshot` JSON on note creation — that method is already exposed and ready for that use.

---

## 8. Acceptance criteria

**Backend**
- [ ] `GET /patients/:patientId/problems` works for Doctor, Nurse, and Admin tokens; returns `{ data: Problem[] }` sorted by `sortOrder` ascending, including REMOVED entries.
- [ ] `POST /patients/:patientId/problems` returns `403` for Nurse, `201` for Doctor/Admin.
- [ ] Creating a problem with a `parentId` that itself has a non-null `parentId` returns `400`.
- [ ] `PATCH .../problems/:id` with `{ status: "RESOLVED" }` bumps `sortOrder` to the current max+1 for that patient.
- [ ] `PATCH .../problems/:id` with `{ status: "REMOVED" }` also sets any direct children to `REMOVED`.
- [ ] `DELETE .../problems/:id` leaves the row in the table with `status = REMOVED` (verify via `GET` afterward — it should still appear).
- [ ] `POST .../problems/reorder` with an `id` belonging to a different patient returns `403`.
- [ ] No Prisma migration was generated or run for this phase.

**Frontend**
- [ ] `/dashboard/:patientId/problems` renders the real screen, not the Phase-8 placeholder text.
- [ ] Nurse-role users see problems read-only — no "+ Add Problem", no edit/resolve/remove buttons, no drag handles.
- [ ] Drag-and-drop reordering of root-level ACTIVE problems persists after a page refresh.
- [ ] Reordering is also achievable via keyboard alone (Tab to a drag handle, Space, Arrow keys, Space).
- [ ] Resolving a problem moves it visually to the bottom of the list and shows a "Resolved" badge.
- [ ] The Dashboard's Problem List card shows only ACTIVE problems, falls back to the existing empty state when none exist, and gets the amber/accent "recently updated" treatment when something changed in the last 48 hours.
- [ ] The Medications card on the Dashboard is unchanged (still the empty placeholder — Phase 6 territory).

---

## 9. Explicit non-goals for this pass

- Do not implement Medications, Vital Signs, Visits creation flows, Initial Notes, or Progress Notes.
- Do not add a `GET /patients/:patientId/problems/active`-style separate endpoint — the Dashboard card filters the single `GET .../problems` response client-side.
- Do not build custom up/down reorder buttons — `@dnd-kit`'s `KeyboardSensor` already covers the accessibility requirement.
- Do not add Admin Analytics aggregation queries for problems — that's Phase 14, and it reads the existing `problems` table without requiring anything new from this phase.