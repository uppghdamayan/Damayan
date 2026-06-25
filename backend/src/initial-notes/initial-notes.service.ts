import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInitialNoteDto } from './dto/create-initial-note.dto';
import { UpdateInitialNoteDto } from './dto/update-initial-note.dto';
import { NoteStatus, VisitType, Prisma } from '@prisma/client';
import { VisitsService } from '../visits/visits.service';
import { ProblemsService } from '../problems/problems.service';
import { MedicationsService } from '../medications/medications.service';
import { diffByTitle, diffByNameDoseUnit } from '../progress-notes/progress-notes.utils';

@Injectable()
export class InitialNotesService {
  constructor(
    private prisma: PrismaService,
    private visitsService: VisitsService,
    private problemsService: ProblemsService,
    private medicationsService: MedicationsService,
  ) {}

  async findOne(patientId: string) {
    const note = await this.prisma.initialNote.findFirst({
      where: { visit: { patientId } },
      include: { author: { select: { firstName: true, lastName: true, role: true } }, lastEditor: { select: { firstName: true, lastName: true, role: true } } },
    });
    if (!note) {
      throw new NotFoundException('Initial note not found for this patient.');
    }
    return note;
  }

  async create(patientId: string, dto: CreateInitialNoteDto, userId: string) {
    const existing = await this.prisma.initialNote.findFirst({
      where: { visit: { patientId } },
    });
    if (existing) {
      throw new ConflictException('Patient already has an Initial Note.');
    }

    return this.prisma.$transaction(async (tx) => {
      const visit = await this.visitsService.createForNote(
        patientId,
        userId,
        VisitType.INITIAL,
        new Date(dto.visitDatetime),
        tx,
      );

      return tx.initialNote.create({
        data: {
          visitId: visit.id,
          authorId: userId,
          chiefComplaint: dto.chiefComplaint ?? '',
          hpi: dto.hpi ?? '',
          physicalExam: dto.physicalExam ?? '',
          assessment: dto.assessment ? (dto.assessment as any) : [],
          pmhComorbidities: dto.pmhComorbidities,
          pmhSurgeries: dto.pmhSurgeries,
          pmhHospitalizations: dto.pmhHospitalizations,
          allergies: dto.allergies,
          familyHistory: dto.familyHistory,
          socialHistory: dto.socialHistory,
          obHistory: dto.obHistory,
          psychosocialHistory: dto.psychosocialHistory,
          mgmtNonpharm: dto.mgmtNonpharm,
          diagnostics: dto.diagnostics ? (dto.diagnostics as any) : [],
          medicationSnapshot: dto.medicationSnapshot ? (dto.medicationSnapshot as any) : [],
          status: NoteStatus.DRAFT,
        },
      });
    });
  }

  async update(
    patientId: string,
    id: string,
    dto: UpdateInitialNoteDto,
    userId: string,
  ) {
    const note = await this.prisma.initialNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');
    if (
      note.visitId &&
      !(await this.prisma.visit.findFirst({
        where: { id: note.visitId, patientId },
      }))
    ) {
      throw new NotFoundException('Note not found for this patient');
    }

    const { visitDatetime, ...updateData } = dto;
    const data: Prisma.InitialNoteUpdateInput = {
      ...(updateData.chiefComplaint !== undefined && {
        chiefComplaint: updateData.chiefComplaint,
      }),
      ...(updateData.hpi !== undefined && { hpi: updateData.hpi }),
      ...(updateData.pmhComorbidities !== undefined && {
        pmhComorbidities: updateData.pmhComorbidities,
      }),
      ...(updateData.pmhSurgeries !== undefined && {
        pmhSurgeries: updateData.pmhSurgeries,
      }),
      ...(updateData.pmhHospitalizations !== undefined && {
        pmhHospitalizations: updateData.pmhHospitalizations,
      }),
      ...(updateData.allergies !== undefined && {
        allergies: updateData.allergies,
      }),
      ...(updateData.familyHistory !== undefined && {
        familyHistory: updateData.familyHistory,
      }),
      ...(updateData.socialHistory !== undefined && {
        socialHistory: updateData.socialHistory,
      }),
      ...(updateData.obHistory !== undefined && {
        obHistory: updateData.obHistory,
      }),
      ...(updateData.psychosocialHistory !== undefined && {
        psychosocialHistory: updateData.psychosocialHistory,
      }),
      ...(updateData.physicalExam !== undefined && {
        physicalExam: updateData.physicalExam,
      }),
      ...(updateData.assessment !== undefined && {
        assessment: updateData.assessment as any,
      }),
      ...(updateData.mgmtNonpharm !== undefined && {
        mgmtNonpharm: updateData.mgmtNonpharm,
      }),
      ...(updateData.diagnostics !== undefined && {
        diagnostics: updateData.diagnostics,
      }),
      ...(updateData.medicationSnapshot !== undefined && {
        medicationSnapshot: updateData.medicationSnapshot as any,
      }),
    };

    if (note.status === NoteStatus.PUBLISHED) {
      data.lastEditor = { connect: { id: userId } };
      data.lastEditedAt = new Date();
    }

    return this.prisma.initialNote.update({ where: { id }, data });
  }

