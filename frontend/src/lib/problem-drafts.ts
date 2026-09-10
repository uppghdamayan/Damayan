// ─────────────────────────────────────────────
// Problem List localStorage draft key — scoped per patient. Holds the
// in-progress, unpublished edit (order/nesting/titles/dates/statuses) made
// on ProblemListScreen while a note draft is open. See note-drafts.ts for
// the equivalent per-note-field pattern.
//
// Deleting the note that the draft was made alongside must also clear this
// key — otherwise the draft's nesting/order (which describes a note that no
// longer exists) gets silently restored over the server's post-delete
// revert the next time the screen mounts.
// ─────────────────────────────────────────────

export function problemDraftKey(patientId: string): string {
  return `damayan_problem_draft_${patientId}`;
}

export function clearProblemDraft(patientId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  localStorage.removeItem(problemDraftKey(patientId));
}
