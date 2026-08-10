import { InitialNote } from '@/hooks/useInitialNote';
import { ProgressNote } from '@/hooks/useProgressNotes';



export interface TimelineNoteView {
  id: string;
  kind: 'initial' | 'progress';
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
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
    labs?: string;
    assessment?: string[];          // problem titles
    nonPharm?: string;
    pharm?: string;
    diagnostics?: string[];
    medications?: string[];
    medicationsDetailed?: { name: string; dose?: string }[];
  };
  isDeleted: boolean;
}

/**
 * Performs same-name case-insensitive fuzzy matching between consecutive notes'
 * medications and diagnostics to tag items as existing, added, or removed.
 */
export function diffListItems(
  current: string[],
  previous: string[] | null
): { text: string; status: 'existing' | 'added' | 'removed' }[] {
  if (!previous) {
    return current.map(item => ({ text: item, status: 'existing' }));
  }

  const isMatch = (item1: string, item2: string): boolean => {
    const norm = (str: string) => str.toLowerCase().trim();
    const n1 = norm(item1);
    const n2 = norm(item2);
    const getDrugName = (s: string) => {
      const match = s.match(/^[a-z0-9]+/i);
      return match ? match[0] : s;
    };
    const d1 = getDrugName(n1);
    const d2 = getDrugName(n2);
    return d1 === d2 || d1.includes(d2) || d2.includes(d1);
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
 * Same-name fuzzy matching between consecutive notes' medication lists, but
 * dose-aware: a name match with a differing dose is tagged 'dose-up' /
 * 'dose-down' / 'dose-changed' instead of being collapsed into 'existing'
 * (plain diffListItems bakes name+dose into one string, so a name-only match
 * on the leading drug name silently hides dose-only edits).
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
    const norm = (str: string) => str.toLowerCase().trim();
    const getDrugName = (s: string) => {
      const match = norm(s).match(/^[a-z0-9]+/i);
      return match ? match[0] : norm(s);
    };
    const d1 = getDrugName(n1);
    const d2 = getDrugName(n2);
    return d1 === d2 || d1.includes(d2) || d2.includes(d1);
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
      if (currDose && prevDose && currDose.toLowerCase() !== prevDose.toLowerCase()) {
        const currNum = parseFloat(currDose);
        const prevNum = parseFloat(prevDose);
        const status =
          !isNaN(currNum) && !isNaN(prevNum)
            ? (currNum > prevNum ? 'dose-up' : currNum < prevNum ? 'dose-down' : 'dose-changed')
            : 'dose-changed';
        diffItems.push({ text: formatItem(curr), status, fromDose: prevDose, toDose: currDose });
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
export function mapNoteToTimelineView(
  note: InitialNote | ProgressNote,
  isLatest: boolean,
  initialNoteAuthorId?: string | null
): TimelineNoteView {
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

    const assessmentTitles = Array.isArray(initialNote.assessment)
      ? initialNote.assessment.map((item: any) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const prefix = (item.depth > 0 || item.parentId) ? '↳ ' : '';
            return prefix + item.title;
          }
          return '';
        }).filter(Boolean)
      : [];

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
        labs: Array.isArray(initialNote.diagnostics) && initialNote.diagnostics.length > 0 ? initialNote.diagnostics.join(', ') : undefined,
        assessment: assessmentTitles,
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

    const assessmentTitles = Array.isArray(progressNote.problemListSnapshot)
      ? progressNote.problemListSnapshot.map((item: any) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const prefix = (item.depth > 0 || item.parentId) ? '↳ ' : '';
            return prefix + item.title;
          }
          return '';
        }).filter(Boolean)
      : [];

    const medicationList = Array.isArray(progressNote.medicationSnapshot)
      ? progressNote.medicationSnapshot.map((med: any) => {
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
      ? progressNote.medicationSnapshot.map((med: any) => {
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
        nonPharm: progressNote.mgmtNonpharm || undefined,
        pharm: progressNote.mgmtPharm || undefined,
        diagnostics: Array.isArray(progressNote.diagnostics) ? progressNote.diagnostics : undefined,
        medications: medicationList.length > 0 ? medicationList : undefined,
        medicationsDetailed: medicationsDetailed.length > 0 ? medicationsDetailed : undefined,
      }
    };
  }
}
