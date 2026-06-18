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
        icdCode: dto.icdCode?.trim() || null,
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
      if (dto.icdCode !== undefined) data.icdCode = dto.icdCode ? dto.icdCode.trim() : null;
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
