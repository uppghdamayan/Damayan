import { ProgressNotesService } from './progress-notes.service';

// resolveCarryForwardSource only touches `prisma.progressNote.findFirst` and
// `prisma.initialNote.findFirst` — the other injected services (visits,
// problems, medications, vitals, initial-notes, storage) are irrelevant to
// this method, so they're stubbed out rather than fully mocked.
function buildService(mocks: {
  progressNoteFindFirst: jest.Mock;
  initialNoteFindFirst: jest.Mock;
}) {
  const prisma = {
    progressNote: { findFirst: mocks.progressNoteFindFirst },
    initialNote: { findFirst: mocks.initialNoteFindFirst },
  };
  return new ProgressNotesService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

function progressNote(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'progress-default',
    mgmtNonpharm: 'nonpharm-default',
    mgmtPharm: 'pharm-default',
    diagnostics: ['diag-default'],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    visit: { visitDatetime: new Date('2026-01-01T00:00:00Z') },
    ...overrides,
  };
}

function initialNote(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'initial-default',
    mgmtNonpharm: 'initial-nonpharm',
    mgmtPharm: 'initial-pharm',
    diagnostics: ['initial-diag'],
    createdAt: new Date('2025-12-01T00:00:00Z'),
    visit: { visitDatetime: new Date('2025-12-01T00:00:00Z') },
    ...overrides,
  };
}