  async publish(patientId: string, id: string, userId: string) {
    const note = await this.prisma.initialNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');

    // Assert publishable
    const missingFields: string[] = [];
    if (!note.chiefComplaint) missingFields.push('chiefComplaint');
    if (!note.hpi) missingFields.push('hpi');
    if (!note.physicalExam) missingFields.push('physicalExam');
    if (!note.assessment || (note.assessment as any[]).length === 0)
      missingFields.push('assessment');

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Missing required fields for publishing: ${missingFields.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const published = await tx.initialNote.update({
        where: { id },
        data: { status: NoteStatus.PUBLISHED },
      });

      const beforeProblems = await this.problemsService.findActiveForPatient(patientId, tx);
      const beforeMeds = await this.medicationsService.findActiveForPatient(patientId, tx);

      const assessmentItems = (note.assessment as any[] || [])
        .filter(a => a && a.title && String(a.title).trim() !== '')
        .map((a) => ({
          title: String(a.title).trim(),
          icdCode: a.icdCode,
        }));
      
      await this.problemsService.upsertFromAssessment(
        patientId,
        assessmentItems,
        userId,
        tx,
      );

      const medicationItems = (note.medicationSnapshot as any[] || [])
        .filter(m => m && m.name && String(m.name).trim() !== '')
        .map((m) => ({
          name: String(m.name).trim(),
          dose: m.dose !== undefined && m.dose !== null ? Number(m.dose) : 0,
          unit: m.unit || 'MG',
          formulation: m.formulation,
          quantity: m.quantity !== undefined && m.quantity !== null ? Number(m.quantity) : undefined,
          instructions: m.instructions,
        }));
      await this.medicationsService.upsertFromNoteMedications(
        patientId,
        medicationItems,
        userId,
        tx,
      );

      const afterProblems = await this.problemsService.findActiveForPatient(patientId, tx);
      const afterMeds = await this.medicationsService.findActiveForPatient(patientId, tx);

      const problemChanges = diffByTitle(beforeProblems, afterProblems);
      const medicationChanges = diffByNameDoseUnit(beforeMeds, afterMeds);

      await this.visitsService.updateChangeSummary(
        note.visitId,
        problemChanges,
        medicationChanges,
        tx,
      );

      await tx.visit.update({
        where: { id: note.visitId },
        data: { status: NoteStatus.PUBLISHED },
      });

      return published;
    });
  }

  async remove(patientId: string, id: string, userId: string) {
    const note = await this.prisma.initialNote.findUnique({
      where: { id },
      include: { visit: true },
    });
    if (!note) throw new NotFoundException('Note not found');

    if (note.visit.patientId !== patientId) {
      throw new NotFoundException('Note not found for this patient');
    }

    const progressNotesCount = await this.prisma.progressNote.count({
      where: { visit: { patientId } },
    });

    if (progressNotesCount > 0) {
      throw new BadRequestException(
        'Cannot delete initial note because progress notes already exist for this patient.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete attachments first if there are any
      await tx.attachment.deleteMany({
        where: { noteId: id },
      });

      await tx.initialNote.delete({ where: { id } });

      // Delete the visit since an Initial Note is 1:1 with its visit
      await tx.visit.delete({ where: { id: note.visitId } });

      return { success: true };
    });
  }
}
