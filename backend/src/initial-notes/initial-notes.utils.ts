import { InitialNote } from '@prisma/client';

/**
 * The clinical fields that make up an Initial Note's content. These are the
 * fields captured in a version snapshot and compared when building a change
 * description — deliberately excluding identity/bookkeeping columns
 * (id, visitId, authorId, status, timestamps) which are not "content".
 */
export const INITIAL_NOTE_CONTENT_FIELDS = [
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
  'mgmtNonpharm',
  'diagnostics',
] as const;

export type InitialNoteContentField =
  (typeof INITIAL_NOTE_CONTENT_FIELDS)[number];

/**
 * Full section names as a clinician would read them — these go straight into
 * log descriptions, so no abbreviations. Mirrored on the frontend in
 * `lib/initial-note-log-utils.tsx`; keep both in sync.
 */
export const INITIAL_NOTE_FIELD_LABELS: Record<
  InitialNoteContentField,
  string
> = {
  chiefComplaint: 'Chief Complaint',
  hpi: 'History of Present Illness',
  pmhComorbidities: 'Past Medical History (Comorbidities)',
  pmhSurgeries: 'Past Medical History (Surgeries)',
  pmhHospitalizations: 'Past Medical History (Hospitalizations)',
  allergies: 'Allergies',
  familyHistory: 'Family History',
  socialHistory: 'Social History',
  obHistory: 'Obstetric History',
  psychosocialHistory: 'Psychosocial History',
  physicalExam: 'Physical Exam',
  assessment: 'Assessment',
  medicationSnapshot: 'Medications',
  mgmtNonpharm: 'Non-pharmacologic Management',
  diagnostics: 'Diagnostics',
};

/**
 * Order-stable, noise-free serialisation used to compare two field values.
 *
 * Object keys are sorted so `{a,b}` and `{b,a}` compare equal, and empty
 * values (null / undefined / '') are dropped so that e.g. `icdCode: ''` on one
 * side and a missing `icdCode` on the other do not read as a change. Array
 * order IS significant — the assessment is an ordered problem list.
 */
function stableStringify(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    if (Array.isArray(v)) {
      return v.map(normalize).filter((item) => item !== undefined);
    }
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v).sort()) {
        const normalized = normalize((v as Record<string, unknown>)[key]);
        if (normalized !== undefined) out[key] = normalized;
      }
      return Object.keys(out).length === 0 ? undefined : out;
    }
    return v;
  };

  return JSON.stringify(normalize(value) ?? null);
}

export type InitialNoteSnapshot = Record<string, unknown>;

/**
 * Full field-for-field copy of a note's clinical content, stored verbatim on
 * `InitialNoteVersion.snapshot`. `status` rides along so a rendered version can
 * label itself without joining back to the live note.
 */
export function buildSnapshot(note: InitialNote): InitialNoteSnapshot {
  const snapshot: InitialNoteSnapshot = { status: note.status };
  for (const field of INITIAL_NOTE_CONTENT_FIELDS) {
    snapshot[field] =
      (note as unknown as Record<string, unknown>)[field] ?? null;
  }
  return snapshot;
}

// ─────────────────────────────────────────────
// CHANGE DESCRIPTIONS
// ─────────────────────────────────────────────

type ChangeKind = 'added' | 'edited' | 'cleared';

const CHANGE_VERBS: Record<ChangeKind, string> = {
  added: 'Added',
  edited: 'Edited',
  cleared: 'Cleared',
};

/** Which key identifies an item, for the list-valued fields. */
const LIST_ITEM_LABEL: Partial<
  Record<InitialNoteContentField, (item: unknown) => string>
> = {
  assessment: (item) =>
    String((item as { title?: unknown })?.title ?? '').trim(),
  medicationSnapshot: (item) =>
    String((item as { name?: unknown })?.name ?? '').trim(),
  diagnostics: (item) => String(item ?? '').trim(),
};

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** "A", "A and B", "A, B, and C" */
function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * For list-valued sections, name the items that came and went — "added
 * Hypertension, removed Migraine" — and identify in-place modifications (e.g. dose changes)
 * so the log says what actually moved rather than just that the section changed.
 */
function describeListDelta(
  field: InitialNoteContentField,
  before: unknown,
  after: unknown,
): string | null {
  const labelOf = LIST_ITEM_LABEL[field];
  if (!labelOf || !Array.isArray(before) || !Array.isArray(after)) return null;

  const beforeItems = before.map(labelOf).filter(Boolean);
  const afterItems = after.map(labelOf).filter(Boolean);
  const added = afterItems.filter((item) => !beforeItems.includes(item));
  const removed = beforeItems.filter((item) => !afterItems.includes(item));

  // Check for in-place modifications for items with same label
  const modified: string[] = [];
  const common = beforeItems.filter((item) => afterItems.includes(item));
  for (const label of common) {
    const beforeObj = before.find((item) => labelOf(item) === label);
    const afterObj = after.find((item) => labelOf(item) === label);
    if (stableStringify(beforeObj) !== stableStringify(afterObj)) {
      modified.push(label);
    }
  }

  const parts: string[] = [];
  if (added.length > 0) parts.push(`added ${joinList(added)}`);
  if (removed.length > 0) parts.push(`removed ${joinList(removed)}`);
  if (modified.length > 0) parts.push(`updated ${joinList(modified)}`);

  return parts.length > 0 ? parts.join(', ') : null;
}

interface FieldChange {
  field: InitialNoteContentField;
  kind: ChangeKind;
  detail: string | null;
}

/**
 * Turns the raw field changes into one readable clause, e.g.
 * "Edited the Chief Complaint and History of Present Illness" or
 * "Added the Allergies; edited the Assessment (added Hypertension)".
 */
function buildSummary(changes: FieldChange[]): string {
  if (changes.length === 0) return '';

  const clauses: string[] = [];
  for (const kind of ['edited', 'added', 'cleared'] as ChangeKind[]) {
    const group = changes.filter((change) => change.kind === kind);
    if (group.length === 0) continue;

    const labels = group.map((change) => {
      const label = INITIAL_NOTE_FIELD_LABELS[change.field];
      return change.detail ? `${label} (${change.detail})` : label;
    });
    clauses.push(`${CHANGE_VERBS[kind]} the ${joinList(labels)}`);
  }

  // Only the leading clause keeps its capital: "Edited the X; added the Y"
  return clauses
    .map((clause, i) =>
      i === 0 ? clause : clause.charAt(0).toLowerCase() + clause.slice(1),
    )
    .join('; ');
}

/**
 * Compares two notes (or a note and a snapshot) and returns which content
 * fields differ, plus a human-readable description of what changed.
 */
export function diffNoteFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { changedFields: InitialNoteContentField[]; summary: string } {
  const changes: FieldChange[] = [];

  for (const field of INITIAL_NOTE_CONTENT_FIELDS) {
    if (stableStringify(before[field]) === stableStringify(after[field])) {
      continue;
    }

    const wasEmpty = isEmptyValue(before[field]);
    const isNowEmpty = isEmptyValue(after[field]);
    changes.push({
      field,
      kind: wasEmpty ? 'added' : isNowEmpty ? 'cleared' : 'edited',
      detail: describeListDelta(field, before[field], after[field]),
    });
  }

  return {
    changedFields: changes.map((change) => change.field),
    summary: buildSummary(changes),
  };
}
