import { InitialNote } from '@/hooks/useInitialNote';
import { ProgressNote } from '@/hooks/useProgressNotes';



export interface TimelineNoteView {
  id: string;
  kind: 'initial' | 'progress';
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  // The date/time that actually drives ordering and inheritance server-side
  // (visit.visitDatetime), falling back to createdAt when the visit relation
  // is unavailable. Timeline sort/display must key off this, not createdAt,
  // or the visible order can disagree with what a new note inherits from.
  visitDatetime: string;
  visitId?: string;
  authorId?: string | null;
  authorName: string;
  authorRole?: string;
  isMainAuthor: boolean;
  lastEditorName?: string;
  lastEditedAt?: string;
  previewText: string;       // first ~65 chars of chief complaint (initial) or subjective (progress)
  isLatest: boolean;
  sections: {
    subjective?: { label: string; body: string }[];   // e.g. [{label: 'Chief Complaint', body: ...}, {label: 'HPI', body: ...}] for initial; [{label: 'Subjective', body}] for progress
    objective?: string;
    assessment?: string[];          // problem titles
    assessmentItems?: { id?: string; title: string }[];  // same items, paired with problem id (when known) for identity-based diffing
    nonPharm?: string;
    pharm?: string;
    diagnostics?: string[];
    medications?: string[];
    medicationsDetailed?: { name: string; dose?: string }[];
  };
  isDeleted: boolean;
}

/**
 * Performs same-name case-insensitive matching between consecutive notes'
 * diagnostics/assessment items to tag items as existing, added, or removed.
 * Normalizes items by stripping leading tree/nesting indicators (e.g. '↳ ')
 * so nesting or un-nesting a problem does not falsely flag it as removed/resolved
 * or added/new.
 */
export function diffListItems(
  current: string[],
  previous: string[] | null
): { text: string; status: 'existing' | 'added' | 'removed' }[] {
  if (!previous) {
    return current.map(item => ({ text: item, status: 'existing' }));
  }

  const normalize = (item: string): string =>
    item.replace(/^[↳\u21b3\->\s]+/u, '').trim().toLowerCase();

  const isMatch = (item1: string, item2: string): boolean => {
    const n1 = normalize(item1);
    const n2 = normalize(item2);
    if (!n1 || !n2) {
      return item1.trim().toLowerCase() === item2.trim().toLowerCase();
    }
    return n1 === n2;
  };

  const matchedPrevIndices = new Set<number>();
  const diffItems: { text: string; status: 'existing' | 'added' | 'removed' }[] = [];

  for (const curr of current) {
    const prevIdx = previous.findIndex((prevVal, idx) => isMatch(curr, prevVal) && !matchedPrevIndices.has(idx));
    if (prevIdx !== -1) {
      diffItems.push({ text: curr, status: 'existing' });
      matchedPrevIndices.add(prevIdx);
    } else {
      diffItems.push({ text: curr, status: 'added' });
    }
  }

  for (let i = 0; i < previous.length; i++) {
    if (!matchedPrevIndices.has(i)) {
      diffItems.push({ text: previous[i], status: 'removed' });
    }
  }

  return diffItems;
}

/**
 * Identity-aware diffing for assessment/problem items between consecutive notes.
 * Problems carry a stable id across notes (they are the same Problem record being
 * carried forward), so a problem whose id matches but whose title changed (e.g. a
 * diagnosis edited from "CKD stage 3b" to "CKD stage 4") must be tagged 'updated' —
 * NOT 'removed'+'added', which would incorrectly read as the old problem being
 * resolved and a brand-new problem being added. Falls back to name-based matching
 * (via diffListItems) for items without an id (e.g. legacy snapshots, plain strings).
 */
