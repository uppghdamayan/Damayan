"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffListItems = diffListItems;
exports.mapNoteToTimelineView = mapNoteToTimelineView;
/**
 * Performs same-name case-insensitive fuzzy matching between consecutive notes'
 * medications and diagnostics to tag items as existing, added, or removed.
 */
function diffListItems(current, previous) {
    if (!previous) {
        return current.map(item => ({ text: item, status: 'existing' }));
    }
    const isMatch = (item1, item2) => {
        const norm = (str) => str.toLowerCase().trim();
        const n1 = norm(item1);
        const n2 = norm(item2);
        const getDrugName = (s) => {
            const match = s.match(/^[a-z0-9]+/i);
            return match ? match[0] : s;
        };
        const d1 = getDrugName(n1);
        const d2 = getDrugName(n2);
        return d1 === d2 || d1.includes(d2) || d2.includes(d1);
    };
    const matchedPrevIndices = new Set();
    const diffItems = [];
    for (const curr of current) {
        const prevIdx = previous.findIndex((prevVal, idx) => isMatch(curr, prevVal) && !matchedPrevIndices.has(idx));
        if (prevIdx !== -1) {
            diffItems.push({ text: curr, status: 'existing' });
            matchedPrevIndices.add(prevIdx);
        }
        else {
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
function mapNoteToTimelineView(note, isLatest) {
    const isInitial = 'chiefComplaint' in note;
    if (isInitial) {
        const initialNote = note;
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
            ? initialNote.assessment.map((item) => {
                if (typeof item === 'string')
                    return item;
                if (item && typeof item === 'object') {
                    return item.title + (item.icdCode ? ` (${item.icdCode})` : '');
                }
                return '';
            }).filter(Boolean)
            : [];
        return {
            id: initialNote.id,
            kind: 'initial',
            status: initialNote.status,
            createdAt: initialNote.createdAt,
            authorName: initialNote.lastEditedBy || 'Dr. Reyes, Ana M.',
            previewText: initialNote.chiefComplaint ? initialNote.chiefComplaint.slice(0, 65) + (initialNote.chiefComplaint.length > 65 ? '...' : '') : '',
            isLatest,
            sections: {
                subjective: subjectiveSections,
                objective: initialNote.physicalExam || undefined,
                labs: Array.isArray(initialNote.diagnostics) && initialNote.diagnostics.length > 0 ? initialNote.diagnostics.join(', ') : undefined,
                assessment: assessmentTitles,
                nonPharm: initialNote.mgmtNonpharm || undefined,
                diagnostics: Array.isArray(initialNote.diagnostics) ? initialNote.diagnostics : undefined,
                medications: undefined,
            }
        };
    }
    else {
        const progressNote = note;
        const subjectiveSections = [
            { label: 'Subjective', body: progressNote.subjective }
        ];
        const assessmentTitles = Array.isArray(progressNote.problemListSnapshot)
            ? progressNote.problemListSnapshot.map((item) => {
                if (typeof item === 'string')
                    return item;
                if (item && typeof item === 'object') {
                    return item.title + (item.icdCode ? ` (${item.icdCode})` : '');
                }
                return '';
            }).filter(Boolean)
            : [];
        const medicationList = Array.isArray(progressNote.medicationSnapshot)
            ? progressNote.medicationSnapshot.map((med) => {
                if (typeof med === 'string')
                    return med;
                if (med && typeof med === 'object') {
                    return `${med.name} ${med.dose}${med.unit}`;
                }
                return '';
            }).filter(Boolean)
            : [];
        return {
            id: progressNote.id,
            kind: 'progress',
            status: progressNote.status,
            createdAt: progressNote.createdAt,
            authorName: progressNote.lastEditedBy || 'Dr. Reyes, Ana M.',
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
