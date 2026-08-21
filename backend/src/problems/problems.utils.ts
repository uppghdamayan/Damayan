// ─────────────────────────────────────────────
// Normalizes a raw assessment/problemListSnapshot JSON array into the shape
// ProblemsService#upsertFromAssessment expects. Preserves whether each item
// explicitly carried a `parentId` key (even set to `null`, meaning "root")
// versus omitting it entirely (meaning "this entry carries no nesting info
// — leave existing nesting alone"), since upsertFromAssessment relies on
// that distinction via `hasOwnProperty` to stay backward-compatible with
// older snapshots that never carried nesting at all.
//
// Shared by both note modules: the Initial Note's `assessment` and the
// Progress Note's `problemListSnapshot` are structurally identical arrays,
// and both feed the same upsertFromAssessment contract on publish.
// ─────────────────────────────────────────────
export function mapAssessmentSnapshot(raw: any[] | null | undefined): {
  id?: string;
  tempId?: string;
  title: string;
  parentId?: string | null;
  diagnosisDate?: string | null;
  sortOrder: number;
}[] {
  return (raw || [])
    .filter((p) => p && p.title && String(p.title).trim() !== '')
    .map((p, index) => {
      const hasParentId = Object.prototype.hasOwnProperty.call(p, 'parentId');
      return {
        id: p.id ? String(p.id) : undefined,
        tempId: p.tempId ? String(p.tempId) : undefined,
        title: String(p.title).trim(),
        diagnosisDate: p.diagnosisDate ?? undefined,
        // Positional index in the published snapshot — the note's array
        // order is the clinician's reviewed order, and this is what lets
        // upsertFromAssessment write it back to the master Problem.sortOrder
        // so the master list, dashboard, and next note all agree on order.
        sortOrder: index,
        ...(hasParentId
          ? { parentId: p.parentId === null ? null : String(p.parentId) }
          : {}),
      };
    });
}
