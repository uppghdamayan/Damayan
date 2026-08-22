/**
 * Shared mapper from a note's `medicationSnapshot` JSON to the item shape
 * `MedicationsService#upsertFromNoteMedications` expects. Used by both
 * initial-notes and progress-notes at draft-save and publish time so the
 * four previously-duplicated call sites can't drift from each other again.
 *
 * - Drops 'past' entries — publish never promotes those to the master
 *   Medication list.
 * - Folds `unit` into `dose` (e.g. dose:'5', unit:'mg' -> '5 mg'). Medication
 *   has no `unit` column; matching in upsertFromNoteMedications is by
 *   name+dose, so a snapshot that separately carries unit would otherwise
 *   fail to match a snapshot that typed "5 mg" straight into the dose field,
 *   creating a duplicate row and deactivating the original.
 * - Always carries `fromPast` — one of the two original call sites omitted
 *   it, so a medication created/updated by a post-publish edit lost its
 *   "Past" badge on the next read.
 * - Dedupes by normalized name+dose so an item added twice (e.g. via
 *   "Reflect to Prescribed" on top of an existing entry) doesn't create two
 *   Medication rows.
 */
export function mapMedicationSnapshot(snapshot: any[] | null | undefined): {
  name: string;
  dose: string;
  formulation?: string;
  instructions?: string;
  quantity?: number;
  fromPast?: boolean;
}[] {
  const items = (Array.isArray(snapshot) ? snapshot : [])
    .filter(
      (m) => m && m.name && String(m.name).trim() !== '' && m.source !== 'past',
    )
    .map((m) => {
      const doseStr =
        m.dose !== undefined && m.dose !== null ? String(m.dose).trim() : '';
      const unitStr =
        m.unit !== undefined && m.unit !== null ? String(m.unit).trim() : '';
      return {
        name: String(m.name).trim(),
        dose: [doseStr, unitStr].filter(Boolean).join(' '),
        formulation: m.formulation,
        quantity:
          m.quantity !== undefined && m.quantity !== null
            ? Number(m.quantity)
            : undefined,
        instructions: m.instructions,
        fromPast: m.fromPast || false,
      };
    });

  const seen = new Set<string>();
  const deduped: typeof items = [];
  for (const item of items) {
    const key = `${item.name.toLowerCase()}-${item.dose.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

export function mergeActiveMedications(
  existingMeds: any[],
  activeMedications: any[],
) {
  const activeByName = new Map(
    (activeMedications || [])
      .filter((m: any) => m && m.name && String(m.name).trim() !== '')
      .map((m: any) => [String(m.name).trim().toLowerCase(), m]),
  );
  const activeNames = new Set(activeByName.keys());

  const existing = (existingMeds || [])
    .filter((m: any) => {
      if (!m || typeof m !== 'object') return false;
      if (m.isNew) return true;
      const name = String(m.name || '').trim().toLowerCase();
      return !!name && activeNames.has(name);
    })
    .map((m: any) => {
      if (!m || typeof m !== 'object' || m.isNew) return m;
      const name = String(m.name || '').trim().toLowerCase();
      const live = name ? activeByName.get(name) : undefined;
      if (!live) return m;
      return {
        ...m,
        dose: m.dose !== undefined ? m.dose : (live.dose || undefined),
        formulation: m.formulation !== undefined ? m.formulation : (live.formulation || undefined),
        quantity: m.quantity !== undefined ? m.quantity : (live.quantity || undefined),
        instructions: m.instructions !== undefined ? m.instructions : (live.instructions || undefined),
        fromPast: m.fromPast ?? live.fromPast ?? false,
      };
    });

  const existingNames = new Set(
    existing
      .map((m: any) => String(m.name || '').trim().toLowerCase())
      .filter(Boolean),
  );

  for (const m of activeMedications || []) {
    const name = String(m.name || '').trim().toLowerCase();
    if (!name) continue;
    if (!existingNames.has(name)) {
      existing.push({
        name: m.name,
        dose: m.dose || undefined,
        formulation: m.formulation || undefined,
        quantity: m.quantity || undefined,
        instructions: m.instructions || undefined,
        fromPast: m.fromPast || false,
      });
    }
  }

  return existing;
}
