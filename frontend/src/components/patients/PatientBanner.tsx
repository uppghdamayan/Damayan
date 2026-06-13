import { calcAge, initials } from '@/lib/patient-utils';
import type { Patient } from '@/types/patient';

export function PatientBanner({ patient }: { patient: Patient }) {
  const age = calcAge(patient.dateOfBirth);
  const dob = new Date(patient.dateOfBirth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const ini = initials(patient.firstName, patient.lastName);
  const allergyList = patient.allergies
    ? patient.allergies.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const addressParts = [
    patient.addressBarangay,
    patient.addressCity,
    patient.addressRegion,
    'Philippines',
  ].filter(Boolean);

  return (
    <div className="bg-white border border-[#D1D5E0] rounded-lg p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] flex gap-4 items-start">
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-[#085A4E] text-white flex items-center justify-center text-base font-bold shrink-0">
        {ini}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap mb-1">
          <span className="text-lg font-bold text-[#0D1117]">
            {patient.lastName}, {patient.firstName}
            {patient.middleName ? ` ${patient.middleName}` : ''}
            {patient.extension ? ` ${patient.extension}` : ''}
          </span>
          <span className="font-mono text-[11px] text-[#6B7280] bg-[#F7F8FA] border border-[#D1D5E0] rounded px-1.5 py-[1px]">
            {patient.patientCode}
          </span>
        </div>

        <div className="text-xs text-[#374151] flex gap-3 flex-wrap">
          <span>{patient.sex === 'MALE' ? 'Male' : patient.sex === 'FEMALE' ? 'Female' : 'Other'}</span>
          <span className="text-[#D1D5E0]">|</span>
          <span>DOB: {dob}</span>
          <span className="text-[#D1D5E0]">|</span>
          <span>{age} years old</span>
          {addressParts.length > 0 && (
            <>
              <span className="text-[#D1D5E0]">|</span>
              <span>{addressParts.join(', ')}</span>
            </>
          )}
        </div>

        {/* Allergy tags */}
        {allergyList.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            <span className="text-[10px] font-bold uppercase text-[#6B7280] self-center">Allergies:</span>
            {allergyList.map((a) => (
              <span key={a} className="text-[11px] font-semibold px-2 py-0.5 rounded-[20px] bg-[#FEE2E2] text-[#991B1B] border border-[#EF4444]">
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
