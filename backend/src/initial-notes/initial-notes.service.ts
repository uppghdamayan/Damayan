import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInitialNoteDto } from './dto/create-initial-note.dto';
import { UpdateInitialNoteDto } from './dto/update-initial-note.dto';
import { NoteStatus, VisitType, Prisma, InitialNote } from '@prisma/client';
import { VisitsService } from '../visits/visits.service';
import { ProblemsService } from '../problems/problems.service';
import { MedicationsService } from '../medications/medications.service';
import { StorageService } from '../storage/storage.service';
import {
  diffByTitle,
  diffByNameDoseUnit,
} from '../progress-notes/progress-notes.utils';
import { buildSnapshot, diffNoteFields } from './initial-notes.utils';
import { mapAssessmentSnapshot } from '../problems/problems.utils';
import { mapMedicationSnapshot } from '../medications/medications.utils';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class InitialNotesService {
  constructor(
    private prisma: PrismaService,
    private visitsService: VisitsService,
    private problemsService: ProblemsService,
    private medicationsService: MedicationsService,
    private storageService: StorageService,
  ) {}

  async findOne(patientId: string) {
    const note = await this.prisma.initialNote.findFirst({
      where: { visit: { patientId } },
      include: {
        author: { select: { firstName: true, lastName: true, role: true } },
        lastEditor: { select: { firstName: true, lastName: true, role: true } },
      },
    });
    if (!note) {
      throw new NotFoundException('Initial note not found for this patient.');
    }
    return note;
  }

  async findAll(patientId: string) {
    return this.prisma.initialNote.findMany({
      where: { visit: { patientId } },
      include: {
        visit: true,
        author: { select: { firstName: true, lastName: true, role: true } },
        lastEditor: { select: { firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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

      const created = await tx.initialNote.create({
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
          mgmtPharm: dto.mgmtPharm,
          diagnostics: dto.diagnostics ? (dto.diagnostics as any) : [],
          medicationSnapshot: dto.medicationSnapshot
            ? (dto.medicationSnapshot as any)
            : [],
          status: NoteStatus.DRAFT,
        },
      });

      await this.logAction(
        patientId,
        userId,
        'Created',
        'Created Initial Note draft',
        tx,
        created.id,
      );

      return created;
    });
  }

  // ─────────────────────────────────────────────
  // Mirrors ProgressNotesService#reconcileMedicationSnapshot — see there for
  // the full reasoning. Drops carried-over entries for a medication that's
  // no longer active (matched by name, not name+dose, so an in-note dose
  // edit is never mistaken for a deletion), and resyncs dose/formulation/
  // quantity/instructions from the live active medication on every kept,
  // non-`isNew` entry UNLESS that field is listed in the entry's own
  // `editedFields`. Without this, a dose edited on the Medications master
  // list while this draft sits open would never reach the snapshot, and the
  // stale old-dose entry would get treated as a second dose change on top
  // of the master-list edit on the next save, clobbering it back.
  // ─────────────────────────────────────────────
  private async reconcileMedicationSnapshot(
    patientId: string,
    snapshot: any[] | undefined,
    tx: Prisma.TransactionClient | PrismaService,
  ): Promise<any[] | undefined> {
    if (!snapshot) return snapshot;

    const activeMeds = await this.medicationsService.findActiveForPatient(
      patientId,
      tx,
    );
    const activeByName = new Map(
      activeMeds.map((m) => [m.name.trim().toLowerCase(), m]),
    );

    return snapshot
      .filter((m) => {
        if (!m || !m.name) return false;
        if (m.isNew) return true;
        return activeByName.has(String(m.name).trim().toLowerCase());
      })
      .map((m) => {
        if (!m || m.isNew) return m;
        const live = activeByName.get(String(m.name).trim().toLowerCase());
        if (!live) return m;
        const edited = new Set<string>(
          Array.isArray(m.editedFields) ? m.editedFields : [],
        );
        const pick = (field: string, liveValue: unknown) =>
          edited.has(field) ? m[field] : (liveValue ?? m[field]);
        return {
          ...m,
          dose: pick('dose', live.dose),
          formulation: pick('formulation', live.formulation),
          quantity: pick('quantity', live.quantity),
          instructions: pick('instructions', live.instructions),
        };
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

    // Only reconcile for drafts — a published note's snapshot is a locked
    // historical record (Prescribed Medications are frozen post-publish, see
    // below) and should not be silently rewritten by this guard.
    if (
      updateData.medicationSnapshot !== undefined &&
      note.status === NoteStatus.DRAFT
    ) {
      updateData.medicationSnapshot = await this.reconcileMedicationSnapshot(
        patientId,
        updateData.medicationSnapshot,
        this.prisma,
      );
    }

    // For published notes: Prescribed Medications under Plan are locked.
    // Only Past Medications (source: 'past') under History module are editable.
    let effectiveMedicationSnapshot = updateData.medicationSnapshot;
    if (
      note.status === NoteStatus.PUBLISHED &&
      updateData.medicationSnapshot !== undefined
    ) {
      const existingPrescribed = Array.isArray(note.medicationSnapshot)
        ? (note.medicationSnapshot as any[]).filter(
            (m) => !m || typeof m !== 'object' || m.source !== 'past',
          )
        : [];
      const newPast = Array.isArray(updateData.medicationSnapshot)
        ? (updateData.medicationSnapshot as any[]).filter(
            (m) => m && typeof m === 'object' && m.source === 'past',
          )
        : [];
      effectiveMedicationSnapshot = [...existingPrescribed, ...newPast];
    }

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
      // Assessment is locked once published (Subjective/Objective/Assessment/
      // Plan are permanent records — only the History module and Past
      // Medications stay editable). Silently ignoring it here — rather than
      // persisting whatever the form last happened to submit — keeps a
      // published note's Assessment out of the version diff entirely, since
      // it never actually changes post-publish.
      ...(updateData.assessment !== undefined &&
        note.status !== NoteStatus.PUBLISHED && {
          assessment: updateData.assessment as any,
        }),
      ...(updateData.mgmtNonpharm !== undefined && {
        mgmtNonpharm: updateData.mgmtNonpharm,
      }),
      ...(updateData.mgmtPharm !== undefined && {
        mgmtPharm: updateData.mgmtPharm,
      }),
      ...(updateData.diagnostics !== undefined && {
        diagnostics: updateData.diagnostics,
      }),
      ...(effectiveMedicationSnapshot !== undefined && {
        medicationSnapshot: effectiveMedicationSnapshot as any,
      }),
    };

    if (note.status === NoteStatus.PUBLISHED) {
      data.lastEditor = { connect: { id: userId } };
      data.lastEditedAt = new Date();

      return this.prisma.$transaction(
        async (tx) => {
          // v1 must always be the note as published. Notes published before
          // version history existed have no baseline, so capture the pre-edit
          // state as v1 first — this edit then correctly lands as v2.
          await this.ensureBaselineVersion(patientId, note, tx, userId);

          const updatedNote = await tx.initialNote.update({
            where: { id },
            data,
          });

          // Version + log the edit. A save that changed nothing records
          // neither, so the history stays free of no-op entries.
          const { changedFields, summary } = diffNoteFields(note, updatedNote);
          if (changedFields.length > 0) {
            const version = await this.snapshotVersion(
              patientId,
              updatedNote,
              changedFields,
              summary,
              userId,
              tx,
            );
            await this.logAction(
              patientId,
              userId,
              'Revised',
              `Revised published Initial Note (v${version.versionNumber}): ${summary}`,
              tx,
              id,
              version.id,
            );
          }

          const beforeProblems =
            await this.problemsService.findActiveForPatient(patientId, tx);
          const beforeMeds = await this.medicationsService.findActiveForPatient(
            patientId,
            tx,
          );

          // Assessment is locked post-publish (see the `data` construction
          // above) — never re-syncs Problem records from here. Problem
          // changes on a published patient go through the Problems module.

          // Array.isArray + length guard, not just truthy: `[]` is truthy in
          // JS, and upsertFromNoteMedications reads an empty list as "the
          // patient now has zero active medications" and deactivates every
          // one of them. A snapshot that's empty (or entirely 'past', which
          // mapMedicationSnapshot filters down to empty) must be a no-op
          // here, not a mass-discontinue.
          if (
            note.status !== NoteStatus.PUBLISHED &&
            Array.isArray(updateData.medicationSnapshot) &&
            updateData.medicationSnapshot.length > 0
          ) {
            const medicationItems = mapMedicationSnapshot(
              updateData.medicationSnapshot as any[],
            );
            if (medicationItems.length > 0) {
              await this.medicationsService.upsertFromNoteMedications(
                patientId,
                medicationItems,
                userId,
                'Initial Note',
                tx,
              );
            }
          }

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

          return updatedNote;
        },
        {
          timeout: 20000,
          maxWait: 10000,
        },
      );
    }

    // DRAFT: no version snapshot (nothing is clinically committed yet), but the
    // save is still logged for transparency when it actually changed something.
    return this.prisma.$transaction(async (tx) => {
      const updatedNote = await tx.initialNote.update({ where: { id }, data });

      const { changedFields, summary } = diffNoteFields(note, updatedNote);
      if (changedFields.length > 0) {
        await this.logAction(
          patientId,
          userId,
          'Updated',
          `Updated Initial Note draft: ${summary}`,
          tx,
          id,
        );
      }

      return updatedNote;
    });
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

    return this.prisma.$transaction(
      async (tx) => {
        const [published, beforeProblems, beforeMeds] = await Promise.all([
          tx.initialNote.update({
            where: { id },
            data: { status: NoteStatus.PUBLISHED },
          }),
          this.problemsService.findActiveForPatient(patientId, tx),
          this.medicationsService.findActiveForPatient(patientId, tx),
        ]);

        // v1 — the note exactly as first published. No changedFields: there is
        // no earlier version to have changed from.
        const version = await this.snapshotVersion(
          patientId,
          published,
          [],
          null,
          userId,
          tx,
        );
        await this.logAction(
          patientId,
          userId,
          'Published',
          `Published Initial Note (v${version.versionNumber})`,
          tx,
          id,
          version.id,
        );

        const assessmentItems = mapAssessmentSnapshot(note.assessment as any[]);
        const medicationItems = mapMedicationSnapshot(
          note.medicationSnapshot as any[],
        );

        const [resolvedIdByKey] = await Promise.all([
          this.problemsService.upsertFromAssessment(
            patientId,
            assessmentItems,
            userId,
            'Initial Note',
            tx,
            { resolveMissing: false },
          ),
          this.medicationsService.upsertFromNoteMedications(
            patientId,
            medicationItems,
            userId,
            'Initial Note',
            tx,
          ),
        ]);

        const [afterProblems, afterMeds] = await Promise.all([
          this.problemsService.findActiveForPatient(patientId, tx),
          this.medicationsService.findActiveForPatient(patientId, tx),
        ]);

        const problemChanges = diffByTitle(beforeProblems, afterProblems);
        const medicationChanges = diffByNameDoseUnit(beforeMeds, afterMeds);

        // Heal tempId's into real id's in the note's stored assessment snapshot.
        // parentId references also point at tempId's — a child's parentId must
        // be healed too, else it dangles once its parent's tempId disappears
        // and the child silently falls back to root (loses its nesting) in
        // every subsequent read of this snapshot.
        const updatedSnapshot = (note.assessment as any[]).map((item) => {
          if (!item || typeof item !== 'object') return item;
          const key = item.id || item.tempId;
          const healedParentId =
            item.parentId && resolvedIdByKey.has(item.parentId)
              ? resolvedIdByKey.get(item.parentId)
              : item.parentId;
          if (key && resolvedIdByKey.has(key)) {
            const newId = resolvedIdByKey.get(key);
            const { tempId, isNew, ...rest } = item;
            return { ...rest, id: newId, parentId: healedParentId };
          }
          if (healedParentId !== item.parentId) {
            return { ...item, parentId: healedParentId };
          }
          return item;
        });

        await tx.initialNote.update({
          where: { id },
          data: { assessment: updatedSnapshot as any },
        });

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
      },
      {
        timeout: 20000,
        maxWait: 10000,
      },
    );
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
      if (note.status === NoteStatus.PUBLISHED) {
        await tx.deletedNote.create({
          data: {
            patientId,
            originalNoteId: id,
            noteType: 'INITIAL_NOTE',
            content: note as any,
            authorId: note.authorId,
            deletedBy: userId,
            originalCreatedAt: note.createdAt,
            visitId: note.visitId,
          },
        });

        // Bug Fix: clear problems and medications on initial note deletion.
        await tx.problem.updateMany({
          where: {
            patientId,
            status: { in: ['ACTIVE', 'RESOLVED'] },
          },
          data: { status: 'REMOVED' },
        });

        await tx.medication.updateMany({
          where: {
            patientId,
            isActive: true,
          },
          data: { isActive: false },
        });

        await this.logAction(
          patientId,
          userId,
          'Deleted',
          'Archived published Initial Note',
          tx,
          id,
        );
      }

      // Hard delete for DRAFT and PUBLISHED
      // Delete attachments first if there are any
      const attachments = await tx.attachment.findMany({
        where: { noteId: id },
      });

      for (const att of attachments) {
        if (att.storageKey) {
          await this.storageService
            .delete(att.storageKey)
            .catch((e) =>
              console.error('Failed to delete attachment from storage', e),
            );
        }
      }

      await tx.attachment.deleteMany({
        where: { noteId: id },
      });

      // Clear any versions before deleting the note.
      await tx.initialNoteVersion.deleteMany({ where: { initialNoteId: id } });

      // Detach existing log rows rather than deleting them — the change history
      // survives the note, matching how ProblemLog handles a hard-deleted problem.
      await tx.initialNoteLog.updateMany({
        where: { initialNoteId: id },
        data: { initialNoteId: null, versionId: null },
      });

      await tx.initialNote.delete({ where: { id } });

      // Check if visit is now empty and can be deleted
      const visitDetails = await tx.visit.findUnique({
        where: { id: note.visitId },
        include: {
          vitalSigns: true,
          documents: true,
          progressNote: true,
          deletedNotes: true,
        },
      });

      if (
        visitDetails &&
        visitDetails.vitalSigns.length === 0 &&
        visitDetails.documents.length === 0 &&
        !visitDetails.progressNote &&
        (!visitDetails.deletedNotes || visitDetails.deletedNotes.length === 0)
      ) {
        await tx.visit.delete({ where: { id: note.visitId } });
      }

      if (note.status === NoteStatus.DRAFT) {
        await this.logAction(
          patientId,
          userId,
          'Deleted',
          'Deleted Initial Note draft',
          tx,
        );
      }

      return { success: true, ...note, isDeleted: true };
    });
  }

  // ─────────────────────────────────────────────
  // INITIAL NOTE LOGS
  // ─────────────────────────────────────────────
  // Patient-scoped master change log, mirroring ProblemsService.getLogs — but
  // with NO retention cleanup. Unlike problem logs (purged after 14 days),
  // initial-note entries are kept indefinitely.

  async getLogs(patientId: string) {
    return this.prisma.initialNoteLog.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        editor: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  // ─────────────────────────────────────────────
  // VERSION HISTORY
  // ─────────────────────────────────────────────

  /** Version metadata for the history rail — deliberately omits `snapshot`. */
  async getVersions(patientId: string, noteId: string) {
    await this.assertNoteBelongsToPatient(noteId, patientId);

    return this.prisma.initialNoteVersion.findMany({
      where: { initialNoteId: noteId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        initialNoteId: true,
        patientId: true,
        versionNumber: true,
        changedFields: true,
        changeSummary: true,
        editorId: true,
        createdAt: true,
        editor: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  /** A single version including its full snapshot payload. */
  async getVersion(patientId: string, noteId: string, versionId: string) {
    await this.assertNoteBelongsToPatient(noteId, patientId);

    const version = await this.prisma.initialNoteVersion.findFirst({
      where: { id: versionId, initialNoteId: noteId, patientId },
      include: {
        editor: { select: { firstName: true, lastName: true, role: true } },
      },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  private async assertNoteBelongsToPatient(noteId: string, patientId: string) {
    const note = await this.prisma.initialNote.findFirst({
      where: { id: noteId, visit: { patientId } },
      select: { id: true },
    });
    if (!note) throw new NotFoundException('Note not found for this patient');
    return note;
  }

  // ─────────────────────────────────────────────
  // LOG / VERSION WRITERS
  // ─────────────────────────────────────────────

  private async logAction(
    patientId: string,
    editorId: string,
    action: string,
    description: string,
    client: PrismaTx | PrismaService = this.prisma,
    initialNoteId?: string,
    versionId?: string,
  ) {
    await client.initialNoteLog.create({
      data: {
        patientId,
        editorId,
        action,
        description,
        initialNoteId: initialNoteId ?? null,
        versionId: versionId ?? null,
      },
    });
  }

  /**
   * Writes an immutable snapshot of `note` as the next version. Must be called
   * inside a transaction: the version number is derived from the current max,
   * and the @@unique([initialNoteId, versionNumber]) constraint is the backstop
   * if two saves ever race.
   */
  private async snapshotVersion(
    patientId: string,
    note: InitialNote,
    changedFields: string[],
    changeSummary: string | null,
    editorId: string,
    client: PrismaTx,
    createdAt?: Date,
  ) {
    const { _max } = await client.initialNoteVersion.aggregate({
      where: { initialNoteId: note.id },
      _max: { versionNumber: true },
    });

    return client.initialNoteVersion.create({
      data: {
        initialNoteId: note.id,
        patientId,
        versionNumber: (_max.versionNumber ?? 0) + 1,
        snapshot: buildSnapshot(note) as Prisma.InputJsonValue,
        changedFields,
        changeSummary,
        editorId,
        ...(createdAt && { createdAt }),
      },
    });
  }

  /**
   * Guarantees a published note has a v1 baseline before any edit is versioned.
   *
   * Only fires for notes published before version history shipped — `publish()`
   * writes v1 for everything since. Without it the first post-deploy edit would
   * become "v1", presenting edited content as the original. The snapshot is the
   * pre-edit state and is dated to when that state came into being, not to now.
   */
  private async ensureBaselineVersion(
    patientId: string,
    note: InitialNote,
    client: PrismaTx,
    fallbackEditorId: string,
  ) {
    const existing = await client.initialNoteVersion.count({
      where: { initialNoteId: note.id },
    });
    if (existing > 0) return null;

    return this.snapshotVersion(
      patientId,
      note,
      [],
      null,
      // Attribute the baseline to whoever authored the note; editorId is a
      // non-null FK, so fall back to the current user for authorless legacy rows.
      note.authorId ?? note.lastEditedBy ?? fallbackEditorId,
      client,
      note.lastEditedAt ?? note.createdAt,
    );
  }
}
