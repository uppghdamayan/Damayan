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
import { StorageService } from '../storage/storage.service';
import { diffByTitle, diffByNameDoseUnit } from './progress-notes.utils';
import { mapAssessmentSnapshot } from '../problems/problems.utils';
import { mapMedicationSnapshot } from '../medications/medications.utils';

@Injectable()
export class ProgressNotesService {
  constructor(
    private prisma: PrismaService,
    private visitsService: VisitsService,
    private problemsService: ProblemsService,
    private medicationsService: MedicationsService,
    private vitalsService: VitalsService,
    private initialNotesService: InitialNotesService,
    private storageService: StorageService,
  ) {}

  async findAllByPatient(
    patientId: string,
    page = 1,
    limit = 10,
    excludeDeleted = false,
  ) {
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ProgressNoteWhereInput = {
      visit: { patientId },
    };

    const [data, total] = await Promise.all([
      this.prisma.progressNote.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: [{ visit: { visitDatetime: 'desc' } }, { createdAt: 'desc' }],
        include: {
          visit: true,
          author: { select: { firstName: true, lastName: true, role: true } },
          lastEditor: {
            select: { firstName: true, lastName: true, role: true },
          },
        },
      }),
      this.prisma.progressNote.count({ where: whereClause }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const note = await this.prisma.progressNote.findUnique({
      where: { id },
      include: {
        visit: true,
        author: { select: { firstName: true, lastName: true, role: true } },
        lastEditor: { select: { firstName: true, lastName: true, role: true } },
      },
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

  // ─────────────────────────────────────────────
  // Guards against stale medicationSnapshot payloads: the frontend keeps its
  // own copy of the patient's active medications in form state, and can lag
  // behind a deletion made concurrently in the Medications module (different
  // tab, race with cache invalidation, etc.). Anything in the incoming
  // snapshot that isn't flagged `isNew` (added by the clinician in this note)
  // must still match a currently-active medication BY NAME — otherwise it's a
  // carried-over entry for a medication that no longer exists/is active, and
  // we drop it so deletions take effect immediately in new/updated notes.
  // Deliberately name-only (not name+dose): the clinician can freely edit an
  // existing medication's dose within the note itself (that's the whole
  // point of the dose-change badge) — the active record's dose only gets
  // updated later, on publish, so matching on dose here would wrongly treat
  // every in-note dose edit as a deleted medication.
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
    const activeNames = new Set(
      activeMeds.map((m) => m.name.trim().toLowerCase()),
    );

    return snapshot.filter((m) => {
      if (!m || !m.name) return false;
      if (m.isNew) return true;
      return activeNames.has(String(m.name).trim().toLowerCase());
    });
  }

  // ─────────────────────────────────────────────
  // The single source of truth for "what does the next progress note carry
  // forward from". Used by create() (server-side default), the
  // /carry-forward endpoint (frontend prefill + timeline "Inherited by
  // today's note" pin), and deleteDraft()'s revert path — all four used to
  // compute "latest" differently (different filters, different orderBy keys,
  // one missing the DOCTOR-author filter its sibling had), which is how a
  // note could end up silently inheriting from the wrong ancestor.
  //
  // Candidates are PUBLISHED, not soft-deleted, and authored by a DOCTOR or
  // by nobody (null authorId) — mirrors the `authorRole === 'DOCTOR' ||
  // !authorRole` branch in publish() that actually updates the problem/med
  // snapshots, and excludes NURSE/PHARMACIST notes which don't carry a
  // clinical management plan. `excludeNoteId` lets the caller exclude the
  // note currently being edited (e.g. the author's own open draft) so a note
  // can never inherit from itself.
  //
  // "Latest" is strictly the newest single note by visit.visitDatetime, tied
  // on createdAt — not a field-by-field walk back through older notes. If
  // that note left a field blank, the blank is returned as-is: clearing a
  // field is a deliberate clinical decision, not a gap to paper over with an
  // older value.
  // ─────────────────────────────────────────────
  async resolveCarryForwardSource(
    patientId: string,
    excludeNoteId?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    sourceNoteId: string | null;
    sourceKind: 'progress' | 'initial' | null;
    sourceVisitDatetime: Date | null;
    mgmtNonpharm: string;
    mgmtPharm: string;
    diagnostics: string[];
  }> {
    const client = tx ?? this.prisma;

    const [latestProgress, latestInitial] = await Promise.all([
      client.progressNote.findFirst({
        where: {
          visit: { patientId },
          status: NoteStatus.PUBLISHED,
          ...(excludeNoteId ? { id: { not: excludeNoteId } } : {}),
          OR: [{ author: { role: 'DOCTOR' } }, { authorId: null }],
        },
        orderBy: [{ visit: { visitDatetime: 'desc' } }, { createdAt: 'desc' }],
        select: {
          id: true,
          mgmtNonpharm: true,
          mgmtPharm: true,
          diagnostics: true,
          createdAt: true,
          visit: { select: { visitDatetime: true } },
        },
      }),
      client.initialNote.findFirst({
        where: {
          visit: { patientId },
          status: NoteStatus.PUBLISHED,
        },
        select: {
          id: true,
          mgmtNonpharm: true,
          mgmtPharm: true,
          diagnostics: true,
          createdAt: true,
          visit: { select: { visitDatetime: true } },
        },
      }),
    ]);

    const pickProgress =
      !!latestProgress &&
      (!latestInitial ||
        latestProgress.visit.visitDatetime >
          latestInitial.visit.visitDatetime ||
        (latestProgress.visit.visitDatetime.getTime() ===
          latestInitial.visit.visitDatetime.getTime() &&
          latestProgress.createdAt >= latestInitial.createdAt));

    const source = pickProgress ? latestProgress : latestInitial;

    if (!source) {
      return {
        sourceNoteId: null,
        sourceKind: null,
        sourceVisitDatetime: null,
        mgmtNonpharm: '',
        mgmtPharm: '',
        diagnostics: [],
      };
    }

    return {
      sourceNoteId: source.id,
      sourceKind: pickProgress ? 'progress' : 'initial',
      sourceVisitDatetime: source.visit.visitDatetime,
      mgmtNonpharm: source.mgmtNonpharm ?? '',
      mgmtPharm: source.mgmtPharm ?? '',
      diagnostics: [],
    };
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
      throw new ConflictException(
        'You already have an active progress note draft for this patient.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const [activeProblems, activeMedications, latestVitals] =
          await Promise.all([
            this.problemsService.findActiveForPatient(patientId, tx),
            this.medicationsService.findActiveForPatient(patientId, tx),
            this.vitalsService.findLatestForPatient(patientId, tx),
          ]);

        const carryForward = await this.resolveCarryForwardSource(
          patientId,
          null,
          tx,
        );

        const reconciledMedicationSnapshot =
          await this.reconcileMedicationSnapshot(
            patientId,
            dto.medicationSnapshot as any[] | undefined,
            tx,
          );

        // Progress notes have no user-facing visit-date input — the client
        // sends a submit-time stamp, but we don't trust it as the source of
        // truth (a stale/duplicate value is how two notes can tie or invert
        // in every visitDatetime-ordered query). Fall back to `now()`
        // whenever it's missing or unparsable.
        const parsedVisitDatetime = dto.visitDatetime
          ? new Date(dto.visitDatetime)
          : null;
        const visitDatetime =
          parsedVisitDatetime && !isNaN(parsedVisitDatetime.getTime())
            ? parsedVisitDatetime
            : new Date();

        const visit = await this.visitsService.createForNote(
          patientId,
          userId,
          VisitType.PROGRESS,
          visitDatetime,
          tx,
        );

        return tx.progressNote.create({
          data: {
            visitId: visit.id,
            authorId: userId,
            subjective: dto.subjective ?? '',
            objective: dto.objective ?? '',
            // `??` only falls back when the client omits the field entirely
            // (undefined/null) — an intentionally blank '' from the form is
            // preserved as-is. Non-UI callers that omit these fields still
            // get the resolved carry-forward value.
            mgmtNonpharm: dto.mgmtNonpharm ?? carryForward.mgmtNonpharm,
            mgmtPharm: dto.mgmtPharm ?? carryForward.mgmtPharm,
            diagnostics: dto.diagnostics ? (dto.diagnostics as any) : [],
            problemListSnapshot:
              dto.problemListSnapshot !== undefined
                ? (dto.problemListSnapshot as any)
                : (activeProblems as any),
            medicationSnapshot:
              dto.medicationSnapshot !== undefined
                ? (reconciledMedicationSnapshot as any)
                : (activeMedications as any),
            status: NoteStatus.DRAFT,
          },
        });
      },
      {
        timeout: 20000,
        maxWait: 10000,
      },
    );
  }

  async createAndPublish(
    patientId: string,
    dto: CreateProgressNoteDto,
    userId: string,
  ) {
    const note = await this.create(patientId, dto, userId);
    return this.publish(patientId, note.id, userId);
  }

  async update(id: string, dto: UpdateProgressNoteDto, userId: string) {
    const note = await this.prisma.progressNote.findUnique({
      where: { id },
      include: { visit: true },
    });
    if (!note) throw new NotFoundException('Note not found');

    const { visitDatetime, ...updateData } = dto;

    // Only reconcile for drafts — a published note's snapshot is a locked
    // historical record and should not be silently rewritten by this guard.
    if (
      updateData.medicationSnapshot !== undefined &&
      note.status === NoteStatus.DRAFT
    ) {
      updateData.medicationSnapshot = await this.reconcileMedicationSnapshot(
        note.visit.patientId,
        updateData.medicationSnapshot,
        this.prisma,
      );
    }

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
      ...(updateData.mgmtPharm !== undefined && {
        mgmtPharm: updateData.mgmtPharm,
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
    const note = await this.prisma.progressNote.findUnique({
      where: { id },
      include: { author: { select: { role: true } } },
    });
    if (!note) throw new NotFoundException('Note not found');

    const authorRole = note.author?.role;

    if (authorRole === 'DOCTOR' || !authorRole) {
      if (!note.subjective || !note.objective) {
        throw new BadRequestException(
          'Subjective and Objective are required to publish a progress note.',
        );
      }
    } else {
      if (!note.subjective) {
        throw new BadRequestException('Note text is required.');
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        let problemChanges: any = null;
        let medicationChanges: any = null;

        if (authorRole === 'DOCTOR' || !authorRole) {
          const [beforeProblems, beforeMeds] = await Promise.all([
            this.problemsService.findActiveForPatient(patientId, tx),
            this.medicationsService.findActiveForPatient(patientId, tx),
          ]);

          const snapshotItems = mapAssessmentSnapshot(
            note.problemListSnapshot as any[],
          );

          const snapshotMeds = mapMedicationSnapshot(
            note.medicationSnapshot as any[],
          );

          const [resolvedIdByKey] = await Promise.all([
            this.problemsService.upsertFromAssessment(
              patientId,
              snapshotItems,
              userId,
              'Progress Note',
              tx,
            ),
            this.medicationsService.upsertFromNoteMedications(
              patientId,
              snapshotMeds,
              userId,
              'Progress Note',
              tx,
            ),
          ]);

          const [afterProblems, afterMeds] = await Promise.all([
            this.problemsService.findActiveForPatient(patientId, tx),
            this.medicationsService.findActiveForPatient(patientId, tx),
          ]);

          problemChanges = diffByTitle(beforeProblems, afterProblems) as object;
          medicationChanges = diffByNameDoseUnit(
            beforeMeds,
            afterMeds,
          ) as object;

          // Heal tempId's into real id's in the note's stored snapshot
          // so that future diffs (e.g., when the note is edited and then diffed against the previous note)
          // can correctly match items by identity instead of falling back to title matching.
          const updatedSnapshot = (note.problemListSnapshot as any[]).map(
            (item) => {
              if (!item || typeof item !== 'object') return item;
              const key = item.id || item.tempId;
              if (key && resolvedIdByKey.has(key)) {
                const newId = resolvedIdByKey.get(key);
                const { tempId, isNew, ...rest } = item;
                return { ...rest, id: newId };
              }
              return item;
            },
          );

          await tx.progressNote.update({
            where: { id },
            data: { problemListSnapshot: updatedSnapshot as any },
          });
        }

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
      },
      {
        timeout: 20000,
        maxWait: 10000,
      },
    );
  }

  async deleteDraft(patientId: string, id: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const note = await tx.progressNote.findUnique({
          where: { id },
          include: { visit: true },
        });

        if (!note) throw new NotFoundException('Note not found');
        if (note.authorId !== userId && userId !== 'admin')
          throw new ForbiddenException('Not authorized to delete this note');
        if (note.visit.patientId !== patientId)
          throw new BadRequestException('Note does not belong to this patient');

        if (note.status !== NoteStatus.DRAFT) {
          // Ensure there are no newer progress notes — "newer" keyed the same
          // way as everywhere else: visit.visitDatetime, tied on createdAt.
          const newerNote = await tx.progressNote.findFirst({
            where: {
              id: { not: id },
              OR: [
                {
                  visit: {
                    patientId,
                    visitDatetime: { gt: note.visit.visitDatetime },
                  },
                },
                {
                  visit: { patientId, visitDatetime: note.visit.visitDatetime },
                  createdAt: { gt: note.createdAt },
                },
              ],
            },
          });
          if (newerNote) {
            throw new BadRequestException(
              'Only the latest progress note can be deleted',
            );
          }

          // Revert global lists to previous state — reuses the same
          // "what's the previous note" resolution as note creation, so
          // deleting the latest note always reverts to exactly what the next
          // note would otherwise have inherited from.
          let prevSnapshotProblems: any[] = [];
          let prevSnapshotMeds: any[] = [];

          const carryForward = await this.resolveCarryForwardSource(
            patientId,
            id,
            tx,
          );

          if (
            carryForward.sourceKind === 'progress' &&
            carryForward.sourceNoteId
          ) {
            const prevProgress = await tx.progressNote.findUnique({
              where: { id: carryForward.sourceNoteId },
              select: { problemListSnapshot: true, medicationSnapshot: true },
            });
            prevSnapshotProblems =
              (prevProgress?.problemListSnapshot as any[]) || [];
            prevSnapshotMeds =
              (prevProgress?.medicationSnapshot as any[]) || [];
          } else if (
            carryForward.sourceKind === 'initial' &&
            carryForward.sourceNoteId
          ) {
            const initialNote = await tx.initialNote.findUnique({
              where: { id: carryForward.sourceNoteId },
              select: { assessment: true, medicationSnapshot: true },
            });
            if (initialNote) {
              prevSnapshotProblems = (initialNote.assessment as any[]) || [];
              prevSnapshotMeds =
                (initialNote.medicationSnapshot as any[]) || [];
            }
          }

          const validProblems = mapAssessmentSnapshot(prevSnapshotProblems);

          const validMeds = mapMedicationSnapshot(prevSnapshotMeds);

          await this.problemsService.upsertFromAssessment(
            patientId,
            validProblems,
            userId,
            'Progress Note',
            tx,
          );
          await this.medicationsService.upsertFromNoteMedications(
            patientId,
            validMeds,
            userId,
            'Progress Note',
            tx,
          );

          await tx.deletedNote.create({
            data: {
              patientId,
              originalNoteId: id,
              noteType: 'PROGRESS_NOTE',
              content: note as any,
              authorId: note.authorId,
              deletedBy: userId,
              originalCreatedAt: note.createdAt,
              visitId: note.visitId,
            },
          });

          // Attachments are intentionally kept — they stay listed under
          // Documents (orphaned, no longer tied to a live note) and remain
          // individually deletable there.

          await tx.progressNote.delete({
            where: { id },
          });

          // Check if visit is now empty and can be deleted
          const visitDetails = await tx.visit.findUnique({
            where: { id: note.visitId },
            include: { vitalSigns: true, documents: true, initialNote: true },
          });

          if (
            visitDetails &&
            visitDetails.vitalSigns.length === 0 &&
            visitDetails.documents.length === 0 &&
            !visitDetails.initialNote
          ) {
            await tx.visit.delete({ where: { id: note.visitId } });
          }

          return { success: true, ...note, isDeleted: true };
        }

        // Hard delete for DRAFT — attachments are kept (see note above).
        await tx.progressNote.delete({ where: { id } });
        await tx.visit.delete({ where: { id: note.visitId } });

        return { success: true, ...note };
      },
      {
        timeout: 20000,
        maxWait: 10000,
      },
    );
  }

  async deleteAllDrafts(patientId: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
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

        const noteIds = drafts.map((d) => d.id);
        const visitIds = drafts.map((d) => d.visitId);

        // Attachments are intentionally kept (see deleteDraft above).

        const count = await tx.progressNote.deleteMany({
          where: { id: { in: noteIds } },
        });

        await tx.visit.deleteMany({
          where: { id: { in: visitIds } },
        });

        return { count: count.count };
      },
      {
        timeout: 20000,
        maxWait: 10000,
      },
    );
  }
}