export function diffAssessmentItems(
  current: { id?: string; title: string }[],
  previous: { id?: string; title: string }[] | null
): { text: string; status: 'existing' | 'added' | 'removed' | 'updated'; fromText?: string }[] {
  if (!previous) {
    return current.map(item => ({ text: item.title, status: 'existing' as const }));
  }

  const prevById = new Map(previous.filter(p => p.id).map(p => [p.id!, p]));
  const matchedPrevIds = new Set<string>();

  // Id-less items (legacy snapshots, or a problem typed fresh in-note that
  // has no Problem id yet) fall back to name matching amongst themselves —
  // but that match is resolved up front, keyed by array position, so the
  // walk below can place every item — id'd or not — in one pass that
  // preserves `current`'s array order. Previously id'd items were all
  // diffed first and id-less items appended afterward regardless of where
  // they actually sat in `current`, so a freshly-added problem always
  // floated to the bottom of the note's Assessment display no matter where
  // it was nested/positioned in the live Problem List — out of step with
  // every other view of the same array (the note editor, Master Problem
  // List) which renders it in its real position.
  const previousWithoutId = previous.filter(p => !p.id);
  const matchedPrevWithoutIdIdx = new Set<number>();
  const nameMatchByPosition = new Map<number, { title: string } | undefined>();
  current.forEach((c, idx) => {
    if (c.id) return;
    const prevIdx = previousWithoutId.findIndex(
      (p, i) => !matchedPrevWithoutIdIdx.has(i) && p.title.trim().toLowerCase() === c.title.trim().toLowerCase(),
    );
    if (prevIdx !== -1) {
      matchedPrevWithoutIdIdx.add(prevIdx);
      nameMatchByPosition.set(idx, previousWithoutId[prevIdx]);
    }
  });

  const diffItems: { text: string; status: 'existing' | 'added' | 'removed' | 'updated'; fromText?: string }[] = [];

  current.forEach((curr, idx) => {
    if (curr.id) {
      const prev = prevById.get(curr.id);
      if (prev) {
        matchedPrevIds.add(curr.id);
        if (prev.title.trim().toLowerCase() !== curr.title.trim().toLowerCase()) {
          diffItems.push({ text: curr.title, status: 'updated', fromText: prev.title });
        } else {
          diffItems.push({ text: curr.title, status: 'existing' });
        }
      } else {
        diffItems.push({ text: curr.title, status: 'added' });
      }
      return;
    }
    const prev = nameMatchByPosition.get(idx);
    diffItems.push(prev ? { text: curr.title, status: 'existing' } : { text: curr.title, status: 'added' });
  });

  // Removed items — present in `previous` but with no match in `current` —
  // have no position of their own to preserve, so they stay appended last.
  for (const prev of previous) {
    if (prev.id && !matchedPrevIds.has(prev.id)) {
      diffItems.push({ text: prev.title, status: 'removed' });
    }
  }
  previousWithoutId.forEach((prev, i) => {
    if (!matchedPrevWithoutIdIdx.has(i)) {
      diffItems.push({ text: prev.title, status: 'removed' });
    }
  });

  return diffItems;
}

/**
 * Compares two dose strings and determines if they differ and whether it is a dose increase, decrease, or change.
 */
export function compareDoses(
  currDoseRaw?: string,
  prevDoseRaw?: string
): { isDifferent: boolean; status: 'existing' | 'dose-up' | 'dose-down' | 'dose-changed' } {
  const curr = (currDoseRaw ? String(currDoseRaw) : '').trim();
  const prev = (prevDoseRaw ? String(prevDoseRaw) : '').trim();

  // Normalize spacing and case for exact comparison (e.g. "10mg" === "10 mg")
  const normCurr = curr.toLowerCase().replace(/\s+/g, '');
  const normPrev = prev.toLowerCase().replace(/\s+/g, '');

  if (normCurr === normPrev) {
    return { isDifferent: false, status: 'existing' };
  }

  // If one is empty and the other is present
  if (!curr && prev) {
    return { isDifferent: true, status: 'dose-down' };
  }
  if (curr && !prev) {
    return { isDifferent: true, status: 'dose-up' };
  }

  // Numerical comparison (e.g. "10 units" vs "6 units", "10 mg" vs "5 mg")
  const currNum = parseFloat(curr);
  const prevNum = parseFloat(prev);

  if (!isNaN(currNum) && !isNaN(prevNum)) {
    if (currNum > prevNum) {
      return { isDifferent: true, status: 'dose-up' };
    }
    if (currNum < prevNum) {
      return { isDifferent: true, status: 'dose-down' };
    }
  }

  return { isDifferent: true, status: 'dose-changed' };
}

/**
 * Normalizes a medication name for accurate matching between notes.
 * Preserves the full drug name (e.g. "Insulin Lispro" vs "Insulin Glargine")
 * while forgiving minor spacing and separator differences.
 */
export function normalizeMedicationName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([+/&-])\s*/g, '$1');
}

/**
 * Medication diffing between consecutive notes:
 * Uses full normalized medication name matching so distinct drugs (e.g. Insulin Lispro vs Insulin Glargine)
 * are never falsely matched against each other.
 */
