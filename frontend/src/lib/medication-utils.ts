import type { Medication } from '@/types/medication';

export const COMMON_MEDICATIONS = [
  'Amoxicillin', 'Amlodipine', 'Losartan', 'Metformin', 'Paracetamol',
  'Cetirizine', 'Mefenamic Acid', 'Salbutamol', 'Omeprazole', 'Atorvastatin',
  'Captopril', 'Clopidogrel', 'Metoprolol', 'Simvastatin', 'Co-Amoxiclav',
  'Cefalexin', 'Ascorbic Acid', 'Multivitamins', 'Loperamide', 'Ibuprofen',
] as const;

/** Merge the static common list with names already on file for this patient
 *  (active + inactive), de-duplicated case-insensitively, for the
 *  MedicationForm name-field autocomplete. */
export function buildMedicationSuggestions(patientMedications: Medication[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of [...patientMedications.map((m) => m.name), ...COMMON_MEDICATIONS]) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result.sort((a, b) => a.localeCompare(b));
}

export function isRecentlyUpdated(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
}

export function mostRecentMedicationUpdate(medications: Medication[]): string | null {
  if (medications.length === 0) return null;
  return medications.reduce((latest, m) => (m.updatedAt > latest ? m.updatedAt : latest), medications[0].updatedAt);
}

export function formatDose(medication: Pick<Medication, 'dose' | 'unit'>): string {
  const num = Number(medication.dose);
  const trimmed = num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${trimmed} ${medication.unit.toLowerCase()}`;
}
