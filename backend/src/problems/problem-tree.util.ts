export interface FlatProblem<T> {
  problem: T;
  depth: number;
}

/**
 * DFS-flatten a flat, sortOrder-ordered Problem list into parent-then-children
 * order with a computed depth — server-side mirror of the frontend's
 * buildProblemTree (frontend/src/lib/problem-utils.ts) + DFS traversal, so
 * document generation nests assessments identically to the Problem List and
 * the Progress Note assessment.
 *
 * A child is nested under its parent only if that parent is present in the
 * input array — e.g. an ACTIVE child of a RESOLVED parent (which
 * findActiveForPatient excludes) falls back to root rather than vanishing.
 * Roots and each sibling group are sorted by sortOrder ascending.
 */
export function flattenProblemTree<
  T extends { id: string; parentId: string | null; sortOrder: number },
>(problems: T[]): FlatProblem<T>[] {
  const byId = new Map(problems.map((p) => [p.id, p]));
  const childrenByParent = new Map<string, T[]>();
  const roots: T[] = [];

  problems.forEach((p) => {
    if (p.parentId && byId.has(p.parentId)) {
      const siblings = childrenByParent.get(p.parentId) ?? [];
      siblings.push(p);
      childrenByParent.set(p.parentId, siblings);
    } else {
      roots.push(p);
    }
  });

  const bySortOrder = (a: T, b: T) => a.sortOrder - b.sortOrder;
  roots.sort(bySortOrder);
  childrenByParent.forEach((siblings) => siblings.sort(bySortOrder));

  const result: FlatProblem<T>[] = [];
  const traverse = (nodes: T[], depth: number) => {
    nodes.forEach((node) => {
      result.push({ problem: node, depth });
      const children = childrenByParent.get(node.id);
      if (children) traverse(children, depth + 1);
    });
  };
  traverse(roots, 0);

  return result;
}
