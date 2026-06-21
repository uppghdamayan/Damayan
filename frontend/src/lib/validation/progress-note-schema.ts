import { z } from 'zod';
import { assessmentItemSchema } from './initial-note-schema';

export const progressNoteDraftSchema = z.object({
  subjective: z.string().optional().or(z.literal('')),
  objective: z.string().optional().or(z.literal('')),
  mgmtNonpharm: z.string().optional().or(z.literal('')),
  diagnostics: z.array(z.string()).optional(),
  problemListSnapshot: z.array(assessmentItemSchema).optional(),
  medicationSnapshot: z.array(z.any()).optional(),
  visitDatetime: z.string().optional(),
});

export const progressNotePublishSchema = progressNoteDraftSchema.extend({
  subjective: z.string().min(1, 'Subjective is required'),
  objective: z.string().min(1, 'Objective is required'),
});

export type ProgressNoteDraftValues = z.infer<typeof progressNoteDraftSchema>;
export type ProgressNotePublishValues = z.infer<typeof progressNotePublishSchema>;
