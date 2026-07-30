'use client';

import React from 'react';
import {
  MessageSquare,
  Stethoscope,
  ClipboardList,
  Search,
  Pill,
  History,
  FlaskConical,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { InitialNoteSnapshot } from '@/types/initial-note';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  changed?: boolean;
  children: React.ReactNode;
}

/**
 * Section header matched to NoteFormattedSections so a historical version reads
 * exactly like a note in the timeline.
 */
function Section({ title, icon, changed, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 border-b-[1.5px] border-b-[var(--border-strong)] pb-1 w-full text-[var(--text-secondary)] font-bold">
        {icon}
        <span className="text-[11.5px] uppercase tracking-[0.6px]">{title}</span>
        {changed && (
          <Badge variant="info" className="ml-1.5">
            Changed
          </Badge>
        )}
      </div>
      <div className="text-[13px] text-[var(--text-primary)] leading-[1.65] pl-2 whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

function EmptyValue() {
  return <span className="text-[12px] text-[var(--text-muted)] italic">Not documented</span>;
}

interface InitialNoteVersionViewProps {
  snapshot: InitialNoteSnapshot;
  /** Field keys that differ from the previous version; drives the Changed badges. */
  changedFields: string[];
}

export function InitialNoteVersionView({
  snapshot,
  changedFields,
}: InitialNoteVersionViewProps) {
  const changed = (field: string) => changedFields.includes(field);

  const historyFields: { key: keyof InitialNoteSnapshot; label: string }[] = [
    { key: 'pmhComorbidities', label: 'Comorbidities' },
    { key: 'pmhSurgeries', label: 'Past Surgeries' },
    { key: 'pmhHospitalizations', label: 'Hospitalizations' },
    { key: 'allergies', label: 'Allergies' },
    { key: 'familyHistory', label: 'Family History' },
    { key: 'socialHistory', label: 'Social History' },
    { key: 'obHistory', label: 'OB History' },
    { key: 'psychosocialHistory', label: 'Psychosocial History' },
  ];

  const hasAnyHistory = historyFields.some((f) => !!snapshot[f.key]);
  const historyChanged = historyFields.some((f) => changed(f.key as string));

  const assessment = snapshot.assessment ?? [];
  const medications = snapshot.medicationSnapshot ?? [];
  const diagnostics = snapshot.diagnostics ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Chief Complaint"
        icon={<MessageSquare className="w-3.5 h-3.5" />}
        changed={changed('chiefComplaint')}
      >
        {snapshot.chiefComplaint || <EmptyValue />}
      </Section>

      <Section
        title="History of Present Illness"
        icon={<ClipboardList className="w-3.5 h-3.5" />}
        changed={changed('hpi')}
      >
        {snapshot.hpi || <EmptyValue />}
      </Section>

      <Section
        title="History"
        icon={<History className="w-3.5 h-3.5" />}
        changed={historyChanged}
      >
        {hasAnyHistory ? (
          <div className="flex flex-col gap-2">
            {historyFields
              .filter((f) => !!snapshot[f.key])
              .map((f) => (
                <div key={f.key} className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[var(--text-muted)]">
                    {f.label}
                  </span>
                  <span>{snapshot[f.key] as string}</span>
                </div>
              ))}
          </div>
        ) : (
          <EmptyValue />
        )}
      </Section>

      <Section
        title="Physical Exam"
        icon={<Stethoscope className="w-3.5 h-3.5" />}
        changed={changed('physicalExam')}
      >
        {snapshot.physicalExam || <EmptyValue />}
      </Section>

      <Section
        title="Assessment"
        icon={<Search className="w-3.5 h-3.5" />}
        changed={changed('assessment')}
      >
        {assessment.length > 0 ? (
          <div className="flex flex-col gap-1">
            {assessment.map((item, i) => {
              const depth = item.depth ?? 0;
              return (
                <div
                  key={`${item.title}-${i}`}
                  className="flex items-center gap-2"
                  style={depth > 0 ? { paddingLeft: `${depth * 20}px` } : undefined}
                >
                  {depth > 0 && (
                    <span className="font-mono text-[var(--text-muted)] select-none">↳</span>
                  )}
                  <span className="text-[13px] font-medium">{item.title}</span>
                  {item.icdCode && (
                    <span className="font-mono text-[10px] text-[var(--text-muted)] bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                      {item.icdCode}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyValue />
        )}
      </Section>

      <Section
        title="Medications"
        icon={<Pill className="w-3.5 h-3.5" />}
        changed={changed('medicationSnapshot')}
      >
        {medications.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {medications.map((med, i) => (
              <div key={`${med.name}-${i}`} className="flex flex-col">
                <span className="text-[13px] font-medium">
                  {[med.name, med.dose, med.formulation].filter(Boolean).join(' ')}
                </span>
                {med.instructions && (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {med.instructions}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyValue />
        )}
      </Section>

      <Section
        title="Diagnostics"
        icon={<FlaskConical className="w-3.5 h-3.5" />}
        changed={changed('diagnostics')}
      >
        {diagnostics.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {diagnostics.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="text-[11px] text-[var(--text-secondary)] bg-surface-2 border border-border rounded-[4px] px-2 py-0.5"
              >
                {d}
              </span>
            ))}
          </div>
        ) : (
          <EmptyValue />
        )}
      </Section>

      <Section
        title="Non-pharmacologic Management"
        icon={<ClipboardList className="w-3.5 h-3.5" />}
        changed={changed('mgmtNonpharm')}
      >
        {snapshot.mgmtNonpharm || <EmptyValue />}
      </Section>
    </div>
  );
}
