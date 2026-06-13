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
      <div className="flex flex-col items-center h-full font-sans">
        {/* Zone A — Primary Action Area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[600px] px-5 gap-0">
          {/* Icon container */}
          <div className="w-10 h-10 rounded-lg bg-[#D4EDE9] flex items-center justify-center mb-3">
            <UserSearch size={22} color="#0A6E5F" strokeWidth={1.5} />
          </div>

          {/* Headline */}
          <h2 className="text-xl font-bold text-[#0D1117] m-0 mb-2">
            Select a patient to begin
          </h2>

          {/* Subline */}
          <p className="text-[13px] text-[#6B7280] text-center max-w-[340px] m-0 mb-5 leading-relaxed">
            Search the sidebar or register a new patient to open their clinical record.
          </p>

          {/* CTA button */}
          {canCreatePatient && (
            <button
              onClick={() => setNewPatientOpen(true)}
              className="h-[34px] px-[18px] bg-[#0A6E5F] text-white border border-[#085A4E] rounded-md text-xs font-semibold cursor-pointer shadow-[0_2px_4px_rgba(10,110,95,0.15)] transition-all duration-150 font-sans hover:bg-[#085A4E] hover:shadow-[0_4px_8px_rgba(10,110,95,0.2)]"
            >
              + New Patient
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="h-px bg-[#D1D5E0] w-full max-w-[600px] mx-auto mb-6" />

        {/* Zone B — Feature Orientation Grid */}
        <div className="w-full max-w-[600px] px-5 pb-8 grid grid-cols-3 gap-4">
          {capabilityCards.map((card) => (
            <div
              key={card.title}
              className="bg-white border border-[#D1D5E0] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center gap-[9px] px-3.5 py-2.5 bg-[#F7F8FA] border-b border-[#D1D5E0]">
                {/* Icon container */}
                <div className="w-8 h-8 rounded-md bg-[#D4EDE9] flex items-center justify-center shrink-0">
                  <card.icon size={20} color="#0A6E5F" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold text-[#0D1117]">
                  {card.title}
                </span>
              </div>

              {/* Card body */}
              <div className="px-3.5 py-3">
                <p className="text-[11px] text-[#6B7280] m-0 leading-relaxed">
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
