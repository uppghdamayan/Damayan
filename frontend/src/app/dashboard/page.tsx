export default function DashboardIndexPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 12, padding: 32,
    }}>
      <div style={{ width: 48, height: 48, background: '#D4EDE9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
        👤
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', margin: 0 }}>
        No patient selected
      </h2>
      <p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 320, margin: 0 }}>
        Select a patient from the sidebar to view their record, or register a new patient using the <strong>+ New Patient</strong> button.
      </p>
    </div>
  );
}
