// ─────────────────────────────────────────────
// Progress-note localStorage draft keys — scoped per patient AND per note.
//
// Previously a single key (`damayan:draft:${patientId}:progress`) covered
// every progress note for a patient. Once note 4 was published, any residue
// left in that key (diagnostics, in-progress management text) got restored
// straight into note 5 the moment it was opened, since the restore logic in
// ProgressNoteForm only backfills a field when it's already falsy. Scoping
// the key by noteId (or 'new' for a not-yet-created draft) means a note can
// only ever restore its own leftover draft.
// ─────────────────────────────────────────────

const PREFIX = 'damayan:draft:';
const SUFFIX = ':progress';

export function progressDraftKey(patientId: string, noteId?: string | null): string {
  return `${PREFIX}${patientId}${SUFFIX}:${noteId ?? 'new'}`;
}

// Prefix-matches every progress-draft key for this patient, regardless of
// which note it belongs to — used where callers only need to know "is some
// progress-note edit in flight" (e.g. the master/note problem-edit mutual
// lock), not which specific note.
export function hasProgressDraft(patientId: string): boolean {
  const prefix = `${PREFIX}${patientId}${SUFFIX}:`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) return true;
  }
  return false;
}

// Removes every progress-draft key for this patient — called on publish/
// delete so no orphaned per-note key can bleed into a future note.
export function clearProgressDrafts(patientId: string): void {
  const prefix = `${PREFIX}${patientId}${SUFFIX}:`;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) toRemove.push(key);
  }
  toRemove.forEach((key) => localStorage.removeItem(key));
}
