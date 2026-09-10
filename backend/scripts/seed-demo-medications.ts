/**
 * One-off seed/reconcile: set the medication list for two demo patients
 * (Dela Cruz, Natividad and Mariano, Benjamin) to an exact specified state.
 *
 * For each patient, existing `medication` rows are matched against the
 * desired list by normalized name (`normalizeMedText`, same rule the
 * note-publish upsert path uses — see medications.utils.ts):
 *   - match found            -> update dose/formulation/instructions/quantity,
 *                                isActive: true, plus a MedicationLog entry
 *                                ('Reactivated' if it was inactive, else 'Updated')
 *   - no match                -> create, isActive: true, plus a 'Created' log
 *   - existing row not desired -> soft-remove (isActive: false), plus a
 *                                'Removed' log. Not a hard delete, so history
 *                                stays attached to the row.
 *
 * Idempotent: re-running with --apply after a successful run finds every row
 * already matching and writes nothing.
 *
 *   npx ts-node -T scripts/seed-demo-medications.ts                     # dry run
 *   npx ts-node -T scripts/seed-demo-medications.ts --apply             # write
 *   npx ts-node -T scripts/seed-demo-medications.ts --apply --actor=<user-uuid>
 *
 * Without --actor, the first active ADMIN user (by createdAt asc) is used as
 * the editor for MedicationLog rows and as addedBy/updatedBy.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeMedText } from '../src/medications/medications.utils';

type Tx = Prisma.TransactionClient;

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const ACTOR_ARG = process.argv.find((a) => a.startsWith('--actor='));
const ACTOR_OVERRIDE = ACTOR_ARG ? ACTOR_ARG.slice('--actor='.length) : null;

interface DesiredMed {
  name: string;
  formulation: string;
  dose: string;
  instructions: string;
  quantity: number;
}

interface PatientSeed {
  lastName: string;
  firstName: string;
  medications: DesiredMed[];
}

const SEED: PatientSeed[] = [
  {
    lastName: 'Dela Cruz',
    firstName: 'Natividad',
    medications: [
      { name: 'Losartan', formulation: 'tablet', dose: '50 mg', instructions: 'PO OD', quantity: 30 },
      { name: 'Amlodipine', formulation: 'tablet', dose: '10 mg', instructions: 'PO OD', quantity: 30 },
      { name: 'Insulin Glargine', formulation: '100 IU/mL pre-filled injection', dose: '14 units', instructions: 'SC HS', quantity: 2 },
      { name: 'Insulin Lispro', formulation: '100 IU/mL pre-filled injection', dose: '6 units', instructions: 'SC TID AC', quantity: 2 },
      { name: 'Rosuvastatin', formulation: 'tablet', dose: '10 mg', instructions: 'PO OD HS', quantity: 30 },
      { name: 'Calcium Carbonate + Vit D3', formulation: 'tablet', dose: '500 mg/400 IU', instructions: 'PO BID', quantity: 60 },
      { name: 'Sodium Bicarbonate', formulation: 'tablet', dose: '650 mg', instructions: 'PO TID', quantity: 90 },
      { name: 'Ferrous Sulfate', formulation: 'tablet', dose: '325 mg', instructions: 'PO OD', quantity: 30 },
      { name: 'Paracetamol', formulation: 'tablet', dose: '500 mg', instructions: 'PO Q8H PRN for OA knee pain', quantity: 20 },
    ],
  },
  {
    lastName: 'Mariano',
    firstName: 'Benjamin',
    medications: [
      { name: 'Losartan', formulation: 'tablet', dose: '100 mg', instructions: 'PO OD', quantity: 30 },
      { name: 'Sitagliptin + Metformin', formulation: 'tablet', dose: '50 mg/500 mg', instructions: 'PO BID AC', quantity: 60 },
      { name: 'Allopurinol', formulation: 'tablet', dose: '100 mg', instructions: 'PO OD', quantity: 30 },
      { name: 'Atorvastatin', formulation: 'tablet', dose: '20 mg', instructions: 'PO OD HS', quantity: 30 },
      { name: 'Paracetamol', formulation: 'tablet', dose: '500 mg', instructions: 'PO Q6H PRN for joint pain', quantity: 20 },
    ],
  },
];

async function resolveActor(): Promise<string> {
  if (ACTOR_OVERRIDE) return ACTOR_OVERRIDE;
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    throw new Error(
      'No active ADMIN user found to attribute MedicationLog entries to. Pass --actor=<user-uuid>.',
    );
  }
  return admin.id;
}

async function main() {
  const actorId = await resolveActor();
  console.log(`Actor: ${actorId}${ACTOR_OVERRIDE ? ' (--actor override)' : ' (first active ADMIN)'}`);
  console.log(APPLY ? 'Mode: APPLY (writing)' : 'Mode: DRY RUN (no writes)');

  for (const patientSeed of SEED) {
    const patients = await prisma.patient.findMany({
      where: {
        isActive: true,
        lastName: { equals: patientSeed.lastName, mode: 'insensitive' },
        firstName: { equals: patientSeed.firstName, mode: 'insensitive' },
      },
    });

    console.log(`\n=== ${patientSeed.lastName}, ${patientSeed.firstName} ===`);

    if (patients.length === 0) {
      console.log('  ABORT: no active patient found with this name. Skipping.');
      continue;
    }
    if (patients.length > 1) {
      console.log(`  ABORT: ${patients.length} active patients matched this name — ambiguous. Skipping.`);
      continue;
    }

    const patient = patients[0];
    const existing = await prisma.medication.findMany({ where: { patientId: patient.id } });
    const existingByKey = new Map(existing.map((m) => [normalizeMedText(m.name), m]));
    const desiredKeys = new Set(patientSeed.medications.map((d) => normalizeMedText(d.name)));

    const plan: Array<(tx: Tx) => Promise<void>> = [];
    const lines: string[] = [];

    for (const desired of patientSeed.medications) {
      const key = normalizeMedText(desired.name);
      const match = existingByKey.get(key);

      if (!match) {
        lines.push(`  CREATE   ${desired.name} | ${desired.formulation} | ${desired.dose} | ${desired.instructions} | qty ${desired.quantity}`);
        plan.push(async (tx) => {
          const med = await tx.medication.create({
            data: {
              patientId: patient.id,
              name: desired.name,
              dose: desired.dose,
              formulation: desired.formulation,
              instructions: desired.instructions,
              quantity: desired.quantity,
              isActive: true,
              fromPast: false,
              addedBy: actorId,
            },
          });
          await tx.medicationLog.create({
            data: {
              patientId: patient.id,
              medicationId: med.id,
              action: 'Created',
              description: `Added medication '${med.name}' (demo seed)`,
              editorId: actorId,
            },
          });
        });
        continue;
      }

      const changed =
        match.dose !== desired.dose ||
        match.formulation !== desired.formulation ||
        match.instructions !== desired.instructions ||
        match.quantity !== desired.quantity ||
        !match.isActive;

      if (!changed) {
        lines.push(`  OK       ${desired.name} (unchanged)`);
        continue;
      }

      const action = match.isActive ? 'Updated' : 'Reactivated';
      lines.push(
        `  ${action.toUpperCase().padEnd(8)} ${desired.name} | ${match.dose} -> ${desired.dose} | ${match.formulation ?? '—'} -> ${desired.formulation} | qty ${match.quantity ?? '—'} -> ${desired.quantity}`,
      );
      plan.push(async (tx) => {
        await tx.medication.update({
          where: { id: match.id },
          data: {
            dose: desired.dose,
            formulation: desired.formulation,
            instructions: desired.instructions,
            quantity: desired.quantity,
            isActive: true,
            updatedBy: actorId,
          },
        });
        await tx.medicationLog.create({
          data: {
            patientId: patient.id,
            medicationId: match.id,
            action,
            description: `${action} medication '${match.name}' (demo seed)`,
            editorId: actorId,
          },
        });
      });
    }

    for (const m of existing) {
      if (m.isActive && !desiredKeys.has(normalizeMedText(m.name))) {
        lines.push(`  DEACTIVATE ${m.name} (not in desired list)`);
        plan.push(async (tx) => {
          await tx.medication.update({
            where: { id: m.id },
            data: { isActive: false, updatedBy: actorId },
          });
          await tx.medicationLog.create({
            data: {
              patientId: patient.id,
              medicationId: m.id,
              action: 'Removed',
              description: `Removed medication '${m.name}' (demo seed reconcile)`,
              editorId: actorId,
            },
          });
        });
      }
    }

    console.log(lines.join('\n') || '  (nothing to do)');

    if (APPLY && plan.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const step of plan) await step(tx);
      });
      console.log(`  Applied ${plan.length} change(s).`);
    } else if (APPLY) {
      console.log('  No changes.');
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
