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
    let attempts = 0;
    while (attempts < 5) {
      const last = await this.prisma.patient.findFirst({
        orderBy: { patientCode: 'desc' },
        select: { patientCode: true },
      });
      const next = last
        ? parseInt(last.patientCode.replace('PT-', ''), 10) + 1
        : 1;
      const code = `PT-${String(next).padStart(4, '0')}`;
      // Check it doesn't already exist (handles gaps from deletions)
      const exists = await this.prisma.patient.findUnique({
        where: { patientCode: code },
      });
      if (!exists) return code;
      attempts++;
    }
    throw new Error('Failed to generate unique patient code after 5 attempts.');
  }

  // ── List / search ──────────────────────────────────────────────────────────

  async findAll(filters: { search?: string; page?: number; limit?: number; includeInactive?: boolean }) {
    const { search, page = 1, limit = 50, includeInactive = false } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (search) {
      where.OR = [
        { lastName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
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
        lastName: dto.lastName,
        firstName: dto.firstName,
        middleName: dto.middleName,
        extension: dto.extension,
        dateOfBirth: new Date(dto.dateOfBirth),
        sex: dto.sex,
        addressStreet: dto.addressStreet,
        addressBarangay: dto.addressBarangay,
        addressCity: dto.addressCity,
        addressRegion: dto.addressRegion,
        createdBy: userId,
      },
    });
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdatePatientDto) {
    await this.findOne(id);
    return this.prisma.patient.update({
      where: { id },
      data: {
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.middleName !== undefined && { middleName: dto.middleName }),
        ...(dto.extension !== undefined && { extension: dto.extension }),
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: new Date(dto.dateOfBirth),
        }),
        ...(dto.sex !== undefined && { sex: dto.sex }),
        ...(dto.addressStreet !== undefined && {
          addressStreet: dto.addressStreet,
        }),
        ...(dto.addressBarangay !== undefined && {
          addressBarangay: dto.addressBarangay,
        }),
        ...(dto.addressCity !== undefined && { addressCity: dto.addressCity }),
        ...(dto.addressRegion !== undefined && {
          addressRegion: dto.addressRegion,
        }),
      },
    });
  }
  // ── Deactivate ─────────────────────────────────────────────────────────────

  async deactivate(id: string) {
    await this.findOne(id); // throws if not found
    return this.prisma.patient.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ── Reactivate ─────────────────────────────────────────────────────────────

  async reactivate(id: string) {
    // we use prisma directly because findOne might check isActive if we modify it in the future
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException(`Patient ${id} not found.`);
    return this.prisma.patient.update({
      where: { id },
      data: { isActive: true },
    });
  }
}