export function diffMedicationItems(
  current: { name: string; dose?: string }[],
  previous: { name: string; dose?: string }[] | null
): {
  text: string;
  status: 'existing' | 'added' | 'removed' | 'dose-up' | 'dose-down' | 'dose-changed';
  fromDose?: string;
  toDose?: string;
}[] {
  const formatItem = (item: { name: string; dose?: string }) =>
    item.dose ? `${item.name} ${item.dose}` : item.name;

  if (!previous) {
    return current.map(item => ({ text: formatItem(item), status: 'existing' as const }));
  }

  const isMatch = (n1: string, n2: string): boolean => {
    return normalizeMedicationName(n1) === normalizeMedicationName(n2);
  };

  const matchedPrevIndices = new Set<number>();
  const diffItems: ReturnType<typeof diffMedicationItems> = [];

  for (const curr of current) {
    const prevIdx = previous.findIndex(
      (prevVal, idx) => isMatch(curr.name, prevVal.name) && !matchedPrevIndices.has(idx)
    );
    if (prevIdx !== -1) {
      matchedPrevIndices.add(prevIdx);
      const prevVal = previous[prevIdx];
      const currDose = curr.dose ? String(curr.dose).trim() : '';
      const prevDose = prevVal.dose ? String(prevVal.dose).trim() : '';
      const { isDifferent, status } = compareDoses(currDose, prevDose);

      if (isDifferent) {
        diffItems.push({ text: formatItem(curr), status, fromDose: prevDose || undefined, toDose: currDose || undefined });
      } else {
        diffItems.push({ text: formatItem(curr), status: 'existing' });
      }
    } else {
      diffItems.push({ text: formatItem(curr), status: 'added' });
    }
  }

  for (let i = 0; i < previous.length; i++) {
    if (!matchedPrevIndices.has(i)) {
      diffItems.push({ text: formatItem(previous[i]), status: 'removed' });
    }
  }

  return diffItems;
}

/**
 * Maps an InitialNote or ProgressNote into a TimelineNoteView.
 */
/**
 * Formats an array of assessment items or snapshot problems into display titles.
 * Traverses parent-child relationships so nested sub-problems always appear
 * beneath their parent with a '↳ ' prefix, while top-level problems (no parentId)
 * have no prefix.
 */
export function formatAssessmentTitles(rawItems: any[] | null | undefined): string[] {
  return formatAssessmentItems(rawItems).map((i) => i.title);
}

/**
 * Same traversal as formatAssessmentTitles, but keeps each item's problem id
 * alongside its formatted display title so callers can diff by identity
 * (see diffAssessmentItems) instead of by text.
 */
export function formatAssessmentItems(rawItems: any[] | null | undefined): { id?: string; title: string }[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

  // Check if items are all plain strings
  if (rawItems.every((item) => typeof item === 'string')) {
    return rawItems.filter(Boolean).map((title) => ({ title }));
  }

  // Normalize objects
  const items = rawItems
    .filter((item) => item && (typeof item === 'string' || item.title))
    .map((item, idx) => {
      if (typeof item === 'string') {
        return { key: `__str_${idx}`, id: undefined, title: item, parentId: undefined, explicitDepth: 0 };
      }
      const key = item.id ? String(item.id) : (item.tempId ? String(item.tempId) : `__idx_${idx}`);
      return {
        key,
        id: item.id ? String(item.id) : undefined,
        title: String(item.title).trim(),
        parentId: item.parentId ? String(item.parentId) : undefined,
        explicitDepth: typeof item.depth === 'number' ? item.depth : undefined,
      };
    });

  const byKey = new Map(items.map((i) => [i.key, i]));
  const byId = new Map(items.filter((i) => i.id).map((i) => [i.id!, i]));

  const childrenByParent = new Map<string, typeof items>();
  const roots: typeof items = [];

  let hasAnyParentId = false;

  items.forEach((item) => {
    let parentKey = item.parentId;
    if (parentKey && !byKey.has(parentKey) && byId.has(parentKey)) {
      parentKey = byId.get(parentKey)!.key;
    }

    if (parentKey && byKey.has(parentKey) && parentKey !== item.key) {
      hasAnyParentId = true;
      const arr = childrenByParent.get(parentKey) || [];
      arr.push(item);
      childrenByParent.set(parentKey, arr);
    } else {
      roots.push(item);
    }
  });

  if (hasAnyParentId) {
    const result: { id?: string; title: string }[] = [];
    const traverse = (nodes: typeof items, depth: number) => {
      nodes.forEach((n) => {
        const prefix = depth > 0 ? '↳ ' : '';
        result.push({ id: n.id, title: prefix + n.title });
        const kids = childrenByParent.get(n.key);
        if (kids) traverse(kids, depth + 1);
      });
    };
    traverse(roots, 0);
    return result;
  }

  // Fallback for snapshots where parentId was not tracked but explicitDepth was
  return items.map((item) => {
    const prefix = (item.explicitDepth && item.explicitDepth > 0) ? '↳ ' : '';
    return { id: item.id, title: prefix + item.title };
  });
}

