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
  const medicationCreate = jest.fn().mockImplementation(({ data }) =>
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

  const service = new MedicationsService({} as any, { create: jest.fn() } as any);

  return { service, client, medicationUpdate, medicationCreate, medicationLogCreate };
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
    const { service, client, medicationUpdate, medicationLogCreate } = buildService(existing);

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
    const { service, client, medicationUpdate, medicationLogCreate } = buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      // A legacy snapshot without formulation/instructions/quantity at all.
      [{ name: 'Amlodipine', dose: '10 mg' } as any],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationUpdate).not.toHaveBeenCalled();
    expect(medicationLogCreate).not.toHaveBeenCalled();
  });

  it('creates a new row and deactivates the old one when only the dose differs', async () => {
    const existing = [med()];
    const { service, client, medicationCreate, medicationUpdate } = buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [{ name: 'Amlodipine', dose: '5 mg' }],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dose: '5 mg' }) }),
    );
    // The old 10mg row is deactivated, not updated in place.
    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'med-1' }, data: { isActive: false } }),
    );
  });

  it('reactivates an inactive exact match without creating a duplicate', async () => {
    const existing = [med({ isActive: false })];
    const { service, client, medicationCreate, medicationUpdate } = buildService(existing);

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
    const existing = [med(), med({ id: 'med-2', name: 'Losartan', dose: '50 mg' })];
    const { service, client, medicationUpdate } = buildService(existing);

    await service.upsertFromNoteMedications(
      'patient-1',
      [{ name: 'Amlodipine', dose: '10 mg' }],
      'user-1',
      'Progress Note',
      client as any,
    );

    expect(medicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'med-2' }, data: { isActive: false } }),
    );
  });

  it('writes no MedicationLog when nothing changed', async () => {
    const existing = [med()];
    const { service, client, medicationUpdate, medicationLogCreate } = buildService(existing);

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
