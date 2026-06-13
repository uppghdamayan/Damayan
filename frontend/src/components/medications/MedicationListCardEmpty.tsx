export function MedicationListCardEmpty() {
  return (
    <div className="bg-white border border-[#D1D5E0] rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-[#F7F8FA] border-b border-[#D1D5E0] px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-[#EFF1F5] rounded-md flex items-center justify-center text-[13px]">💊</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#374151]">Medications</span>
        </div>
        <button className="h-7 px-3 bg-[#F7F8FA] text-[#374151] border border-[#D1D5E0] rounded-md text-[11px] font-semibold cursor-pointer">
          Manage
        </button>
      </div>
      <div className="py-5 px-3.5 text-xs text-[#6B7280] text-center">
        No medications recorded yet.
      </div>
    </div>
  );
}
