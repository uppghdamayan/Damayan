import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProgressNoteDto } from './create-progress-note.dto';

describe('CreateProgressNoteDto medicationSnapshot validation', () => {
  it('rejects an instructions value over 255 characters', async () => {
    const dto = plainToInstance(CreateProgressNoteDto, {
      medicationSnapshot: [
        {
          name: 'Amlodipine',
          dose: '10 mg',
          instructions: 'Take 1 tablet by mouth twice daily after meals. '.repeat(11),
        },
      ],
    });

    const errors = await validate(dto);
    const medErrors = errors.find((e) => e.property === 'medicationSnapshot');
    expect(medErrors).toBeDefined();
    // medicationSnapshot -> [0] (array index) -> instructions
    const nested = medErrors!.children?.[0]?.children?.[0]?.constraints || {};
    expect(Object.keys(nested)).toContain('maxLength');
  });

  it('accepts a well-formed isNew medication with no id/tempId field', async () => {
    const dto = plainToInstance(CreateProgressNoteDto, {
      medicationSnapshot: [
        {
          name: 'Sodium Bicarbonate',
          dose: '650 mg',
          isNew: true,
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
