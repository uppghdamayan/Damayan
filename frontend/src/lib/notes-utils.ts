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
  isDisplayedUserAuthor: boolean;
  previewText: string;       // first ~65 chars of chief complaint (initial) or subjective (progress)
  isLatest: boolean;
  sections: {
    subjective?: { label: string; body: string }[];   // e.g. [{label: 'Chief Complaint', body: ...}, {label: 'HPI', body: ...}] for initial; [{label: 'Subjective', body}] for progress
    objective?: string;
    labs?: string;
    assessment?: string[];          // problem titles
    nonPharm?: string;
    diagnostics?: string[];
    medications?: string[];
  };
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
            return item.title + (item.icdCode ? ` (${item.icdCode})` : '');
          }
          return '';
        }).filter(Boolean)
      : [];

    const medicationList = Array.isArray(initialNote.medicationSnapshot)
      ? initialNote.medicationSnapshot.map((med: any) => {
          if (typeof med === 'string') return med;
          if (med && typeof med === 'object') {
            return `${med.name} ${med.dose}${med.unit}`;
          }
          return '';
        }).filter(Boolean)
      : [];

    const author = initialNote.author;
    const lastEditor = (initialNote as any).lastEditor;
    
    let displayUser = author;
    let displayUserId = initialNote.authorId;

    if (initialNote.lastEditedBy && initialNote.lastEditedBy !== initialNote.authorId) {
      if (lastEditor) {
        displayUser = lastEditor;
        displayUserId = initialNote.lastEditedBy;
      }
    }

    let isDisplayedUserAuthor = displayUserId === initialNote.authorId;

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
      isDisplayedUserAuthor,
      previewText: initialNote.chiefComplaint ? initialNote.chiefComplaint.slice(0, 65) + (initialNote.chiefComplaint.length > 65 ? '...' : '') : '',
      isLatest,
      sections: {
        subjective: subjectiveSections,
        objective: initialNote.physicalExam || undefined,
        labs: Array.isArray(initialNote.diagnostics) && initialNote.diagnostics.length > 0 ? initialNote.diagnostics.join(', ') : undefined,
        assessment: assessmentTitles,
        nonPharm: initialNote.mgmtNonpharm || undefined,
        diagnostics: Array.isArray(initialNote.diagnostics) ? initialNote.diagnostics : undefined,
        medications: medicationList.length > 0 ? medicationList : undefined,
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
            return item.title + (item.icdCode ? ` (${item.icdCode})` : '');
          }
          return '';
        }).filter(Boolean)
      : [];

    const medicationList = Array.isArray(progressNote.medicationSnapshot)
      ? progressNote.medicationSnapshot.map((med: any) => {
          if (typeof med === 'string') return med;
          if (med && typeof med === 'object') {
            return `${med.name} ${med.dose}${med.unit}`;
          }
          return '';
        }).filter(Boolean)
      : [];

    const author = progressNote.author;
    const lastEditor = (progressNote as any).lastEditor;
    
    let displayUser = author;
    let displayUserId = progressNote.authorId;

    if (progressNote.lastEditedBy && progressNote.lastEditedBy !== progressNote.authorId) {
      if (lastEditor) {
        displayUser = lastEditor;
        displayUserId = progressNote.lastEditedBy;
      }
    }

    let isDisplayedUserAuthor = false;
    if (initialNoteAuthorId) {
      isDisplayedUserAuthor = displayUserId === initialNoteAuthorId;
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
      isDisplayedUserAuthor,
      previewText: progressNote.subjective ? progressNote.subjective.slice(0, 65) + (progressNote.subjective.length > 65 ? '...' : '') : '',
      isLatest,
      sections: {
        subjective: subjectiveSections,
        objective: progressNote.objective || undefined,
        assessment: assessmentTitles,
        nonPharm: progressNote.mgmtNonpharm || undefined,
        diagnostics: Array.isArray(progressNote.diagnostics) ? progressNote.diagnostics : undefined,
        medications: medicationList.length > 0 ? medicationList : undefined,
      }
    };
  }
}
