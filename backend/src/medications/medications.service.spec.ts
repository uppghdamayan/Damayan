import { MedicationsService } from './medications.service';

// upsertFromNoteMedications only touches `client.medication.*` and
// `client.medicationLog.create` — build a minimal mock client rather than a
// full PrismaService, matching the hand-rolled-mock style used in
// progress-notes.service.spec.ts.
function buildService(existing: any[]) {
  const medicationUpdate = jest.fn().mockImplementation(({ where, data }) => {
    const med = existing.find((m) => m.id === where.id);
    return Promise.resolve({ ...med, ...data });
  });
  const medicationCreate = jest
    .fn()
    .mockImplementation(({ data }) =>
      Promise.resolve({ id: `new-${data.name}`, ...data }),
    );
  const medicationLogCreate = jest.fn().mockResolvedValue({});

  const client = {
    medication: {
      findMany: jest.fn().mockResolvedValue(existing),
      update: medicationUpdate,
      create: medicationCreate,
    },
    medicationLog: {
      create: medicationLogCreate,
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ role: 'DOCTOR' }),
    },
  };

  const service = new MedicationsService(
    {} as any,
    { create: jest.fn() } as any,
  );

  return {
    service,
    client,
    medicationUpdate,
    medicationCreate,
    medicationLogCreate,
  };
}

function med(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'med-1',
    name: 'Amlodipine',
    dose: '10 mg',
    formulation: 'Tablet',
    instructions: 'Take 1 tab daily',
    quantity: 30,
    isActive: true,
    ...overrides,
  };
}

