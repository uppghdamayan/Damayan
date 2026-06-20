import type { VitalSign } from '@/types/vitals';

export function isRecentlyUpdated(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000;
}

/** True if the reading is from a date earlier than today (local time). */
export function isStaleReading(measuredAt: string | null | undefined): boolean {
  if (!measuredAt) return true;
  const measured = new Date(measuredAt);
  const now = new Date();
  
  // Note: "Not today" check
  return (
    measured.getFullYear() !== now.getFullYear() ||
    measured.getMonth() !== now.getMonth() ||
    measured.getDate() !== now.getDate()
  );
}

export function formatTemperature(temperature: string | number | null | undefined): string {
  if (temperature === null || temperature === undefined) return '—';
  const num = Number(temperature);
  return num.toFixed(1);
}

export function formatBloodPressure(sbp: number | null, dbp: number | null): string {
  if (sbp == null && dbp == null) return '—/—';
  return `${sbp ?? '—'}/${dbp ?? '—'}`;
}

/**
 * Vital range classification, mirrored on both Dashboard card and Vitals form
 * for the colored-status treatment described in design-standard.md Section 7.2.
 * These are coarse clinical thresholds for visual triage only — not diagnostic.
 */
export function classifyBloodPressure(sbp: number | null, dbp: number | null): 'normal' | 'warn' | 'critical' {
  if (sbp == null || dbp == null) return 'normal';
  if (sbp >= 180 || dbp >= 120) return 'critical';
  if (sbp >= 140 || dbp >= 90) return 'warn';
  return 'normal';
}

export function classifyHeartRate(hr: number | null): 'normal' | 'warn' | 'critical' {
  if (hr == null) return 'normal';
  if (hr < 40 || hr > 150) return 'critical';
  if (hr < 60 || hr > 100) return 'warn';
  return 'normal';
}

export function classifyOxygenSaturation(spo2: number | null): 'normal' | 'warn' | 'critical' {
  if (spo2 == null) return 'normal';
  if (spo2 < 90) return 'critical';
  if (spo2 < 95) return 'warn';
  return 'normal';
}

export function classifyTemperature(temp: string | number | null): 'normal' | 'warn' | 'critical' {
  if (temp == null) return 'normal';
  const num = Number(temp);
  if (num >= 39.5 || num <= 35.0) return 'critical';
  if (num >= 38.0 || num < 36.0) return 'warn';
  return 'normal';
}

export function classifyRespiratoryRate(rr: number | null): 'normal' | 'warn' | 'critical' {
  if (rr == null) return 'normal';
  if (rr < 8 || rr > 30) return 'critical';
  if (rr < 12 || rr > 20) return 'warn';
  return 'normal';
}