export function mapNoteToTimelineView(
  note: InitialNote | ProgressNote,
  isLatest: boolean,
  initialNoteAuthorId?: string | null
): TimelineNoteView {
  const isDeletedNote = 'originalNoteId' in note;
  
  if (isDeletedNote) {
    const deletedNote = note as any; // Type as DeletedNote locally
    const originalContent = deletedNote.content;
    const isInitial = deletedNote.noteType === 'INITIAL_NOTE';
    
    // The migration stored the row using row_to_json, so the keys are in snake_case.
    // Convert the necessary keys to camelCase for the mapping function to work.
    const camelCasedContent = { ...originalContent };
    
    // Initial Note keys
    if ('chief_complaint' in camelCasedContent) camelCasedContent.chiefComplaint = camelCasedContent.chief_complaint;
    if ('pmh_comorbidities' in camelCasedContent) camelCasedContent.pmhComorbidities = camelCasedContent.pmh_comorbidities;
    if ('pmh_surgeries' in camelCasedContent) camelCasedContent.pmhSurgeries = camelCasedContent.pmh_surgeries;
    if ('pmh_hospitalizations' in camelCasedContent) camelCasedContent.pmhHospitalizations = camelCasedContent.pmh_hospitalizations;
    if ('family_history' in camelCasedContent) camelCasedContent.familyHistory = camelCasedContent.family_history;
    if ('social_history' in camelCasedContent) camelCasedContent.socialHistory = camelCasedContent.social_history;
    if ('ob_history' in camelCasedContent) camelCasedContent.obHistory = camelCasedContent.ob_history;
    if ('psychosocial_history' in camelCasedContent) camelCasedContent.psychosocialHistory = camelCasedContent.psychosocial_history;
    if ('physical_exam' in camelCasedContent) camelCasedContent.physicalExam = camelCasedContent.physical_exam;
    
    // Progress Note & Initial Note shared keys
    if ('mgmt_nonpharm' in camelCasedContent) camelCasedContent.mgmtNonpharm = camelCasedContent.mgmt_nonpharm;
    if ('mgmt_pharm' in camelCasedContent) camelCasedContent.mgmtPharm = camelCasedContent.mgmt_pharm;
    if ('problem_list_snapshot' in camelCasedContent) camelCasedContent.problemListSnapshot = camelCasedContent.problem_list_snapshot;
    if ('medication_snapshot' in camelCasedContent) camelCasedContent.medicationSnapshot = camelCasedContent.medication_snapshot;
    
    // Standard keys
    if ('author_id' in camelCasedContent) camelCasedContent.authorId = camelCasedContent.author_id;
    if ('visit_id' in camelCasedContent) camelCasedContent.visitId = camelCasedContent.visit_id;
    if ('created_at' in camelCasedContent) camelCasedContent.createdAt = camelCasedContent.created_at;
    if ('updated_at' in camelCasedContent) camelCasedContent.updatedAt = camelCasedContent.updated_at;

    // Recursively map the camel-cased content to get the timeline view
    // Then override the necessary fields to mark it as deleted
    const timelineView = mapNoteToTimelineView(camelCasedContent, isLatest, initialNoteAuthorId);
    
    return {
      ...timelineView,
      isDeleted: true,
      id: deletedNote.originalNoteId, // Important: use original note id so toggling/keys work
      createdAt: deletedNote.originalCreatedAt,
      visitDatetime: deletedNote.visit?.visitDatetime || deletedNote.originalCreatedAt,
      authorName: deletedNote.author 
        ? `${deletedNote.author.role === 'DOCTOR' ? 'Dr. ' : ''}${deletedNote.author.lastName}, ${deletedNote.author.firstName}`
        : timelineView.authorName,
      authorRole: deletedNote.author?.role || timelineView.authorRole,
    };
  }

  const isInitial = 'chiefComplaint' in note;
  
  if (isInitial) {
    const initialNote = note as InitialNote;
    const subjectiveSections = [
      { label: 'Chief Complaint', body: initialNote.chiefComplaint },
      { label: 'History of Present Illness (HPI)', body: initialNote.hpi },
    ];
    if (initialNote.pmhComorbidities || initialNote.pmhSurgeries || initialNote.pmhHospitalizations || initialNote.allergies) {
      const pmhParts = [
        initialNote.pmhComorbidities ? `Comorbidities: ${initialNote.pmhComorbidities}` : null,
        initialNote.pmhSurgeries ? `Surgeries: ${initialNote.pmhSurgeries}` : null,
        initialNote.pmhHospitalizations ? `Hospitalizations: ${initialNote.pmhHospitalizations}` : null,
        initialNote.allergies ? `Allergies: ${initialNote.allergies}` : null,
      ].filter(Boolean).join('\n');
      if (pmhParts) {
        subjectiveSections.push({ label: 'Past Medical History (PMH)', body: pmhParts });
      }
    }
    if (initialNote.familyHistory) {
      subjectiveSections.push({ label: 'Family Medical History', body: initialNote.familyHistory });
    }
    if (initialNote.socialHistory) {
      subjectiveSections.push({ label: 'Personal & Social History', body: initialNote.socialHistory });
    }
    if (initialNote.obHistory) {
      subjectiveSections.push({ label: 'OB/Menstrual History', body: initialNote.obHistory });
    }
    if (initialNote.psychosocialHistory) {
      subjectiveSections.push({ label: 'Psychosocial History', body: initialNote.psychosocialHistory });
    }

    const assessmentItems = formatAssessmentItems(initialNote.assessment);
    const assessmentTitles = assessmentItems.map((i) => i.title);

    const medicationList = Array.isArray(initialNote.medicationSnapshot)
      ? initialNote.medicationSnapshot
          .filter((med: any) => !med || typeof med !== 'object' || med.source !== 'past')
          .map((med: any) => {
            if (typeof med === 'string') return med;
            if (med && typeof med === 'object') {
              const doseStr = med.dose != null ? String(med.dose).trim() : '';
              const unitStr = med.unit ? ` ${String(med.unit).trim()}` : '';
              const fullDose = `${doseStr}${unitStr}`.trim();
              return `${med.name}${fullDose ? ` ${fullDose}` : ''}`;
            }
            return '';
          }).filter(Boolean)
      : [];

    const medicationsDetailed = Array.isArray(initialNote.medicationSnapshot)
      ? initialNote.medicationSnapshot
          .filter((med: any) => !med || typeof med !== 'object' || med.source !== 'past')
          .map((med: any) => {
            if (typeof med === 'string') return { name: med };
            if (med && typeof med === 'object') {
              const doseStr = med.dose != null ? String(med.dose).trim() : '';
              const unitStr = med.unit ? ` ${String(med.unit).trim()}` : '';
              return { name: med.name, dose: `${doseStr}${unitStr}`.trim() || undefined };
            }
            return { name: '' };
          }).filter((m: any) => m.name)
      : [];

    const author = initialNote.author;
    const lastEditor = (initialNote as any).lastEditor;
    const lastEditorName = lastEditor 
      ? `${lastEditor.role === 'DOCTOR' ? 'Dr. ' : ''}${lastEditor.lastName}, ${lastEditor.firstName}`
      : undefined;
    const lastEditedAt = (initialNote as any).lastEditedAt;
    
    const displayUser = author;
    const displayUserId = initialNote.authorId;

    const isMainAuthor = true; // Initial note creator is always the main author

    const authorName = displayUser 
      ? `${displayUser.role === 'DOCTOR' ? 'Dr. ' : ''}${displayUser.lastName}, ${displayUser.firstName}`
      : 'Dr. Reyes, Ana M.';

    return {
      id: initialNote.id,
      kind: 'initial',
      status: initialNote.status,
      createdAt: initialNote.createdAt,
      visitDatetime: initialNote.visit?.visitDatetime || initialNote.createdAt,
      visitId: initialNote.visitId,
      authorId: initialNote.authorId,
      authorName,
      authorRole: displayUser?.role || 'DOCTOR',
      isMainAuthor,
      lastEditorName,
      lastEditedAt,
      previewText: initialNote.chiefComplaint ? initialNote.chiefComplaint.slice(0, 65) + (initialNote.chiefComplaint.length > 65 ? '...' : '') : '',
      isLatest,
      isDeleted: initialNote.isDeleted || false,
      sections: {
        subjective: subjectiveSections,
        objective: initialNote.physicalExam || undefined,
        assessment: assessmentTitles,
        assessmentItems,
        nonPharm: initialNote.mgmtNonpharm || undefined,
        pharm: initialNote.mgmtPharm || undefined,
        diagnostics: Array.isArray(initialNote.diagnostics) ? initialNote.diagnostics : undefined,
        medications: medicationList.length > 0 ? medicationList : undefined,
        medicationsDetailed: medicationsDetailed.length > 0 ? medicationsDetailed : undefined,
      }
    };
  } else {
    const progressNote = note as ProgressNote;
    const subjectiveSections = [
      { label: 'Subjective', body: progressNote.subjective }
    ];

    const assessmentItems = formatAssessmentItems(progressNote.problemListSnapshot);
    const assessmentTitles = assessmentItems.map((i) => i.title);

    // Mirror the INITIAL branch's `source !== 'past'` filter: publish()
    // drops 'past' entries for both note types before they reach the master
    // Medication table, so the timeline should never show a chip for one
    // that publish would have discarded.
    const medicationList = Array.isArray(progressNote.medicationSnapshot)
      ? progressNote.medicationSnapshot
          .filter((med: any) => !med || typeof med !== 'object' || med.source !== 'past')
          .map((med: any) => {
            if (typeof med === 'string') return med;
            if (med && typeof med === 'object') {
              const doseStr = med.dose != null ? String(med.dose).trim() : '';
              const unitStr = med.unit ? ` ${String(med.unit).trim()}` : '';
              const fullDose = `${doseStr}${unitStr}`.trim();
              return `${med.name}${fullDose ? ` ${fullDose}` : ''}`;
            }
            return '';
          }).filter(Boolean)
      : [];

    const medicationsDetailed = Array.isArray(progressNote.medicationSnapshot)
      ? progressNote.medicationSnapshot
          .filter((med: any) => !med || typeof med !== 'object' || med.source !== 'past')
          .map((med: any) => {
            if (typeof med === 'string') return { name: med };
            if (med && typeof med === 'object') {
              const doseStr = med.dose != null ? String(med.dose).trim() : '';
              const unitStr = med.unit ? ` ${String(med.unit).trim()}` : '';
              return { name: med.name, dose: `${doseStr}${unitStr}`.trim() || undefined };
            }
            return { name: '' };
          }).filter((m: any) => m.name)
      : [];

    const author = progressNote.author;
    const lastEditor = (progressNote as any).lastEditor;
    const lastEditorName = lastEditor 
      ? `${lastEditor.role === 'DOCTOR' ? 'Dr. ' : ''}${lastEditor.lastName}, ${lastEditor.firstName}`
      : undefined;
    const lastEditedAt = (progressNote as any).lastEditedAt;
    
    const displayUser = author;
    const displayUserId = progressNote.authorId;

    let isMainAuthor = false;
    if (initialNoteAuthorId) {
      isMainAuthor = displayUserId === initialNoteAuthorId;
    }

    const authorName = displayUser 
      ? `${displayUser.role === 'DOCTOR' ? 'Dr. ' : ''}${displayUser.lastName}, ${displayUser.firstName}`
      : 'Dr. Reyes, Ana M.';

    return {
      id: progressNote.id,
      kind: 'progress',
      status: progressNote.status,
      createdAt: progressNote.createdAt,
      visitDatetime: progressNote.visit?.visitDatetime || progressNote.createdAt,
      visitId: progressNote.visitId,
      authorId: progressNote.authorId,
      authorName,
      authorRole: displayUser?.role || 'DOCTOR',
      isMainAuthor,
      lastEditorName,
      lastEditedAt,
      previewText: progressNote.subjective ? progressNote.subjective.slice(0, 65) + (progressNote.subjective.length > 65 ? '...' : '') : '',
      isLatest,
      isDeleted: progressNote.isDeleted || false,
      sections: {
        subjective: subjectiveSections,
        objective: progressNote.objective || undefined,
        assessment: assessmentTitles,
        assessmentItems,
        nonPharm: progressNote.mgmtNonpharm || undefined,
        pharm: progressNote.mgmtPharm || undefined,
        diagnostics: Array.isArray(progressNote.diagnostics) ? progressNote.diagnostics : undefined,
        medications: medicationList.length > 0 ? medicationList : undefined,
        medicationsDetailed: medicationsDetailed.length > 0 ? medicationsDetailed : undefined,
      }
    };
  }
}
