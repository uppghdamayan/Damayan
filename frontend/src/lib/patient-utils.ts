/**
 * Calculates age in years from a date of birth string (ISO 8601 or date string).
 */
export function calcAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * Returns patient display name in "Last, First [Middle initial]." format.
 */
export function displayName(p: {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  extension?: string | null;
}): string {
  const parts = [p.lastName + ',', p.firstName];
  if (p.middleName) parts.push(p.middleName[0] + '.');
  if (p.extension) parts.push(p.extension);
  return parts.join(' ');
}

/**
 * Returns initials for an avatar from first and last name.
 */
export function initials(firstName: string, lastName: string): string {
  return `${(firstName[0] ?? '').toUpperCase()}${(lastName[0] ?? '').toUpperCase()}`;
}

/**
 * Groups an array of patients alphabetically by first letter of last name.
 * Returns an array of { letter, patients } buckets, sorted A–Z.
 */
export function groupByLetter<T extends { lastName: string }>(
  patients: T[],
): { letter: string; patients: T[] }[] {
  const map = new Map<string, T[]>();
  for (const p of patients) {
    const letter = (p.lastName[0] ?? '#').toUpperCase();
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, patients]) => ({ letter, patients }));
}