describe('ProgressNotesService.resolveCarryForwardSource', () => {
  it('resolves to the newest published progress note, not an older one', async () => {
    // Simulates "note 3 inherits from note 2, not note 1": the Prisma query
    // (mocked here) is the one that actually enforces ordering — this test
    // guards the resolver's *selection* between what findFirst returns for
    // progress vs. initial, given the DB has already ordered correctly.
    const note2 = progressNote({
      id: 'note-2',
      mgmtPharm: 'note-2-pharm',
      createdAt: new Date('2026-02-01T00:00:00Z'),
      visit: { visitDatetime: new Date('2026-02-01T00:00:00Z') },
    });
    const progressNoteFindFirst = jest.fn().mockResolvedValue(note2);
    const initialNoteFindFirst = jest.fn().mockResolvedValue(initialNote());

    const service = buildService({
      progressNoteFindFirst,
      initialNoteFindFirst,
    });

    const result = await service.resolveCarryForwardSource('patient-1');

    expect(result.sourceNoteId).toBe('note-2');
    expect(result.sourceKind).toBe('progress');
    expect(result.mgmtPharm).toBe('note-2-pharm');
  });

  it('excludes the note being edited, so a draft can never inherit from itself', async () => {
    // This is the reported bug: the author's own open draft (note 3) used to
    // be indistinguishable from "the latest note" and could resolve to
    // itself. excludeNoteId is what the caller uses to rule that out.
    const progressNoteFindFirst = jest.fn().mockImplementation(({ where }) => {
      const excluded = where?.id?.not;
      // Emulate Prisma actually applying the `id: { not }` filter.
      if (excluded === 'note-3') {
        return Promise.resolve(
          progressNote({ id: 'note-2', mgmtPharm: 'note-2-pharm' }),
        );
      }
      return Promise.resolve(progressNote({ id: 'note-3', mgmtPharm: '' }));
    });
    const initialNoteFindFirst = jest.fn().mockResolvedValue(initialNote());

    const service = buildService({
      progressNoteFindFirst,
      initialNoteFindFirst,
    });

    const result = await service.resolveCarryForwardSource(
      'patient-1',
      'note-3',
    );

    expect(result.sourceNoteId).toBe('note-2');
    expect(result.mgmtPharm).toBe('note-2-pharm');
    expect(progressNoteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'note-3' } }),
      }),
    );
  });

  it('prefers the latest published progress note even when the initial note has a later visit date', async () => {
    // The reported bug: an initial note's visitDatetime is arbitrary,
    // unvalidated client input and can be dated after every progress note.
    // Once any published progress note exists, it must always win — the
    // resolver no longer compares visit dates between the two note kinds.
    const progressNoteFindFirst = jest.fn().mockResolvedValue(
      progressNote({
        id: 'progress-earlier',
        mgmtPharm: 'progress-pharm',
        createdAt: new Date('2026-01-15T00:00:00Z'),
        visit: { visitDatetime: new Date('2026-01-15T00:00:00Z') },
      }),
    );
    const initialNoteFindFirst = jest.fn().mockResolvedValue(
      initialNote({
        id: 'initial-future-dated',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        visit: { visitDatetime: new Date('2026-06-01T00:00:00Z') },
      }),
    );

    const service = buildService({
      progressNoteFindFirst,
      initialNoteFindFirst,
    });

    const result = await service.resolveCarryForwardSource('patient-1');

    expect(result.sourceNoteId).toBe('progress-earlier');
    expect(result.sourceKind).toBe('progress');
    expect(result.mgmtPharm).toBe('progress-pharm');
  });

  it('returns a blank field as-is instead of walking back to an older note', async () => {
    const progressNoteFindFirst = jest
      .fn()
      .mockResolvedValue(progressNote({ id: 'note-latest', mgmtPharm: '' }));
    const initialNoteFindFirst = jest.fn().mockResolvedValue(initialNote());

    const service = buildService({
      progressNoteFindFirst,
      initialNoteFindFirst,
    });

    const result = await service.resolveCarryForwardSource('patient-1');

    expect(result.sourceNoteId).toBe('note-latest');
    expect(result.mgmtPharm).toBe('');
  });

  it('falls back to the published initial note when there are no progress notes', async () => {
    const progressNoteFindFirst = jest.fn().mockResolvedValue(null);
    const initialNoteFindFirst = jest.fn().mockResolvedValue(initialNote());

    const service = buildService({
      progressNoteFindFirst,
      initialNoteFindFirst,
    });

    const result = await service.resolveCarryForwardSource('patient-1');

    expect(result.sourceKind).toBe('initial');
    expect(result.sourceNoteId).toBe('initial-default');
  });

  it('returns an empty, sourceless result when nothing is published', async () => {
    const progressNoteFindFirst = jest.fn().mockResolvedValue(null);
    const initialNoteFindFirst = jest.fn().mockResolvedValue(null);

    const service = buildService({
      progressNoteFindFirst,
      initialNoteFindFirst,
    });

    const result = await service.resolveCarryForwardSource('patient-1');

    expect(result).toEqual({
      sourceNoteId: null,
      sourceKind: null,
      sourceVisitDatetime: null,
      mgmtNonpharm: '',
      mgmtPharm: '',
      medicationSnapshot: [],
    });
  });

  it('filters progress-note candidates to DOCTOR-authored or author-less notes', async () => {
    const progressNoteFindFirst = jest.fn().mockResolvedValue(null);
    const initialNoteFindFirst = jest.fn().mockResolvedValue(initialNote());

    const service = buildService({
      progressNoteFindFirst,
      initialNoteFindFirst,
    });

    await service.resolveCarryForwardSource('patient-1');

    // The DB does the actual role filtering — this asserts the resolver
    // sends the right filter (a NURSE/PHARMACIST-authored note must not be
    // eligible, matching the DOCTOR-or-null branch in publish()).
    expect(progressNoteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ author: { role: 'DOCTOR' } }, { authorId: null }],
        }),
      }),
    );
  });
});

