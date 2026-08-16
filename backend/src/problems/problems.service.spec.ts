import { ProblemsService } from './problems.service';

const PATIENT_ID = 'patient-1';
const USER_ID = 'user-1';

/**
 * A minimal in-memory stand-in for the Prisma transaction client, passed
 * directly as upsertFromAssessment's `client` param — no NestJS TestingModule
 * needed since the method takes its own client override.
 */
function makeClient(seed: any[]) {
  const problems = seed.map((p) => ({ ...p }));
  let counter = 0;

  const client = {
    problem: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          problems.filter((p) => p.patientId === where.patientId),
        ),
      ),
      findFirst: jest.fn(({ where }: any) => {
        if (where?.id) {
          return Promise.resolve(
            problems.find(
              (p) => p.id === where.id && p.patientId === where.patientId,
            ) || null,
          );
        }
        // getNextSortOrder's "highest sortOrder" query
        const sorted = [...problems].sort((a, b) => b.sortOrder - a.sortOrder);
        return Promise.resolve(sorted[0] || null);
      }),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(problems.find((p) => p.id === where.id) || null),
      ),
      create: jest.fn(({ data }: any) => {
        const newProb = {
          id: `new-${++counter}`,
          patientId: data.patientId,
          title: data.title,
          status: data.status,
          sortOrder: data.sortOrder,
          parentId: null,
          diagnosisDate: data.diagnosisDate ?? null,
          addedBy: data.addedBy,
        };
        problems.push(newProb);
        return Promise.resolve(newProb);
      }),
      update: jest.fn(({ where, data }: any) => {
        const p = problems.find((pp) => pp.id === where.id);
        if (!p) throw new Error(`problem ${where.id} not found`);
        if (data.title !== undefined) p.title = data.title;
        if (data.status !== undefined) p.status = data.status;
        if (data.sortOrder !== undefined) p.sortOrder = data.sortOrder;
        if ('diagnosisDate' in data) p.diagnosisDate = data.diagnosisDate;
        if (data.parent?.connect) p.parentId = data.parent.connect.id;
        if (data.parent?.disconnect) p.parentId = null;
        return Promise.resolve({ ...p });
      }),
    },
    problemLog: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ role: 'DOCTOR' }),
    },
  };

  return { client, problems };
}

describe('ProblemsService#upsertFromAssessment', () => {
  let service: ProblemsService;

  beforeEach(() => {
    service = new ProblemsService({} as any, { create: jest.fn() } as any);
  });

  it('resolveMissing: false leaves an absent ACTIVE problem untouched and logs nothing', async () => {
    const { client, problems } = makeClient([
      {
        id: 'p1',
        patientId: PATIENT_ID,
        title: 'Pre-existing',
        status: 'ACTIVE',
        sortOrder: 0,
        parentId: null,
        diagnosisDate: null,
      },
    ]);

    await service.upsertFromAssessment(
      PATIENT_ID,
      [],
      USER_ID,
      'Initial Note',
      client as any,
      { resolveMissing: false },
    );

    expect(problems.find((p) => p.id === 'p1')!.status).toBe('ACTIVE');
    expect(client.problemLog.create).not.toHaveBeenCalled();
  });

  it('defaults to resolving an absent ACTIVE problem (Progress Note regression guard)', async () => {
    const { client, problems } = makeClient([
      {
        id: 'p1',
        patientId: PATIENT_ID,
        title: 'Pre-existing',
        status: 'ACTIVE',
        sortOrder: 0,
        parentId: null,
        diagnosisDate: null,
      },
    ]);

    await service.upsertFromAssessment(
      PATIENT_ID,
      [],
      USER_ID,
      'Progress Note',
      client as any,
    );

    expect(problems.find((p) => p.id === 'p1')!.status).toBe('RESOLVED');
    expect(client.problemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'Resolved' }),
      }),
    );
  });

  it('resolves a parentId that references another item by tempId, once both are created', async () => {
    const { client, problems } = makeClient([]);

    await service.upsertFromAssessment(
      PATIENT_ID,
      [
        { tempId: 't-parent', title: 'CKD Stage 3' },
        { tempId: 't-child', title: 'Proteinuria', parentId: 't-parent' },
      ],
      USER_ID,
      'Initial Note',
      client as any,
      { resolveMissing: false },
    );

    const parent = problems.find((p) => p.title === 'CKD Stage 3')!;
    const child = problems.find((p) => p.title === 'Proteinuria')!;
    expect(child.parentId).toBe(parent.id);
  });

  it('skips re-parenting for items with no parentId key, leaving existing nesting untouched', async () => {
    const { client, problems } = makeClient([
      {
        id: 'p0',
        patientId: PATIENT_ID,
        title: 'Existing Parent',
        status: 'ACTIVE',
        sortOrder: 0,
        parentId: null,
        diagnosisDate: null,
      },
      {
        id: 'p1',
        patientId: PATIENT_ID,
        title: 'Existing Child',
        status: 'ACTIVE',
        sortOrder: 1,
        parentId: 'p0',
        diagnosisDate: null,
      },
    ]);

    // Legacy item — no `parentId` key at all.
    await service.upsertFromAssessment(
      PATIENT_ID,
      [{ id: 'p1', title: 'Existing Child' }],
      USER_ID,
      'Initial Note',
      client as any,
      { resolveMissing: false },
    );

    expect(problems.find((p) => p.id === 'p1')!.parentId).toBe('p0');
  });

  it('does not clear an existing diagnosisDate when the incoming item omits the field', async () => {
    const originalDate = new Date('2023-05-10T00:00:00.000Z');
    const { client, problems } = makeClient([
      {
        id: 'p1',
        patientId: PATIENT_ID,
        title: 'Hypertension',
        status: 'ACTIVE',
        sortOrder: 0,
        parentId: null,
        diagnosisDate: originalDate,
      },
    ]);

    await service.upsertFromAssessment(
      PATIENT_ID,
      [{ id: 'p1', title: 'Hypertension' }],
      USER_ID,
      'Initial Note',
      client as any,
      { resolveMissing: false },
    );

    expect(problems.find((p) => p.id === 'p1')!.diagnosisDate).toEqual(
      originalDate,
    );
  });
});
