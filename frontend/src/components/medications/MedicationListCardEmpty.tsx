export function MedicationListCardEmpty() {
  return (
    <div className="bg-surface border border-border rounded-lg shadow-card overflow-hidden">
      <div className="bg-surface-2 border-b border-border px-3.5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] bg-surface-3 rounded-md flex items-center justify-center text-[13px]">💊</div>
          <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary">Medications</span>
        </div>
        <button className="h-7 px-3 bg-surface-2 text-text-secondary border border-border rounded-md text-[11px] font-semibold cursor-pointer hover:bg-surface-3 hover:text-text-primary transition-colors">
          Manage
        </button>
      </div>
      <div className="py-5 px-3.5 text-xs text-text-muted text-center">
        No medications recorded yet.
      </div>
    </div>
  );
}
