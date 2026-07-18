'use client';

import { useState } from 'react';
import { calcAge, initials } from '@/lib/patient-utils';
import { useAuthStore } from '@/stores/authStore';
import { usePatientStore } from '@/stores/patientStore';
import { EditPatientModal } from './EditPatientModal';
import { Pencil } from 'lucide-react';
import type { Patient } from '@/types/patient';

export function PatientBanner({ patient }: { patient: Patient }) {
  const { user } = useAuthStore();
  const { setActivePatient } = usePatientStore();
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  const age = calcAge(patient.dateOfBirth);
  const dob = new Date(patient.dateOfBirth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const ini = initials(patient.firstName, patient.lastName);
  
  const allergyList = patient.allergies
    ? patient.allergies.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const addressParts = [
    patient.addressStreet,
    patient.addressBarangay,
    patient.addressCity,
    patient.addressRegion,
    'Philippines',
  ].filter(Boolean);
  const addressStr = addressParts.length > 0 ? addressParts.join(', ') : 'Not documented';

  const sexLabel = patient.sex === 'MALE' ? 'Male' : patient.sex === 'FEMALE' ? 'Female' : 'Other';

  return (
    <div className="relative bg-surface border border-border rounded-card p-4 flex gap-5 items-stretch flex-wrap shadow-card">
      {/* Left Column: Avatar + Name (Section 7.1) */}
      <div className="flex gap-3.5 items-center flex-[1.2] min-w-[250px] border-r border-border pr-5">
        <div className="w-11 h-11 rounded-full bg-accent-light border-2 border-accent flex items-center justify-center text-[15px] font-bold text-accent-hover flex-shrink-0">
          {ini}
        </div>
        <div className="text-[12px] flex flex-col gap-1 min-w-0">
          <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px]">Patient Name</span>
          <span className="text-[18px] font-bold text-text-primary leading-tight truncate" title={`${patient.lastName}, ${patient.firstName}`}>
            {patient.lastName}, {patient.firstName}
            {patient.middleName ? ` ${patient.middleName}` : ''}
            {patient.extension ? ` ${patient.extension}` : ''}
          </span>
          <span className="font-mono text-[10px] text-text-muted mt-1 bg-surface-2 border border-border rounded px-1.5 py-[1px] w-fit">
            #{patient.patientCode}
          </span>
        </div>
      </div>

      {/* Middle Column: Demographics */}
      <div className="flex flex-col gap-2 flex-1 min-w-[280px] border-r border-border pr-5 justify-center">
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          <div>
            <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] block">Sex</span>
            <strong className="text-text-primary text-[12px]">{sexLabel}</strong>
          </div>
          <div>
            <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] block">Age</span>
            <strong className="text-text-primary text-[12px]">{age} yrs</strong>
          </div>
          <div>
            <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] block">Birthdate</span>
            <strong className="text-text-primary text-[12px]" title={dob}>{dob}</strong>
          </div>
          <div className="col-span-3">
            <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] block">Address</span>
            <span className="text-text-secondary text-[12px] truncate block" title={addressStr}>{addressStr}</span>
          </div>
        </div>
      </div>

      {/* Right Column: Clinical Profile */}
      <div className="flex flex-col gap-1 flex-[0.8] min-w-[180px] text-[12px] text-text-secondary justify-center">
        <span className="text-[9px] font-semibold text-text-muted uppercase tracking-[0.5px] mb-1 block">Clinical Profile</span>
        <div className="flex flex-col gap-1.5">
          {/* Allergies tags */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-[11px] font-medium text-text-muted">Allergies:</span>
            {allergyList.length > 0 ? (
              <div className="flex gap-1.5 flex-wrap">
                {allergyList.map((a) => (
                  <span key={a} className="text-[9px] font-bold bg-red-bg text-red border border-red-border px-[7px] py-[2px] rounded-[4px] inline-flex items-center gap-[3px]" title={`Allergy: ${a}`}>
                    ⚠ {a}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-text-muted text-[11px] italic">None documented</span>
            )}
          </div>

          {/* Record statistics */}
          <div className="flex gap-2 flex-wrap text-[11px] text-text-muted mt-1">
            <span>Problems: <strong className="text-text-secondary font-mono">{patient._count?.problems ?? 0}</strong></span>
            <span>·</span>
            <span>Meds: <strong className="text-text-secondary font-mono">{patient._count?.medications ?? 0}</strong></span>
            <span>·</span>
            <span>Visits: <strong className="text-text-secondary font-mono">{patient._count?.visits ?? 0}</strong></span>
          </div>
        </div>
      </div>
      {/* Edit button — top-right of banner */}
      {canEdit && (
        <button
          onClick={() => setEditOpen(true)}
          title="Edit patient demographics"
          className="absolute top-3 right-3 h-[28px] px-2.5 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
      )}

      <EditPatientModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        patient={patient}
        onUpdated={(updated) => {
          setActivePatient(updated);
          setEditOpen(false);
        }}
      />
    </div>
  );
}
