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
