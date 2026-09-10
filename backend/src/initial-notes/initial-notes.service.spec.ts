import { Test, TestingModule } from '@nestjs/testing';
import { InitialNote } from '@prisma/client';
import { InitialNotesService } from './initial-notes.service';
import { PrismaService } from '../prisma/prisma.service';
import { VisitsService } from '../visits/visits.service';
import { ProblemsService } from '../problems/problems.service';
import { MedicationsService } from '../medications/medications.service';
import { StorageService } from '../storage/storage.service';

const PATIENT_ID = 'patient-1';
const NOTE_ID = 'note-1';
const USER_ID = 'user-1';

function makeNote(overrides: Partial<InitialNote> = {}): InitialNote {
  return {
    id: NOTE_ID,
    visitId: 'visit-1',
    authorId: USER_ID,
    chiefComplaint: 'Headache',
    hpi: 'Two weeks of frontal headache.',
    pmhComorbidities: null,
    pmhSurgeries: null,
    pmhHospitalizations: null,
    allergies: null,
    familyHistory: null,
    socialHistory: null,
    obHistory: null,
    psychosocialHistory: null,
    physicalExam: 'Unremarkable.',
    assessment: [{ title: 'Migraine', icdCode: 'G43' }],
    medicationSnapshot: [],
    mgmtNonpharm: null,
    diagnostics: [],
    status: 'PUBLISHED',
    lastEditedBy: null,
    lastEditedAt: null,
    createdAt: new Date('2026-07-20T02:00:00Z'),
    updatedAt: new Date('2026-07-20T02:00:00Z'),
    ...overrides,
  } as InitialNote;
}

