'use client';

import { useParams } from 'next/navigation';
import { DocumentsScreen } from '@/components/documents/DocumentsScreen';

export default function DocumentsPage() {
  const { patientId } = useParams<{ patientId: string }>();

  return <DocumentsScreen patientId={patientId} />;
}
