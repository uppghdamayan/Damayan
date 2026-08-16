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
}[] {
  return (raw || [])
    .filter((p) => p && p.title && String(p.title).trim() !== '')
    .map((p) => {
      const hasParentId = Object.prototype.hasOwnProperty.call(p, 'parentId');
      return {
        id: p.id ? String(p.id) : undefined,
        tempId: p.tempId ? String(p.tempId) : undefined,
        title: String(p.title).trim(),
        diagnosisDate: p.diagnosisDate ?? undefined,
        ...(hasParentId
          ? { parentId: p.parentId === null ? null : String(p.parentId) }
          : {}),
      };
    });
}
