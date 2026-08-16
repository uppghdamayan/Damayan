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
import { cn } from '@/lib/utils';
import type { InitialNoteSnapshot } from '@/types/initial-note';

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  changed?: boolean;
  children: React.ReactNode;
}

/**
 * Section header matched to NoteFormattedSections so a historical version reads
 * cleanly and legibly with subtle change cues rather than loud visual noise.
 */
function Section({ title, icon, changed, children }: SectionProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3.5 shadow-card transition-all"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2 w-full">
        <div className="flex items-center gap-2 text-text-secondary font-bold">
          <div className="w-[22px] h-[22px] rounded-icon flex items-center justify-center text-[11px] bg-surface-2 text-text-muted">
            {icon}
          </div>
          <span className="text-[11px] uppercase tracking-[0.6px] text-text-primary">{title}</span>
        </div>
        {changed && (
          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-amber bg-amber-bg border border-amber-border/70 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" />
            Modified
          </span>
        )}
      </div>
      <div className="text-[13px] text-text-primary leading-[1.65] pt-0.5 whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}

function EmptyValue() {
  return <span className="text-[12px] text-text-muted italic">Not documented</span>;
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
    { key: 'familyHistory', label: 'Family Medical History' },
    { key: 'socialHistory', label: 'Personal & Social History' },
    { key: 'obHistory', label: 'OB / Menstrual History' },
    { key: 'psychosocialHistory', label: 'Psychosocial History' },
  ];

  const hasAnyHistory = historyFields.some((f) => !!snapshot[f.key]);
  const historyChanged = historyFields.some((f) => changed(f.key as string));

  const assessment = snapshot.assessment ?? [];
  const medications = snapshot.medicationSnapshot ?? [];
  const diagnostics = snapshot.diagnostics ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Chief Complaint"
        icon={<MessageSquare className="w-3.5 h-3.5" />}
        changed={changed('chiefComplaint')}
      >
        {snapshot.chiefComplaint || <EmptyValue />}
      </Section>

      <Section
        title="History of Present Illness (HPI)"
        icon={<ClipboardList className="w-3.5 h-3.5" />}
        changed={changed('hpi')}
      >
        {snapshot.hpi || <EmptyValue />}
      </Section>

      <Section
        title="History Module (PMH, Family, Social)"
        icon={<History className="w-3.5 h-3.5" />}
        changed={historyChanged}
      >
        {hasAnyHistory ? (
          <div className="grid grid-cols-1 @min-[1024px]:grid-cols-2 gap-3.5 pt-1">
            {historyFields
              .filter((f) => !!snapshot[f.key])
              .map((f) => {
                const isFieldChanged = changed(f.key as string);
                return (
                  <div
                    key={f.key}
                    className={cn(
                      "flex flex-col gap-0.5 rounded p-2.5 transition-all border",
                      isFieldChanged
                        ? "bg-amber-bg/20 border-amber-border/50"
                        : "bg-surface-2/40 border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.5px]",
                        isFieldChanged ? "text-amber" : "text-text-muted"
                      )}>
                        {f.label}
                      </span>
                      {isFieldChanged && (
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-amber bg-amber-bg border border-amber-border px-1 py-0 rounded">
                          Modified
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-[12.5px] leading-relaxed mt-0.5 whitespace-pre-wrap",
                      isFieldChanged ? "font-medium text-text-primary" : "text-text-secondary"
                    )}>
                      {snapshot[f.key] as string}
                    </p>
                  </div>
                );
              })}
          </div>
        ) : (
          <EmptyValue />
        )}
      </Section>

      <Section
        title="Physical Examination"
        icon={<Stethoscope className="w-3.5 h-3.5" />}
        changed={changed('physicalExam')}
      >
        {snapshot.physicalExam || <EmptyValue />}
      </Section>

      <Section
        title="Assessment (Active Problems)"
        icon={<Search className="w-3.5 h-3.5" />}
        changed={changed('assessment')}
      >
        {assessment.length > 0 ? (
          <div className="flex flex-col gap-1.5 pt-0.5">
            {assessment.map((item, i) => {
              const itemAny = item as any;
              const depth = itemAny.parentId ? (itemAny.depth || 1) : (itemAny.parentId === null ? 0 : (item.depth ?? 0));
              return (
                <div
                  key={`${item.title}-${i}`}
                  className="flex items-center gap-2 py-1 border-b border-border/50 last:border-b-0"
                  style={depth > 0 ? { paddingLeft: `${depth * 18}px` } : undefined}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  {depth > 0 && (
                    <span className="font-mono text-text-muted select-none text-[11px]">↳</span>
                  )}
                  <span className="text-[12.5px] font-medium text-text-primary">{item.title}</span>
                  {item.icdCode && (
                    <span className="font-mono text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
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
          <div className="flex flex-col gap-2 pt-0.5">
            {medications.map((med, i) => (
              <div key={`${med.name}-${i}`} className="flex items-start gap-2 py-1.5 px-2.5 rounded bg-surface-2/50 border border-border/60 text-[12px]">
                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-text-primary">{med.name}</span>
                    {med.dose && <span className="font-mono font-semibold text-accent">{med.dose}</span>}
                    {med.formulation && <span className="text-text-secondary">({med.formulation})</span>}
                    {med.quantity && <span className="text-text-muted">Qty: {med.quantity}</span>}
                  </div>
                  {med.instructions && (
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {med.instructions}
                    </div>
                  )}
                </div>
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
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {diagnostics.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="text-[11px] font-medium text-text-secondary bg-surface-2 border border-border rounded px-2 py-0.5"
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
