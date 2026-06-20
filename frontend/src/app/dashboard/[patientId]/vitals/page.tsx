'use client';

import { useParams } from 'next/navigation';
import { VitalsScreen } from '@/components/vitals/VitalsScreen';

export default function VitalsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  return <VitalsScreen patientId={patientId} />;
}
