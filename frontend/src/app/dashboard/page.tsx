'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { UserSearch, ClipboardList, Activity, FileText } from 'lucide-react';
import type { Patient } from '@/types/patient';

const capabilityCards = [
  {
    icon: ClipboardList,
    title: 'Problem-Oriented Notes',
    description: 'All clinical findings are organized by problem, not by date.',
  },
  {
    icon: Activity,
    title: 'Cumulative Medication List',
    description: 'A single medication list carries forward across every visit automatically.',
  },
  {
    icon: FileText,
    title: 'One-Click Documents',
    description: 'Generate prescriptions, lab requests, and charge slips from any visit.',
  },
];

export default function DashboardIndexPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [newPatientOpen, setNewPatientOpen] = useState(false);

  const canCreatePatient = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  return (
    <>
      <div className="flex flex-col items-center h-full font-sans bg-bg">
        {/* Zone A — Primary Action Area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[600px] px-5 gap-0">
          {/* Icon container */}
          <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center mb-3">
            <UserSearch size={22} className="text-accent" strokeWidth={1.5} />
          </div>

          {/* Headline */}
          <h2 className="text-xl font-bold text-text-primary m-0 mb-2">
            Select a patient to begin
          </h2>

          {/* Subline */}
          <p className="text-[13px] text-text-muted text-center max-w-[340px] m-0 mb-5 leading-relaxed">
            Search the sidebar or register a new patient to open their clinical record.
          </p>

          {/* CTA button */}
          {canCreatePatient && (
            <button
              onClick={() => setNewPatientOpen(true)}
              className="h-[34px] px-3.5 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover shadow-btn-primary hover:bg-accent-hover hover:shadow-btn-primary-hover transition-all duration-150 inline-flex items-center gap-[5px] whitespace-nowrap cursor-pointer"
            >
              + New Patient
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="h-px bg-border w-full max-w-[600px] mx-auto mb-6" />

        {/* Zone B — Feature Orientation Grid */}
        <div className="w-full max-w-[600px] px-5 pb-8 grid grid-cols-3 gap-4">
          {capabilityCards.map((card) => (
            <div
              key={card.title}
              className="bg-surface border border-border rounded-card shadow-card overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
                {/* Icon container */}
                <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] flex-shrink-0">
                  <card.icon size={14} className="text-accent" strokeWidth={2} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
                  {card.title}
                </span>
              </div>

              {/* Card body */}
              <div className="px-3.5 py-3 bg-surface">
                <p className="text-[11px] text-text-muted m-0 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NewPatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        onCreated={(p) => {
          setNewPatientOpen(false);
          router.push(`/dashboard/${(p as Patient).id}`);
        }}
      />
    </>
  );
}

