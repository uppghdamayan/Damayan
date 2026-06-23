import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInitialNoteDto } from './dto/create-initial-note.dto';
import { UpdateInitialNoteDto } from './dto/update-initial-note.dto';
import { NoteStatus, VisitType, Prisma } from '@prisma/client';
import { VisitsService } from '../visits/visits.service';
import { ProblemsService } from '../problems/problems.service';
import { MedicationsService } from '../medications/medications.service';

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
          status: NoteStatus.DRAFT,
        },
      });
    });
  }

  async update(patientId: string, id: string, dto: UpdateInitialNoteDto, userId: string) {
    const note = await this.prisma.initialNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.visitId && !(await this.prisma.visit.findFirst({ where: { id: note.visitId, patientId } }))) {
       throw new NotFoundException('Note not found for this patient');
    }

    const { visitDatetime, ...updateData } = dto;
    const data: Prisma.InitialNoteUpdateInput = {
      ...(updateData.chiefComplaint !== undefined && { chiefComplaint: updateData.chiefComplaint }),
      ...(updateData.hpi !== undefined && { hpi: updateData.hpi }),
      ...(updateData.pmhComorbidities !== undefined && { pmhComorbidities: updateData.pmhComorbidities }),
      ...(updateData.pmhSurgeries !== undefined && { pmhSurgeries: updateData.pmhSurgeries }),
      ...(updateData.pmhHospitalizations !== undefined && { pmhHospitalizations: updateData.pmhHospitalizations }),
      ...(updateData.allergies !== undefined && { allergies: updateData.allergies }),
      ...(updateData.familyHistory !== undefined && { familyHistory: updateData.familyHistory }),
      ...(updateData.socialHistory !== undefined && { socialHistory: updateData.socialHistory }),
      ...(updateData.obHistory !== undefined && { obHistory: updateData.obHistory }),
      ...(updateData.psychosocialHistory !== undefined && { psychosocialHistory: updateData.psychosocialHistory }),
      ...(updateData.physicalExam !== undefined && { physicalExam: updateData.physicalExam }),
      ...(updateData.assessment !== undefined && { assessment: updateData.assessment as any }),
      ...(updateData.mgmtNonpharm !== undefined && { mgmtNonpharm: updateData.mgmtNonpharm }),
      ...(updateData.diagnostics !== undefined && { diagnostics: updateData.diagnostics as any }),
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
    if (!note.assessment || (note.assessment as any[]).length === 0) missingFields.push('assessment');
    
    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields for publishing: ${missingFields.join(', ')}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const published = await tx.initialNote.update({
        where: { id },
        data: { status: NoteStatus.PUBLISHED },
      });

      const assessmentTitles = (note.assessment as { title: string }[]).map(a => a.title);
      await this.problemsService.upsertFromAssessment(patientId, assessmentTitles, userId, tx);

      // Medications are created directly, so we just query active meds during Initial Note publish?
      // Wait, initial&progress.md says: "Initial Note publish does not need deactivation logic at all... 
      // see comment block in the service". Actually, "note.medicationList" is mentioned in 3.1.4 but then:
      // "Important schema note: InitialNote has no dedicated medicationList column in schema.prisma...
      // The frontend MedicationListEditor uses useCreateMedication... while Initial Note is open.
      // This keeps a single source of truth in the medications table and avoids the upsert collision."
      // So I don't need to call upsertFromNoteMedications in publish for Initial Note if they are added live.
      // Let's re-read 3.1.4 Important schema note: "Do not add a new JSONB column... wire the frontend 
      // MedicationListEditor to call the Medications API directly". 
      // So no medication upserts during Initial Note publish.

      await tx.visit.update({
        where: { id: note.visitId },
        data: { status: NoteStatus.PUBLISHED },
      });

      return published;
    });
  }

  async remove(patientId: string, id: string, userId: string) {
    const note = await this.prisma.initialNote.findUnique({ where: { id }, include: { visit: true } });
    if (!note) throw new NotFoundException('Note not found');
    
    if (note.visit.patientId !== patientId) {
      throw new NotFoundException('Note not found for this patient');
    }

    const progressNotesCount = await this.prisma.progressNote.count({
      where: { visit: { patientId } }
    });

    if (progressNotesCount > 0) {
      throw new BadRequestException('Cannot delete initial note because progress notes already exist for this patient.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Delete attachments first if there are any
      await tx.attachment.deleteMany({
        where: { noteId: id }
      });
      
      await tx.initialNote.delete({ where: { id } });
      
      // Delete the visit since an Initial Note is 1:1 with its visit
      await tx.visit.delete({ where: { id: note.visitId } });
      
      return { success: true };
    });
  }
}
