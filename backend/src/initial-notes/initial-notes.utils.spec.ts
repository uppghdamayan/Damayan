import { InitialNote } from '@prisma/client';
import {
  buildSnapshot,
  diffNoteFields,
  INITIAL_NOTE_CONTENT_FIELDS,
} from './initial-notes.utils';

function makeNote(overrides: Partial<InitialNote> = {}): InitialNote {
  return {
    id: 'note-1',
    visitId: 'visit-1',
    authorId: 'user-1',
    chiefComplaint: 'Headache',
    hpi: 'Two weeks of frontal headache.',
    pmhComorbidities: 'Hypertension',
    pmhSurgeries: null,
    pmhHospitalizations: null,
    allergies: null,
    familyHistory: null,
    socialHistory: null,
    obHistory: null,
    psychosocialHistory: null,
    physicalExam: 'Unremarkable.',
    assessment: [{ title: 'Migraine', icdCode: 'G43' }],
    medicationSnapshot: [{ name: 'Paracetamol', dose: '500' }],
    mgmtNonpharm: 'Hydration',
    diagnostics: ['CBC'],
    status: 'PUBLISHED',
    isDeleted: false,
    lastEditedBy: null,
    lastEditedAt: null,
    createdAt: new Date('2026-07-20T02:00:00Z'),
    updatedAt: new Date('2026-07-20T02:00:00Z'),
    ...overrides,
  } as InitialNote;
}

describe('initial-notes.utils', () => {
  describe('buildSnapshot', () => {
    it('captures every content field plus the status', () => {
      const snapshot = buildSnapshot(makeNote());

      for (const field of INITIAL_NOTE_CONTENT_FIELDS) {
        expect(snapshot).toHaveProperty(field);
      }
      expect(snapshot.status).toBe('PUBLISHED');
      expect(snapshot.chiefComplaint).toBe('Headache');
    });

    it('stores nulls rather than dropping unfilled fields', () => {
      const snapshot = buildSnapshot(makeNote({ allergies: null }));
      expect(snapshot.allergies).toBeNull();
    });

    it('does not capture identity or bookkeeping columns', () => {
      const snapshot = buildSnapshot(makeNote());
      expect(snapshot).not.toHaveProperty('id');
      expect(snapshot).not.toHaveProperty('visitId');
      expect(snapshot).not.toHaveProperty('authorId');
      expect(snapshot).not.toHaveProperty('lastEditedAt');
    });
  });

  describe('diffNoteFields', () => {
    it('reports no changes for an identical note', () => {
      const note = makeNote();
      const { changedFields, summary } = diffNoteFields(note, makeNote());
      expect(changedFields).toEqual([]);
      expect(summary).toBe('');
    });

    it('describes a single edited section in full words', () => {
      const { changedFields, summary } = diffNoteFields(
        makeNote(),
        makeNote({ hpi: 'Vertigo on standing.' }),
      );

      expect(changedFields).toEqual(['hpi']);
      expect(summary).toBe('Edited the History of Present Illness');
    });

    it('joins several edited sections into one clause', () => {
      const { changedFields, summary } = diffNoteFields(
        makeNote(),
        makeNote({
          chiefComplaint: 'Dizziness',
          physicalExam: 'Nystagmus noted.',
        }),
      );

      expect(changedFields).toEqual(['chiefComplaint', 'physicalExam']);
      expect(summary).toBe('Edited the Chief Complaint and Physical Exam');
    });

    it('distinguishes filling in a blank section from editing one', () => {
      const { summary } = diffNoteFields(
        makeNote({ allergies: null }),
        makeNote({
          allergies: 'Penicillin',
          hpi: 'Vertigo on standing.',
        }),
      );

      expect(summary).toBe(
        'Edited the History of Present Illness; added the Allergies',
      );
    });

    it('describes emptying a section as cleared', () => {
      const { summary } = diffNoteFields(
        makeNote({ mgmtNonpharm: 'Hydration' }),
        makeNote({ mgmtNonpharm: '' }),
      );

      expect(summary).toBe('Cleared the Non-pharmacologic Management');
    });

    it('names the items added to and removed from list sections', () => {
      const { changedFields, summary } = diffNoteFields(
        makeNote({
          assessment: [{ title: 'Migraine' }, { title: 'Anemia' }],
        }),
        makeNote({
          assessment: [{ title: 'Migraine' }, { title: 'Hypertension' }],
        }),
      );

      expect(changedFields).toEqual(['assessment']);
      expect(summary).toBe(
        'Edited the Assessment (added Hypertension, removed Anemia)',
      );
    });

    it('ignores whitespace-only and empty-vs-null differences', () => {
      const { changedFields } = diffNoteFields(
        makeNote({
          allergies: null,
          mgmtNonpharm: 'Hydration',
        }),
        makeNote({
          allergies: '',
          mgmtNonpharm: '  Hydration  ',
        }),
      );

      expect(changedFields).toEqual([]);
    });

    it('ignores object key ordering inside JSON fields', () => {
      const { changedFields } = diffNoteFields(
        makeNote({
          assessment: [{ title: 'Migraine', icdCode: 'G43' }],
        }),
        makeNote({
          assessment: [{ icdCode: 'G43', title: 'Migraine' }],
        }),
      );

      expect(changedFields).toEqual([]);
    });

    it('treats array order as significant — the assessment is an ordered list', () => {
      const { changedFields } = diffNoteFields(
        makeNote({
          assessment: [{ title: 'A' }, { title: 'B' }],
        }),
        makeNote({
          assessment: [{ title: 'B' }, { title: 'A' }],
        }),
      );

      expect(changedFields).toEqual(['assessment']);
    });
  });
});
