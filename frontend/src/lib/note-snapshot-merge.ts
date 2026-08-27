import { buildProblemTree } from '@/lib/problem-utils';

/**
 * Shared merge logic for a progress note draft's `problemListSnapshot` /
 * `medicationSnapshot` against the patient's live master Problem List /
 * Medication List. Originally lived inline in ProgressNoteForm (the editor);
 * extracted so NoteTimeline can run the identical merge to keep a draft's
 * timeline entry 1:1 with what the editor shows. See notes-utils.ts's
 * mapNoteToTimelineView for the timeline side of that.
 */

/**
 * Flattens the active Problem List into DFS (parent-then-children) order,
 * pairing each problem with its nesting depth. Shared by the editor's
 * fresh-note seed and the timeline's equivalent seed for a snapshot-less
 * draft.
 */
export function flattenActiveProblemTree(
  activeProblems: any[],
): { problem: any; depth: number }[] {
  const tree = buildProblemTree(activeProblems || []);
  const list: { problem: any; depth: number }[] = [];
  const traverse = (nodes: any[], depth: number) => {
    nodes.forEach((node) => {
      list.push({ problem: node, depth });
      traverse(node.children || [], depth + 1);
    });
  };
  traverse(tree, 0);
  return list;
}

/**
 * Merges a draft's stored problem snapshot with the live active Problem
 * List: drops snapshot entries tied to a Problem that's no longer active,
 * adds active problems missing from the snapshot, and re-sorts into the
 * master list's own order — all while preserving in-note edits (title,
 * nesting, diagnosis date) already captured in the snapshot. See the
 * inline comments for the full reasoning; this is a verbatim extraction
 * from ProgressNoteForm.tsx, no behavior change.
 */
export function mergeActiveProblems(
  existingProblems: any[],
  activeProblems: any[],
): any[] {
  const flatActive = flattenActiveProblemTree(activeProblems);

  const activeIds = new Set(
    flatActive.map(({ problem }) => problem.id).filter(Boolean),
  );
  const activeTitles = new Set(
    flatActive.map(({ problem }) => problem.title?.trim().toLowerCase()).filter(Boolean),
  );
  // Drop any snapshot entry that is tied to a master Problem (has an id)
  // which is no longer in the active list — resolved or removed via the
  // Problem List module (or a prior note). Without this, a draft note's
  // snapshot only ever grows: a problem deleted from the Master Problem
  // List stayed "stuck" in every open progress note forever.
  //
  // Id-less entries need their own rule: entries the clinician typed fresh
  // in this note (`isNew`) are always kept — the Problem List has no say
  // over them yet. But id-less entries that AREN'T `isNew` are leftover
  // snapshots saved before ids were tracked on assessment items at all
  // (localStorage drafts, older DB drafts). Those are only trustworthy if
  // their title still matches something currently active; otherwise
  // they're exactly the kind of stale, disconnected entry this is meant to
  // clear (a resolved/removed/renamed problem whose old snapshot lacks the
  // id needed to detect that directly).
  const existing = existingProblems.filter((p: any) => {
    if (!p || typeof p !== 'object') return true;
    if (p.id) return activeIds.has(p.id);
    if (p.isNew || !p.id) return true;
    const title = p.title?.trim().toLowerCase();
    return !!title && activeTitles.has(title);
  });

  // Match by stable Problem.id first — falling back to title text only for
  // legacy/id-less entries. Matching by title alone means a title edited
  // elsewhere (Problem List module) or in-note no longer matches its own
  // prior snapshot entry, so both the stale and the fresh title get kept,
  // producing a visible duplicate before the note is even published.
  const existingById = new Map<string, number>();
  const existingTitles = new Map<string, number>();
  existing.forEach((p: any, idx: number) => {
    if (p && typeof p === 'object' && p.id) existingById.set(p.id, idx);
    const title = (typeof p === 'string' ? p : p?.title)?.trim().toLowerCase();
    if (title) existingTitles.set(title, idx);
  });

  for (const item of flatActive) {
    const p = item.problem;
    if (!p.title) continue;
    const titleKey = p.title.trim().toLowerCase();

    const matchIdx = (p.id && existingById.has(p.id))
      ? existingById.get(p.id)!
      : existingTitles.has(titleKey)
        ? existingTitles.get(titleKey)!
        : undefined;

    if (matchIdx !== undefined) {
      // Same problem, possibly renamed/re-nested since this snapshot was
      // taken (id match), or a legacy id-less entry now healed with its id
      // (title match) — sync in place instead of adding a second entry.
      //
      // Preserve only the in-note title edit already captured in the
      // snapshot, so a background activeProblems refetch never reverts a
      // rename the user is drafting. Nesting (parentId) and depth are NOT
      // preserved: nesting can only be changed in-note via the locked
      // NoteProblemListEditor edit mode, which bypasses this merge entirely
      // (see the isProblemEditMode branches around this function's callers)
      // — so outside that mode, a stale parentId here is never a deliberate
      // in-note customization, only leftover from an earlier merge. Always
      // take the live value, exactly like depth already does, or a nesting
      // change made in the Problem List module never reaches an
      // already-snapshotted entry.
      const prev = existing[matchIdx];
      existing[matchIdx] = {
        ...(typeof prev === 'object' ? prev : {}),
        id: p.id,
        title: (typeof prev === 'object' && prev.title) ? prev.title : p.title,
        parentId: p.parentId || undefined,
        depth: item.depth,
        diagnosisDate: (typeof prev === 'object' && prev.diagnosisDate) ? prev.diagnosisDate : (p.diagnosisDate || null),
      };
      continue;
    }

    // Not found in existing — this problem was added to the Master List
    // since the snapshot was last updated. Add it now.
    existing.push({
      id: p.id || undefined,
      title: p.title,
      parentId: p.parentId || undefined,
      depth: item.depth,
      diagnosisDate: p.diagnosisDate || null,
    });
  }

  // Re-sort into the master list's own order (Problem.sortOrder via
  // buildProblemTree's DFS) so a reorder published in the Problem List
  // module — even while this note was already open as a draft — is
  // reflected here instead of staying frozen in whatever order the
  // snapshot array happened to have. Id-less rows (isNew, or legacy
  // entries that never got healed with an id) have no master rank to
  // compare against — they sort after every ranked row, keeping their
  // existing relative order among themselves.
  const orderRank = new Map<string, number>();
  flatActive.forEach(({ problem }, idx) => {
    if (problem.id) orderRank.set(problem.id, idx);
  });
  const withRank = existing.map((item: any, originalIndex: number) => ({
    item,
    originalIndex,
    rank: item?.id && orderRank.has(item.id) ? orderRank.get(item.id)! : Number.MAX_SAFE_INTEGER,
  }));
  withRank.sort((a, b) => a.rank - b.rank || a.originalIndex - b.originalIndex);
  return withRank.map((w) => w.item);
}