describe('InitialNotesService — logs and version history', () => {
  let service: InitialNotesService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      initialNote: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      initialNoteVersion: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _max: { versionNumber: null } }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(({ data }: any) =>
          Promise.resolve({ id: 'version-1', ...data }),
        ),
        deleteMany: jest.fn(),
      },
      deletedNote: {
        create: jest.fn(),
      },
      visit: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      initialNoteLog: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      attachment: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      problem: { updateMany: jest.fn() },
      medication: { updateMany: jest.fn() },
      problemLog: { findMany: jest.fn().mockResolvedValue([]) },
      medicationLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };

    prisma = {
      initialNote: { findUnique: jest.fn(), findFirst: jest.fn() },
      visit: { findFirst: jest.fn().mockResolvedValue({ id: 'visit-1' }) },
      progressNote: { count: jest.fn().mockResolvedValue(0) },
      initialNoteLog: { findMany: jest.fn().mockResolvedValue([]) },
      initialNoteVersion: { findMany: jest.fn(), findFirst: jest.fn() },
      // Run the callback immediately with the tx mock; ignore the options arg
      $transaction: jest.fn((cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitialNotesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: VisitsService,
          useValue: {
            createForNote: jest.fn().mockResolvedValue({ id: 'visit-1' }),
            updateChangeSummary: jest.fn(),
          },
        },
        {
          provide: ProblemsService,
          useValue: {
            findActiveForPatient: jest.fn().mockResolvedValue([]),
            upsertFromAssessment: jest.fn().mockResolvedValue(new Map()),
            removeIntroducedAndRerootOrphans: jest.fn(),
          },
        },
        {
          provide: MedicationsService,
          useValue: {
            findActiveForPatient: jest.fn().mockResolvedValue([]),
            upsertFromNoteMedications: jest.fn(),
          },
        },
        { provide: StorageService, useValue: { delete: jest.fn() } },
      ],
    }).compile();

    service = module.get(InitialNotesService);
  });

  describe('publish', () => {
    it('writes v1 with no changed fields and a Published log', async () => {
      const note = makeNote({ status: 'DRAFT' });
      prisma.initialNote.findUnique.mockResolvedValue(note);
      tx.initialNote.update.mockResolvedValue(
        makeNote({ status: 'PUBLISHED' }),
      );

      await service.publish(PATIENT_ID, NOTE_ID, USER_ID);

      expect(tx.initialNoteVersion.create).toHaveBeenCalledTimes(1);
      const versionData = tx.initialNoteVersion.create.mock.calls[0][0].data;
      expect(versionData.versionNumber).toBe(1);
      expect(versionData.changedFields).toEqual([]);
      expect(versionData.changeSummary).toBeNull();
      expect(versionData.snapshot.chiefComplaint).toBe('Headache');

      const logData = tx.initialNoteLog.create.mock.calls[0][0].data;
      expect(logData.action).toBe('Published');
      expect(logData.description).toBe('Published Initial Note (v1)');
      expect(logData.versionId).toBe('version-1');
    });

    it('passes nesting and diagnosis date through to upsertFromAssessment, opting out of auto-resolve', async () => {
      const note = makeNote({
        status: 'DRAFT',
        assessment: [
          { id: 'p1', title: 'Hypertension', diagnosisDate: '2023-05-10' },
          { tempId: 't1', title: 'Proteinuria', parentId: 'p1' },
        ],
      });
      prisma.initialNote.findUnique.mockResolvedValue(note);
      tx.initialNote.update.mockResolvedValue(
        makeNote({ status: 'PUBLISHED' }),
      );

      const upsertSpy = (service as any).problemsService
        .upsertFromAssessment as jest.Mock;

      await service.publish(PATIENT_ID, NOTE_ID, USER_ID);

      expect(upsertSpy).toHaveBeenCalledTimes(1);
      const [calledPatientId, items, calledUserId, sourceNote, , options] =
        upsertSpy.mock.calls[0];
      expect(calledPatientId).toBe(PATIENT_ID);
      expect(calledUserId).toBe(USER_ID);
      expect(sourceNote).toBe('Initial Note');
      expect(options).toEqual({ resolveMissing: false });

      expect(items[0]).toEqual(
        expect.objectContaining({
          id: 'p1',
          title: 'Hypertension',
          diagnosisDate: '2023-05-10',
        }),
      );
      // Legacy-safety: an item with no parentId key in the raw snapshot must
      // not gain one — that would flatten existing nesting on publish.
      expect(items[0]).not.toHaveProperty('parentId');

      expect(items[1]).toEqual(
        expect.objectContaining({
          tempId: 't1',
          title: 'Proteinuria',
          parentId: 'p1',
        }),
      );
    });

    it('omits parentId for legacy assessment items so existing nesting is preserved', async () => {
      const note = makeNote({
        status: 'DRAFT',
        assessment: [{ id: 'p1', title: 'Migraine' }],
      });
      prisma.initialNote.findUnique.mockResolvedValue(note);
      tx.initialNote.update.mockResolvedValue(
        makeNote({ status: 'PUBLISHED' }),
      );

      const upsertSpy = (service as any).problemsService
        .upsertFromAssessment as jest.Mock;

      await service.publish(PATIENT_ID, NOTE_ID, USER_ID);

      const items = upsertSpy.mock.calls[0][1];
      expect(items[0]).not.toHaveProperty('parentId');
    });
  });

  describe('update — published note', () => {
    beforeEach(() => {
      // Default: the note already has its v1 baseline from publish()
      tx.initialNoteVersion.count.mockResolvedValue(1);
    });

    it('writes the next version and a Revised log naming the changed sections', async () => {
      prisma.initialNote.findUnique.mockResolvedValue(makeNote());
      tx.initialNote.update.mockResolvedValue(
        makeNote({ chiefComplaint: 'Dizziness', hpi: 'Vertigo on standing.' }),
      );
      tx.initialNoteVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: 1 },
      });

      await service.update(
        PATIENT_ID,
        NOTE_ID,
        { chiefComplaint: 'Dizziness', hpi: 'Vertigo on standing.' },
        USER_ID,
      );

      const versionData = tx.initialNoteVersion.create.mock.calls[0][0].data;
      expect(versionData.versionNumber).toBe(2);
      expect(versionData.changedFields).toEqual(['chiefComplaint', 'hpi']);
      expect(versionData.changeSummary).toBe(
        'Edited the Chief Complaint and History of Present Illness',
      );

      const logData = tx.initialNoteLog.create.mock.calls[0][0].data;
      expect(logData.action).toBe('Revised');
      expect(logData.description).toBe(
        'Revised published Initial Note (v2): Edited the Chief Complaint and History of Present Illness',
      );
    });

    it('numbers versions contiguously from the current maximum', async () => {
      prisma.initialNote.findUnique.mockResolvedValue(makeNote());
      tx.initialNote.update.mockResolvedValue(
        makeNote({ chiefComplaint: 'X' }),
      );
      tx.initialNoteVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: 4 },
      });

      await service.update(
        PATIENT_ID,
        NOTE_ID,
        { chiefComplaint: 'X' },
        USER_ID,
      );

      expect(
        tx.initialNoteVersion.create.mock.calls[0][0].data.versionNumber,
      ).toBe(5);
    });

    it('records neither a version nor a log when nothing actually changed', async () => {
      prisma.initialNote.findUnique.mockResolvedValue(makeNote());
      // Same values back — a no-op save
      tx.initialNote.update.mockResolvedValue(makeNote());

      await service.update(
        PATIENT_ID,
        NOTE_ID,
        { chiefComplaint: 'Headache' },
        USER_ID,
      );

      expect(tx.initialNoteVersion.create).not.toHaveBeenCalled();
      expect(tx.initialNoteLog.create).not.toHaveBeenCalled();
    });

    it('backfills the pre-edit state as v1 when the note has no baseline, so the edit becomes v2', async () => {
      // A note published before version history shipped
      tx.initialNoteVersion.count.mockResolvedValue(0);
      const original = makeNote({ hpi: 'Original HPI.' });
      prisma.initialNote.findUnique.mockResolvedValue(original);
      tx.initialNote.update.mockResolvedValue(makeNote({ hpi: 'Edited HPI.' }));

      let nextNumber = 0;
      tx.initialNoteVersion.aggregate.mockImplementation(() =>
        Promise.resolve({ _max: { versionNumber: nextNumber || null } }),
      );
      tx.initialNoteVersion.create.mockImplementation(({ data }: any) => {
        nextNumber = data.versionNumber;
        return Promise.resolve({
          id: `version-${data.versionNumber}`,
          ...data,
        });
      });

      await service.update(
        PATIENT_ID,
        NOTE_ID,
        { hpi: 'Edited HPI.' },
        USER_ID,
      );

      expect(tx.initialNoteVersion.create).toHaveBeenCalledTimes(2);

      const baseline = tx.initialNoteVersion.create.mock.calls[0][0].data;
      expect(baseline.versionNumber).toBe(1);
      expect(baseline.changedFields).toEqual([]);
      expect(baseline.changeSummary).toBeNull();
      // v1 holds the ORIGINAL text, not the edit
      expect(baseline.snapshot.hpi).toBe('Original HPI.');
      // and is dated to when that state existed, not to now
      expect(baseline.createdAt).toEqual(original.createdAt);

      const edit = tx.initialNoteVersion.create.mock.calls[1][0].data;
      expect(edit.versionNumber).toBe(2);
      expect(edit.snapshot.hpi).toBe('Edited HPI.');
      expect(edit.changedFields).toEqual(['hpi']);

      expect(tx.initialNoteLog.create.mock.calls[0][0].data.description).toBe(
        'Revised published Initial Note (v2): Edited the History of Present Illness',
      );
    });

    it('locks prescribed medications and only updates past medications on published notes', async () => {
      const original = makeNote({
        status: 'PUBLISHED',
        medicationSnapshot: [
          { name: 'Abacavir/Lamivudine', dose: '600/300mg' },
          { name: 'Ibuprofen', dose: '400mg' },
        ],
      });
      prisma.initialNote.findUnique.mockResolvedValue(original);
      tx.initialNoteVersion.count.mockResolvedValue(1);
      tx.initialNoteVersion.aggregate.mockResolvedValue({
        _max: { versionNumber: 1 },
      });

      tx.initialNote.update.mockImplementation(({ data }: any) => {
        const updatedState = makeNote({
          ...original,
          ...data,
        });
        return Promise.resolve(updatedState);
      });

      await service.update(
        PATIENT_ID,
        NOTE_ID,
        {
          medicationSnapshot: [{ name: 'test', dose: '10mg', source: 'past' }],
        },
        USER_ID,
      );

      expect(
        tx.initialNote.update.mock.calls[0][0].data.medicationSnapshot,
      ).toEqual([
        { name: 'Abacavir/Lamivudine', dose: '600/300mg' },
        { name: 'Ibuprofen', dose: '400mg' },
        { name: 'test', dose: '10mg', source: 'past' },
      ]);

      const versionData = tx.initialNoteVersion.create.mock.calls[0][0].data;
      expect(versionData.changedFields).toEqual(['pmhMedications']);
      expect(versionData.changeSummary).toBe(
        'Added the Past Medical History (Past Medications) (added test)',
      );

      const logData = tx.initialNoteLog.create.mock.calls[0][0].data;
      expect(logData.description).toBe(
        'Revised published Initial Note (v2): Added the Past Medical History (Past Medications) (added test)',
      );
    });
  });

  describe('update — draft note', () => {
    it('logs the save but does not snapshot a version, not even a baseline', async () => {
      prisma.initialNote.findUnique.mockResolvedValue(
        makeNote({ status: 'DRAFT' }),
      );
      tx.initialNote.update.mockResolvedValue(
        makeNote({ status: 'DRAFT', hpi: 'Revised draft HPI.' }),
      );

      await service.update(
        PATIENT_ID,
        NOTE_ID,
        { hpi: 'Revised draft HPI.' },
        USER_ID,
      );

      expect(tx.initialNoteVersion.create).not.toHaveBeenCalled();

      const logData = tx.initialNoteLog.create.mock.calls[0][0].data;
      expect(logData.action).toBe('Updated');
      expect(logData.description).toBe(
        'Updated Initial Note draft: Edited the History of Present Illness',
      );
      expect(logData.versionId).toBeNull();
    });

    it('syncs the assessment and medication snapshot into the master lists and heals tempIds', async () => {
      const problemsService = (service as any).problemsService;
      const medicationsService = (service as any).medicationsService;
      const draftAssessment = [{ title: 'Migraine', tempId: 'temp-1' }];
      const draftMeds = [{ name: 'Sumatriptan', dose: '50mg', source: 'prescribed' }];
      prisma.initialNote.findUnique.mockResolvedValue(
        makeNote({ status: 'DRAFT', assessment: [], medicationSnapshot: [] }),
      );
      tx.initialNote.update.mockResolvedValueOnce(
        makeNote({
          status: 'DRAFT',
          assessment: draftAssessment,
          medicationSnapshot: draftMeds,
        }),
      );
      const resolved = new Map([['temp-1', 'problem-real-1']]);
      (problemsService.upsertFromAssessment as jest.Mock).mockResolvedValueOnce(
        resolved,
      );

      await service.update(
        PATIENT_ID,
        NOTE_ID,
        { assessment: draftAssessment as any, medicationSnapshot: draftMeds as any },
        USER_ID,
      );

      expect(problemsService.upsertFromAssessment).toHaveBeenCalledWith(
        PATIENT_ID,
        expect.arrayContaining([expect.objectContaining({ tempId: 'temp-1' })]),
        USER_ID,
        'Initial Note',
        tx,
        { resolveMissing: false },
      );
      expect(medicationsService.upsertFromNoteMedications).toHaveBeenCalledWith(
        PATIENT_ID,
        expect.arrayContaining([expect.objectContaining({ name: 'Sumatriptan' })]),
        USER_ID,
        'Initial Note',
        tx,
        { deactivateMissing: false },
      );
      // Second tx.initialNote.update call persists the healed assessment.
      const healedCall = tx.initialNote.update.mock.calls[1][0];
      expect(healedCall.data.assessment[0]).toMatchObject({
        id: 'problem-real-1',
      });
      expect(healedCall.data.assessment[0].tempId).toBeUndefined();
    });

    it('does not sync when neither assessment nor medicationSnapshot is part of the save', async () => {
      const problemsService = (service as any).problemsService;
      const medicationsService = (service as any).medicationsService;
      prisma.initialNote.findUnique.mockResolvedValue(
        makeNote({ status: 'DRAFT' }),
      );
      tx.initialNote.update.mockResolvedValue(
        makeNote({ status: 'DRAFT', hpi: 'Revised.' }),
      );

      await service.update(PATIENT_ID, NOTE_ID, { hpi: 'Revised.' }, USER_ID);

      expect(problemsService.upsertFromAssessment).not.toHaveBeenCalled();
      expect(medicationsService.upsertFromNoteMedications).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('logs the draft creation', async () => {
      prisma.initialNote.findFirst.mockResolvedValue(null);
      tx.initialNote.create.mockResolvedValue(makeNote({ status: 'DRAFT' }));

      await service.create(
        PATIENT_ID,
        { visitDatetime: '2026-07-20T02:00:00Z' },
        USER_ID,
      );

      const logData = tx.initialNoteLog.create.mock.calls[0][0].data;
      expect(logData.action).toBe('Created');
      expect(logData.initialNoteId).toBe(NOTE_ID);
    });

    it('syncs a non-empty assessment/medicationSnapshot on the very first draft save', async () => {
      prisma.initialNote.findFirst.mockResolvedValue(null);
      const problemsService = (service as any).problemsService;
      const medicationsService = (service as any).medicationsService;
      const created = makeNote({
        status: 'DRAFT',
        assessment: [{ title: 'Migraine' }],
        medicationSnapshot: [{ name: 'Sumatriptan', dose: '50mg' }],
      });
      tx.initialNote.create.mockResolvedValue(created);
      tx.initialNote.update.mockResolvedValue(created);

      await service.create(
        PATIENT_ID,
        {
          visitDatetime: '2026-07-20T02:00:00Z',
          assessment: [{ title: 'Migraine' }] as any,
          medicationSnapshot: [{ name: 'Sumatriptan', dose: '50mg' }] as any,
        },
        USER_ID,
      );

      expect(problemsService.upsertFromAssessment).toHaveBeenCalled();
      expect(medicationsService.upsertFromNoteMedications).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('logs an archive and hard-deletes when deleting a published note', async () => {
      prisma.initialNote.findUnique.mockResolvedValue({
        ...makeNote(),
        visit: { patientId: PATIENT_ID },
      });

      await service.remove(PATIENT_ID, NOTE_ID, USER_ID);

      expect(tx.deletedNote.create).toHaveBeenCalled();
      expect(tx.initialNote.delete).toHaveBeenCalledWith({
        where: { id: NOTE_ID },
      });
      expect(tx.initialNoteLog.create.mock.calls[0][0].data.action).toBe(
        'Deleted',
      );
    });

    it('detaches log rows before hard-deleting a draft', async () => {
      prisma.initialNote.findUnique.mockResolvedValue({
        ...makeNote({ status: 'DRAFT' }),
        visit: { patientId: PATIENT_ID },
      });

      await service.remove(PATIENT_ID, NOTE_ID, USER_ID);

      expect(tx.initialNoteVersion.deleteMany).toHaveBeenCalledWith({
        where: { initialNoteId: NOTE_ID },
      });
      expect(tx.initialNoteLog.updateMany).toHaveBeenCalledWith({
        where: { initialNoteId: NOTE_ID },
        data: { initialNoteId: null, versionId: null },
      });
      expect(tx.initialNote.delete).toHaveBeenCalledWith({
        where: { id: NOTE_ID },
      });
    });

    it('reverts problems/medications this draft introduced, leaves pre-existing ones alone', async () => {
      const problemsService = (service as any).problemsService;
      prisma.initialNote.findUnique.mockResolvedValue({
        ...makeNote({ status: 'DRAFT' }),
        visit: { patientId: PATIENT_ID },
      });
      tx.problemLog.findMany.mockResolvedValue([
        { problemId: 'problem-introduced-1' },
      ]);
      tx.medicationLog.findMany.mockResolvedValue([
        { medicationId: 'med-introduced-1' },
      ]);

      await service.remove(PATIENT_ID, NOTE_ID, USER_ID);

      expect(tx.problemLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: PATIENT_ID,
            action: 'Created',
            description: { endsWith: 'from Initial Note' },
          }),
        }),
      );
      expect(problemsService.removeIntroducedAndRerootOrphans).toHaveBeenCalledWith(
        PATIENT_ID,
        ['problem-introduced-1'],
        USER_ID,
        'Initial Note',
        tx,
      );
      expect(tx.medication.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['med-introduced-1'] }, isActive: true },
        data: { isActive: false },
      });
      expect(tx.medicationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            medicationId: 'med-introduced-1',
            action: 'Discontinued',
          }),
        }),
      );
    });

    it('does not touch problems/medications when the draft introduced none', async () => {
      const problemsService = (service as any).problemsService;
      prisma.initialNote.findUnique.mockResolvedValue({
        ...makeNote({ status: 'DRAFT' }),
        visit: { patientId: PATIENT_ID },
      });

      await service.remove(PATIENT_ID, NOTE_ID, USER_ID);

      expect(problemsService.removeIntroducedAndRerootOrphans).not.toHaveBeenCalled();
      expect(tx.medication.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getLogs', () => {
    it('reads newest-first and does not purge old entries', async () => {
      await service.getLogs(PATIENT_ID);

      expect(prisma.initialNoteLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: PATIENT_ID },
          orderBy: { createdAt: 'desc' },
        }),
      );
      // Unlike ProblemsService.getLogs there is no deleteMany retention sweep
      expect(prisma.initialNoteLog).not.toHaveProperty('deleteMany');
    });
  });
});
