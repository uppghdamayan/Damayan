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
}

export interface ProblemNode extends Problem {
  children: ProblemNode[];
}

export interface ProblemsResponse {
  data: Problem[];
}
