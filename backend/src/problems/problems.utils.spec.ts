import { mapAssessmentSnapshot } from './problems.utils';

describe('mapAssessmentSnapshot', () => {
  it('omits parentId entirely when the raw item has no such key (legacy snapshot)', () => {
    const [item] = mapAssessmentSnapshot([{ title: 'Hypertension' }]);
    expect(item).not.toHaveProperty('parentId');
  });

  it('emits parentId: null when the raw item explicitly carries null (root)', () => {
    const [item] = mapAssessmentSnapshot([
      { title: 'Hypertension', parentId: null },
    ]);
    expect(item.parentId).toBeNull();
  });

  it('stringifies a non-null parentId', () => {
    const [item] = mapAssessmentSnapshot([
      { title: 'Proteinuria', parentId: 'ckd-1' },
    ]);
    expect(item.parentId).toBe('ckd-1');
  });

  it('collapses diagnosisDate: null to undefined so it never wipes an existing date', () => {
    const [item] = mapAssessmentSnapshot([
      { title: 'Hypertension', diagnosisDate: null },
    ]);
    expect(item.diagnosisDate).toBeUndefined();
  });

  it('preserves a real diagnosisDate string', () => {
    const [item] = mapAssessmentSnapshot([
      { title: 'Hypertension', diagnosisDate: '2023-05-10' },
    ]);
    expect(item.diagnosisDate).toBe('2023-05-10');
  });

  it('preserves id and tempId', () => {
    const [item] = mapAssessmentSnapshot([
      { id: 'p1', tempId: 't1', title: 'CKD' },
    ]);
    expect(item.id).toBe('p1');
    expect(item.tempId).toBe('t1');
  });

  it('drops items with a blank or whitespace-only title', () => {
    const items = mapAssessmentSnapshot([
      { title: '' },
      { title: '   ' },
      { title: 'Valid' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Valid');
  });

  it('trims titles', () => {
    const [item] = mapAssessmentSnapshot([{ title: '  Hypertension  ' }]);
    expect(item.title).toBe('Hypertension');
  });

  it('returns an empty array for null/undefined input', () => {
    expect(mapAssessmentSnapshot(null)).toEqual([]);
    expect(mapAssessmentSnapshot(undefined)).toEqual([]);
  });
});
