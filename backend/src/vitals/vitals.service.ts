import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, VitalSign } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVitalsDto } from './dto/create-vitals.dto';
import { UpdateVitalsDto } from './dto/update-vitals.dto';

type PrismaTx = Prisma.TransactionClient;

const MEASURE_FIELDS = [
  'sbp',
  'dbp',
  'heartRate',
  'respiratoryRate',
  'temperature',
  'oxygenSaturation',
] as const;

@Injectable()
export class VitalsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // LIST — paginated, newest first.
  // Deleted records stay in the list (isDeleted: true) so the history table
  // can render them as a struck-through "ghost", same as the note timeline.
  // Pass excludeDeleted=true to hide them entirely.
  // ─────────────────────────────────────────────
  async findAll(
    patientId: string,
    page = 1,
    limit = 10,
    excludeDeleted = false,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.VitalSignWhereInput = {
      patientId,
      ...(excludeDeleted ? { isDeleted: false } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.vitalSign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { measuredAt: 'desc' },
        include: {
          measuredByUser: {
            select: { firstName: true, lastName: true, role: true },
          },
        },
      }),
      this.prisma.vitalSign.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─────────────────────────────────────────────
  // LATEST — single most recent record (or null)
  // Used by: Dashboard VitalsCard, and Phase 8 Initial Note pre-fill.
  // Deleted records are excluded — a ghosted entry should never surface as
  // "the" current reading.
  // ─────────────────────────────────────────────
  async findLatest(patientId: string): Promise<VitalSign | null> {
    return this.prisma.vitalSign.findFirst({
      where: { patientId, isDeleted: false },
      orderBy: { measuredAt: 'desc' },
      include: {
        measuredByUser: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  // ─────────────────────────────────────────────
  // AS-OF — first record at or before a cutoff timestamp (or null).
  // Used by: published note read-only views, so a note's vitals snapshot
  // stays pinned to what was recorded at the time of the visit instead of
  // drifting to whatever is most recent as new vitals get logged later.
  // Deleted records are excluded, same as findLatest().
  // ─────────────────────────────────────────────
  async findAsOf(patientId: string, cutoff: Date): Promise<VitalSign | null> {
    return this.prisma.vitalSign.findFirst({
      where: { patientId, isDeleted: false, measuredAt: { lte: cutoff } },
      orderBy: { measuredAt: 'asc' },
      include: {
        measuredByUser: {
          select: { firstName: true, lastName: true, role: true },
        },
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
      where: { patientId, isDeleted: false },
      orderBy: { measuredAt: 'desc' },
    });
  }

  async findOne(patientId: string, id: string): Promise<VitalSign> {
    const record = await this.prisma.vitalSign.findFirst({
      where: { id, patientId },
    });
    if (!record)
      throw new NotFoundException(
        `Vital signs record ${id} not found for this patient.`,
      );
    return record;
  }

  // ─────────────────────────────────────────────
  // CREATE — standalone vitals (visitId always null in Phase 7)
  // ─────────────────────────────────────────────
  async create(
    patientId: string,
    dto: CreateVitalsDto,
    userId: string,
  ): Promise<VitalSign> {
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
  async update(
    patientId: string,
    id: string,
    dto: UpdateVitalsDto,
  ): Promise<VitalSign> {
    const existing = await this.findOne(patientId, id);
    if (existing.isDeleted) {
      throw new BadRequestException(
        'This vital signs record has been deleted and can no longer be edited.',
      );
    }

    const merged: CreateVitalsDto = {
      sbp: dto.sbp !== undefined ? dto.sbp : (existing.sbp ?? undefined),
      dbp: dto.dbp !== undefined ? dto.dbp : (existing.dbp ?? undefined),
      heartRate:
        dto.heartRate !== undefined
          ? dto.heartRate
          : (existing.heartRate ?? undefined),
      respiratoryRate:
        dto.respiratoryRate !== undefined
          ? dto.respiratoryRate
          : (existing.respiratoryRate ?? undefined),
      temperature:
        dto.temperature !== undefined
          ? dto.temperature
          : existing.temperature
            ? Number(existing.temperature)
            : undefined,
      oxygenSaturation:
        dto.oxygenSaturation !== undefined
          ? dto.oxygenSaturation
          : (existing.oxygenSaturation ?? undefined),
      measuredAt: dto.measuredAt ?? existing.measuredAt.toISOString(),
    };
    this.assertAtLeastOneMeasure(merged);

    const data: Prisma.VitalSignUpdateInput = {};
    if (dto.sbp !== undefined) data.sbp = dto.sbp;
    if (dto.dbp !== undefined) data.dbp = dto.dbp;
    if (dto.heartRate !== undefined) data.heartRate = dto.heartRate;
    if (dto.respiratoryRate !== undefined)
      data.respiratoryRate = dto.respiratoryRate;
    if (dto.temperature !== undefined) data.temperature = dto.temperature;
    if (dto.oxygenSaturation !== undefined)
      data.oxygenSaturation = dto.oxygenSaturation;
    if (dto.measuredAt !== undefined)
      data.measuredAt = new Date(dto.measuredAt);

    return this.prisma.vitalSign.update({ where: { id }, data });
  }

  // ─────────────────────────────────────────────
  // DELETE — soft delete. The record stays in the history list flagged
  // isDeleted so it renders as a struck-through ghost, same as a deleted
  // note in the timeline, instead of disappearing outright.
  // ─────────────────────────────────────────────
  async remove(patientId: string, id: string): Promise<VitalSign> {
    const existing = await this.findOne(patientId, id);
    if (existing.isDeleted) {
      throw new BadRequestException(
        'This vital signs record has already been deleted.',
      );
    }
    return this.prisma.vitalSign.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  private assertAtLeastOneMeasure(dto: Partial<CreateVitalsDto>): void {
    const hasAny = MEASURE_FIELDS.some(
      (field) => dto[field] !== undefined && dto[field] !== null,
    );
    if (!hasAny) {
      throw new BadRequestException(
        'At least one vital sign measurement (SBP, DBP, heart rate, respiratory rate, temperature, or oxygen saturation) is required.',
      );
    }
  }
}
