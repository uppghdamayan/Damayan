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
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-surface-3 rounded-md flex items-center justify-center text-[13px]">❤️</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Latest Vital Signs</span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.6px] px-1.5 py-0.5 rounded bg-amber-bg text-amber border border-amber-border">
          No reading today
        </span>
      </div>
      <div className="p-3.5 grid grid-cols-5 gap-2">
        {VITALS.map((v) => (
          <div key={v.label} className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-center">
            <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-muted mb-1.5">{v.label}</div>
            <div className="text-lg font-medium text-border-strong font-mono mb-0.5">{v.placeholder}</div>
            <div className="text-[10px] text-text-muted">{v.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
