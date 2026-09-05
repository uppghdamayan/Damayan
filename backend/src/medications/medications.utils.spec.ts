import { resolveMedicationMatches } from './medications.utils';

function row(overrides: Partial<{
  id: string;
  name: string;
  dose: string | null;
  isActive: boolean;
}> = {}) {
  return {
    id: 'row-1',
    name: 'Amlodipine',
    dose: '10 mg',
    isActive: true,
    ...overrides,
  };
}

describe('resolveMedicationMatches', () => {
  it('1:1 — exact name+dose match on an active row is claimed in pass 1', () => {
    const existing = [row()];
    const items = [{ name: 'Amlodipine', dose: '10 mg' }];

    const result = resolveMedicationMatches(existing, items);

    expect(result.exact.get(0)).toBe('row-1');
    expect(result.doseChange.size).toBe(0);
    expect(result.creates).toEqual([]);
    expect(result.claimedIds).toEqual(new Set(['row-1']));
  });

  it('1:1 — same name, different dose, one active row is an unambiguous dose change', () => {
    const existing = [row({ dose: '10 mg' })];
    const items = [{ name: 'Amlodipine', dose: '5 mg' }];

    const result = resolveMedicationMatches(existing, items);

    expect(result.exact.size).toBe(0);
    expect(result.doseChange.get(0)).toBe('row-1');
    expect(result.creates).toEqual([]);
  });

  it('0:1 — no existing row at all is a create', () => {
    const existing: ReturnType<typeof row>[] = [];
    const items = [{ name: 'Amlodipine', dose: '10 mg' }];

    const result = resolveMedicationMatches(existing, items);

    expect(result.exact.size).toBe(0);
    expect(result.doseChange.size).toBe(0);
    expect(result.creates).toEqual([0]);
  });

  it('1:0 — an existing row with no matching item is left unclaimed (caller deactivates it)', () => {
    const existing = [row({ id: 'row-1' })];
    const items: { name: string; dose: string }[] = [];

    const result = resolveMedicationMatches(existing, items);

    expect(result.claimedIds.size).toBe(0);
  });

  it('2:1 — two items for one same-name active row is ambiguous: both create', () => {
    const existing = [row({ id: 'row-1', dose: '25 mg' })];
    const items = [
      { name: 'Amlodipine', dose: '12.5 mg' },
      { name: 'Amlodipine', dose: '25 mg BID' },
    ];

    const result = resolveMedicationMatches(existing, items);

    expect(result.doseChange.size).toBe(0);
    expect(result.creates.sort()).toEqual([0, 1]);
    expect(result.claimedIds.size).toBe(0);
  });

  it('1:2 — one item, two same-name active rows both changing is ambiguous: create, both left unclaimed', () => {
    const existing = [
      row({ id: 'row-1', dose: '25 mg' }),
      row({ id: 'row-2', dose: '50 mg' }),
    ];
    const items = [{ name: 'Amlodipine', dose: '75 mg' }];

    const result = resolveMedicationMatches(existing, items);

    expect(result.doseChange.size).toBe(0);
    expect(result.creates).toEqual([0]);
    expect(result.claimedIds.size).toBe(0);
  });

  it('2:2 — two same-name active rows, one unchanged + one changed, resolves via pass 1 then pass 2', () => {
    const existing = [
      row({ id: 'row-1', dose: '25 mg' }),
      row({ id: 'row-2', dose: '50 mg' }),
    ];
    const items = [
      { name: 'Amlodipine', dose: '25 mg' },
      { name: 'Amlodipine', dose: '75 mg' },
    ];

    const result = resolveMedicationMatches(existing, items);

    expect(result.exact.get(0)).toBe('row-1');
    expect(result.doseChange.get(1)).toBe('row-2');
    expect(result.creates).toEqual([]);
    expect(result.claimedIds).toEqual(new Set(['row-1', 'row-2']));
  });

  it('2:2 — both same-name active rows change dose is fully ambiguous: both create, nothing claimed', () => {
    const existing = [
      row({ id: 'row-1', dose: '25 mg' }),
      row({ id: 'row-2', dose: '50 mg' }),
    ];
    const items = [
      { name: 'Amlodipine', dose: '12.5 mg' },
      { name: 'Amlodipine', dose: '75 mg' },
    ];

    const result = resolveMedicationMatches(existing, items);

    expect(result.doseChange.size).toBe(0);
    expect(result.creates.sort()).toEqual([0, 1]);
    expect(result.claimedIds.size).toBe(0);
  });

  it('prefers an active exact match over an inactive one with the same name+dose', () => {
    const existing = [
      row({ id: 'row-1', isActive: false }),
      row({ id: 'row-2', isActive: true }),
    ];
    const items = [{ name: 'Amlodipine', dose: '10 mg' }];

    const result = resolveMedicationMatches(existing, items);

    expect(result.exact.get(0)).toBe('row-2');
  });

  it('falls back to an inactive exact match (reactivation) when no active row matches', () => {
    const existing = [row({ id: 'row-1', isActive: false })];
    const items = [{ name: 'Amlodipine', dose: '10 mg' }];

    const result = resolveMedicationMatches(existing, items);

    expect(result.exact.get(0)).toBe('row-1');
  });

  it('never claims an inactive row as a dose-change candidate', () => {
    const existing = [row({ id: 'row-1', dose: '10 mg', isActive: false })];
    const items = [{ name: 'Amlodipine', dose: '5 mg' }];

    const result = resolveMedicationMatches(existing, items);

    expect(result.doseChange.size).toBe(0);
    expect(result.creates).toEqual([0]);
    expect(result.claimedIds.size).toBe(0);
  });

  it('matching is one-to-one: an identical duplicate item does not double-claim the same row', () => {
    const existing = [row({ id: 'row-1' })];
    const items = [
      { name: 'Amlodipine', dose: '10 mg' },
      { name: 'Amlodipine', dose: '10 mg' },
    ];

    const result = resolveMedicationMatches(existing, items);

    expect(result.exact.get(0)).toBe('row-1');
    expect(result.exact.has(1)).toBe(false);
    expect(result.creates).toEqual([1]);
  });
});
