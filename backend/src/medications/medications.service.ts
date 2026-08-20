import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, Medication, MedicationLog, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class MedicationsService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

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
      include: {
        addedByUser: {
          select: { firstName: true, lastName: true, role: true },
        },
        updatedByUser: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
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
      include: {
        addedByUser: {
          select: { firstName: true, lastName: true, role: true },
        },
        updatedByUser: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
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
          description: `Added medication '${med.name}'`,
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

    const data: Prisma.MedicationUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.dose !== undefined) data.dose = dto.dose.trim();
    if (dto.formulation !== undefined)
      data.formulation = dto.formulation?.trim() || null;
    if (dto.instructions !== undefined)
      data.instructions = dto.instructions?.trim() || null;
    if (dto.quantity !== undefined) data.quantity = dto.quantity ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    data.updatedBy = userId;

    let action = 'Updated';
    let description = `Updated medication '${existing.name}'`;

    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      if (dto.isActive) {
        action = 'Reactivated';
        description = `Reactivated medication '${existing.name}'`;
      } else {
        action = 'Discontinued';
        description = `Discontinued medication '${existing.name}'`;
      }
    } else {
      const changes: string[] = [];
      if (dto.name !== undefined && dto.name.trim() !== existing.name) {
        changes.push(`renamed to '${dto.name.trim()}'`);
      }
      if (dto.dose !== undefined && dto.dose.trim() !== existing.dose) {
        changes.push(`dose changed to '${dto.dose.trim()}'`);
      }

      const newFormulation = dto.formulation?.trim() || null;
      if (
        dto.formulation !== undefined &&
        newFormulation !== existing.formulation
      ) {
        changes.push(`formulation changed to '${newFormulation || 'none'}'`);
      }

      const newInstructions = dto.instructions?.trim() || null;
      if (
        dto.instructions !== undefined &&
        newInstructions !== existing.instructions
      ) {
        changes.push(`instructions changed to '${newInstructions || 'none'}'`);
      }

      const newQuantity = dto.quantity ?? null;
      if (dto.quantity !== undefined && newQuantity !== existing.quantity) {
        changes.push(`quantity changed to '${newQuantity || 'none'}'`);
      }

      if (changes.length > 0) {
        description = `Updated '${existing.name}': ${changes.join(', ')}`;
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
  async remove(
    patientId: string,
    id: string,
    userId: string,
  ): Promise<Medication> {
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
          description: `Removed medication '${med.name}'`,
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
  // Medications on the patient's current active list that are missing from
  // the note's list ARE auto-deactivated here (see the "Deactivate missing
  // items" loop below), mirroring ProblemsService#upsertFromAssessment's
  // auto-resolve behavior for problems dropped from a note's assessment.
  // ─────────────────────────────────────────────
  // Note: unlike upsertFromNoteMedications' medicationLog writes, entries here
  // also feed the centralized Logs page's AuditLog table. This method is
  // called internally by InitialNotesService/ProgressNotesService on note
  // publish — never through MedicationsController — so the global
  // AuditLogInterceptor (which only taps HTTP responses) never sees these
  // mutations. Without this, every medication added/updated/discontinued as
  // a side effect of publishing a note was invisible on the Logs page.
  private async getUserRole(
    userId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<Role | undefined> {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role;
  }

  private async logAudit(
    patientId: string,
    userId: string,
    userRole: Role | undefined,
    action: 'CREATE' | 'UPDATE',
    medicationId: string,
    name: string,
    sourceNote: 'Initial Note' | 'Progress Note',
  ) {
    if (!userRole) return;
    await this.auditLogsService.create({
      userId,
      userRole,
      action,
      tableName: 'medications',
      recordId: medicationId,
      patientId,
      changes: { name, _sourceNote: sourceNote },
    });
  }

  async upsertFromNoteMedications(
    patientId: string,
    items: {
      name: string;
      dose: string;
      formulation?: string;
      instructions?: string;
      quantity?: number;
      fromPast?: boolean;
    }[],
    userId: string,
    sourceNote: 'Initial Note' | 'Progress Note',
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<void> {
    const keptIds = new Set<string>();
    const userRole = await this.getUserRole(userId, client);

    const existing = await client.medication.findMany({
      where: { patientId },
    });

    const promises: Promise<any>[] = [];

    for (const item of items) {
      const normalize = (s: string) =>
        s.trim().toLowerCase().replace(/\s+/g, ' ');
      const match = existing.find(
        (m) =>
          normalize(m.name) === normalize(item.name) &&
          normalize(String(m.dose ?? '')) ===
            normalize(String(item.dose ?? '')),
      );
      if (match) {
        keptIds.add(match.id);

        const data: Prisma.MedicationUncheckedUpdateInput = {};
        const changes: string[] = [];

        if (!match.isActive) {
          data.isActive = true;
        }

        // Update non-dose fields on a name+dose match — the dose itself is
        // deliberately never overwritten here (a dose change is handled by
        // the no-match branch below, which creates a new row instead).
        // `undefined` on `item` means "this snapshot didn't carry the field"
        // (e.g. a legacy snapshot predating it) and must leave the existing
        // value alone — treating it as "clear" would silently wipe
        // production medication data on every publish.
        if (item.formulation !== undefined) {
          const next = item.formulation?.trim() || null;
          if (next !== match.formulation) {
            data.formulation = next;
            changes.push(`formulation → '${next ?? 'none'}'`);
          }
        }
        if (item.instructions !== undefined) {
          const next = item.instructions?.trim() || null;
          if (next !== match.instructions) {
            data.instructions = next;
            changes.push(`instructions → '${next ?? 'none'}'`);
          }
        }
        if (item.quantity !== undefined) {
          const next = item.quantity ?? null;
          if (next !== match.quantity) {
            data.quantity = next;
            changes.push(`quantity → '${next ?? 'none'}'`);
          }
        }

        if (!match.isActive) {
          promises.push(
            client.medication
              .update({ where: { id: match.id }, data })
              .then(async () => {
                await client.medicationLog.create({
                  data: {
                    patientId,
                    medicationId: match.id,
                    action: 'Reactivated',
                    description: `Reactivated medication '${match.name}' from ${sourceNote}`,
                    editorId: userId,
                  },
                });
                await this.logAudit(
                  patientId,
                  userId,
                  userRole,
                  'UPDATE',
                  match.id,
                  match.name,
                  sourceNote,
                );
              }),
          );
        } else if (changes.length > 0) {
          data.updatedBy = userId;
          promises.push(
            client.medication
              .update({ where: { id: match.id }, data })
              .then(async () => {
                await client.medicationLog.create({
                  data: {
                    patientId,
                    medicationId: match.id,
                    action: 'Updated',
                    description: `Updated '${match.name}' from ${sourceNote}: ${changes.join(', ')}`,
                    editorId: userId,
                  },
                });
                await this.logAudit(
                  patientId,
                  userId,
                  userRole,
                  'UPDATE',
                  match.id,
                  match.name,
                  sourceNote,
                );
              }),
          );
        }
        continue;
      }

      // A same-name, active row with a different dose is a dose change,
      // not a brand-new medication — the row itself still gets
      // discontinued+recreated below (dose is never silently overwritten,
      // per the note above), but the log must carry an 'Updated' entry too
      // so the dose change is visible under the Updated filter instead of
      // only showing as a Discontinued/Created pair.
      const doseChangedFrom = existing.find(
        (m) =>
          m.isActive &&
          !keptIds.has(m.id) &&
          normalize(m.name) === normalize(item.name) &&
          normalize(String(m.dose ?? '')) !==
            normalize(String(item.dose ?? '')),
      );

      promises.push(
        client.medication
          .create({
            data: {
              patientId,
              name: item.name.trim(),
              dose: item.dose.trim(),
              formulation: item.formulation?.trim() || null,
              instructions: item.instructions?.trim() || null,
              quantity: item.quantity ?? null,
              isActive: true,
              fromPast: item.fromPast || false,
              addedBy: userId,
            },
          })
          .then(async (newMed) => {
            await client.medicationLog.create({
              data: {
                patientId,
                medicationId: newMed.id,
                action: 'Created',
                description: `Added medication '${newMed.name}' from ${sourceNote}`,
                editorId: userId,
              },
            });
            if (doseChangedFrom) {
              await client.medicationLog.create({
                data: {
                  patientId,
                  medicationId: newMed.id,
                  action: 'Updated',
                  description: `Updated '${newMed.name}' from ${sourceNote}: dose changed to '${newMed.dose}' (from '${doseChangedFrom.dose}')`,
                  editorId: userId,
                },
              });
            }
            await this.logAudit(
              patientId,
              userId,
              userRole,
              'CREATE',
              newMed.id,
              newMed.name,
              sourceNote,
            );
          }),
      );
    }

    // Deactivate missing items. Guarded on a non-empty `items` — an empty (or
    // all-'past', which the caller's filter collapses to empty) snapshot must
    // never be read as "the patient has zero active medications now"; that
    // would mass-discontinue every medication on the chart from one save.
    for (const ext of items.length > 0 ? existing : []) {
      if (!keptIds.has(ext.id) && ext.isActive) {
        promises.push(
          client.medication
            .update({
              where: { id: ext.id },
              data: { isActive: false },
            })
            .then(async () => {
              await client.medicationLog.create({
                data: {
                  patientId,
                  medicationId: ext.id,
                  action: 'Discontinued',
                  description: `Discontinued medication '${ext.name}' — no longer listed in the ${sourceNote}`,
                  editorId: userId,
                },
              });
              await this.logAudit(
                patientId,
                userId,
                userRole,
                'UPDATE',
                ext.id,
                ext.name,
                sourceNote,
              );
            }),
        );
      }
    }

    await Promise.all(promises);
  }
}
