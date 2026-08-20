import type { DocumentDraftData } from '@/hooks/useDocuments';

interface DocumentDraftPreviewProps {
  draft: DocumentDraftData;
  title: string;
  showMedications?: boolean;
}

// Read-only draft block shown before generating a PDF — kept in lockstep with
// the PDF templates (backend/src/documents/templates/layout.helper.ts) so
// what the doctor previews here is exactly what prints:
//  - Assessment: same order + indent-by-depth as drawAssessmentList
//  - Medications: same fields as drawMedicationList (dose/formulation, #qty, Sig)
export function DocumentDraftPreview({ draft, title, showMedications = true }: DocumentDraftPreviewProps) {
  return (
    <div className="bg-surface-2 border border-border rounded-card p-4 text-[13px] text-text-primary">
      <h3 className="font-bold text-[14px] mb-2 border-b border-border pb-1">{title}</h3>
      <p><strong>Patient:</strong> {draft.patient.firstName} {draft.patient.lastName}</p>

      <div className="mt-2 font-bold">Assessment:</div>
      {draft.assessment && draft.assessment.length > 0 ? (
        <ul className="list-none">
          {draft.assessment.map((a) => (
            <li key={a.id} style={{ paddingLeft: a.depth * 14 }}>
              {a.depth > 0 ? '-> ' : '• '}{a.title}
            </li>
          ))}
        </ul>
      ) : (
        <p>No assessment</p>
      )}

      {showMedications && (
        <>
          <div className="mt-2 font-bold">Medications:</div>
          {draft.medications && draft.medications.length > 0 ? (
            <ul className="list-none">
              {draft.medications.map((m) => {
                const detail = [m.dose, m.formulation].filter(Boolean).join(' ');
                const qty = m.quantity ? ` #${m.quantity}` : '';
                return (
                  <li key={m.id} className="mb-1">
                    <div><strong>{m.name}</strong> {detail}{qty}</div>
                    {m.instructions && (
                      <div className="text-text-secondary">Sig: {m.instructions}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No active medications</p>
          )}
        </>
      )}
    </div>
  );
}
