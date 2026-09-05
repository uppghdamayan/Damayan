import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInitialNoteDto } from './create-initial-note.dto';

describe('CreateInitialNoteDto medicationSnapshot validation', () => {
  it('accepts an editedFields array marking which fields were edited in-note', async () => {
    const dto = plainToInstance(CreateInitialNoteDto, {
      visitDatetime: new Date().toISOString(),
      medicationSnapshot: [
        {
          name: 'Lisinopril',
          dose: '20 mg',
          editedFields: ['dose'],
        },
      ],
    });

    const errors = await validate(dto);
    const medErrors = errors.find((e) => e.property === 'medicationSnapshot');
    expect(medErrors).toBeUndefined();
  });

  it('rejects a non-string entry inside editedFields', async () => {
    const dto = plainToInstance(CreateInitialNoteDto, {
      visitDatetime: new Date().toISOString(),
      medicationSnapshot: [
        {
          name: 'Lisinopril',
          dose: '20 mg',
          editedFields: [123],
        },
      ],
    });

    const errors = await validate(dto);
    const medErrors = errors.find((e) => e.property === 'medicationSnapshot');
    expect(medErrors).toBeDefined();
    const nested = medErrors!.children?.[0]?.children?.[0]?.constraints || {};
    expect(Object.keys(nested)).toContain('isString');
  });
});
