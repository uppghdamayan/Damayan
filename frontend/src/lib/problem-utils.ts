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