/**
 * Merges a draft's stored medication snapshot with the live active
 * Medication List: drops discontinued/no-longer-active entries (and any
 * `source: 'past'` entry — publish discards those too, so carrying them in
 * a draft was never meaningful), resyncs dose/formulation/quantity/
 * instructions from the live medication, appends newly active meds, and
 * skips names the clinician explicitly discontinued in this note
 * (`removedNames`, sourced from ProgressNoteForm's `removedMedNamesRef` —
 * `undefined`/omitted behaves as an empty set, which is what the timeline
 * uses since it has no visibility into that in-note-only state).
 *
 * Entries are projected to the editor's `NoteMedicationItem` shape
 * (name/dose/formulation/quantity/instructions/isNew/fromPast) rather than
 * spread verbatim, so a legacy `unit`/`source` field never survives the
 * merge — `unit` is folded into `dose` instead.
 */
export function mergeActiveMedications(
  existingMeds: any[],
  activeMedications: any[],
  removedNames?: Set<string>,
): any[] {
  const activeByName = new Map(
    (activeMedications || [])
      .filter((m: any) => m.name?.trim())
      .map((m: any) => [m.name.trim().toLowerCase(), m]),
  );
  const activeNames = new Set(activeByName.keys());

  const existing = existingMeds
    .filter((m: any) => {
      if (!m || typeof m !== 'object') return true;
      if (m.isNew) return true;
      const name = (typeof m === 'string' ? m : m.name)?.trim().toLowerCase();
      // A discontinuation only ever clears the entry OUT of form state at
      // the moment it's clicked (ProgressNoteForm's
      // handleMedicationSnapshotChange). If `existingMeds` here is instead
      // a source that still carries the old entry — most commonly the
      // persisted `note.medicationSnapshot` re-read on a hydration re-run
      // outside edit mode (exiting edit mode, a background invalidation,
      // reopening the note) before that discontinuation was ever saved —
      // the med is still ACTIVE on the master list, so it would otherwise
      // sail through this filter and resurrect. Drop it here too, not just
      // in the "add missing actives" step below, so a discontinuation
      // can't come back from a stale source.
      if (name && removedNames?.has(name)) return false;
      if (m.source === 'past') return false;
      return !!name && activeNames.has(name);
    })
    // A name match kept the *stale* snapshot entry — dose/formulation/
    // instructions/quantity edited on the medication itself (e.g. via the
    // Medications module) never made it in, since only brand-new names
    // were ever added below. Resync those fields from the live active
    // medication so a published dose change actually shows up here.
    .map((m: any) => {
      if (!m || typeof m !== 'object' || m.isNew) return m;
      const name = (typeof m === 'string' ? m : m.name)?.trim().toLowerCase();
      const live = name ? activeByName.get(name) : undefined;
      const dose = m.dose !== undefined ? m.dose : (live?.dose || undefined);
      const legacyUnit = (m as any).unit;
      return {
        name: typeof m === 'string' ? m : m.name,
        dose: legacyUnit ? [dose, legacyUnit].filter(Boolean).join(' ') : dose,
        formulation: m.formulation !== undefined ? m.formulation : (live?.formulation || undefined),
        quantity: m.quantity !== undefined ? m.quantity : (live?.quantity || undefined),
        instructions: m.instructions !== undefined ? m.instructions : (live?.instructions || undefined),
        isNew: m.isNew,
        fromPast: m.fromPast ?? live?.fromPast ?? false,
      };
    });

  const existingNames = new Set(
    existing.map((m: any) => (typeof m === 'string' ? m : m.name)?.trim().toLowerCase()).filter(Boolean)
  );

  for (const m of activeMedications || []) {
    const name = m.name?.trim().toLowerCase();
    if (!name) continue;
    if (removedNames?.has(name)) continue; // explicitly discontinued in this note — do not resurrect
    if (!existingNames.has(name)) {
      existing.push({
        name: m.name,
        dose: m.dose || undefined,
        formulation: m.formulation || undefined,
        quantity: m.quantity || undefined,
        instructions: m.instructions || undefined,
        fromPast: m.fromPast || false,
      });
    }
  }

  return existing;
}
