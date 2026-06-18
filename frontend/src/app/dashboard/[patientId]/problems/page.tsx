'use client';

import { useParams } from 'next/navigation';
import { ProblemListScreen } from '@/components/problems/ProblemListScreen';

export default function ProblemsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  return <ProblemListScreen patientId={patientId} />;
}
