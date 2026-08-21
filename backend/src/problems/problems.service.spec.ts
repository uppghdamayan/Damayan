import { ProblemsService } from './problems.service';
import { ProblemStatus } from '@prisma/client';

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
      findMany: jest.fn(({ where, orderBy }: any) => {
        let result = problems.filter((p) => p.patientId === where.patientId);
        if (where.parentId !== undefined) {
          result = result.filter((p) => p.parentId === where.parentId);
        }
        if (where.status?.not !== undefined) {
          result = result.filter((p) => p.status !== where.status.not);
        }
        if (orderBy?.sortOrder === 'asc') {
          result = [...result].sort((a, b) => a.sortOrder - b.sortOrder);
        }
        return Promise.resolve(result);
      }),
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
        if ('parentId' in data) p.parentId = data.parentId;
        return Promise.resolve({ ...p });
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        const ids: string[] | undefined = where.id?.in;
        const matches = problems.filter((p) => {
          if (ids && !ids.includes(p.id)) return false;
          if (where.patientId && p.patientId !== where.patientId) return false;
          if (where.parentId !== undefined && p.parentId !== where.parentId)
            return false;
          if (where.status?.not !== undefined && p.status === where.status.not)
            return false;
          return true;
        });
        matches.forEach((p) => Object.assign(p, data));
        return Promise.resolve({ count: matches.length });
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

  it('writes the snapshot order back to Problem.sortOrder for existing ACTIVE problems', async () => {
    // Simulates a note reorder: two already-ACTIVE problems swap position in
    // the published snapshot. Without writing sortOrder back here, the
    // master Problem List / dashboard keep showing the pre-note order.
    const { client, problems } = makeClient([
      {
        id: 'p1',
        patientId: PATIENT_ID,
        title: 'Hypertension',
        status: 'ACTIVE',
        sortOrder: 0,
        parentId: null,
        diagnosisDate: null,
      },
      {
        id: 'p2',
        patientId: PATIENT_ID,
        title: 'Diabetes',
        status: 'ACTIVE',
        sortOrder: 1,
        parentId: null,
        diagnosisDate: null,
      },
    ]);

    await service.upsertFromAssessment(
      PATIENT_ID,
      [
        { id: 'p2', title: 'Diabetes', sortOrder: 0 },
        { id: 'p1', title: 'Hypertension', sortOrder: 1 },
      ],
      USER_ID,
      'Progress Note',
      client as any,
    );

    expect(problems.find((p) => p.id === 'p2')!.sortOrder).toBe(0);
    expect(problems.find((p) => p.id === 'p1')!.sortOrder).toBe(1);
  });
});

/**
 * A fake PrismaService for ProblemsService#update/#remove — these run inside
 * `this.prisma.$transaction(async (tx) => ...)`, so unlike upsertFromAssessment
 * (tested above via its own client param) we need $transaction to hand back
 * the same in-memory client makeClient builds.
 */
function makeTransactionalPrisma(seed: any[]) {
  const { client, problems } = makeClient(seed);
  const prisma = {
    $transaction: jest.fn((cb: any) => cb(client)),
  };
  return { prisma, client, problems };
}

