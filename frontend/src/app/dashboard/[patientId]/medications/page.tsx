'use client';

import { useParams } from 'next/navigation';
import { MedicationsScreen } from '@/components/medications/MedicationsScreen';

export default function MedicationsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  return <MedicationsScreen patientId={patientId} />;
}