describe('MedicationsService.upsertFromNoteMedications', () => {
  it('updates formulation/instructions/quantity and stamps updatedBy on a name+dose match', async () => {
    const existing = [med()];
    const { service, client, medicationUpdate, medicationLogCreate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [
        {
          name: 'Amlodipine',
          dose: '10 mg',
          formulation: 'Tablet',
          instructions: 'Take 1 tab at bedtime',
          quantity: 30,
        },
      ],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-1' },
        data: expect.objectContaining({
          instructions: 'Take 1 tab at bedtime',
          updatedBy: 'user-1',
        }),
      }),
    );
    expect(medicationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'Updated' }),
      }),
    );
  });

  it('leaves fields untouched when the item omits them (undefined ≠ clear)', async () => {
    const existing = [med()];
    const { service, client, medicationUpdate, medicationLogCreate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      // A legacy snapshot without formulation/instructions/quantity at all.
      [{ name: 'Amlodipine', dose: '10 mg' }],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationUpdate).not.toHaveBeenCalled();
    expect(medicationLogCreate).not.toHaveBeenCalled();
  });

  it('updates the existing row in place when only the dose differs', async () => {
    const existing = [med()];
    const {
      service,
      client,
      medicationCreate,
      medicationUpdate,
      medicationLogCreate,
    } = buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [{ name: 'Amlodipine', dose: '5 mg' }],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).not.toHaveBeenCalled();
    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-1' },
        data: expect.objectContaining({ dose: '5 mg', updatedBy: 'user-1' }),
      }),
    );
    // The row stays active — it must not be discontinued.
    expect(medicationUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-1' },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
    expect(medicationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'Updated',
          description: expect.stringContaining("'5 mg'"),
        }),
      }),
    );
    expect(medicationLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: expect.stringContaining("'10 mg'"),
        }),
      }),
    );
  });

  it('resolves a same-name dose change identically regardless of item order (pass 1 before pass 2)', async () => {
    const existing = [
      med({ id: 'med-1', name: 'Metoprolol', dose: '25 mg' }),
      med({ id: 'med-2', name: 'Metoprolol', dose: '50 mg' }),
    ];

    for (const items of [
      [
        { name: 'Metoprolol', dose: '25 mg' },
        { name: 'Metoprolol', dose: '75 mg' },
      ],
      [
        { name: 'Metoprolol', dose: '75 mg' },
        { name: 'Metoprolol', dose: '25 mg' },
      ],
    ]) {
      const { service, client, medicationCreate, medicationUpdate } =
        buildService(existing);

      await service.upsertFromNoteMedications(
        'patient-1',
        items,
        'user-1',
        'Progress Note',
        client as any,
      );

      expect(medicationCreate).not.toHaveBeenCalled();
      // med-1 (25mg, unchanged) is never touched.
      expect(medicationUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'med-1' } }),
      );
      // med-2 (50mg -> 75mg) is updated in place, not discontinued.
      expect(medicationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'med-2' },
          data: expect.objectContaining({ dose: '75 mg' }),
        }),
      );
      expect(medicationUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'med-2' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    }
  });

  it('falls back to discontinue+create when both same-name active doses change at once (ambiguous)', async () => {
    const existing = [
      med({ id: 'med-1', name: 'Metoprolol', dose: '25 mg' }),
      med({ id: 'med-2', name: 'Metoprolol', dose: '50 mg' }),
    ];
    const { service, client, medicationCreate, medicationUpdate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [
        { name: 'Metoprolol', dose: '12.5 mg' },
        { name: 'Metoprolol', dose: '75 mg' },
      ],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).toHaveBeenCalledTimes(2);
    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-1' },
        data: { isActive: false },
      }),
    );
    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-2' },
        data: { isActive: false },
      }),
    );
    // Neither existing row was ever mis-paired into a dose write.
    for (const call of medicationUpdate.mock.calls) {
      expect(call[0].data).not.toHaveProperty('dose');
    }
  });

  it('creates and deactivates when one active row splits into two same-name items', async () => {
    const existing = [med({ name: 'Metoprolol', dose: '25 mg' })];
    const { service, client, medicationCreate, medicationUpdate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [
        { name: 'Metoprolol', dose: '12.5 mg' },
        { name: 'Metoprolol', dose: '25 mg BID' },
      ],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).toHaveBeenCalledTimes(2);
    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-1' },
        data: { isActive: false },
      }),
    );
    for (const call of medicationUpdate.mock.calls) {
      expect(call[0].data).not.toHaveProperty('dose');
    }
  });

  it('updates dose and another field together in one write when both change', async () => {
    const existing = [med({ name: 'Amlodipine', dose: '10 mg' })];
    const { service, client, medicationCreate, medicationUpdate, medicationLogCreate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [
        {
          name: 'Amlodipine',
          dose: '5 mg',
          instructions: 'Take at bedtime',
        },
      ],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).not.toHaveBeenCalled();
    expect(medicationUpdate).toHaveBeenCalledTimes(1);
    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-1' },
        data: expect.objectContaining({
          dose: '5 mg',
          instructions: 'Take at bedtime',
        }),
      }),
    );
    expect(medicationLogCreate).toHaveBeenCalledTimes(1);
    const [logCall] = medicationLogCreate.mock.calls;
    expect(logCall[0].data.description).toEqual(
      expect.stringContaining('5 mg'),
    );
    expect(logCall[0].data.description).toEqual(
      expect.stringContaining('instructions'),
    );
  });

  it('creates instead of silently re-dosing an inactive row with the same name', async () => {
    const existing = [med({ name: 'Amlodipine', dose: '10 mg', isActive: false })];
    const { service, client, medicationCreate, medicationUpdate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [{ name: 'Amlodipine', dose: '5 mg' }],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dose: '5 mg' }),
      }),
    );
    // The inactive row is left alone — not silently re-dosed or reactivated.
    expect(medicationUpdate).not.toHaveBeenCalled();
  });

  it('is a no-op on an empty snapshot even with existing active medications', async () => {
    const existing = [med(), med({ id: 'med-2', name: 'Losartan', dose: '50 mg' })];
    const { service, client, medicationCreate, medicationUpdate, medicationLogCreate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).not.toHaveBeenCalled();
    expect(medicationUpdate).not.toHaveBeenCalled();
    expect(medicationLogCreate).not.toHaveBeenCalled();
  });

  it('resolves a legacy duplicate (two active rows, same name+dose) deterministically', async () => {
    const existing = [
      med({ id: 'med-1', name: 'Amlodipine', dose: '10 mg' }),
      med({ id: 'med-2', name: 'Amlodipine', dose: '10 mg' }),
    ];
    const { service, client, medicationCreate, medicationUpdate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [{ name: 'Amlodipine', dose: '10 mg' }],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).not.toHaveBeenCalled();
    // The findMany mock returns `existing` in array order, which the real
    // query pins via orderBy([{isActive:'desc'},{createdAt:'asc'}]) — the
    // first row (med-1) is claimed, the second (med-2) is deactivated.
    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-2' },
        data: { isActive: false },
      }),
    );
    expect(medicationUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'med-1' } }),
    );
  });

  it('reactivates an inactive exact match without creating a duplicate', async () => {
    const existing = [med({ isActive: false })];
    const { service, client, medicationCreate, medicationUpdate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [{ name: 'Amlodipine', dose: '10 mg' }],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).not.toHaveBeenCalled();
    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-1' },
        data: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('deactivates an existing active med absent from the note list', async () => {
    const existing = [
      med(),
      med({ id: 'med-2', name: 'Losartan', dose: '50 mg' }),
    ];
    const { service, client, medicationUpdate } = buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [{ name: 'Amlodipine', dose: '10 mg' }],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'med-2' },
        data: { isActive: false },
      }),
    );
  });

  it('writes no MedicationLog when nothing changed', async () => {
    const existing = [med()];
    const { service, client, medicationUpdate, medicationLogCreate } =
      buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [
        {
          name: 'Amlodipine',
          dose: '10 mg',
          formulation: 'Tablet',
          instructions: 'Take 1 tab daily',
          quantity: 30,
        },
      ],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationUpdate).not.toHaveBeenCalled();
    expect(medicationLogCreate).not.toHaveBeenCalled();
  });
});