describe('ProgressNotesService.reconcileMedicationSnapshot', () => {
  it('preserves newly added medications with isNew: true even if not active yet', async () => {
    const mockMedicationsService = {
      findActiveForPatient: jest.fn().mockResolvedValue([
        { name: 'Insulin Glargine', dose: '14 units' },
        { name: 'Amlodipine', dose: '10 mg' },
      ]),
    };

    const service = new ProgressNotesService(
      {} as any,
      {} as any,
      {} as any,
      mockMedicationsService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const snapshot = [
      { name: 'Insulin Glargine', dose: '14 units' },
      { name: 'Sodium Bicarbonate', dose: '650 mg', isNew: true },
      { name: 'Removed Drug', dose: '5 mg' },
    ];

    const result = await (service as any).reconcileMedicationSnapshot(
      'patient-1',
      snapshot,
      {} as any,
    );

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Insulin Glargine');
    expect(result[1].name).toBe('Sodium Bicarbonate');
    expect(result[1].isNew).toBe(true);
  });

  it('drops a non-isNew entry that is absent from the active medication list', async () => {
    const mockMedicationsService = {
      findActiveForPatient: jest
        .fn()
        .mockResolvedValue([{ name: 'Amlodipine', dose: '10 mg' }]),
    };

    const service = new ProgressNotesService(
      {} as any,
      {} as any,
      {} as any,
      mockMedicationsService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // Stale carried-over entry for a medication deleted concurrently on the
    // Master Medications List — not flagged isNew, so it must be dropped.
    const snapshot = [
      { name: 'Amlodipine', dose: '10 mg' },
      { name: 'Discontinued Drug', dose: '5 mg' },
    ];

    const result = await (service as any).reconcileMedicationSnapshot(
      'patient-1',
      snapshot,
      {} as any,
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Amlodipine');
  });

  it('matches on name only, so an in-note dose edit is not treated as a deletion', async () => {
    const mockMedicationsService = {
      findActiveForPatient: jest
        .fn()
        .mockResolvedValue([{ name: 'Amlodipine', dose: '10 mg' }]),
    };

    const service = new ProgressNotesService(
      {} as any,
      {} as any,
      {} as any,
      mockMedicationsService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // The clinician edited the dose within the note; the active record's
    // dose hasn't been updated yet (that only happens on publish). Matching
    // on name alone (not name+dose) must keep this entry, not treat the
    // dose mismatch as "no longer active" — but since this entry doesn't
    // carry `editedFields: ['dose']`, the live master dose still resyncs
    // over it (see the two tests below for the `editedFields` pin itself).
    const snapshot = [{ name: 'Amlodipine', dose: '5 mg' }];

    const result = await (service as any).reconcileMedicationSnapshot(
      'patient-1',
      snapshot,
      {} as any,
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Amlodipine');
  });

  it('resyncs dose/formulation/quantity/instructions from the live medication when editedFields is absent', async () => {
    const mockMedicationsService = {
      findActiveForPatient: jest.fn().mockResolvedValue([
        {
          name: 'Amlodipine',
          dose: '10 mg',
          formulation: 'Tablet',
          quantity: 30,
          instructions: 'Take 1 tab daily',
        },
      ]),
    };

    const service = new ProgressNotesService(
      {} as any,
      {} as any,
      {} as any,
      mockMedicationsService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // A stale entry left over from before a master-list dose edit was made
    // while this draft was open. No editedFields — nothing in this note
    // pins the old value, so the live master row must win.
    const snapshot = [{ name: 'Amlodipine', dose: '5 mg' }];

    const result = await (service as any).reconcileMedicationSnapshot(
      'patient-1',
      snapshot,
      {} as any,
    );

    expect(result).toHaveLength(1);
    expect(result[0].dose).toBe('10 mg');
    expect(result[0].formulation).toBe('Tablet');
    expect(result[0].quantity).toBe(30);
    expect(result[0].instructions).toBe('Take 1 tab daily');
  });

  it('leaves a field alone when it is listed in the entry\'s own editedFields', async () => {
    const mockMedicationsService = {
      findActiveForPatient: jest
        .fn()
        .mockResolvedValue([{ name: 'Amlodipine', dose: '10 mg' }]),
    };

    const service = new ProgressNotesService(
      {} as any,
      {} as any,
      {} as any,
      mockMedicationsService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // The clinician deliberately edited the dose via the in-note medication
    // edit modal, which records `editedFields: ['dose']` — that pin must
    // survive the resync even though it now disagrees with the live master.
    const snapshot = [
      { name: 'Amlodipine', dose: '5 mg', editedFields: ['dose'] },
    ];

    const result = await (service as any).reconcileMedicationSnapshot(
      'patient-1',
      snapshot,
      {} as any,
    );

    expect(result).toHaveLength(1);
    expect(result[0].dose).toBe('5 mg');
  });
});

describe('ProgressNotesService draft problem syncing & reverting', () => {
  it('syncs problems to master when a draft is created by a doctor', async () => {
    const mockProblemsService = {
      findActiveForPatient: jest.fn().mockResolvedValue([]),
      upsertFromAssessment: jest.fn().mockResolvedValue(new Map([['temp-1', 'prob-real-1']])),
    };
    const mockMedicationsService = {
      findActiveForPatient: jest.fn().mockResolvedValue([]),
    };
    const mockVitalsService = {
      findLatestForPatient: jest.fn().mockResolvedValue(null),
    };
    const mockVisitsService = {
      createForNote: jest.fn().mockResolvedValue({ id: 'visit-1' }),
    };
    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'DOCTOR' }),
      },
      initialNote: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'init-1',
          status: 'PUBLISHED',
          visit: { visitDatetime: new Date() },
        }),
      },
      progressNote: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'progress-1', ...data })),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    const mockInitialNotesService = {
      findOne: jest.fn().mockResolvedValue({ status: 'PUBLISHED' }),
    };

    const service = new ProgressNotesService(
      mockPrisma as any,
      mockVisitsService as any,
      mockProblemsService as any,
      mockMedicationsService as any,
      mockVitalsService as any,
      mockInitialNotesService as any,
      {} as any,
    );

    const dto = {
      subjective: 'Test subjective',
      objective: 'Test objective',
      problemListSnapshot: [{ tempId: 'temp-1', title: 'Hypertension stage 1' }],
    };

    const result = await service.create('patient-1', dto as any, 'user-1');

    expect(mockProblemsService.upsertFromAssessment).toHaveBeenCalledWith(
      'patient-1',
      expect.any(Array),
      'user-1',
      'Progress Note',
      mockPrisma,
    );
    expect((result.problemListSnapshot as any)[0].id).toBe('prob-real-1');
  });

  it('reverts problems to previous note snapshot when a draft is deleted', async () => {
    const mockProblemsService = {
      upsertFromAssessment: jest.fn().mockResolvedValue(new Map()),
    };
    const mockProgressNoteFindFirst = jest.fn().mockResolvedValue(null);
    const mockInitialNoteFindFirst = jest.fn().mockResolvedValue({
      id: 'initial-1',
      status: 'PUBLISHED',
      mgmtNonpharm: '',
      mgmtPharm: '',
      diagnostics: [],
      createdAt: new Date(),
      visit: { visitDatetime: new Date() },
    });

    const mockPrisma = {
      progressNote: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'draft-1',
          authorId: 'user-1',
          status: 'DRAFT',
          visitId: 'visit-1',
          visit: { patientId: 'patient-1' },
        }),
        findFirst: mockProgressNoteFindFirst,
        delete: jest.fn().mockResolvedValue({ id: 'draft-1' }),
      },
      initialNote: {
        findFirst: mockInitialNoteFindFirst,
        findUnique: jest.fn().mockResolvedValue({
          id: 'initial-1',
          assessment: [{ title: 'Hypertension' }],
          medicationSnapshot: [],
        }),
      },
      visit: {
        findUnique: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue({ id: 'visit-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    const service = new ProgressNotesService(
      mockPrisma as any,
      {} as any,
      mockProblemsService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.deleteDraft('patient-1', 'draft-1', 'user-1');

    expect(mockProblemsService.upsertFromAssessment).toHaveBeenCalledWith(
      'patient-1',
      expect.arrayContaining([expect.objectContaining({ title: 'Hypertension' })]),
      'user-1',
      'Progress Note',
      mockPrisma,
    );
    expect(mockPrisma.progressNote.delete).toHaveBeenCalledWith({ where: { id: 'draft-1' } });
  });
});

