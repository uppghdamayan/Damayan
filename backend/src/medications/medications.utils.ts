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
 *   fail to match a snapshot that typed "5 mg" straight into the dose field.
 *   The mismatch is no longer destructive (a same-name active row still
 *   resolves to an in-place dose update, see resolveMedicationMatches below)
 *   but it does produce a spurious 'Updated' log entry, so keep folding it.
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

export function normalizeMedText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolves note-snapshot items against a patient's existing Medication rows
 * for `MedicationsService#upsertFromNoteMedications`. Pure and synchronous —
 * no Prisma involved — so the matching rules are unit-testable on their own.
 *
 * Three passes, in order:
 *
 *  1. Exact name+dose match, one claim per row (active rows preferred over
 *     inactive — an inactive exact match is a reactivation). This recovers
 *     identity for every item whose dose hasn't changed, INCLUDING when two
 *     active rows share a name at different doses (e.g. Metoprolol 25mg AM +
 *     50mg PM) — the unchanged one is claimed here, before dose-change
 *     matching ever runs, so it can't be mistaken for the changed one.
 *  2. Same-name dose change: for each normalized name still unresolved after
 *     pass 1, claim the single remaining active row for that name ONLY when
 *     there is exactly one unresolved item and exactly one unclaimed active
 *     row for that name. Any other cardinality (two items, one row; one
 *     item, two rows; etc.) is ambiguous and is left to pass 3, which
 *     discontinues the old row(s) and creates new one(s) instead of risking
 *     a mis-pairing.
 *  3. Everything still unresolved is a create (brand-new medication, or the
 *     ambiguous case above).
 *
 * `existing` should be ordered active-first, then by createdAt ascending —
 * callers are expected to pass `findMany({ orderBy: [{ isActive: 'desc' },
 * { createdAt: 'asc' }] })` results — so that legacy duplicate rows (same
 * name+dose, both active) resolve deterministically to the same one every
 * time instead of depending on unspecified DB row order.
 */
export function resolveMedicationMatches(
  existing: { id: string; name: string; dose: string | null; isActive: boolean }[],
  items: { name: string; dose: string }[],
): {
  exact: Map<number, string>;
  doseChange: Map<number, string>;
  creates: number[];
  claimedIds: Set<string>;
} {
  const exact = new Map<number, string>();
  const doseChange = new Map<number, string>();
  const claimedIds = new Set<string>();

  // Pass 1 — exact name+dose match, one-to-one, active rows preferred.
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemName = normalizeMedText(item.name);
    const itemDose = normalizeMedText(String(item.dose ?? ''));

    const active = existing.find(
      (m) =>
        m.isActive &&
        !claimedIds.has(m.id) &&
        normalizeMedText(m.name) === itemName &&
        normalizeMedText(String(m.dose ?? '')) === itemDose,
    );
    const match =
      active ??
      existing.find(
        (m) =>
          !m.isActive &&
          !claimedIds.has(m.id) &&
          normalizeMedText(m.name) === itemName &&
          normalizeMedText(String(m.dose ?? '')) === itemDose,
      );

    if (match) {
      exact.set(i, match.id);
      claimedIds.add(match.id);
    }
  }

  // Pass 2 — same-name dose change, grouped, only when unambiguous.
  const unresolvedByName = new Map<string, number[]>();
  for (let i = 0; i < items.length; i++) {
    if (exact.has(i)) continue;
    const key = normalizeMedText(items[i].name);
    const group = unresolvedByName.get(key);
    if (group) group.push(i);
    else unresolvedByName.set(key, [i]);
  }

  for (const [name, indices] of unresolvedByName) {
    const candidates = existing.filter(
      (m) =>
        m.isActive && !claimedIds.has(m.id) && normalizeMedText(m.name) === name,
    );
    if (indices.length === 1 && candidates.length === 1) {
      doseChange.set(indices[0], candidates[0].id);
      claimedIds.add(candidates[0].id);
    }
  }

  // Pass 3 — everything else is a create.
  const creates: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!exact.has(i) && !doseChange.has(i)) creates.push(i);
  }

  return { exact, doseChange, creates, claimedIds };
}

/**
 * Builds a NEW note's carried-forward medication list from the previous
 * note's `medicationSnapshot`, re-synced against the patient's current
 * active Medication rows. Only caller: ProgressNotesService when it seeds a
 * fresh draft.
 *
 * Unlike the frontend twin in `note-snapshot-merge.ts` (which merges a note
 * against ITS OWN in-progress edits and must honor `editedFields` so an
 * unsaved edit isn't clobbered), every entry here belongs to the *previous*
 * note. There is no in-progress edit to protect, so the live master row
 * always wins on dose/formulation/quantity/instructions — otherwise a dose
 * changed on the master list (or by a since-published note) would be
 * silently overwritten by the stale carried-forward value the moment a new
 * draft is opened. `editedFields` is intentionally dropped, not carried
 * forward: a pin from the previous note must not outlive its context.
 */
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
      const { editedFields: _editedFields, ...rest } = m;
      return {
        ...rest,
        dose: live.dose ?? m.dose,
        formulation: live.formulation ?? m.formulation,
        quantity: live.quantity ?? m.quantity,
        instructions: live.instructions ?? m.instructions,
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
