import { flattenProblemTree } from './problem-tree.util';

interface P {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

const p = (id: string, parentId: string | null, sortOrder: number): P => ({
  id,
  parentId,
  sortOrder,
});

describe('flattenProblemTree', () => {
  it('orders siblings by sortOrder ascending', () => {
    const input = [p('b', null, 2), p('a', null, 1), p('c', null, 3)];
    const result = flattenProblemTree(input);
    expect(result.map((r) => r.problem.id)).toEqual(['a', 'b', 'c']);
    expect(result.every((r) => r.depth === 0)).toBe(true);
  });

  it('nests children under their parent with increasing depth (DFS)', () => {
    const input = [
      p('root', null, 1),
      p('child2', 'root', 2),
      p('child1', 'root', 1),
      p('grandchild', 'child1', 1),
    ];
    const result = flattenProblemTree(input);
    expect(result.map((r) => ({ id: r.problem.id, depth: r.depth }))).toEqual([
      { id: 'root', depth: 0 },
      { id: 'child1', depth: 1 },
      { id: 'grandchild', depth: 2 },
      { id: 'child2', depth: 1 },
    ]);
  });

  it('falls back an orphaned child (parent not present in input) to root', () => {
    // e.g. an ACTIVE child whose parent is RESOLVED and was excluded upstream
    const input = [p('root', null, 1), p('orphan', 'missing-parent', 1)];
    const result = flattenProblemTree(input);
    expect(result).toHaveLength(2);
    const orphan = result.find((r) => r.problem.id === 'orphan');
    expect(orphan?.depth).toBe(0);
  });
});
