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
    <div style={{
      background: '#FFFFFF', border: '1px solid #D1D5E0',
      borderRadius: 8, padding: 16,
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      display: 'flex', gap: 16, alignItems: 'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: '#085A4E', color: '#FFFFFF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, flexShrink: 0,
      }}>
        {ini}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0D1117' }}>
            {patient.lastName}, {patient.firstName}
            {patient.middleName ? ` ${patient.middleName}` : ''}
            {patient.extension ? ` ${patient.extension}` : ''}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#6B7280', background: '#F7F8FA', border: '1px solid #D1D5E0', borderRadius: 4, padding: '1px 6px' }}>
            {patient.patientCode}
          </span>
        </div>

        <div style={{ fontSize: 12, color: '#374151', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>{patient.sex === 'MALE' ? 'Male' : patient.sex === 'FEMALE' ? 'Female' : 'Other'}</span>
          <span style={{ color: '#D1D5E0' }}>|</span>
          <span>DOB: {dob}</span>
          <span style={{ color: '#D1D5E0' }}>|</span>
          <span>{age} years old</span>
          {addressParts.length > 0 && (
            <>
              <span style={{ color: '#D1D5E0' }}>|</span>
              <span>{addressParts.join(', ')}</span>
            </>
          )}
        </div>

        {/* Allergy tags */}
        {allergyList.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6B7280', alignSelf: 'center' }}>Allergies:</span>
            {allergyList.map((a) => (
              <span key={a} style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: '#FEE2E2', color: '#991B1B', border: '1px solid #EF4444',
              }}>
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
