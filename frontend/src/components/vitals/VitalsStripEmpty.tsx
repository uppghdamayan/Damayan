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
    <div className="bg-white border border-[#D1D5E0] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-[#F7F8FA] border-b border-[#D1D5E0] px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-[#EFF1F5] rounded-md flex items-center justify-center text-[13px]">❤️</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#374151]">Latest Vital Signs</span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.6px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B]">
          No reading today
        </span>
      </div>
      <div className="p-3.5 grid grid-cols-5 gap-2">
        {VITALS.map((v) => (
          <div key={v.label} className="bg-[#F7F8FA] border border-[#D1D5E0] rounded-lg px-3 py-2.5 text-center">
            <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#6B7280] mb-1.5">{v.label}</div>
            <div className="text-lg font-medium text-[#9BA3B5] font-mono mb-0.5">{v.placeholder}</div>
            <div className="text-[10px] text-[#6B7280]">{v.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
