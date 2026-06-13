export function VitalsStripEmpty({ patientId }: { patientId: string }) {
  const VITALS = [
    { label: 'Blood Pressure', unit: 'mmHg', placeholder: '—/—' },
    { label: 'Heart Rate',     unit: 'bpm',         placeholder: '—' },
    { label: 'Resp. Rate',     unit: 'breaths/min',  placeholder: '—' },
    { label: 'Temperature',    unit: '°C',           placeholder: '—' },
    { label: 'O₂ Saturation',  unit: '%',            placeholder: '—' },
  ];

  // This component renders a placeholder until Phase 10 implements real vitals.
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#EFF1F5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>❤️</div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>Latest Vital Signs</span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
          No reading today
        </span>
      </div>
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {VITALS.map((v) => (
          <div key={v.label} style={{ background: '#F7F8FA', border: '1px solid #D1D5E0', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6B7280', marginBottom: 6 }}>{v.label}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#9BA3B5', fontFamily: "'IBM Plex Mono', monospace", marginBottom: 2 }}>{v.placeholder}</div>
            <div style={{ fontSize: 10, color: '#6B7280' }}>{v.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
