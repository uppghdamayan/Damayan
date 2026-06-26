export type ProblemStatusValue = 'ACTIVE' | 'RESOLVED' | 'REMOVED';

export interface Problem {
  id: string;
  patientId: string;
  parentId: string | null;
  title: string;
  icdCode: string | null;
  status: ProblemStatusValue;
  sortOrder: number;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
  addedByUser?: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  } | null;
  updatedBy?: string | null;
  updatedByUser?: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  } | null;
}

export interface ProblemNode extends Problem {
  children: ProblemNode[];
}

export interface ProblemsResponse {
  data: Problem[];
}

export interface ProblemLog {
  id: string;
  patientId: string;
  problemId: string | null;
  action: string;
  description: string;
  editorId: string;
  createdAt: string;
  editor: {
    firstName: string;
    lastName: string;
    role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  };
}

export interface ProblemLogsResponse {
  data: ProblemLog[];
}
