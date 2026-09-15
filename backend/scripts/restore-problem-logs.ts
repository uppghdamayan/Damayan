/**
 * Restore ProblemLog rows that were purged by the 14-day cleanup sweep
 * in ProblemsService.getLogs().
 *
 * Scans `audit_logs` where tableName = 'problems' and recreates the
 * corresponding `ProblemLog` rows with their original timestamps, editor,
 * action, and description.
 *
 * Usage:
 *   npx ts-node -T scripts/restore-problem-logs.ts          # Dry run (default)
 *   npx ts-node -T scripts/restore-problem-logs.ts --apply  # Write to database
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`\n=== ProblemLog Restoration Tool [${APPLY ? 'APPLY MODE' : 'DRY RUN'}] ===\n`);

  const patients = await prisma.patient.findMany({
    select: { id: true, firstName: true, lastName: true, patientCode: true },
    orderBy: { patientCode: 'asc' },
  });

  let totalRestored = 0;

  for (const patient of patients) {
    const existingProblemLogs = await prisma.problemLog.findMany({
      where: { patientId: patient.id },
      select: { id: true, createdAt: true, problemId: true, action: true },
    });

    const auditLogs = await prisma.auditLog.findMany({
      where: { patientId: patient.id, tableName: 'problems' },
      orderBy: { createdAt: 'asc' },
    });

    if (auditLogs.length === 0) continue;

    // Filter audit logs that don't already have a corresponding problemLog at approximately the same timestamp (within 2s)
    const missingAuditLogs = auditLogs.filter((al) => {
      return !existingProblemLogs.some((pl) => {
        const timeDiff = Math.abs(pl.createdAt.getTime() - al.createdAt.getTime());
        return timeDiff < 2000;
      });
    });

    if (missingAuditLogs.length === 0) {
      console.log(`[${patient.patientCode}] ${patient.firstName} ${patient.lastName}: All ${auditLogs.length} logs already present in ProblemLog.`);
      continue;
    }

    console.log(`\n[${patient.patientCode}] ${patient.firstName} ${patient.lastName}: ${missingAuditLogs.length} missing ProblemLog(s) to restore:`);

    const recordsToInsert: Array<{
      patientId: string;
      problemId: string | null;
      action: string;
      description: string;
      editorId: string;
      createdAt: Date;
    }> = [];

    for (let i = 0; i < auditLogs.length; i++) {
      const al = auditLogs[i];
      if (!missingAuditLogs.includes(al)) continue;

      const changes = (al.changes as Record<string, any>) || {};
      const sourceNote = changes._sourceNote || 'Progress Note';
      const title = changes.title || 'problem';
      let action = 'Created';
      let description = '';

      if (al.action === 'CREATE') {
        action = 'Created';
        description = `Added problem '${title}' from ${sourceNote}`;
      } else if (changes._isReorder) {
        action = 'Published';
        description = 'Published new problem list order and nesting';
      } else if (changes.status === 'RESOLVED') {
        action = 'Resolved';
        description = `Resolved problem '${title}'`;
      } else if (changes.status === 'ACTIVE') {
        action = 'Reactivated';
        description = `Reactivated problem '${title}'`;
      } else if (changes.status === 'REMOVED') {
        action = 'Removed';
        description = `Removed problem '${title}'`;
      } else {
        // UPDATE: Determine if renamed or nested
        const prevLogsForProblem = auditLogs.slice(0, i).filter((l) => l.recordId === al.recordId);
        if (prevLogsForProblem.length === 0) {
          action = 'Updated';
          description = `Updated problem '${title}' from ${sourceNote}`;
        } else {
          const prev = prevLogsForProblem[prevLogsForProblem.length - 1];
          const prevTitle = (prev.changes as any)?.title;
          if (prevTitle && prevTitle !== title) {
            action = 'Renamed';
            description = `Renamed problem '${prevTitle}' to '${title}' from ${sourceNote}`;
          } else if (al.createdAt.getTime() - prev.createdAt.getTime() < 5000) {
            action = 'Updated';
            description = `Nested '${title}' from ${sourceNote}`;
          } else {
            action = 'Updated';
            description = `Updated problem '${title}' from ${sourceNote}`;
          }
        }
      }

      recordsToInsert.push({
        patientId: patient.id,
        problemId: al.recordId,
        action,
        description,
        editorId: al.userId,
        createdAt: al.createdAt,
      });

      console.log(
        `  ${APPLY ? 'RESTORE' : 'WOULD RESTORE'}: [${al.createdAt.toISOString()}] ${action.padEnd(10)} | ${description}`,
      );
    }

    if (APPLY && recordsToInsert.length > 0) {
      await prisma.$transaction(
        recordsToInsert.map((rec) =>
          prisma.problemLog.create({
            data: rec,
          }),
        ),
      );
      console.log(`  -> Successfully restored ${recordsToInsert.length} ProblemLog entries for ${patient.firstName} ${patient.lastName}.`);
    }

    totalRestored += recordsToInsert.length;
  }

  console.log(`\n=== Summary: ${totalRestored} ProblemLog entry(s) ${APPLY ? 'restored to database' : 'identified for restoration'}. ===\n`);
}

main()
  .catch((err) => {
    console.error('Restoration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
