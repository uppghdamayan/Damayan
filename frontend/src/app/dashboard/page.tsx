'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { UserSearch, ClipboardList, Activity, FileText } from 'lucide-react';
import type { Patient } from '@/types/patient';

const capabilityCards = [
  {
    icon: ClipboardList,
    title: 'Problem-Oriented Notes',
    description: 'All clinical findings are organized by problem, not by date.',
  },
  {
    icon: Activity,
    title: 'Cumulative Medication List',
    description: 'A single medication list carries forward across every visit automatically.',
  },
  {
    icon: FileText,
    title: 'One-Click Documents',
    description: 'Generate prescriptions, lab requests, and charge slips from any visit.',
  },
];

export default function DashboardIndexPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [newPatientOpen, setNewPatientOpen] = useState(false);

  const canCreatePatient = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        {/* Zone A — Primary Action Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
            width: '100%',
            maxWidth: 600,
            padding: '0 20px',
          }}
        >
          {/* Icon container */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'var(--accent-light, #D4EDE9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <UserSearch size={22} color="var(--accent, #0A6E5F)" strokeWidth={1.5} />
          </div>

          {/* Headline */}
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text-primary, #0D1117)',
              margin: 0,
              marginBottom: 8,
            }}
          >
            Select a patient to begin
          </h2>

          {/* Subline */}
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted, #6B7280)',
              textAlign: 'center',
              maxWidth: 340,
              margin: 0,
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            Search the sidebar or register a new patient to open their clinical record.
          </p>

          {/* CTA button */}
          {canCreatePatient && (
            <button
              onClick={() => setNewPatientOpen(true)}
              style={{
                height: 34,
                padding: '0 18px',
                background: 'var(--accent, #0A6E5F)',
                color: '#FFFFFF',
                border: '1px solid var(--accent-hover, #085A4E)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(10,110,95,0.15)',
                transition: 'all 0.15s ease',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-hover, #085A4E)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(10,110,95,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent, #0A6E5F)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(10,110,95,0.15)';
              }}
            >
              + New Patient
            </button>
          )}
        </div>

        {/* Separator */}
        <div
          style={{
            height: 1,
            background: 'var(--border, #D1D5E0)',
            width: '100%',
            maxWidth: 600,
            margin: '0 auto 24px',
          }}
        />

        {/* Zone B — Feature Orientation Grid */}
        <div
          style={{
            width: '100%',
            maxWidth: 600,
            padding: '0 20px 32px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {capabilityCards.map((card) => (
            <div
              key={card.title}
              style={{
                background: 'var(--surface, #FFFFFF)',
                border: '1px solid var(--border, #D1D5E0)',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                overflow: 'hidden',
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '10px 14px',
                  background: 'var(--surface-2, #F7F8FA)',
                  borderBottom: '1px solid var(--border, #D1D5E0)',
                }}
              >
                {/* Icon container */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: 'var(--accent-light, #D4EDE9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <card.icon size={20} color="var(--accent, #0A6E5F)" strokeWidth={1.5} />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary, #0D1117)',
                  }}
                >
                  {card.title}
                </span>
              </div>

              {/* Card body */}
              <div style={{ padding: '12px 14px' }}>
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted, #6B7280)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NewPatientModal
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        onCreated={(p) => {
          setNewPatientOpen(false);
          router.push(`/dashboard/${(p as Patient).id}`);
        }}
      />
    </>
  );
}
