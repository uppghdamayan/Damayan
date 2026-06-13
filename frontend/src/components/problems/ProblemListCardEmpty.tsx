export function ProblemListCardEmpty() {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, background: '#EFF1F5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📋</div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>Problem List</span>
        </div>
        <button style={{ height: 28, padding: '0 12px', background: '#F7F8FA', color: '#374151', border: '1px solid #D1D5E0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          Manage
        </button>
      </div>
      <div style={{ padding: '20px 14px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
        No problems recorded. Problems are added when the Initial Note assessment is published.
      </div>
    </div>
  );
}
