/**
 * One-off backfill: give every already-published Initial Note a v1 baseline.
 *
 * Version history shipped after these notes were published, so `publish()`
 * never recorded their original state. Without a baseline the first edit made
 * after the feature went live becomes "v1" and presents edited content as the
 * original — see `InitialNotesService.ensureBaselineVersion`, which is the
 * runtime guard for the same problem.
 *
 * The snapshot is the note's CURRENT content, dated to `lastEditedAt ?? createdAt`.
 * For a note never edited since publication that is exactly the published state.
 * For one edited before the feature existed it is the earliest state we still
 * have — nothing is reconstructed or invented.
 *
 * Safe to re-run: notes that already have any version are skipped.
 *
 *   npx ts-node -T scripts/backfill-initial-note-versions.ts          # dry run
 *   npx ts-node -T scripts/backfill-initial-note-versions.ts --apply  # write
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { buildSnapshot } from '../src/initial-notes/initial-notes.utils';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const notes = await prisma.initialNote.findMany({
    where: { status: 'PUBLISHED', isDeleted: false },
    include: { _count: { select: { versions: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const needsBaseline = notes.filter((note) => note._count.versions === 0);
  const alreadyVersioned = notes.length - needsBaseline.length;

  console.log(
    `${notes.length} published note(s): ${needsBaseline.length} need a baseline, ${alreadyVersioned} already versioned.`,
  );

  for (const note of needsBaseline) {
    const editorId = note.authorId ?? note.lastEditedBy;
    if (!editorId) {
      console.warn(`  SKIP ${note.id} — no author or last editor to attribute v1 to`);
      continue;
    }

    const createdAt = note.lastEditedAt ?? note.createdAt;
    console.log(
      `  ${APPLY ? 'WRITE' : 'would write'} v1 for ${note.id} ` +
        `("${note.chiefComplaint}") dated ${createdAt.toISOString()}`,
    );

    if (!APPLY) continue;

    await prisma.initialNoteVersion.create({
      data: {
        initialNoteId: note.id,
        patientId: (
          await prisma.visit.findUniqueOrThrow({
            where: { id: note.visitId },
            select: { patientId: true },
          })
        ).patientId,
        versionNumber: 1,
        snapshot: buildSnapshot(note) as Prisma.InputJsonValue,
        changedFields: [],
        changeSummary: null,
        editorId,
        createdAt,
      },
    });
  }

  console.log(APPLY ? 'Done.' : 'Dry run — re-run with --apply to write.');
}

main()
  .catch((e) => {
    console.error('FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
