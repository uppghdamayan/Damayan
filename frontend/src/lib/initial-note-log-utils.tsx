import React from 'react';
import type { LogEditor } from '@/types/initial-note';

/**
 * Field key → display label. Mirrors `INITIAL_NOTE_FIELD_LABELS` in
 * `backend/src/initial-notes/initial-notes.utils.ts` — keep both in sync.
 * Used for the version-history "Changed" badges; the backend already bakes
 * these labels into log descriptions.
 */
export const INITIAL_NOTE_FIELD_LABELS: Record<string, string> = {
  chiefComplaint: 'Chief Complaint',
  hpi: 'History of Present Illness',
  pmhComorbidities: 'Past Medical History (Comorbidities)',
  pmhSurgeries: 'Past Medical History (Surgeries)',
  pmhHospitalizations: 'Past Medical History (Hospitalizations)',
  pmhMedications: 'Past Medical History (Past Medications)',
  allergies: 'Allergies',
  familyHistory: 'Family History',
  socialHistory: 'Social History',
  obHistory: 'Obstetric History',
  psychosocialHistory: 'Psychosocial History',
  physicalExam: 'Physical Exam',
  assessment: 'Assessment',
  medicationSnapshot: 'Past Medical History (Past Medications)',
  mgmtNonpharm: 'Non-pharmacologic Management',
  diagnostics: 'Diagnostics',
};

/** Short badge-friendly section names for chips and version tags. */
export const INITIAL_NOTE_FIELD_SHORT_LABELS: Record<string, string> = {
  chiefComplaint: 'Chief Complaint',
  hpi: 'HPI',
  pmhComorbidities: 'Comorbidities',
  pmhSurgeries: 'Surgeries',
  pmhHospitalizations: 'Hospitalizations',
  pmhMedications: 'Past Meds',
  allergies: 'Allergies',
  familyHistory: 'Family History',
  socialHistory: 'Social History',
  obHistory: 'OB History',
  psychosocialHistory: 'Psychosocial History',
  physicalExam: 'Physical Exam',
  assessment: 'Assessment',
  medicationSnapshot: 'Past Meds',
  mgmtNonpharm: 'Non-pharm Mgmt',
  diagnostics: 'Diagnostics',
};

export function getFieldShortLabel(field: string): string {
  return INITIAL_NOTE_FIELD_SHORT_LABELS[field] || INITIAL_NOTE_FIELD_LABELS[field] || field;
}

/** Role-prefixed display name, matching the problem/medication log tables. */
export function formatEditorName(editor: LogEditor): string {
  if (editor.role === 'DOCTOR') return `Dr. ${editor.lastName}`;
  if (editor.role === 'NURSE') return `Nurse ${editor.lastName}`;
  return `${editor.firstName} ${editor.lastName}`;
}

/** `Jul 30, 2026` in en-PH. */
export function formatLogDate(value: string): string {
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** `2:15 PM` in en-PH. */
export function formatLogTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Bolds the section labels inside a log description so the changed parts of
 * "Revised published Initial Note (v3): Chief Complaint, HPI" stand out.
 */
export function FormattedLogText({ text }: { text: string }) {
  const labels = Object.values(INITIAL_NOTE_FIELD_LABELS)
    // longest first so "Past Surgeries" wins over a prefix match
    .sort((a, b) => b.length - a.length)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${labels.join('|')})`, 'g');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-semibold text-text-primary">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
