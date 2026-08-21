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
    expect(result.diagnostics).toEqual([]);
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
      diagnostics: [],
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

  it('matches on name only, so an in-note dose edit survives reconcile', async () => {
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
    // dose mismatch as "no longer active".
    const snapshot = [{ name: 'Amlodipine', dose: '5 mg' }];

    const result = await (service as any).reconcileMedicationSnapshot(
      'patient-1',
      snapshot,
      {} as any,
    );

    expect(result).toHaveLength(1);
    expect(result[0].dose).toBe('5 mg');
  });
});
