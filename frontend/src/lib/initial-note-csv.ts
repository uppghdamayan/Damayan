import type {
  InitialNoteSnapshot,
  InitialNoteVersionDetail,
} from '@/types/initial-note';
import { INITIAL_NOTE_FIELD_LABELS, formatEditorName } from './initial-note-log-utils';

/**
 * Section order for the export — matches the order a clinician reads the note
 * on screen, not the alphabetical/schema order.
 */
const EXPORT_SECTIONS: (keyof InitialNoteSnapshot)[] = [
  'chiefComplaint',
  'hpi',
  'pmhComorbidities',
  'pmhSurgeries',
  'pmhHospitalizations',
  'allergies',
  'familyHistory',
  'socialHistory',
  'obHistory',
  'psychosocialHistory',
  'physicalExam',
  'assessment',
  'medicationSnapshot',
  'diagnostics',
  'mgmtNonpharm',
];

/**
 * RFC 4180 escaping. Every field is quoted rather than only the ones that need
 * it — the HPI and Physical Exam routinely contain commas and newlines, and
 * unconditional quoting keeps those intact when Excel parses the file.
 */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

/** Flattens a section value to a single cell of text. */
function sectionToText(
  field: keyof InitialNoteSnapshot,
  snapshot: InitialNoteSnapshot,
): string {
  const value = snapshot[field];
  if (value === null || value === undefined) return '';

  // `snapshot[field]` is a union across every section, so narrow per branch
  if (field === 'assessment' && Array.isArray(value)) {
    type AssessmentItem = { title?: string; icdCode?: string | null; depth?: number };
    return (value as AssessmentItem[])
      .map((item) => {
        const title = String(item?.title ?? '').trim();
        if (!title) return '';
        // Two spaces per nesting level keeps sub-problems readable in a cell
        const indent = '  '.repeat(item?.depth ?? 0);
        return item?.icdCode ? `${indent}${title} (${item.icdCode})` : `${indent}${title}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  if (field === 'medicationSnapshot' && Array.isArray(value)) {
    type MedicationItem = {
      name?: string;
      dose?: string | number | null;
      formulation?: string | null;
      instructions?: string | null;
    };
    return (value as MedicationItem[])
      .map((med) => {
        const name = [med?.name, med?.dose, med?.formulation]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (!name) return '';
        return med?.instructions ? `${name} — ${med.instructions}` : name;
      })
      .filter(Boolean)
      .join('\n');
  }

  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '').trim()).filter(Boolean).join('\n');
  }

  return String(value);
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  // Locale-independent and spreadsheet-sortable
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export interface CsvPatientContext {
  patientCode?: string;
  fullName?: string;
}

/**
 * Builds a tidy one-row-per-section CSV for a single version.
 *
 * Metadata is repeated on every row rather than sitting in a separate header
 * block, so the file stays a single rectangular table — sortable, filterable,
 * and safe to concatenate with exports of other versions.
 */
export function buildVersionCsv(
  version: InitialNoteVersionDetail,
  changedFields: string[],
  patient?: CsvPatientContext,
): string {
  const header = [
    'Patient',
    'Patient Code',
    'Note Type',
    'Version',
    'Status',
    'Saved At',
    'Saved By',
    'Section',
    'Content',
    'Changed In This Version',
  ];

  const meta = [
    patient?.fullName ?? '',
    patient?.patientCode ?? '',
    'Initial Note',
    `v${version.versionNumber}`,
    String(version.snapshot?.status ?? ''),
    formatTimestamp(version.createdAt),
    formatEditorName(version.editor),
  ];

  const rows = EXPORT_SECTIONS.map((field) =>
    csvRow([
      ...meta,
      INITIAL_NOTE_FIELD_LABELS[field as string] ?? String(field),
      sectionToText(field, version.snapshot),
      // v1 is the original — nothing precedes it, so nothing is "changed"
      changedFields.includes(field as string) ? 'Yes' : 'No',
    ]),
  );

  // Leading BOM so Excel reads the file as UTF-8 rather than the system
  // codepage — written as an escape, not a literal, so it survives editing.
  const BOM = String.fromCharCode(0xfeff);
  return BOM + [csvRow(header), ...rows].join('\r\n') + '\r\n';
}

/** `initial-note-P0001-v2-2026-07-30.csv` */
export function buildVersionCsvFilename(
  version: InitialNoteVersionDetail,
  patient?: CsvPatientContext,
): string {
  const datePart = new Date(version.createdAt).toISOString().slice(0, 10);
  const patientPart = patient?.patientCode ? `-${patient.patientCode}` : '';
  return `initial-note${patientPart}-v${version.versionNumber}-${datePart}.csv`;
}

/** Triggers a client-side download without any server round-trip. */
export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
