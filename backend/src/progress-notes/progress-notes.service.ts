import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgressNoteDto } from './dto/create-progress-note.dto';
import { UpdateProgressNoteDto } from './dto/update-progress-note.dto';
import { NoteStatus, VisitType, Prisma } from '@prisma/client';
import { VisitsService } from '../visits/visits.service';
import { ProblemsService } from '../problems/problems.service';
import { MedicationsService } from '../medications/medications.service';
import { VitalsService } from '../vitals/vitals.service';
import { InitialNotesService } from '../initial-notes/initial-notes.service';
import { diffByTitle, diffByNameDoseUnit } from './progress-notes.utils';

@Injectable()
export class ProgressNotesService {
  constructor(
    private prisma: PrismaService,
    private visitsService: VisitsService,
    private problemsService: ProblemsService,
    private medicationsService: MedicationsService,
    private vitalsService: VitalsService,
    private initialNotesService: InitialNotesService,
  ) {}

  async findAllByPatient(patientId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.progressNote.findMany({
        where: { visit: { patientId } },
        skip,
        take: limit,
        orderBy: { visit: { visitDatetime: 'desc' } },
        include: {
          visit: true,
          author: { select: { firstName: true, lastName: true, role: true } },
          lastEditor: { select: { firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.progressNote.count({ where: { visit: { patientId } } }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const note = await this.prisma.progressNote.findUnique({
      where: { id },
      include: { visit: true, author: { select: { firstName: true, lastName: true, role: true } }, lastEditor: { select: { firstName: true, lastName: true, role: true } } },
    });
    if (!note) throw new NotFoundException('Progress Note not found');
    return note;
  }

  private async assertInitialNotePublished(patientId: string) {
    try {
      const initialNote = await this.initialNotesService.findOne(patientId);
      if (initialNote.status !== NoteStatus.PUBLISHED) {
        throw new BadRequestException(
          'Initial Note must be published before a Progress Note can be created.',
        );
      }
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new BadRequestException(
          'An Initial Note must be published before a Progress Note can be created.',
        );
      }
      throw e;
    }
  }

  private async getLatestNonpharmMgmt(
    patientId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string | null> {
    const latestProgress = await tx.progressNote.findFirst({
      where: { visit: { patientId }, status: NoteStatus.PUBLISHED },
      orderBy: { visit: { visitDatetime: 'desc' } },
      select: {
        mgmtNonpharm: true,
        visit: { select: { visitDatetime: true } },
      },
    });

    const initial = await tx.initialNote.findFirst({
      where: { visit: { patientId }, status: NoteStatus.PUBLISHED },
      select: {
        mgmtNonpharm: true,
        visit: { select: { visitDatetime: true } },
      },
    });

    if (latestProgress && initial) {
      return latestProgress.visit.visitDatetime > initial.visit.visitDatetime
        ? latestProgress.mgmtNonpharm
        : initial.mgmtNonpharm;
    }

    if (latestProgress) return latestProgress.mgmtNonpharm;
    if (initial) return initial.mgmtNonpharm;
    return null;
  }

  async create(patientId: string, dto: CreateProgressNoteDto, userId: string) {
    await this.assertInitialNotePublished(patientId);

    const existingDraft = await this.prisma.progressNote.findFirst({
      where: {
        authorId: userId,
        status: NoteStatus.DRAFT,
        visit: {
          patientId,
        },
      },
    });

    if (existingDraft) {
      throw new ConflictException('You already have an active progress note draft for this patient.');
    }

    return this.prisma.$transaction(async (tx) => {
      const [activeProblems, activeMedications, latestVitals] =
        await Promise.all([
          this.problemsService.findActiveForPatient(patientId, tx),
          this.medicationsService.findActiveForPatient(patientId, tx),
          this.vitalsService.findLatestForPatient(patientId, tx),
        ]);

      const priorMgmtNonpharm = await this.getLatestNonpharmMgmt(patientId, tx);

      const visit = await this.visitsService.createForNote(
        patientId,
        userId,
        VisitType.PROGRESS,
        new Date(dto.visitDatetime),
        tx,
      );

      return tx.progressNote.create({
        data: {
          visitId: visit.id,
          authorId: userId,
          subjective: dto.subjective ?? '',
          objective: dto.objective ?? '',
          mgmtNonpharm: dto.mgmtNonpharm ?? priorMgmtNonpharm ?? '',
          diagnostics: dto.diagnostics ? (dto.diagnostics as any) : [],
          problemListSnapshot: dto.problemListSnapshot
            ? (dto.problemListSnapshot as any)
            : (activeProblems as any),
          medicationSnapshot: dto.medicationSnapshot
            ? (dto.medicationSnapshot as any)
            : (activeMedications as any),
          status: NoteStatus.DRAFT,
        },
      });
    }, {
      timeout: 20000,
      maxWait: 10000,
    });
  }

  async createAndPublish(patientId: string, dto: CreateProgressNoteDto, userId: string) {
    const note = await this.create(patientId, dto, userId);
    return this.publish(patientId, note.id, userId);
  }

  async update(id: string, dto: UpdateProgressNoteDto, userId: string) {
    const note = await this.prisma.progressNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');

    const { visitDatetime, ...updateData } = dto;
    const data: Prisma.ProgressNoteUpdateInput = {
      ...(updateData.subjective !== undefined && {
        subjective: updateData.subjective,
      }),
      ...(updateData.objective !== undefined && {
        objective: updateData.objective,
      }),
      ...(updateData.mgmtNonpharm !== undefined && {
        mgmtNonpharm: updateData.mgmtNonpharm,
      }),
      ...(updateData.diagnostics !== undefined && {
        diagnostics: updateData.diagnostics,
      }),
      ...(updateData.problemListSnapshot !== undefined && {
        problemListSnapshot: updateData.problemListSnapshot as any,
      }),
      ...(updateData.medicationSnapshot !== undefined && {
        medicationSnapshot: updateData.medicationSnapshot as any,
      }),
    };

    if (note.status === NoteStatus.PUBLISHED) {
      data.lastEditor = { connect: { id: userId } };
      data.lastEditedAt = new Date();
    }

    return this.prisma.progressNote.update({ where: { id }, data });
  }

  async publish(patientId: string, id: string, userId: string) {
    const note = await this.prisma.progressNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');

    if (!note.subjective || !note.objective) {
      throw new BadRequestException(
        'Subjective and Objective are required to publish a progress note.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const beforeProblems = await this.problemsService.findActiveForPatient(
        patientId,
        tx,
      );
      const beforeMeds = await this.medicationsService.findActiveForPatient(
        patientId,
        tx,
      );

      const snapshotItems = (note.problemListSnapshot as any[] || [])
        .filter(p => p && p.title && String(p.title).trim() !== '')
        .map(p => ({ title: String(p.title).trim(), icdCode: p.icdCode }));

      await this.problemsService.upsertFromAssessment(
        patientId,
        snapshotItems,
        userId,
        tx,
      );

      const snapshotMeds = (note.medicationSnapshot as any[] || [])
        .filter(m => m && m.name && String(m.name).trim() !== '')
        .map((m) => ({
          name: String(m.name).trim(),
          dose: m.dose !== undefined && m.dose !== null ? String(m.dose).trim() : '',
          formulation: m.formulation,
          quantity: m.quantity !== undefined && m.quantity !== null ? Number(m.quantity) : undefined,
          instructions: m.instructions,
        }));
      await this.medicationsService.upsertFromNoteMedications(
        patientId,
        snapshotMeds,
        userId,
        tx,
      );

      const afterProblems = await this.problemsService.findActiveForPatient(
        patientId,
        tx,
      );
      const afterMeds = await this.medicationsService.findActiveForPatient(
        patientId,
        tx,
      );

      const problemChanges = diffByTitle(beforeProblems, afterProblems);
      const medicationChanges = diffByNameDoseUnit(beforeMeds, afterMeds);

      await this.visitsService.updateChangeSummary(
        note.visitId,
        problemChanges,
        medicationChanges,
        tx,
      );

      const published = await tx.progressNote.update({
        where: { id },
        data: { status: NoteStatus.PUBLISHED, updatedAt: new Date() },
      });

      await tx.visit.update({
        where: { id: note.visitId },
        data: { status: NoteStatus.PUBLISHED },
      });

      return published;
    }, {
      timeout: 20000,
      maxWait: 10000,
    });
  }

  async deleteDraft(patientId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.progressNote.findUnique({
        where: { id },
        include: { visit: true },
      });

      if (!note) throw new NotFoundException('Note not found');
      if (note.authorId !== userId && userId !== 'admin') throw new ForbiddenException('Not authorized to delete this note');
      if (note.visit.patientId !== patientId) throw new BadRequestException('Note does not belong to this patient');

      if (note.status !== NoteStatus.DRAFT) {
        // Ensure there are no newer progress notes
        const newerNote = await tx.progressNote.findFirst({
          where: {
            visit: { patientId },
            createdAt: { gt: note.createdAt },
          },
        });
        if (newerNote) {
          throw new BadRequestException('Only the latest progress note can be deleted');
        }

        // Revert global lists to previous state
        let prevSnapshotProblems: any[] = [];
        let prevSnapshotMeds: any[] = [];
        
        const prevProgress = await tx.progressNote.findFirst({
          where: { visit: { patientId }, status: NoteStatus.PUBLISHED, id: { not: id } },
          orderBy: { createdAt: 'desc' }
        });
        
        if (prevProgress) {
          prevSnapshotProblems = prevProgress.problemListSnapshot as any[] || [];
          prevSnapshotMeds = prevProgress.medicationSnapshot as any[] || [];
        } else {
          const initialNote = await tx.initialNote.findFirst({
            where: { visit: { patientId } }
          });
          if (initialNote) {
            prevSnapshotProblems = initialNote.assessment as any[] || [];
            prevSnapshotMeds = initialNote.medicationSnapshot as any[] || [];
          }
        }

        const validProblems = prevSnapshotProblems
          .filter(p => p && p.title && String(p.title).trim() !== '')
          .map(p => ({ title: String(p.title).trim(), icdCode: p.icdCode }));

        const validMeds = prevSnapshotMeds
          .filter(m => m && m.name && String(m.name).trim() !== '')
          .map(m => ({
            name: String(m.name).trim(),
            dose: m.dose !== undefined && m.dose !== null ? String(m.dose).trim() : '',
            formulation: m.formulation,
            quantity: m.quantity !== undefined && m.quantity !== null ? Number(m.quantity) : undefined,
            instructions: m.instructions,
          }));

        await this.problemsService.upsertFromAssessment(patientId, validProblems, userId, tx);
        await this.medicationsService.upsertFromNoteMedications(patientId, validMeds, userId, tx);
      }

      await tx.progressNote.delete({ where: { id } });
      await tx.visit.delete({ where: { id: note.visitId } });

      return { success: true };
    });
  }

  async deleteAllDrafts(patientId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const drafts = await tx.progressNote.findMany({
        where: {
          authorId: userId,
          status: NoteStatus.DRAFT,
          visit: {
            patientId,
          },
        },
        select: { id: true, visitId: true },
      });

      if (drafts.length === 0) return { count: 0 };

      const noteIds = drafts.map(d => d.id);
      const visitIds = drafts.map(d => d.visitId);

      const count = await tx.progressNote.deleteMany({
        where: { id: { in: noteIds } },
      });

      await tx.visit.deleteMany({
        where: { id: { in: visitIds } },
      });

      return { count: count.count };
    });
  }
}
