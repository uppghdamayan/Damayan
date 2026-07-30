/**
 * One-off repair: drop version rows that were numbered v1 but actually hold an
 * EDIT rather than the original published state.
 *
 * These exist only for notes published before version history shipped. On the
 * first post-deploy edit, `snapshotVersion` found no prior versions and numbered
 * that edit v1, so the UI presented edited content as the original (a v1 with a
 * non-empty `changedFields` is the tell — a true baseline always has []).
 *
 * The pre-edit content is unrecoverable: it was overwritten before any snapshot
 * mechanism existed. Rather than fabricate a baseline, this deletes the
 * mislabeled row and detaches the log entry that pointed at it. The log entry
 * itself is KEPT and restated — that an edit happened is true and worth
 * recording; only the claim to hold a snapshot of it was wrong.
 *
 * Run `backfill-initial-note-versions.ts --apply` afterwards to give the
 * affected notes a proper v1 baseline from their current content.
 *
 *   npx ts-node -T scripts/repair-mislabeled-v1.ts          # dry run
 *   npx ts-node -T scripts/repair-mislabeled-v1.ts --apply  # write
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const suspect = await prisma.initialNoteVersion.findMany({
    where: { versionNumber: 1 },
    orderBy: { createdAt: 'asc' },
  });
  const mislabeled = suspect.filter((v) => v.changedFields.length > 0);

  console.log(
    `${suspect.length} v1 row(s) found, ${mislabeled.length} mislabeled (non-empty changedFields).`,
  );

  for (const version of mislabeled) {
    const linkedLogs = await prisma.initialNoteLog.findMany({
      where: { versionId: version.id },
    });

    console.log(
      `  ${APPLY ? 'DELETE' : 'would delete'} version ${version.id} ` +
        `(note ${version.initialNoteId}, changed: ${version.changedFields.join(', ')})`,
    );
    for (const log of linkedLogs) {
      console.log(`    ${APPLY ? 'detach' : 'would detach'} log "${log.description}"`);
    }

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      for (const log of linkedLogs) {
        await tx.initialNoteLog.update({
          where: { id: log.id },
          data: {
            versionId: null,
            // Drop the "(vN)" claim — there is no snapshot behind it any more.
            description: log.description.replace(
              /^Revised published Initial Note \(v\d+\): (.*)$/,
              (_m, rest: string) =>
                `Revised published Initial Note: ${rest} (recorded before version history was enabled; no snapshot retained)`,
            ),
          },
        });
      }
      await tx.initialNoteVersion.delete({ where: { id: version.id } });
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
