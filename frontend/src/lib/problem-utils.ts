import { arrayMove } from '@dnd-kit/sortable';
import type { Problem, ProblemNode, ProblemStatusValue } from '@/types/problem';

type Creator = { firstName: string; lastName: string; role: string } | null | undefined;

// Shared display-name formatting for "who added/edited this problem" —
// previously triplicated across ActiveProblemTable, ResolvedProblemTable and
// ProblemListScreen.
export function getCreatorName(user: Creator): string {
  if (!user) return 'System';
  if (user.role === 'DOCTOR') return `Dr. ${user.lastName}`;
  if (user.role === 'NURSE') return `Nurse ${user.lastName}`;
  return `${user.firstName} ${user.lastName}`;
}

// Eligible "Nest Under" targets for a given problem: must be ACTIVE, not the
// problem itself, and not one of its own descendants (which would create a
// cycle). Shared by ActiveProblemTable's row select, ProblemEditModal, and
// the Progress Note's Assessment editor.
export function getSelectableParents(allOptions: Problem[], excludeId?: string | null): Problem[] {
  return allOptions.filter((p) => {
    if (p.status !== 'ACTIVE') return false;
    if (!excludeId) return true;
    if (p.id === excludeId) return false;
    if (isDescendant(allOptions, p.id, excludeId)) return false;
    return true;
  });
}

