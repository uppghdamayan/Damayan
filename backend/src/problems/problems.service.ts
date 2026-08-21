import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Problem, ProblemStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { ReorderProblemsDto } from './dto/reorder-problems.dto';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class ProblemsService {
  constructor(
    private prisma: PrismaService,
    private auditLogsService: AuditLogsService,
  ) {}

  // ─────────────────────────────────────────────
  // LIST — flat, sort-ordered. Tree is built client-side (Appendix B).
  // ─────────────────────────────────────────────

  async findAll(patientId: string): Promise<Problem[]> {
    return this.prisma.problem.findMany({
      where: { patientId },
      orderBy: { sortOrder: 'asc' },
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
   *  - the Dashboard problem count / 48h-indicator logic (called from this module only)
   *  - Phase 9 (Progress Notes) copy-forward / problemListSnapshot
   * See Section 7 of PHASE_5_PROBLEM_LIST.md for the cross-module contract.
   */
  async findActiveForPatient(
    patientId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<Problem[]> {
    return client.problem.findMany({
      where: { patientId, status: ProblemStatus.ACTIVE },
      orderBy: { sortOrder: 'asc' },
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

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(
    patientId: string,
    dto: CreateProblemDto,
    userId: string,
  ): Promise<Problem> {
    if (dto.parentId) {
      await this.assertValidParent(patientId, dto.parentId);
    }
    const sortOrder = await this.getNextSortOrder(patientId);
    const problem = await this.prisma.problem.create({
      data: {
        patientId,
        parentId: dto.parentId ?? null,
        title: dto.title.trim(),
        diagnosisDate: dto.diagnosisDate ? new Date(dto.diagnosisDate) : null,
        status: ProblemStatus.ACTIVE,
        sortOrder,
        addedBy: userId,
      },
    });

    await this.logAction(
      patientId,
      userId,
      'Created',
      `Created problem '${problem.title}'`,
      this.prisma,
      problem.id,
    );
    return problem;
  }

  // ─────────────────────────────────────────────
  // UPDATE — title, status, parentId (all optional, independently settable)
  // ─────────────────────────────────────────────

  async update(
    patientId: string,
    id: string,
    dto: UpdateProblemDto,
    userId: string,
  ): Promise<Problem> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.problem.findFirst({ where: { id, patientId } });
      if (!existing) {
        throw new NotFoundException(
          `Problem ${id} not found for this patient.`,
        );
      }

      if (
        dto.parentId !== undefined &&
        dto.parentId !== existing.parentId &&
        dto.parentId !== null
      ) {
        if (dto.parentId === id) {
          throw new BadRequestException('A problem cannot be its own parent.');
        }
        await this.assertValidParent(patientId, dto.parentId, tx, id);
      }

      const data: Prisma.ProblemUpdateInput = {};
      data.updatedByUser = { connect: { id: userId } };
      if (dto.title !== undefined && dto.title.trim() !== existing.title) {
        await this.logAction(
          patientId,
          userId,
          'Renamed',
          `Renamed problem from '${existing.title}' to '${dto.title.trim()}'`,
          tx,
          id,
        );
      }

      if (dto.title !== undefined) data.title = dto.title.trim();

      if (dto.diagnosisDate !== undefined) {
        data.diagnosisDate = dto.diagnosisDate
          ? new Date(dto.diagnosisDate)
          : null;

        const oldDateStr = existing.diagnosisDate
          ? existing.diagnosisDate.toISOString().split('T')[0]
          : '--';
        const newDateStr = data.diagnosisDate
          ? data.diagnosisDate.toISOString().split('T')[0]
          : '--';
        if (oldDateStr !== newDateStr) {
          await this.logAction(
            patientId,
            userId,
            'Updated',
            `Changed Date of Diagnosis for '${existing.title}' from '${oldDateStr}' to '${newDateStr}'`,
            tx,
            id,
          );
        }
      }

      if (dto.parentId !== undefined) {
        data.parent = dto.parentId
          ? { connect: { id: dto.parentId } }
          : { disconnect: true };
      }

      if (dto.status !== undefined && dto.status !== existing.status) {
        data.status = dto.status;

        // Business rule 3: Resolved/Removed always bump to the end of the list.
        if (
          dto.status === ProblemStatus.RESOLVED ||
          dto.status === ProblemStatus.REMOVED
        ) {
          data.sortOrder = await this.getNextSortOrder(patientId, tx);
        }

        // Business rule 5: taking a parent out of the active tree — whether
        // Resolved or Removed — promotes its first surviving (non-Removed)
        // child into the parent's slot (same parentId + sortOrder as the
        // old parent) and re-parents the remaining former siblings under
        // that heir. The heir's own children are untouched — the whole
        // branch shifts up one level as one block instead of being wiped
        // out (Removed) or silently orphaned (Resolved).
        if (
          dto.status === ProblemStatus.REMOVED ||
          dto.status === ProblemStatus.RESOLVED
        ) {
          const children = await tx.problem.findMany({
            where: {
              patientId,
              parentId: id,
              status: { not: ProblemStatus.REMOVED },
            },
            orderBy: { sortOrder: 'asc' },
          });

          if (children.length > 0) {
            const [heir, ...rest] = children;
            const verb =
              dto.status === ProblemStatus.REMOVED ? 'removed' : 'resolved';

            await tx.problem.update({
              where: { id: heir.id },
              data: {
                parentId: existing.parentId,
                sortOrder: existing.sortOrder,
                updatedBy: userId,
              },
            });

            if (rest.length > 0) {
              await tx.problem.updateMany({
                where: { id: { in: rest.map((p) => p.id) } },
                data: { parentId: heir.id, updatedBy: userId },
              });
            }

            await this.logAction(
              patientId,
              userId,
              'Updated',
              `Promoted '${heir.title}' to replace ${verb} parent '${existing.title}'` +
                (rest.length > 0
                  ? ` (${rest.length} sibling${rest.length === 1 ? '' : 's'} re-parented under it)`
                  : ''),
              tx,
              heir.id,
            );
          }
        }

        let action = 'Updated';
        let desc = `Status changed to ${dto.status}`;
        if (dto.status === ProblemStatus.RESOLVED) {
          action = 'Resolved';
          desc = `Resolved problem '${existing.title}'`;
        } else if (dto.status === ProblemStatus.REMOVED) {
          action = 'Removed';
          desc = `Removed problem '${existing.title}'`;
        } else if (dto.status === ProblemStatus.ACTIVE) {
          action = 'Reactivated';
          desc = `Reactivated problem '${existing.title}'`;
        }
        await this.logAction(patientId, userId, action, desc, tx, id);
      }

      return tx.problem.update({ where: { id }, data });
    });
  }

  // ─────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────

  async remove(
    patientId: string,
    id: string,
    userId: string,
  ): Promise<Problem> {
    return this.update(
      patientId,
      id,
      { status: ProblemStatus.REMOVED },
      userId,
    );
  }

  // ─────────────────────────────────────────────
  // REORDER (batch)
  // ─────────────────────────────────────────────

  async reorder(
    patientId: string,
    dto: ReorderProblemsDto,
    userId: string,
  ): Promise<{ updated: number }> {
    const ids = dto.items.map((i) => i.id);

    // 1. Fetch existing problems for validation and diffing
    const allPatientProblems = await this.prisma.problem.findMany({
      where: { patientId },
    });
    const existingMap = new Map(allPatientProblems.map((p) => [p.id, p]));

    const missingId = ids.find((id) => !existingMap.has(id));
    if (missingId) {
      throw new ForbiddenException(
        'One or more problems do not belong to this patient.',
      );
    }

    // 2. Track changes for the log
    const changes: string[] = [];

    // 3. Execute updates
    await this.prisma.$transaction(
      dto.items.map((item) => {
        const existing = existingMap.get(item.id)!;
        const currentTitle = existing.title;

        // Diff Parent
        if (
          item.parentId !== undefined &&
          item.parentId !== existing.parentId
        ) {
          if (item.parentId === null) {
            changes.push(`Unnested '${currentTitle}'`);
          } else {
            const parentTitle =
              existingMap.get(item.parentId)?.title || 'Unknown';
            changes.push(`Nested '${currentTitle}' under '${parentTitle}'`);
          }
        }

        // Diff Title
        if (item.title !== undefined && item.title.trim() !== currentTitle) {
          changes.push(`Renamed '${currentTitle}' to '${item.title.trim()}'`);
        }

        // Diff Diagnosis Date
        if (item.diagnosisDate !== undefined) {
          const oldDateStr = existing.diagnosisDate
            ? existing.diagnosisDate.toISOString().split('T')[0]
            : '--';
          const newDateStr = item.diagnosisDate
            ? new Date(item.diagnosisDate).toISOString().split('T')[0]
            : '--';
          if (oldDateStr !== newDateStr) {
            changes.push(
              `Set Date of Diagnosis for '${currentTitle}' to '${newDateStr}'`,
            );
          }
        }

        return this.prisma.problem.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            ...(item.parentId !== undefined && { parentId: item.parentId }),
            ...(item.title !== undefined && { title: item.title.trim() }),
            ...(item.diagnosisDate !== undefined && {
              diagnosisDate: item.diagnosisDate
                ? new Date(item.diagnosisDate)
                : null,
            }),
            updatedBy: userId,
          },
        });
      }),
    );

    const logMessage =
      changes.length > 0
        ? changes.join(', ')
        : 'Published new problem list order and nesting';

    await this.logAction(
      patientId,
      userId,
      'Published',
      logMessage,
      this.prisma,
    );
    return { updated: dto.items.length };
  }

  // ─────────────────────────────────────────────
  // PHASE 8 INTEGRATION POINT — see Section 7 for the full contract.
  //
  // Upserts problems from an Initial Note's assessment list on publish.
  // Case-insensitive title match against the patient's existing ACTIVE/RESOLVED
  // problems (REMOVED problems are never matched — a clinician must re-add
  // deliberately):
  //   - ACTIVE match   → no-op (already on the list)
  //   - RESOLVED match → reactivate to ACTIVE, bumped to end of list
  //   - no match       → create new root-level ACTIVE problem
  //
  // Accepts an optional transaction client so InitialNotesService can call this
  // from inside the same $transaction it uses to flip the note to PUBLISHED.
  // ─────────────────────────────────────────────

  async upsertFromAssessment(
    patientId: string,
    assessmentItems: {
      id?: string;
      // Client-generated key for a problem added within the same note that
      // has no master Problem row yet — lets one freshly-added item nest
      // under another before either has a real id. See create-progress-note
      // AssessmentItemDto for the full rationale.
      tempId?: string;
      title: string;
      // Deliberately `string | null | undefined` with runtime "key present?"
      // semantics distinct from "value is undefined" (checked via
      // `hasOwnProperty` below): omitting the key entirely means "this
      // source doesn't carry nesting info, leave existing nesting alone" —
      // required for backward compatibility with legacy Initial Note/Progress
      // Note snapshots saved before nesting was captured, and with the
      // delete-draft revert path when it reads one of those. An explicit
      // `null` means "root level"; a string nests under that id or tempId.
      parentId?: string | null;
      diagnosisDate?: string | null;
      // Positional index in the published snapshot (see
      // mapAssessmentSnapshot) — the note's own array order, the single
      // source of truth this method writes back to Problem.sortOrder so the
      // master list, dashboard, and next note all agree on order. Optional
      // for backward compatibility with any caller that doesn't supply it
      // (falls back to append/getNextSortOrder behaviour).
      sortOrder?: number;
    }[],
    userId: string,
    sourceNote: 'Initial Note' | 'Progress Note',
    client: PrismaTx | PrismaService = this.prisma,
    // When false, an existing ACTIVE problem absent from `assessmentItems` is
    // left alone instead of being auto-RESOLVED (see the "Mark missing items
    // as RESOLVED" pass below). Used by the Initial Note's publish: its
    // assessment is a first-visit snapshot, not a reconciliation of a list
    // the clinician has reviewed, so absence must not be read as "resolved".
    // Defaults true — the Progress Note keeps today's behaviour.
    options: { resolveMissing?: boolean } = {},
  ): Promise<Map<string, string>> {
    const validItems = assessmentItems.filter((i) => i.title?.trim());
    const keptIds = new Set<string>();
    const userRole = await this.getUserRole(userId, client);

    const existing = await client.problem.findMany({
      where: {
        patientId,
        status: {
          in: [
            ProblemStatus.ACTIVE,
            ProblemStatus.RESOLVED,
            ProblemStatus.REMOVED,
          ],
        },
      },
    });
    const existingById = new Map(existing.map((p) => [p.id, p]));

    // De-dupe, preferring identity (Problem.id) over title text: a snapshot
    // item that already points at a master Problem row must never be
    // re-matched by title, since the title itself may be exactly what
    // changed (renamed in the Problem List module, or edited in-note). Items
    // without an id (freshly added in this note, no master row yet) still
    // dedupe/match by title so we don't create sibling duplicates of an
    // existing problem the clinician just retyped.
    const uniqueItems = new Map<
      string,
      {
        id?: string;
        tempId?: string;
        title: string;
        parentId?: string | null;
        hasParentId: boolean;
        diagnosisDate?: string | null;
        sortOrder?: number;
      }
    >();
    for (const item of validItems) {
      const key =
        item.id && existingById.has(item.id)
          ? `id:${item.id}`
          : `title:${item.title.trim().toLowerCase()}`;
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, {
          id: item.id && existingById.has(item.id) ? item.id : undefined,
          tempId: item.tempId,
          title: item.title.trim(),
          parentId: item.parentId,
          hasParentId: Object.prototype.hasOwnProperty.call(item, 'parentId'),
          diagnosisDate: item.diagnosisDate,
          sortOrder: item.sortOrder,
        });
      }
    }

    // Every item that survives this publish (matched-ACTIVE, reactivated,
    // restored, or newly created) gets a contiguous sortOrder assigned in
    // snapshot order — falling back to array-iteration order when the
    // caller didn't supply one (legacy callers / tests). Items dropped to
    // RESOLVED below are numbered past this range so they never collide
    // with the renumbered actives.
    const hasExplicitOrder = Array.from(uniqueItems.values()).every(
      (i) => typeof i.sortOrder === 'number',
    );
    const orderedUniqueItems = hasExplicitOrder
      ? Array.from(uniqueItems.values()).sort(
          (a, b) => (a.sortOrder as number) - (b.sortOrder as number),
        )
      : Array.from(uniqueItems.values());
    let activeIndex = 0;
    const promises: Promise<any>[] = [];

    // Every incoming identity key (a real Problem.id or a client tempId)
    // resolved to the real Problem.id it ends up as once the loop below has
    // created/matched it. Seeded with every existing problem's own id so an
    // item that ISN'T being re-parented this round still resolves as a valid
    // nesting target in pass 2.
    const resolvedIdByKey = new Map<string, string>();
    for (const p of existing) resolvedIdByKey.set(p.id, p.id);

    const toDateStr = (d: Date | string | null | undefined): string | null => {
      if (!d) return null;
      const date = typeof d === 'string' ? new Date(d) : d;
      return Number.isNaN(date.getTime())
        ? null
        : date.toISOString().split('T')[0];
    };

    for (const item of orderedUniqueItems) {
      const match = item.id
        ? existingById.get(item.id)
        : existing.find(
            (p) => p.title.toLowerCase() === item.title.toLowerCase(),
          );

      const registerResolved = (realId: string) => {
        if (item.id) resolvedIdByKey.set(item.id, realId);
        if (item.tempId) resolvedIdByKey.set(item.tempId, realId);
      };

      if (match) {
        registerResolved(match.id);
        const renamed = match.title.trim() !== item.title.trim();
        const dateHasChanged =
          item.diagnosisDate !== undefined &&
          toDateStr(item.diagnosisDate) !== toDateStr(match.diagnosisDate);
        const newDiagnosisDate = item.diagnosisDate
          ? new Date(item.diagnosisDate)
          : null;

        if (match.status === ProblemStatus.ACTIVE) {
          keptIds.add(match.id);
          const sortOrder = activeIndex++;
          const orderChanged = match.sortOrder !== sortOrder;
          if (renamed || dateHasChanged || orderChanged) {
            promises.push(
              client.problem
                .update({
                  where: { id: match.id },
                  data: {
                    ...(renamed && { title: item.title }),
                    ...(dateHasChanged && {
                      diagnosisDate: newDiagnosisDate,
                    }),
                    ...(orderChanged && { sortOrder }),
                    updatedByUser: { connect: { id: userId } },
                  },
                })
                .then(async () => {
                  if (renamed) {
                    await this.logAction(
                      patientId,
                      userId,
                      'Renamed',
                      `Renamed problem '${match.title}' to '${item.title}' from ${sourceNote}`,
                      client,
                      match.id,
                    );
                    await this.logAudit(
                      patientId,
                      userId,
                      userRole,
                      'UPDATE',
                      match.id,
                      item.title,
                      sourceNote,
                    );
                  }
                  if (dateHasChanged) {
                    await this.logAction(
                      patientId,
                      userId,
                      'Updated',
                      `Changed Date of Diagnosis for '${item.title}' from ${sourceNote}`,
                      client,
                      match.id,
                    );
                    await this.logAudit(
                      patientId,
                      userId,
                      userRole,
                      'UPDATE',
                      match.id,
                      item.title,
                      sourceNote,
                    );
                  }
                }),
            );
          }
          continue;
        }

        if (match.status === ProblemStatus.RESOLVED) {
          keptIds.add(match.id);
          const sortOrder = activeIndex++;
          promises.push(
            client.problem
              .update({
                where: { id: match.id },
                data: {
                  title: item.title,
                  status: ProblemStatus.ACTIVE,
                  sortOrder,
                  ...(dateHasChanged && { diagnosisDate: newDiagnosisDate }),
                  updatedByUser: { connect: { id: userId } },
                },
              })
              .then(async () => {
                await this.logAction(
                  patientId,
                  userId,
                  'Reactivated',
                  `Reactivated problem '${match.title}' from ${sourceNote}`,
                  client,
                  match.id,
                );
                await this.logAudit(
                  patientId,
                  userId,
                  userRole,
                  'UPDATE',
                  match.id,
                  item.title,
                  sourceNote,
                );
              }),
          );
          continue;
        }

        if (match.status === ProblemStatus.REMOVED) {
          keptIds.add(match.id);
          const sortOrder = activeIndex++;
          promises.push(
            client.problem
              .update({
                where: { id: match.id },
                data: {
                  title: item.title,
                  status: ProblemStatus.ACTIVE,
                  sortOrder,
                  ...(dateHasChanged && { diagnosisDate: newDiagnosisDate }),
                  updatedByUser: { connect: { id: userId } },
                },
              })
              .then(async () => {
                await this.logAction(
                  patientId,
                  userId,
                  'Restored',
                  `Restored removed problem '${match.title}' from ${sourceNote}`,
                  client,
                  match.id,
                );
                await this.logAudit(
                  patientId,
                  userId,
                  userRole,
                  'UPDATE',
                  match.id,
                  item.title,
                  sourceNote,
                );
              }),
          );
          continue;
        }
      }

      const sortOrder = activeIndex++;
      promises.push(
        client.problem
          .create({
            data: {
              patientId,
              title: item.title,
              status: ProblemStatus.ACTIVE,
              sortOrder,
              addedBy: userId,
              ...(item.diagnosisDate && {
                diagnosisDate: new Date(item.diagnosisDate),
              }),
            },
          })
          .then(async (newProb) => {
            registerResolved(newProb.id);
            await this.logAction(
              patientId,
              userId,
              'Created',
              `Added problem '${newProb.title}' from ${sourceNote}`,
              client,
              newProb.id,
            );
            await this.logAudit(
              patientId,
              userId,
              userRole,
              'CREATE',
              newProb.id,
              newProb.title,
              sourceNote,
            );
          }),
      );
    }

    // Mark missing items as RESOLVED — numbered past every active item so a
    // renumbered 0..n-1 active range never collides with a resolved one.
    let inactiveIndex = activeIndex;
    if (options.resolveMissing !== false) {
      for (const ext of existing) {
        if (!keptIds.has(ext.id) && ext.status === ProblemStatus.ACTIVE) {
          const sortOrder = inactiveIndex++;
          promises.push(
            client.problem
              .update({
                where: { id: ext.id },
                data: {
                  status: ProblemStatus.RESOLVED,
                  sortOrder,
                  updatedByUser: { connect: { id: userId } },
                },
              })
              .then(async () => {
                await this.logAction(
                  patientId,
                  userId,
                  'Resolved',
                  `Resolved problem '${ext.title}' — no longer listed in the ${sourceNote}`,
                  client,
                  ext.id,
                );
                await this.logAudit(
                  patientId,
                  userId,
                  userRole,
                  'UPDATE',
                  ext.id,
                  ext.title,
                  sourceNote,
                );
              }),
          );
        }
      }
    }

    await Promise.all(promises);

    // ── Pass 2: re-parenting ────────────────────────────────────────────
    // Only for items whose source explicitly supplied nesting info (the
    // `parentId` key present on the item, even as `null` for "root") — see
    // the `hasParentId` doc comment on the parameter above. Processed
    // sequentially, not in parallel: two items swapping parents in the same
    // batch could otherwise both pass a cycle check before either write
    // lands, creating a real cycle.
    for (const item of uniqueItems.values()) {
      if (!item.hasParentId) continue;

      const selfId =
        (item.id && resolvedIdByKey.get(item.id)) ||
        (item.tempId && resolvedIdByKey.get(item.tempId));
      if (!selfId) continue;

      const targetRealId = item.parentId
        ? resolvedIdByKey.get(item.parentId)
        : null;
      // parentId pointed at something we couldn't resolve (e.g. a
      // title-only legacy match that never got an id/tempId) — fall back to
      // root rather than fail the whole publish over one bad reference.
      const desiredParentId =
        item.parentId && targetRealId ? targetRealId : null;

      const current = await client.problem.findUnique({
        where: { id: selfId },
        select: { parentId: true, title: true },
      });
      if (!current || current.parentId === desiredParentId) continue;

      if (desiredParentId) {
        try {
          await this.assertValidParent(
            patientId,
            desiredParentId,
            client,
            selfId,
          );
        } catch {
          await client.problem.update({
            where: { id: selfId },
            data: {
              parent: { disconnect: true },
              updatedByUser: { connect: { id: userId } },
            },
          });
          await this.logAction(
            patientId,
            userId,
            'Updated',
            `Could not nest '${current.title}' from ${sourceNote} — target would create a cycle, left at top level`,
            client,
            selfId,
          );
          await this.logAudit(
            patientId,
            userId,
            userRole,
            'UPDATE',
            selfId,
            current.title,
            sourceNote,
          );
          continue;
        }
      }

      await client.problem.update({
        where: { id: selfId },
        data: {
          parent: desiredParentId
            ? { connect: { id: desiredParentId } }
            : { disconnect: true },
          updatedByUser: { connect: { id: userId } },
        },
      });
      await this.logAction(
        patientId,
        userId,
        'Updated',
        desiredParentId
          ? `Nested '${current.title}' from ${sourceNote}`
          : `Un-nested '${current.title}' from ${sourceNote}`,
        client,
        selfId,
      );
      await this.logAudit(
        patientId,
        userId,
        userRole,
        'UPDATE',
        selfId,
        current.title,
        sourceNote,
      );
    }

    return resolvedIdByKey;
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private async getNextSortOrder(
    patientId: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<number> {
    const last = await client.problem.findFirst({
      where: { patientId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async assertValidParent(
    patientId: string,
    parentId: string,
    client: PrismaTx | PrismaService = this.prisma,
    currentProblemId?: string,
  ): Promise<void> {
    let curr: string | null = parentId;
    while (curr) {
      if (curr === currentProblemId) {
        throw new BadRequestException(
          'Cannot nest a problem under its own descendant.',
        );
      }
      const node = await client.problem.findFirst({
        where: { id: curr, patientId },
      });
      if (!node) {
        if (curr === parentId)
          throw new NotFoundException(
            'Parent problem not found for this patient.',
          );
        break;
      }
      curr = node.parentId;
    }
  }

  // ─────────────────────────────────────────────
  // PROBLEM LOGS
  // ─────────────────────────────────────────────

  async getLogs(patientId: string) {
    await this.cleanupOldLogs(patientId);
    return this.prisma.problemLog.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        editor: { select: { firstName: true, lastName: true, role: true } },
      },
    });
  }

  private async cleanupOldLogs(patientId: string) {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    await this.prisma.problemLog.deleteMany({
      where: {
        patientId,
        createdAt: {
          lt: twoWeeksAgo,
        },
      },
    });
  }

  private async logAction(
    patientId: string,
    editorId: string,
    action: string,
    description: string,
    client: PrismaTx | PrismaService = this.prisma,
    problemId?: string,
  ) {
    await client.problemLog.create({
      data: {
        patientId,
        editorId,
        action,
        description,
        problemId: problemId ?? null,
      },
    });
  }

  // ─────────────────────────────────────────────
  // AUDIT TRAIL — feeds the patient-facing centralized Logs page.
  //
  // Problem CRUD reaching this service via ProblemsController is already
  // audit-logged by the global AuditLogInterceptor (it taps the HTTP
  // response). But upsertFromAssessment is called *internally* by
  // InitialNotesService/ProgressNotesService on note publish — never through
  // the controller — so the interceptor never sees those mutations. Without
  // this, every problem created/renamed/resolved/reactivated as a side
  // effect of publishing a note was invisible on the Logs page even though
  // it's a real, frequent source of problem-list activity.
  // ─────────────────────────────────────────────

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
    problemId: string,
    title: string,
    sourceNote: 'Initial Note' | 'Progress Note',
  ) {
    if (!userRole) return;
    await this.auditLogsService.create({
      userId,
      userRole,
      action,
      tableName: 'problems',
      recordId: problemId,
      patientId,
      changes: { title, _sourceNote: sourceNote },
    });
  }
}
