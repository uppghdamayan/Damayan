import type { Problem, ProblemNode } from '@/types/problem';

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

export function isRecentlyUpdated(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
}

export function mostRecentUpdate(problems: Problem[]): string | null {
  if (problems.length === 0) return null;
  return problems.reduce((latest, p) => (p.updatedAt > latest ? p.updatedAt : latest), problems[0].updatedAt);
}
