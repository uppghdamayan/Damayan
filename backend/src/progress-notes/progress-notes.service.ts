import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
        }
      }),
      this.prisma.progressNote.count({ where: { visit: { patientId } } }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const note = await this.prisma.progressNote.findUnique({ where: { id }, include: { visit: true } });
    if (!note) throw new NotFoundException('Progress Note not found');
    return note;
  }

  private async assertInitialNotePublished(patientId: string) {
    try {
      const initialNote = await this.initialNotesService.findOne(patientId);
      if (initialNote.status !== NoteStatus.PUBLISHED) {
        throw new BadRequestException('Initial Note must be published before a Progress Note can be created.');
      }
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw new BadRequestException('An Initial Note must be published before a Progress Note can be created.');
      }
      throw e;
    }
  }

  private async getLatestNonpharmMgmt(patientId: string, tx: Prisma.TransactionClient): Promise<string | null> {
    const latestProgress = await tx.progressNote.findFirst({
      where: { visit: { patientId }, status: NoteStatus.PUBLISHED },
      orderBy: { visit: { visitDatetime: 'desc' } },
      select: { mgmtNonpharm: true, visit: { select: { visitDatetime: true } } }
    });

    const initial = await tx.initialNote.findFirst({
      where: { visit: { patientId }, status: NoteStatus.PUBLISHED },
      select: { mgmtNonpharm: true, visit: { select: { visitDatetime: true } } }
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

    return this.prisma.$transaction(async (tx) => {
      const [activeProblems, activeMedications, latestVitals] = await Promise.all([
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
          problemListSnapshot: activeProblems as any,
          medicationSnapshot: activeMedications as any,
          status: NoteStatus.DRAFT,
        },
      });
    });
  }

  async update(id: string, dto: UpdateProgressNoteDto, userId: string) {
    const note = await this.prisma.progressNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');

    const { visitDatetime, ...updateData } = dto;
    const data: Prisma.ProgressNoteUpdateInput = {
      ...(updateData.subjective !== undefined && { subjective: updateData.subjective }),
      ...(updateData.objective !== undefined && { objective: updateData.objective }),
      ...(updateData.mgmtNonpharm !== undefined && { mgmtNonpharm: updateData.mgmtNonpharm }),
      ...(updateData.diagnostics !== undefined && { diagnostics: updateData.diagnostics as any }),
      ...(updateData.problemListSnapshot !== undefined && { problemListSnapshot: updateData.problemListSnapshot as any }),
      ...(updateData.medicationSnapshot !== undefined && { medicationSnapshot: updateData.medicationSnapshot as any }),
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
      throw new BadRequestException('Subjective and Objective are required to publish a progress note.');
    }

    return this.prisma.$transaction(async (tx) => {
      const beforeProblems = await this.problemsService.findActiveForPatient(patientId, tx);
      const beforeMeds = await this.medicationsService.findActiveForPatient(patientId, tx);

      const snapshotTitles = ((note.problemListSnapshot as any[]) || []).map((p: any) => p.title);
      await this.problemsService.upsertFromAssessment(patientId, snapshotTitles, userId, tx);

      const snapshotMeds = (note.medicationSnapshot as any[]) || [];
      await this.medicationsService.upsertFromNoteMedications(patientId, snapshotMeds, userId, tx);

      const afterProblems = await this.problemsService.findActiveForPatient(patientId, tx);
      const afterMeds = await this.medicationsService.findActiveForPatient(patientId, tx);

      const problemChanges = diffByTitle(beforeProblems, afterProblems);
      const medicationChanges = diffByNameDoseUnit(beforeMeds, afterMeds);

      await this.visitsService.updateChangeSummary(note.visitId, problemChanges, medicationChanges, tx);

      const published = await tx.progressNote.update({
        where: { id },
        data: { status: NoteStatus.PUBLISHED },
      });

      await tx.visit.update({
        where: { id: note.visitId },
        data: { status: NoteStatus.PUBLISHED },
      });

      return published;
    });
  }
}
