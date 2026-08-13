export type UserRole = 'DOCTOR' | 'NURSE' | 'ADMIN';

export interface LogEditor {
  firstName: string;
  lastName: string;
  role: UserRole;
}

/** One entry in the patient-scoped Initial Note master change log. */
export interface InitialNoteLog {
  id: string;
  patientId: string;
  /** null once the note it referred to was hard-deleted (a draft). */
  initialNoteId: string | null;
  /** Set when this entry produced a version snapshot. */
  versionId: string | null;
  action: string;
  description: string;
  editorId: string;
  createdAt: string;
  editor: LogEditor;
}

export interface InitialNoteLogsResponse {
  data: InitialNoteLog[];
}

/**
 * The clinical content of an Initial Note frozen at one point in time. Keys
 * mirror `INITIAL_NOTE_CONTENT_FIELDS` on the backend.
 */
export interface InitialNoteSnapshot {
  status: 'DRAFT' | 'PUBLISHED';
  chiefComplaint: string | null;
  hpi: string | null;
  pmhComorbidities: string | null;
  pmhSurgeries: string | null;
  pmhHospitalizations: string | null;
  allergies: string | null;
  familyHistory: string | null;
  socialHistory: string | null;
  obHistory: string | null;
  psychosocialHistory: string | null;
  physicalExam: string | null;
  assessment: { title: string; icdCode?: string | null; depth?: number }[] | null;
  medicationSnapshot:
    | {
        name: string;
        dose?: string | number | null;
        unit?: string | null;
        formulation?: string | null;
        quantity?: string | number | null;
        instructions?: string | null;
      }[]
    | null;
  mgmtNonpharm: string | null;
  diagnostics: string[] | null;
}

/** Version metadata for the history rail — no snapshot payload. */
export interface InitialNoteVersionSummary {
  id: string;
  initialNoteId: string;
  patientId: string;
  versionNumber: number;
  /** Empty on v1 — there is no earlier version to have changed from. */
  changedFields: string[];
  changeSummary: string | null;
  editorId: string;
  createdAt: string;
  editor: LogEditor;
}

export interface InitialNoteVersionDetail extends InitialNoteVersionSummary {
  snapshot: InitialNoteSnapshot;
}

export interface InitialNoteVersionsResponse {
  data: InitialNoteVersionSummary[];
}