describe('ProblemsService#remove / #update — parent promotion (Business rule 5)', () => {
  let service: ProblemsService;

  const baseProblems = () => [
    {
      id: 'root',
      patientId: PATIENT_ID,
      title: 'Root Parent',
      status: 'ACTIVE',
      sortOrder: 10,
      parentId: null,
      diagnosisDate: null,
    },
    {
      id: 'p',
      patientId: PATIENT_ID,
      title: 'P',
      status: 'ACTIVE',
      sortOrder: 20,
      parentId: 'root',
      diagnosisDate: null,
    },
    {
      id: 'a',
      patientId: PATIENT_ID,
      title: 'A',
      status: 'ACTIVE',
      sortOrder: 21,
      parentId: 'p',
      diagnosisDate: null,
    },
    {
      id: 'a1',
      patientId: PATIENT_ID,
      title: 'A1',
      status: 'ACTIVE',
      sortOrder: 22,
      parentId: 'a',
      diagnosisDate: null,
    },
    {
      id: 'b',
      patientId: PATIENT_ID,
      title: 'B',
      status: 'ACTIVE',
      sortOrder: 23,
      parentId: 'p',
      diagnosisDate: null,
    },
    {
      id: 'c',
      patientId: PATIENT_ID,
      title: 'C',
      status: 'ACTIVE',
      sortOrder: 24,
      parentId: 'p',
      diagnosisDate: null,
    },
  ];

  beforeEach(() => {
    service = new ProblemsService({} as any, { create: jest.fn() } as any);
  });

  it("remove(): promotes the first child into the removed parent's slot and re-parents the rest under it", async () => {
    const { prisma, problems } = makeTransactionalPrisma(baseProblems());
    (service as any).prisma = prisma;

    await service.remove(PATIENT_ID, 'p', USER_ID);

    const p = problems.find((x) => x.id === 'p')!;
    const a = problems.find((x) => x.id === 'a')!;
    const a1 = problems.find((x) => x.id === 'a1')!;
    const b = problems.find((x) => x.id === 'b')!;
    const c = problems.find((x) => x.id === 'c')!;

    expect(p.status).toBe('REMOVED');
    // Heir takes the removed parent's exact slot.
    expect(a.parentId).toBe('root');
    expect(a.sortOrder).toBe(20);
    // Former siblings re-parent under the heir.
    expect(b.parentId).toBe('a');
    expect(c.parentId).toBe('a');
    // The heir's own child is untouched.
    expect(a1.parentId).toBe('a');
    expect(a1.status).toBe('ACTIVE');
  });

  it('remove(): a leaf (no children) is removed with no promotion side effects', async () => {
    const { prisma, problems } = makeTransactionalPrisma(baseProblems());
    (service as any).prisma = prisma;

    await service.remove(PATIENT_ID, 'c', USER_ID);

    expect(problems.find((x) => x.id === 'c')!.status).toBe('REMOVED');
    expect(problems.find((x) => x.id === 'a')!.parentId).toBe('p');
    expect(problems.find((x) => x.id === 'b')!.parentId).toBe('p');
  });

  it('remove(): a REMOVED child is skipped when choosing the heir', async () => {
    const seed = baseProblems();
    (seed.find((p) => p.id === 'a') as any).status = 'REMOVED';
    const { prisma, problems } = makeTransactionalPrisma(seed);
    (service as any).prisma = prisma;

    await service.remove(PATIENT_ID, 'p', USER_ID);

    // 'a' stays REMOVED and untouched; 'b' (next by sortOrder) becomes heir.
    const a = problems.find((x) => x.id === 'a')!;
    const b = problems.find((x) => x.id === 'b')!;
    const c = problems.find((x) => x.id === 'c')!;
    expect(a.status).toBe('REMOVED');
    expect(a.parentId).toBe('p');
    expect(b.parentId).toBe('root');
    expect(c.parentId).toBe('b');
  });

  it('remove(): promoting a root-level parent leaves the heir with parentId null', async () => {
    const { prisma, problems } = makeTransactionalPrisma(baseProblems());
    (service as any).prisma = prisma;

    await service.remove(PATIENT_ID, 'root', USER_ID);

    const p = problems.find((x) => x.id === 'p')!;
    expect(p.parentId).toBeNull();
    expect(p.sortOrder).toBe(10);
  });

  it('update(status: RESOLVED): applies the same promotion as remove()', async () => {
    const { prisma, problems } = makeTransactionalPrisma(baseProblems());
    (service as any).prisma = prisma;

    await service.update(
      PATIENT_ID,
      'p',
      { status: ProblemStatus.RESOLVED },
      USER_ID,
    );

    const p = problems.find((x) => x.id === 'p')!;
    const a = problems.find((x) => x.id === 'a')!;
    const b = problems.find((x) => x.id === 'b')!;
    const c = problems.find((x) => x.id === 'c')!;

    expect(p.status).toBe('RESOLVED');
    expect(a.parentId).toBe('root');
    expect(a.sortOrder).toBe(20);
    expect(b.parentId).toBe('a');
    expect(c.parentId).toBe('a');
  });

  it('update(status: ACTIVE -> ACTIVE reactivation of an unrelated field) does not trigger promotion', async () => {
    const { prisma, problems } = makeTransactionalPrisma(baseProblems());
    (service as any).prisma = prisma;

    await service.update(PATIENT_ID, 'p', { title: 'P Renamed' }, USER_ID);

    expect(problems.find((x) => x.id === 'a')!.parentId).toBe('p');
    expect(problems.find((x) => x.id === 'p')!.title).toBe('P Renamed');
  });
});
