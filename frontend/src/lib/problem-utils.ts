import type { Problem, ProblemNode } from '@/types/problem';

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

// Flattens an assessment list into tree (parent-then-children) order —
// identical in spirit to the Master Problem List's buildProblemTree + DFS
// flatten — so a row visually sits right under its parent based on parentId,
// instead of staying wherever it was first added. Sibling order otherwise
// follows array order; items whose parentId points nowhere resolvable fall
// back to root.
export function buildAssessmentFlatOrder(items: NoteAssessmentItem[]): FlatAssessmentItem[] {
  const withKeys = items.map((item, originalIndex) => ({
    item,
    originalIndex,
    key: assessmentItemKey(item) || `__idx_${originalIndex}`,
  }));
  const byKey = new Map(withKeys.map((w) => [w.key, w]));
  const childrenByParent = new Map<string, typeof withKeys>();
  const roots: typeof withKeys = [];

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

  const result: FlatAssessmentItem[] = [];
  const traverse = (nodes: typeof withKeys, depth: number) => {
    nodes.forEach((n) => {
      result.push({ item: n.item, key: n.key, depth, originalIndex: n.originalIndex });
      const kids = childrenByParent.get(n.key);
      if (kids) traverse(kids, depth + 1);
    });
  };
  traverse(roots, 0);
  return result;
}
