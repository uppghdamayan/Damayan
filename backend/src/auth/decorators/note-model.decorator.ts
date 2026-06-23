import { SetMetadata } from '@nestjs/common';

export const NOTE_MODEL_KEY = 'noteModel';
export const NoteModel = (model: 'initialNote' | 'progressNote') =>
  SetMetadata(NOTE_MODEL_KEY, model);
