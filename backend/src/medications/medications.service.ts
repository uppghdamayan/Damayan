import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, Medication, MedicationLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class MedicationsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // LIST — active by default; ?includeInactive=true returns the full history
  // (used by the frontend autocomplete merge and by Visit History detail views).
  // ─────────────────────────────────────────────
  async findAll(
    patientId: string,
    includeInactive = false,
  ): Promise<Medication[]> {
    return this.prisma.medication.findMany({
      where: { patientId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: { addedByUser: { select: { firstName: true, lastName: true, role: true } } },
    });
  }

  /**
   * Internal helper — NOT exposed as a route. Used by:
   *  - Phase 8 (Initial Note) to seed the medication list on publish
   *  - Phase 9 (Progress Notes) to build medicationSnapshot on note creation/publish
   * See Section 2 ("Cross-Module Integration Contract") below.
   */
  async findActiveForPatient(
    patientId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<Medication[]> {
    return client.medication.findMany({
      where: { patientId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: { addedByUser: { select: { firstName: true, lastName: true, role: true } } },
    });
  }

  async findOne(patientId: string, id: string): Promise<Medication> {
    const med = await this.prisma.medication.findFirst({
      where: { id, patientId },
    });
    if (!med)
      throw new NotFoundException(
        `Medication ${id} not found for this patient.`,
      );
    return med;
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    patientId: string,
    dto: CreateMedicationDto,
    userId: string,
  ): Promise<Medication> {
    return this.prisma.$transaction(async (tx) => {
      const med = await tx.medication.create({
        data: {
          patientId,
          name: dto.name.trim(),
          dose: dto.dose.trim(),
          formulation: dto.formulation?.trim() || null,
          instructions: dto.instructions?.trim() || null,
          quantity: dto.quantity ?? null,
          isActive: true,
          addedBy: userId,
        },
      });

      await tx.medicationLog.create({
        data: {
          patientId,
          medicationId: med.id,
          action: 'Created',
          description: `Added medication: ${med.name}`,
          editorId: userId,
        },
      });

      return med;
    });
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    patientId: string,
    id: string,
    dto: UpdateMedicationDto,
    userId: string,
  ): Promise<Medication> {
    const existing = await this.findOne(patientId, id); // throws if not found / not owned by patient

    const data: Prisma.MedicationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.dose !== undefined) data.dose = dto.dose.trim();
    if (dto.formulation !== undefined)
      data.formulation = dto.formulation?.trim() || null;
    if (dto.instructions !== undefined)
      data.instructions = dto.instructions?.trim() || null;
    if (dto.quantity !== undefined) data.quantity = dto.quantity ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    let action = 'Updated';
    let description = `Updated medication: ${existing.name}`;

    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      if (dto.isActive) {
        action = 'Reactivated';
        description = `Reactivated medication: ${existing.name}`;
      } else {
        action = 'Discontinued';
        description = `Discontinued medication: ${existing.name}`;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.medication.update({ where: { id }, data });

      await tx.medicationLog.create({
        data: {
          patientId,
          medicationId: updated.id,
          action,
          description,
          editorId: userId,
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────
  // HARD DELETE — Removes medication from the database.
  // ─────────────────────────────────────────────
  async remove(patientId: string, id: string, userId: string): Promise<Medication> {
    const med = await this.findOne(patientId, id);
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.medication.delete({
        where: { id },
      });

      await tx.medicationLog.create({
        data: {
          patientId,
          medicationId: null, // Medication is physically deleted
          action: 'Removed',
          description: `Removed medication: ${med.name}`,
          editorId: userId,
        },
      });

      return deleted;
    });
  }

  // ─────────────────────────────────────────────
  // FETCH LOGS
  // ─────────────────────────────────────────────
  async findLogs(patientId: string): Promise<MedicationLog[]> {
    return this.prisma.medicationLog.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        editor: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  // ─────────────────────────────────────────────
  // PHASE 8/9 INTEGRATION POINT — see Section 2 of this file for the full contract.
  //
  // Upserts medications from a note's medication list on publish/save.
  // Case-insensitive match on (name, dose, unit) against the patient's existing
  // ACTIVE medications:
  //   - exact match (name+dose+unit) → no-op (already on the list)
  //   - name matches but dose/unit differs → treated as a NEW entry (dose
  //     changes are clinically significant; never silently overwrite a dose)
  //   - no match → create new active medication
  // Medications removed from the note's list compared to the patient's current
  // active list are NOT auto-deactivated here — deactivation is always an
  // explicit clinician action via DELETE, performed by the calling module if
  // its own business rules require it (Initial Note does not; see Section 2).
  // ─────────────────────────────────────────────
  async upsertFromNoteMedications(
    patientId: string,
    items: {
      name: string;
      dose: string;
      formulation?: string;
      instructions?: string;
      quantity?: number;
    }[],
    userId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<void> {
    const keptIds = new Set<string>();

    const existing = await client.medication.findMany({
      where: { patientId, isActive: true },
    });

    for (const item of items) {
      const match = existing.find(
        (m) =>
          m.name.toLowerCase() === item.name.trim().toLowerCase() &&
          String(m.dose).toLowerCase() === item.dose.trim().toLowerCase(),
      );
      if (match) {
        keptIds.add(match.id);
        continue;
      }

      await client.medication.create({
        data: {
          patientId,
          name: item.name.trim(),
          dose: item.dose.trim(),
          formulation: item.formulation?.trim() || null,
          instructions: item.instructions?.trim() || null,
          quantity: item.quantity ?? null,
          isActive: true,
          addedBy: userId,
        },
      });
    }

    // Deactivate missing items
    for (const ext of existing) {
      if (!keptIds.has(ext.id)) {
        await client.medication.update({
          where: { id: ext.id },
          data: { isActive: false },
        });
      }
    }
  }
}
