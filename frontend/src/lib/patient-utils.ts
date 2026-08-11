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

/**
 * Splits a physician's free-text allergy narrative (e.g.
 * "1. Penicillin — rash (documented) 2. Sulfonamides — rash (reported by patient, not confirmed)")
 * into one entry per allergen for chip display. There is no delimiter contract on this field, so
 * we try the most specific pattern first and fall back to a plain, paren-aware comma split:
 *
 *  1. Numbered markers ("1. ", "2) ") — split on them, discarding the marker itself.
 *  2. Newlines / semicolons — split on them, stripping any leading bullet ("-", "•", "*").
 *  3. Commas, but only at paren/bracket depth 0, so "(rash, urticaria)" stays intact.
 */
export function splitAllergyList(raw: string | null | undefined): string[] {
  const text = raw?.trim();
  if (!text) return [];

  const numberedMarker = () => /(?:^|\s)\d+[.)]\s+/g;
  const numberedMatches = text.match(numberedMarker());
  if (numberedMatches && numberedMatches.length >= 2) {
    return text.split(numberedMarker()).map((s) => s.trim()).filter(Boolean);
  }

  const lineParts = text.split(/[\n;]+/);
  if (lineParts.length >= 2) {
    return lineParts
      .map((s) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);
  }

  return splitTopLevelCommas(text).map((s) => s.trim()).filter(Boolean);
}

/** Splits on commas that sit outside any (...) or [...] grouping. */
function splitTopLevelCommas(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);

    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}
