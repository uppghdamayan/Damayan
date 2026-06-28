import type { Medication } from '@/types/medication';
import medicationsData from '@/data/medications.json';

export interface MedicationDictionaryEntry {
  Molecule: string;
  Route: string;
}

export const MEDICATION_DICTIONARY = medicationsData as MedicationDictionaryEntry[];

/** Merge the static dictionary list with names already on file for this patient
 *  (active + inactive), de-duplicated case-insensitively, for the
 *  MedicationForm name-field autocomplete. */
export function buildMedicationSuggestions(patientMedications: Medication[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  
  const allNames = [
    ...patientMedications.map((m) => m.name),
    ...MEDICATION_DICTIONARY.map((d) => d.Molecule)
  ];

  for (const name of allNames) {
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

