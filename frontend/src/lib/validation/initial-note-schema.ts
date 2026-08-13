import { z } from 'zod';

export const assessmentItemSchema = z.object({
  // Stable Problem.id this entry represents, once it exists as a master
  // Problem record. Already written and relied on throughout the note forms
  // (mergeActiveProblems, Revert) — added here to close a latent gap: the
  // schema never actually declared it.
  id: z.string().optional(),
  // Client-generated key for a problem added within this note that has no
  // master Problem row yet — lets one freshly-added item nest under another
  // before either has a real id.
  tempId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  parentId: z.string().optional().nullable(),
  depth: z.number().optional(),
  isNew: z.boolean().optional(),
  diagnosisDate: z.string().optional().nullable(),
});

export const initialNoteDraftSchema = z.object({
  chiefComplaint: z.string().max(50).optional().or(z.literal('')),
  hpi: z.string().optional().or(z.literal('')),
  pmhComorbidities: z.string().optional().or(z.literal('')),
  pmhSurgeries: z.string().optional().or(z.literal('')),
  pmhHospitalizations: z.string().optional().or(z.literal('')),
  allergies: z.string().optional().or(z.literal('')),
  familyHistory: z.string().optional().or(z.literal('')),
  socialHistory: z.string().optional().or(z.literal('')),
  obHistory: z.string().optional().or(z.literal('')),
  psychosocialHistory: z.string().optional().or(z.literal('')),
  physicalExam: z.string().optional().or(z.literal('')),
  assessment: z.array(assessmentItemSchema).optional(),
  medicationSnapshot: z.array(z.any()).optional(),
  mgmtNonpharm: z.string().optional().or(z.literal('')),
  mgmtPharm: z.string().optional().or(z.literal('')),
  diagnostics: z.array(z.string()).optional(),
  visitDatetime: z.string().optional(),
});

export const initialNotePublishSchema = initialNoteDraftSchema.extend({
  chiefComplaint: z.string().min(1, 'Chief Complaint is required').max(50, 'Max 50 characters'),
  hpi: z.string().min(1, 'HPI is required'),
  physicalExam: z.string().min(1, 'Physical Exam is required'),
  assessment: z.array(assessmentItemSchema).min(1, 'At least one assessment is required'),
  medicationSnapshot: z.array(z.any()),
  visitDatetime: z.string().min(1, 'Visit Datetime is required'),
});

export type InitialNoteDraftValues = z.infer<typeof initialNoteDraftSchema>;
export type InitialNotePublishValues = z.infer<typeof initialNotePublishSchema>;
