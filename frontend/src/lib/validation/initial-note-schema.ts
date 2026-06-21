import { z } from 'zod';

export const assessmentItemSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  icdCode: z.string().optional(),
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
  mgmtNonpharm: z.string().optional().or(z.literal('')),
  diagnostics: z.array(z.string()).optional(),
  visitDatetime: z.string().optional(),
});

export const initialNotePublishSchema = initialNoteDraftSchema.extend({
  chiefComplaint: z.string().min(1, 'Chief Complaint is required').max(50, 'Max 50 characters'),
  hpi: z.string().min(1, 'HPI is required'),
  physicalExam: z.string().min(1, 'Physical Exam is required'),
  assessment: z.array(assessmentItemSchema).min(1, 'At least one assessment is required'),
  visitDatetime: z.string().min(1, 'Visit Datetime is required'),
});

export type InitialNoteDraftValues = z.infer<typeof initialNoteDraftSchema>;
export type InitialNotePublishValues = z.infer<typeof initialNotePublishSchema>;