export function buildProblemTree(problems: Problem[]): ProblemNode[] {
  const map = new Map<string, ProblemNode>(problems.map((p) => [p.id, { ...p, children: [] }]));
  const roots: ProblemNode[] = [];

  map.forEach((node) => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const bySortOrder = (a: ProblemNode, b: ProblemNode) => a.sortOrder - b.sortOrder;
  map.forEach((node) => node.children.sort(bySortOrder));
  roots.sort(bySortOrder);

  return roots;
}

export function isDescendant(problems: Problem[], potentialDescendantId: string, ancestorId: string): boolean {
  if (potentialDescendantId === ancestorId) return true;
  const descendant = problems.find(p => p.id === potentialDescendantId);
  if (!descendant || !descendant.parentId) return false;
  return isDescendant(problems, descendant.parentId, ancestorId);
}

// Derives, for every problem, the parent it should visually sit under once a
// set of *staged but unpublished* status changes is taken into account — a
// pure re-implementation of the master Problem List's server-side "Business
// rule 5" (problems.service.ts update(): when a problem goes non-ACTIVE, its
// first surviving ACTIVE child is promoted into its slot and any remaining
// children are re-parented under that heir). Recomputed fresh from `problems`
// + the two callbacks on every render (see ProblemListScreen's
// draftActiveProblems/effectiveParents), so undoing a staged removal/resolve
// — by deleting its entry from draftStatuses — automatically restores the
// original tree with no separate undo bookkeeping. This replaces the old
// mutation-based mirrorPromotionInDraft, which wrote directly into
// draftParents and so had no way to be undone.
export function applyStagedPromotions(
  problems: Problem[],
  effectiveStatus: (p: Problem) => ProblemStatusValue,
  baseParentOf: (p: Problem) => string | null,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  problems.forEach((p) => {
    result[p.id] = baseParentOf(p);
  });

  // Iterate to a fixed point — promoting a heir can itself need promoting if
  // its new parent (the original problem's parent) is also non-ACTIVE, or a
  // chain of several non-ACTIVE ancestors is staged in the same draft.
  // Bounded by problems.length so a data cycle can't hang the render.
  for (let iteration = 0; iteration < problems.length + 1; iteration++) {
    let changed = false;
    problems.forEach((inactiveCandidate) => {
      if (effectiveStatus(inactiveCandidate) === 'ACTIVE') return;
      const children = problems
        .filter(
          (c) =>
            c.id !== inactiveCandidate.id &&
            effectiveStatus(c) === 'ACTIVE' &&
            result[c.id] === inactiveCandidate.id,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder);
      if (children.length === 0) return;

      const [heir, ...rest] = children;
      const heirsNewParent = result[inactiveCandidate.id];
      if (result[heir.id] !== heirsNewParent) {
        result[heir.id] = heirsNewParent;
        changed = true;
      }
      rest.forEach((sibling) => {
        if (result[sibling.id] !== heir.id) {
          result[sibling.id] = heir.id;
          changed = true;
        }
      });
    });
    if (!changed) break;
  }

  return result;
}

export function isRecentlyUpdated(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
}

export function mostRecentUpdate(problems: Problem[]): string | null {
  if (problems.length === 0) return null;
  return problems.reduce((latest, p) => (p.updatedAt > latest ? p.updatedAt : latest), problems[0].updatedAt);
}

// ─────────────────────────────────────────────
// Shared shape/helpers for a note's assessment list — a simplified projection
// of a master Problem, plus session-only bookkeeping (`isNew`, `tempId`) that
// never survives a save. Used by both the Initial Note and Progress Note
// Assessment editors/read-only cards, so nesting renders identically in both
// places whether the note is being edited or replayed from a frozen snapshot.
// ─────────────────────────────────────────────
export interface NoteAssessmentItem {
  id?: string;
  tempId?: string;
  title: string;
  parentId?: string | null;
  depth?: number;
  isNew?: boolean;
  diagnosisDate?: string | null;
}

// A snapshot item's own identity for parent/descendant matching — its real
// Problem.id once it has one, else its client-generated tempId. Items with
// neither (shouldn't normally happen) can't be nested under or resolved.
export function assessmentItemKey(item: NoteAssessmentItem): string | undefined {
  return item.id || item.tempId;
}

export function formatDiagnosisDate(d: string | null | undefined): string {
  if (!d) return '--';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface FlatAssessmentItem {
  item: NoteAssessmentItem;
  key: string;
  depth: number;
  originalIndex: number;
}

type KeyedAssessmentItem = { item: NoteAssessmentItem; originalIndex: number; key: string };

// Shared indexing pass behind buildAssessmentFlatOrder/effectiveParentKey/
// reorderAssessmentSibling — assigns each item its display key (real id/
// tempId, or a positional fallback for identity-less legacy rows) and groups
// items into parent -> ordered-children buckets (sibling order = array
// order), plus the root bucket for items with no resolvable parent.
function buildAssessmentIndex(items: NoteAssessmentItem[]) {
  const withKeys: KeyedAssessmentItem[] = items.map((item, originalIndex) => ({
    item,
    originalIndex,
    key: assessmentItemKey(item) || `__idx_${originalIndex}`,
  }));
  const byKey = new Map(withKeys.map((w) => [w.key, w]));
  const childrenByParent = new Map<string, KeyedAssessmentItem[]>();
  const roots: KeyedAssessmentItem[] = [];

  withKeys.forEach((w) => {
    const parentKey = w.item.parentId || undefined;
    if (parentKey && byKey.has(parentKey) && parentKey !== w.key) {
      const arr = childrenByParent.get(parentKey) || [];
      arr.push(w);
      childrenByParent.set(parentKey, arr);
    } else {
      roots.push(w);
    }
  });

  return { withKeys, byKey, childrenByParent, roots };
}

// Flattens an assessment list into tree (parent-then-children) order —
// identical in spirit to the Master Problem List's buildProblemTree + DFS
// flatten — so a row visually sits right under its parent based on parentId,
// instead of staying wherever it was first added. Sibling order otherwise
// follows array order; items whose parentId points nowhere resolvable fall
// back to root.
export function buildAssessmentFlatOrder(items: NoteAssessmentItem[]): FlatAssessmentItem[] {
  const { roots, childrenByParent } = buildAssessmentIndex(items);

  const result: FlatAssessmentItem[] = [];
  const traverse = (nodes: KeyedAssessmentItem[], depth: number) => {
    nodes.forEach((n) => {
      result.push({ item: n.item, key: n.key, depth, originalIndex: n.originalIndex });
      const kids = childrenByParent.get(n.key);
      if (kids) traverse(kids, depth + 1);
    });
  };
  traverse(roots, 0);
  return result;
}

// A given item's resolved parent key — `null` for a root item, whether that's
// because it truly has no parentId or because its parentId points nowhere
// resolvable (the same fallback-to-root rule buildAssessmentFlatOrder
// applies). Two items with different-but-both-dead parentIds must still
// count as siblings, so this is what sibling-only reordering compares —
// never raw item.parentId.
export function effectiveParentKey(items: NoteAssessmentItem[], key: string): string | null {
  const { byKey, roots } = buildAssessmentIndex(items);
  if (roots.some((w) => w.key === key)) return null;
  const parentKey = byKey.get(key)?.item.parentId;
  return parentKey && byKey.has(parentKey) ? parentKey : null;
}

// Removes the item at `index`, but instead of leaving its children dangling
// (which buildAssessmentFlatOrder would silently flatten to root), promotes
// its first child into the removed item's slot — same effective parent — and
// re-parents the remaining former siblings under that heir. Mirrors the
// master Problem List's "Business rule 5" promotion in problems.service.ts
// so a note's assessment tree and the master list never disagree about what
// happens to a deleted parent's children.
export function removeAssessmentItemWithPromotion(
  items: NoteAssessmentItem[],
  index: number,
): NoteAssessmentItem[] {
  const removed = items[index];
  if (!removed) return items;

  const { withKeys, childrenByParent } = buildAssessmentIndex(items);
  const removedEntry = withKeys[index];
  const removedKey = removedEntry.key;
  const removedParentKey = effectiveParentKey(items, removedKey);
  const kids = childrenByParent.get(removedKey);

  const next = items.slice();
  next.splice(index, 1);

  if (kids && kids.length > 0) {
    const [heir, ...rest] = kids;
    const byOriginalIndex = new Map(next.map((it, i) => [it, i]));
    const heirIdx = byOriginalIndex.get(heir.item);
    if (heirIdx !== undefined) {
      next[heirIdx] = { ...heir.item, parentId: removedParentKey ?? null };
    }
    rest.forEach((sibling) => {
      const idx = byOriginalIndex.get(sibling.item);
      if (idx !== undefined) {
        next[idx] = { ...sibling.item, parentId: heir.key };
      }
    });
  }

  // Re-flatten to DFS display order (array index == display index) and
  // re-stamp depth — the promoted subtree genuinely changed level, so it
  // should be flagged as modified in the Initial Note's version diff.
  const flat = buildAssessmentFlatOrder(next);
  return flat.map(({ item, depth }) => ({ ...item, depth }));
}

// Moves `activeKey` to the position currently held by `overKey`, but only
// when they're siblings (same effectiveParentKey) — dragging across levels
// is refused (returns null; caller should no-op) so a note-local reorder can
// never be misread as a re-nest, which is the only one of the two that
// writes back to the shared master Problem.parentId on publish. The
// returned array is normalised to DFS display order (array index == display
// index), which is what lets the reordered position survive a save/reload
// even for a host (the Initial Note) that submits the raw array with no
// re-flatten of its own. Does not touch `depth` — a same-level reorder never
// changes it, and re-stamping would falsely mark untouched rows as modified
// in the Initial Note's version diff.
export function reorderAssessmentSibling(
  items: NoteAssessmentItem[],
  activeKey: string,
  overKey: string,
): NoteAssessmentItem[] | null {
  if (activeKey === overKey) return null;
  const activeParent = effectiveParentKey(items, activeKey);
  const overParent = effectiveParentKey(items, overKey);
  if (activeParent !== overParent) return null;

  const { roots, childrenByParent } = buildAssessmentIndex(items);
  const group = activeParent === null ? roots : childrenByParent.get(activeParent);
  if (!group) return null;

  const oldIndex = group.findIndex((w) => w.key === activeKey);
  const newIndex = group.findIndex((w) => w.key === overKey);
  if (oldIndex === -1 || newIndex === -1) return null;

  const moved = arrayMove(group, oldIndex, newIndex);
  if (activeParent === null) {
    roots.splice(0, roots.length, ...moved);
  } else {
    childrenByParent.set(activeParent, moved);
  }

  const result: NoteAssessmentItem[] = [];
  const traverse = (nodes: KeyedAssessmentItem[]) => {
    nodes.forEach((n) => {
      result.push(n.item);
      const kids = childrenByParent.get(n.key);
      if (kids) traverse(kids);
    });
  };
  traverse(roots);
  return result;
}
