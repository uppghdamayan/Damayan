'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { type DateRange } from 'react-day-picker';
import { useAuditLogs, type AuditAction, type AuditLogFilters, type AuditLogEntry } from '@/hooks/useAuditLogs';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, X, ListFilter, Check, RotateCcw, ChevronDown, Clock, Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatient } from '@/hooks/usePatients';

const FormattedLogText = ({ text }: { text: string }) => {
  const processed = text.replace(/Progress Note/g, 'Progress note').replace(/Initial Note/g, 'Initial note');
  const pattern = /\b(renamed|dose|formulation|instructions|quantity|status|unnested|nested|reordered|resolved|reactivated|set date of diagnosis|top level|sub-problem|sub-problems)\b/gi;
  const parts = processed.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return <span key={i} className="font-semibold text-text-primary">{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

const ACTION_BADGE_VARIANT: Record<AuditAction, string> = {
  CREATE: 'saved',      // green
  UPDATE: 'draft',      // amber
  DELETE: 'critical',   // red
  VIEW: 'info',         // light blue
  GENERATE: 'published',// purple
  DRAFT: 'draft',       // amber
};

const ACTIONS = [
  { value: 'ALL', label: 'All Log Types', color: 'bg-text-muted/40' },
  { value: 'CREATE', label: 'Created', color: 'bg-green-border' },
  { value: 'UPDATE', label: 'Updated', color: 'bg-text-secondary' },
  { value: 'DELETE', label: 'Removed', color: 'bg-red-border' },
  { value: 'GENERATE', label: 'Generated', color: 'bg-purple-border' },
] as const;


const MODULE_OPTIONS = [
  { value: 'ALL', label: 'All Modules' },
  { value: 'problems', label: 'Problem List' },
  { value: 'medications', label: 'Medications' },
  { value: 'progress_notes', label: 'Progress Notes' },
  { value: 'initial_notes', label: 'Initial Note' },
  { value: 'vitals', label: 'Vital Signs' },
  { value: 'visits', label: 'Visits' },
  { value: 'documents', label: 'Documents' },
  { value: 'patients', label: 'Patient Profile' },
  { value: 'users', label: 'Users' },
  { value: 'attachments', label: 'Attachments' },
] as const;

const DATE_OPTIONS = [
  { value: 'ANY', label: 'Any Time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'WEEK', label: 'Last 7 Days' },
  { value: 'MONTH', label: 'Last 30 Days' },
  { value: 'CUSTOM', label: 'Custom Range' },
] as const;

function getModuleLabel(tableName: string): string {
  const map: Record<string, string> = {
    problems: 'Problem List',
    medications: 'Medications',
    progress_notes: 'Progress Notes',
    initial_notes: 'Initial Note',
    patients: 'Patient Profile',
    vitals: 'Vital Signs',
    visits: 'Visits',
    documents: 'Documents',
    users: 'Users',
    attachments: 'Attachments',
  };
  return map[tableName.toLowerCase()] ?? tableName;
}

function getInitials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'U';
}

function formatUserName(user: { firstName?: string; lastName?: string }, role?: string): string {
  if (!user) return 'System';
  const name = `${user.lastName || ''}, ${user.firstName || ''}`;
  if (role === 'DOCTOR') {
    return `Dr. ${user.lastName || ''}, ${user.firstName || ''}`;
  }
  if (role === 'NURSE') {
    return `${user.lastName || ''}, ${user.firstName || ''} (Nurse)`;
  }
  return name;
}


function getDocumentDetails(entry: AuditLogEntry): { label: string; article: string } | null {
  const changes = entry.changes as any;
  const reqBody = changes?._requestBody || {};

  const rawType =
    changes?.documentType ||
    changes?.type ||
    reqBody?.documentType ||
    reqBody?.type ||
    changes?.name ||
    changes?.title ||
    '';

  if (!rawType) return null;

  const normalized = String(rawType).trim().toUpperCase().replace(/[- ]/g, '_');

  const knownMap: Record<string, string> = {
    MEDICAL_CERTIFICATE: 'Medical Certificate',
    LAB_REQUEST: 'Lab Request',
    LABORATORY_REQUEST: 'Lab Request',
    PRESCRIPTION: 'Prescription',
    REFERRAL_LETTER: 'Referral Letter',
    CHARGE_SLIP: 'Charge Slip',
  };

  if (knownMap[normalized]) {
    const label = knownMap[normalized];
    const article = /^[aeiou]/i.test(label) ? 'an' : 'a';
    return { label, article };
  }

  const cleanLabel = String(rawType).trim();
  if (cleanLabel) {
    const article = /^[aeiou]/i.test(cleanLabel) ? 'an' : 'a';
    return { label: cleanLabel, article };
  }

  return null;
}

function getReadableDescriptionText(entry: AuditLogEntry): string {
  const table = entry.tableName.toLowerCase();
  const action = entry.action;
  const changes = entry.changes as any;
  const name: string = changes
    ? (changes.name || changes.title || changes.genericName || changes.brandName || '')
    : '';
  const target = name ? `'${name}'` : '';
  const reqBody = (changes as any)?._requestBody || {};

  if (table === 'problems') {
    if (action === 'CREATE') return `Added problem ${target || 'a new problem'}`;
    if (action === 'DELETE') return `Removed problem ${target || 'a problem'}`;
    if (action === 'UPDATE') {
      if (changes?._isReorder || reqBody?.items) {
        const items = (reqBody?.items || []) as any[];
        const nestedCount = items.filter((i) => i.parentId && i.parentId !== null).length;
        const unnestedCount = items.filter((i) => i.parentId === null).length;
        if (nestedCount > 0 && unnestedCount > 0) return 'Updated problem nesting and list order';
        if (nestedCount > 0) return 'Nested sub-problems in problem list';
        if (unnestedCount > 0) return 'Unnested problems to top level';
        return 'Reordered the problem list';
      }
      if ('status' in reqBody || changes?.status) {
        const st = reqBody?.status || changes?.status;
        if (st === 'RESOLVED') return `Resolved problem ${target || 'a problem'}`;
        if (st === 'ACTIVE') return `Reactivated problem ${target || 'a problem'}`;
        if (st === 'REMOVED') return `Removed problem ${target || 'a problem'}`;
      }
      if ('parentId' in reqBody) {
        return reqBody.parentId ? `Nested problem ${target || 'a problem'}` : `Unnested problem ${target || 'a problem'} to top level`;
      }
      return `Updated problem ${target || 'a problem'}`;
    }
  } else if (table === 'medications') {
    if (action === 'CREATE') return `Added medication ${target || 'a new medication'}`;
    if (action === 'DELETE') return `Removed medication ${target || 'a medication'}`;
    if (action === 'UPDATE') {
      if (changes?._isReorder) return 'Reordered the medication list';
      if ('isActive' in reqBody || (changes && 'isActive' in changes && !changes._requestBody)) {
        const isActive = 'isActive' in reqBody ? reqBody.isActive : changes?.isActive;
        return `${isActive === false ? 'Discontinued' : 'Reactivated'} medication: ${target || 'a medication'}`;
      }
      return `Updated medication ${target || 'a medication'}`;
    }
  } else if (table === 'vitals') {
    if (action === 'CREATE') {
      const sbp = reqBody.sbp ?? changes.sbp;
      const dbp = reqBody.dbp ?? changes.dbp;
      const hr = reqBody.heartRate ?? changes.heartRate;
      const rr = reqBody.respiratoryRate ?? changes.respiratoryRate;
      const temp = reqBody.temperature ?? changes.temperature;
      const spo2 = reqBody.oxygenSaturation ?? changes.oxygenSaturation;
      const parts = [];
      if (sbp != null && dbp != null) parts.push(`${sbp}/${dbp} mmHg`);
      if (hr != null) parts.push(`${hr} bpm`);
      if (rr != null) parts.push(`${rr} breaths/min`);
      if (temp != null) parts.push(`${temp} °C`);
      if (spo2 != null) parts.push(`${spo2}% SpO2`);
      return parts.length > 0 ? `Recorded new Vital Signs: ${parts.join(', ')}` : 'Recorded new Vital Signs';
    } else if (action === 'DELETE') {
      return 'Deleted a vital signs record';
    }
  } else if (table === 'progress_notes') {
    if (action === 'CREATE') {
      const isPublished = changes?._isPublish || changes?.status === 'PUBLISHED';
      return `${isPublished ? 'Published' : 'Saved'} a progress note${isPublished ? '' : ' as draft'}`;
    } else if (action === 'DRAFT') {
      return `Saved a progress note as draft`;
    } else if (action === 'UPDATE') {
      return `Updated a progress note`;
    } else if (action === 'DELETE') {
      if (changes?._isDraftsDelete) return `Undrafted ${changes?.count || 'all'} progress note${changes?.count !== 1 ? 's' : ''}`;
      return `${changes?.status === 'DRAFT' ? 'Undrafted' : 'Unpublished'} a progress note`;
    }
  } else if (table === 'initial_notes') {
    if (action === 'CREATE') {
      const isPublished = changes?._isPublish || changes?.status === 'PUBLISHED';
      return `${isPublished ? 'Published' : 'Saved'} the initial note${isPublished ? '' : ' as draft'}`;
    } else if (action === 'DRAFT') {
      return `Saved the initial note as draft`;
    } else if (action === 'UPDATE') {
      return `Updated the initial note`;
    } else if (action === 'DELETE') {
      return `${changes?.status === 'DRAFT' ? 'Undrafted' : 'Unpublished'} the initial note`;
    }
  } else if (table === 'documents') {
    const docInfo = getDocumentDetails(entry);
    const docText = docInfo ? `${docInfo.article} ${docInfo.label}` : 'a document';
    if (action === 'GENERATE') return `Generated ${docText}`;
    if (action === 'CREATE') return `Saved ${docText}`;
    if (action === 'DELETE') return `Deleted ${docText}`;
    if (action === 'UPDATE') return `Updated ${docText}`;
    return `${action.charAt(0).toUpperCase() + action.slice(1).toLowerCase()}d ${docText}`;
  }
  
  const fallbackAction = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
  const fallbackTable = table.replace(/_/g, ' ').replace(/s$/, '');
  return `${fallbackAction}d ${fallbackTable} ${target || `a ${fallbackTable}`}`;
}

function getReadableDescription(entry: AuditLogEntry): React.ReactNode {
  const table = entry.tableName.toLowerCase();
  const action = entry.action;
  const changes = entry.changes as any;

  // Helper: get a display name from the changes payload
  const name: string = changes
    ? (changes.name || changes.title || changes.genericName || changes.brandName || '')
    : '';
  const target = name ? (
    <strong className="font-semibold text-text-primary">'{name}'</strong>
  ) : null;

  // Helper: build a human-readable label for a field key
  const fieldLabel = (key: string): string => {
    const map: Record<string, string> = {
      title: 'title',
      status: 'status',
      parentId: 'nesting',
      name: 'name',
      dose: 'dose',
      formulation: 'formulation',
      instructions: 'instructions',
      quantity: 'quantity',
      isActive: 'status',
      firstName: 'first name',
      lastName: 'last name',
      middleName: 'middle name',
      email: 'email',
      role: 'role',
      phone: 'phone',
      address: 'address',
      birthDate: 'birthdate',
      sex: 'sex',
      civilStatus: 'civil status',
      sbp: 'systolic BP',
      dbp: 'diastolic BP',
      heartRate: 'heart rate',
      temperature: 'temperature',
      respiratoryRate: 'respiratory rate',
      oxygenSaturation: 'oxygen saturation',
      weight: 'weight',
      height: 'height',
      bmi: 'BMI',
    };
    return map[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  };

  // Helper: get changed field labels from the request body (what the user sent)
  const META_KEYS = new Set(['id', 'patientId', 'createdAt', 'updatedAt', 'deletedAt', 'order', 'orders', '_isPublish', '_isReorder', '_requestBody']);
  const reqBody = (changes as any)?._requestBody || {};
  const getChangedFields = (obj?: Record<string, unknown>): string[] =>
    Object.keys(obj ?? reqBody)
      .filter((k) => !META_KEYS.has(k))
      .map(fieldLabel);

  // Helper: join field list into readable text
  const joinFields = (fields: string[]): string => {
    if (fields.length === 0) return '';
    if (fields.length === 1) return fields[0];
    if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
    return `${fields.slice(0, -1).join(', ')}, and ${fields[fields.length - 1]}`;
  };

  // ── Problems ──────────────────────────────────────────────────────────────
  if (table === 'problems') {
    const rawName = changes?.name || changes?.title || '';
    const nameStr = rawName ? `'${rawName}'` : '';
    
    if (action === 'CREATE') {
      return <span className="text-text-secondary"><FormattedLogText text={`Added problem ${nameStr || 'a new problem'}`} /></span>;
    } else if (action === 'DELETE') {
      return <span className="text-text-secondary"><FormattedLogText text={`Removed problem ${nameStr || 'a problem'}`} /></span>;
    } else if (action === 'UPDATE') {
      if ('status' in reqBody || changes?.status) {
        const st = reqBody?.status || changes?.status;
        if (st === 'RESOLVED') return <span className="text-text-secondary"><FormattedLogText text={`Resolved problem ${nameStr || 'a problem'}`} /></span>;
        if (st === 'ACTIVE') return <span className="text-text-secondary"><FormattedLogText text={`Reactivated problem ${nameStr || 'a problem'}`} /></span>;
        if (st === 'REMOVED') return <span className="text-text-secondary"><FormattedLogText text={`Removed problem ${nameStr || 'a problem'}`} /></span>;
      }
      
      const parts: string[] = [];
      
      if (changes?._isReorder || reqBody?.items) {
        const items = (reqBody?.items || []) as any[];
        const nestedCount = items.filter((i) => i.parentId && i.parentId !== null).length;
        const unnestedCount = items.filter((i) => i.parentId === null).length;
        
        if (nestedCount > 0 && unnestedCount > 0) {
          parts.push(`Updated problem nesting and list order`);
        } else if (nestedCount > 0) {
          parts.push(`Nested sub-problems in problem list`);
        } else if (unnestedCount > 0) {
          parts.push(`Unnested problems to top level`);
        } else {
          parts.push(`Reordered problem list`);
        }
      }
      
      if ('title' in reqBody && reqBody.title !== changes?.title) {
        parts.push(`Renamed to '${reqBody.title}'`);
      }
      if ('parentId' in reqBody && !reqBody?.items) {
        parts.push(reqBody.parentId ? `Nested under parent problem` : `Unnested to top level`);
      }
      if ('diagnosisDate' in reqBody) {
        const dDate = reqBody.diagnosisDate ? new Date(reqBody.diagnosisDate).toISOString().split('T')[0] : 'none';
        parts.push(`Set Date of Diagnosis to '${dDate}'`);
      }

      if (parts.length > 0) {
        return <span className="text-text-secondary"><FormattedLogText text={`Updated ${nameStr || 'problem list'}: ${parts.join(', ')}`} /></span>;
      }
      return <span className="text-text-secondary"><FormattedLogText text={`Updated problem ${nameStr || 'a problem'}`} /></span>;
    }

  // ── Medications ───────────────────────────────────────────────────────────
  } else if (table === 'medications') {
    const rawName = changes?.name || changes?.genericName || changes?.brandName || '';
    const nameStr = rawName ? `'${rawName}'` : '';

    if (action === 'CREATE') {
      return <span className="text-text-secondary"><FormattedLogText text={`Added medication ${nameStr || 'a new medication'}`} /></span>;
    } else if (action === 'DELETE') {
      return <span className="text-text-secondary"><FormattedLogText text={`Removed medication ${nameStr || 'a medication'}`} /></span>;
    } else if (action === 'UPDATE') {
      if (changes?._isReorder) {
        return <span className="text-text-secondary"><FormattedLogText text="Reordered the medication list" /></span>;
      }
      if ('isActive' in reqBody || (changes && 'isActive' in changes && !changes._requestBody)) {
        const isActive = 'isActive' in reqBody ? reqBody.isActive : changes?.isActive;
        return <span className="text-text-secondary"><FormattedLogText text={`${isActive === false ? 'Discontinued' : 'Reactivated'} medication ${nameStr || 'a medication'}`} /></span>;
      }
      
      const parts: string[] = [];
      if ('name' in reqBody && reqBody.name !== changes?.name) parts.push(`renamed to '${reqBody.name}'`);
      if ('dose' in reqBody && reqBody.dose !== changes?.dose) parts.push(`dose changed to '${reqBody.dose}'`);
      if ('formulation' in reqBody) parts.push(`formulation changed to '${reqBody.formulation || 'none'}'`);
      if ('instructions' in reqBody) parts.push(`instructions changed to '${reqBody.instructions || 'none'}'`);
      if ('quantity' in reqBody) parts.push(`quantity changed to '${reqBody.quantity || 'none'}'`);

      if (parts.length > 0) {
        return <span className="text-text-secondary"><FormattedLogText text={`Updated ${nameStr || 'a medication'}: ${parts.join(', ')}`} /></span>;
      }
      return <span className="text-text-secondary"><FormattedLogText text={`Updated medication ${nameStr || 'a medication'}`} /></span>;
    }

  // ── Progress Notes ────────────────────────────────────────────────────────
  } else if (table === 'progress_notes') {
    if (action === 'CREATE') {
      const isPublished = changes?._isPublish || changes?.status === 'PUBLISHED';
      return (
        <span className="text-text-secondary">
          {isPublished ? 'Published' : 'Saved'} a progress note{isPublished ? '' : ' as draft'}
        </span>
      );
    } else if (action === 'DRAFT') {
      return (
        <span className="text-text-secondary">
          Saved a progress note as draft
        </span>
      );
    } else if (action === 'UPDATE') {
      const isPublished = changes?._isPublish || changes?.status === 'PUBLISHED';
      if (isPublished) {
        return <span className="text-text-secondary">Updated a progress note</span>;
      }
      return <span className="text-text-secondary">Updated a draft progress note</span>;
    } else if (action === 'DELETE') {
      if (changes?._isDraftsDelete) {
        return <span className="text-text-secondary">Undrafted {changes?.count || 'all'} progress note{changes?.count !== 1 ? 's' : ''}</span>;
      }
      const isDraft = changes?.status === 'DRAFT';
      return <span className="text-text-secondary">{isDraft ? 'Undrafted' : 'Unpublished'} a progress note</span>;
    }

  // ── Initial Notes ─────────────────────────────────────────────────────────
  } else if (table === 'initial_notes') {
    if (action === 'CREATE') {
      const isPublished = changes?._isPublish || changes?.status === 'PUBLISHED';
      return (
        <span className="text-text-secondary">
          {isPublished ? 'Published' : 'Saved'} the initial note{isPublished ? '' : ' as draft'}
        </span>
      );
    } else if (action === 'DRAFT') {
      return (
        <span className="text-text-secondary">
          Saved the initial note as draft
        </span>
      );
    } else if (action === 'UPDATE') {
      const isPublished = changes?._isPublish || changes?.status === 'PUBLISHED';
      if (isPublished) {
        return (
          <span className="text-text-secondary">
            Updated the initial note
          </span>
        );
      }
      return (
        <span className="text-text-secondary">
          Updated a draft initial note
        </span>
      );
    } else if (action === 'DELETE') {
      const isDraft = changes?.status === 'DRAFT';
      return <span className="text-text-secondary">{isDraft ? 'Undrafted' : 'Unpublished'} the initial note</span>;
    }

  // ── Patients ──────────────────────────────────────────────────────────────
  } else if (table === 'patients') {
    const firstName = changes?.firstName || reqBody?.firstName || '';
    const lastName = changes?.lastName || reqBody?.lastName || '';
    const patientName = [firstName, lastName].filter(Boolean).join(' ');
    const pTarget = patientName ? (
      <strong className="font-semibold text-text-primary">'{patientName}'</strong>
    ) : null;
    if (action === 'CREATE') {
      return (
        <span className="text-text-secondary">
          Registered patient {pTarget ? pTarget : 'a new patient'}
        </span>
      );
    } else if (action === 'UPDATE') {
      if (entry.tableName === 'patients' && changes?.status === 'INACTIVE') {
        return (
          <span className="text-text-secondary">
            Deactivated patient {pTarget ? pTarget : 'a patient'}
          </span>
        );
      } else if (entry.tableName === 'patients' && changes?.status === 'ACTIVE' && !('status' in reqBody)) {
        return (
          <span className="text-text-secondary">
            Reactivated patient {pTarget ? pTarget : 'a patient'}
          </span>
        );
      } else if (reqBody?.status === 'INACTIVE') {
        return (
          <span className="text-text-secondary">
            Deactivated patient {pTarget ? pTarget : 'a patient'}
          </span>
        );
      } else if (reqBody?.status === 'ACTIVE') {
        return (
          <span className="text-text-secondary">
            Reactivated patient {pTarget ? pTarget : 'a patient'}
          </span>
        );
      } else {
        const META_KEYS = new Set(['id', 'patientId', 'createdAt', 'updatedAt', 'deletedAt', 'order', 'orders', '_isPublish', '_isReorder', '_requestBody', 'status', 'isActive']);
        const reqKeys = Object.keys(reqBody).filter(k => !META_KEYS.has(k) && reqBody[k] !== undefined);
        
        if (reqKeys.length > 0) {
          const formattedFields = reqKeys.map(k => {
            const label = k.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
            let val = reqBody[k];
            if (val === null || val === '') val = 'empty';
            return (
              <span key={k}>
                {label} to <strong className="font-semibold text-text-primary">'{val}'</strong>
              </span>
            );
          });
          
          return (
            <span className="text-text-secondary">
              Updated {formattedFields.map((field, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && idx === formattedFields.length - 1 ? (reqKeys.length > 2 ? ', and ' : ' and ') : idx > 0 ? ', ' : ''}
                  {field}
                </React.Fragment>
              ))} of patient record
            </span>
          );
        }

        return <span className="text-text-secondary">Updated patient record</span>;
      }
    }

  // ── Vitals ────────────────────────────────────────────────────────────────
  } else if (table === 'vitals') {
    if (action === 'CREATE') {
      const sbp = reqBody.sbp ?? changes.sbp;
      const dbp = reqBody.dbp ?? changes.dbp;
      const hr = reqBody.heartRate ?? changes.heartRate;
      const rr = reqBody.respiratoryRate ?? changes.respiratoryRate;
      const temp = reqBody.temperature ?? changes.temperature;
      const spo2 = reqBody.oxygenSaturation ?? changes.oxygenSaturation;
      const parts: React.ReactNode[] = [];
      if (sbp != null && dbp != null) parts.push(<strong key="bp" className="font-semibold text-text-primary">{sbp}/{dbp} mmHg</strong>);
      if (hr != null) parts.push(<strong key="hr" className="font-semibold text-text-primary">{hr} bpm</strong>);
      if (rr != null) parts.push(<strong key="rr" className="font-semibold text-text-primary">{rr} breaths/min</strong>);
      if (temp != null) parts.push(<strong key="temp" className="font-semibold text-text-primary">{temp} °C</strong>);
      if (spo2 != null) parts.push(<strong key="spo2" className="font-semibold text-text-primary">{spo2}% SpO2</strong>);

      if (parts.length > 0) {
        return (
          <span className="text-text-secondary">
            Recorded new Vital Signs:{' '}
            {parts.map((p, i) => (
              <React.Fragment key={i}>
                {i > 0 && ', '}
                {p}
              </React.Fragment>
            ))}
          </span>
        );
      }
      return <span className="text-text-secondary">Recorded new Vital Signs</span>;
    } else if (action === 'UPDATE') {
      const fields = getChangedFields(reqBody);
      return (
        <span className="text-text-secondary">
          {fields.length > 0 ? (
            <>
              Updated vitals: <strong className="font-semibold text-text-primary">{joinFields(fields)}</strong>
            </>
          ) : (
            'Updated vitals'
          )}
        </span>
      );
    } else if (action === 'DELETE') {
      return <span className="text-text-secondary">Deleted a vital signs record</span>;
    }

  // ── Visits ────────────────────────────────────────────────────────────────
  } else if (table === 'visits') {
    if (action === 'CREATE') return <span className="text-text-secondary">Created a new visit record</span>;
    else if (action === 'UPDATE') {
      const fields = getChangedFields(reqBody);
      return (
        <span className="text-text-secondary">
          {fields.length > 0 ? (
            <>
              Updated <strong className="font-semibold text-text-primary">{joinFields(fields)}</strong> of a visit record
            </>
          ) : (
            'Updated a visit record'
          )}
        </span>
      );
    }

  // ── Documents ─────────────────────────────────────────────────────────────
  } else if (table === 'documents') {
    const docInfo = getDocumentDetails(entry);
    const docTarget = docInfo ? (
      <>
        {docInfo.article}{' '}
        <strong className="font-semibold text-text-primary">{docInfo.label}</strong>
      </>
    ) : (
      'a document'
    );

    if (action === 'GENERATE') {
      return (
        <span className="text-text-secondary">
          Generated {docTarget}
        </span>
      );
    } else if (action === 'CREATE') {
      return (
        <span className="text-text-secondary">
          Saved {docTarget}
        </span>
      );
    } else if (action === 'DELETE') {
      return (
        <span className="text-text-secondary">
          Deleted {docTarget}
        </span>
      );
    } else if (action === 'UPDATE') {
      return (
        <span className="text-text-secondary">
          Updated {docTarget}
        </span>
      );
    } else {
      const fallbackAction = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
      return (
        <span className="text-text-secondary">
          {fallbackAction}d {docTarget}
        </span>
      );
    }

  // ── Users / Accounts ──────────────────────────────────────────────────────
  } else if (table === 'users') {
    const userDisplayName = [changes?.firstName, changes?.lastName].filter(Boolean).join(' ');
    const uTarget = userDisplayName ? (
      <strong className="font-semibold text-text-primary">'{userDisplayName}'</strong>
    ) : null;
    if (action === 'CREATE') {
      return (
        <span className="text-text-secondary">
          Created account for {uTarget ? uTarget : 'a new user'}
        </span>
      );
    } else if (action === 'UPDATE') {
      if (reqBody?.password || reqBody?.passwordHash || reqBody?.newPassword) {
        return (
          <span className="text-text-secondary">
            Reset password for {uTarget ? uTarget : 'a user'}
          </span>
        );
      } else {
        const fields = getChangedFields(reqBody).filter(f => f !== 'password' && f !== 'passwordHash' && f !== 'newPassword');
        return (
          <span className="text-text-secondary">
            {fields.length > 0 ? (
              <>
                Updated <strong className="font-semibold text-text-primary">{joinFields(fields)}</strong> {uTarget ? <>for {uTarget}</> : <>of a user account</>}
              </>
            ) : (
              'Updated a user account'
            )}
          </span>
        );
      }
    } else if (action === 'DELETE') {
      return (
        <span className="text-text-secondary">
          Removed account for {uTarget ? uTarget : 'a user'}
        </span>
      );
    }

  // ── Attachments ───────────────────────────────────────────────────────────
  } else if (table === 'attachments') {
    if (action === 'CREATE') return <span className="text-text-secondary">Uploaded an attachment</span>;
    else if (action === 'DELETE') return <span className="text-text-secondary">Deleted an attachment</span>;
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  const fallbackAction = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
  const fallbackTable = table.replace(/_/g, ' ').replace(/s$/, '');
  return (
    <span className="text-text-secondary">
      {fallbackAction}d {fallbackTable} {target ? target : `a ${fallbackTable}`}
    </span>
  );
}

export default function PatientLogsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: patientData } = usePatient(patientId);

  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | 'ALL'>('ALL');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [dateFilterType, setDateFilterType] = useState<typeof DATE_OPTIONS[number]['value']>('ANY');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown states
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const actionDropdownRef = useRef<HTMLDivElement>(null);
  const moduleDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const limit = 10;

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(target)) {
        setIsActionDropdownOpen(false);
      }
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(target)) {
        setIsModuleDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(target)) {
        setIsDateDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedModule, action, dateFilterType, dateRange]);

  // Compute dates for query based on selection
  const computedDateRange = useMemo(() => {
    if (dateFilterType === 'ANY') return { from: undefined, to: undefined };
    const now = new Date();
    
    if (dateFilterType === 'TODAY') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { from, to };
    }
    
    if (dateFilterType === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const to = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { from, to };
    }
    
    if (dateFilterType === 'WEEK') {
      const from = new Date(now);
      from.setDate(now.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    
    if (dateFilterType === 'MONTH') {
      const from = new Date(now);
      from.setDate(now.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
    
    if (dateFilterType === 'CUSTOM') {
      return { from: dateRange?.from, to: dateRange?.to };
    }
    
    return { from: undefined, to: undefined };
  }, [dateFilterType, dateRange]);

  const filters: AuditLogFilters = {
    patientId,
    page,
    limit,
    ...(action !== 'ALL' && { action }),
    ...(selectedModule !== 'ALL' && { tableName: selectedModule }),
    ...(computedDateRange.from && { from: computedDateRange.from.toISOString() }),
    ...(computedDateRange.to && { to: computedDateRange.to.toISOString() }),
  };

  const { data, isLoading, isError, refetch, isRefetching } = useAuditLogs(filters);

  // Client-side filtering for Search query
  const filteredLogs = useMemo(() => {
    if (!data?.data) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data.data;

    return data.data.filter((entry) => {
      const userFullName = `${entry.user.firstName} ${entry.user.lastName}`.toLowerCase();
      const readableDesc = getReadableDescriptionText(entry).toLowerCase();
      const moduleName = getModuleLabel(entry.tableName).toLowerCase();
      const actionName = entry.action.toLowerCase();
      return (
        userFullName.includes(query) ||
        readableDesc.includes(query) ||
        moduleName.includes(query) ||
        actionName.includes(query)
      );
    });
  }, [data?.data, searchQuery]);

  const hasActiveFilters = selectedModule !== 'ALL' || action !== 'ALL' || dateFilterType !== 'ANY' || searchQuery !== '';

  const handleResetFilters = () => {
    setSelectedModule('ALL');
    setAction('ALL');
    setDateFilterType('ANY');
    setDateRange(undefined);
    setSearchQuery('');
  };

  const formatLogDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeFormatted = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { dateFormatted, timeFormatted };
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col @sm:flex-row gap-2.5 items-stretch @sm:items-center justify-between p-3 bg-surface border border-border rounded-card shadow-sm">
        {/* Left Side: Search and Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 w-full @sm:w-auto">
          
          {/* Search Input Container */}
          <div className="relative w-full @sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full h-[34px] pl-9 pr-8 bg-surface border border-border rounded-btn text-[13px] text-text-primary placeholder-text-muted/75 outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded-full hover:bg-surface-3 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Dropdown */}
          <div className="relative w-full @sm:w-auto" ref={moduleDropdownRef}>
            <button
              type="button"
              onClick={() => setIsModuleDropdownOpen((prev) => !prev)}
              className={cn(
                "flex items-center justify-between gap-2 h-[34px] w-full @sm:w-auto px-3 bg-surface border border-border rounded-btn text-[13px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary cursor-pointer transition-all duration-150 outline-none focus:border-accent focus:shadow-accent-focus select-none",
                selectedModule !== 'ALL' && "border-accent text-accent bg-accent-light/10 hover:bg-accent-light/20 hover:text-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <ListFilter className="w-3.5 h-3.5" />
                <span>{selectedModule === 'ALL' ? 'All Modules' : getModuleLabel(selectedModule)}</span>
              </div>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-text-muted transition-transform duration-200",
                isModuleDropdownOpen && "rotate-180"
              )} />
            </button>

            {isModuleDropdownOpen && (
              <div className="absolute left-0 mt-1 w-48 bg-surface border border-border rounded-btn shadow-modal z-[50] py-1 animate-in fade-in slide-in-from-top-1 duration-100 origin-top-left">
                {MODULE_OPTIONS.map((item) => {
                  const isSelected = selectedModule === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setSelectedModule(item.value);
                        setIsModuleDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface-2 text-left cursor-pointer transition-colors duration-70 select-none",
                        isSelected && "bg-surface-3 font-semibold text-accent"
                      )}
                    >
                      <span>{item.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action/Type Dropdown */}
          <div className="relative w-full @sm:w-auto" ref={actionDropdownRef}>
            <button
              type="button"
              onClick={() => setIsActionDropdownOpen((prev) => !prev)}
              className={cn(
                "flex items-center justify-between gap-2 h-[34px] w-full @sm:w-auto px-3 bg-surface border border-border rounded-btn text-[13px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary cursor-pointer transition-all duration-150 outline-none focus:border-accent focus:shadow-accent-focus select-none",
                action !== 'ALL' && "border-accent text-accent bg-accent-light/10 hover:bg-accent-light/20 hover:text-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <ListFilter className="w-3.5 h-3.5" />
                <span>{action === 'ALL' ? 'All Log Types' : ACTIONS.find(a => a.value === action)?.label}</span>
              </div>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-text-muted transition-transform duration-200",
                isActionDropdownOpen && "rotate-180"
              )} />
            </button>

            {isActionDropdownOpen && (
              <div className="absolute left-0 mt-1 w-44 bg-surface border border-border rounded-btn shadow-modal z-[50] py-1 animate-in fade-in slide-in-from-top-1 duration-100 origin-top-left">
                {ACTIONS.map((item) => {
                  const isSelected = action === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setAction(item.value);
                        setIsActionDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface-2 text-left cursor-pointer transition-colors duration-70 select-none",
                        isSelected && "bg-surface-3 font-semibold text-accent"
                      )}
                    >
                      <div className="flex items-center">
                        <span className={cn(
                          "w-2 h-2 rounded-full mr-2.5",
                          item.color
                        )} />
                        {item.label}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date Options Dropdown */}
          <div className="relative w-full @sm:w-auto" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen((prev) => !prev)}
              className={cn(
                "flex items-center justify-between gap-2 h-[34px] w-full @sm:w-auto px-3 bg-surface border border-border rounded-btn text-[13px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary cursor-pointer transition-all duration-150 outline-none focus:border-accent focus:shadow-accent-focus select-none",
                dateFilterType !== 'ANY' && "border-accent text-accent bg-accent-light/10 hover:bg-accent-light/20 hover:text-accent"
              )}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-text-muted" />
                <span>{DATE_OPTIONS.find(d => d.value === dateFilterType)?.label}</span>
              </div>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-text-muted transition-transform duration-200",
                isDateDropdownOpen && "rotate-180"
              )} />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute left-0 mt-1 w-44 bg-surface border border-border rounded-btn shadow-modal z-[50] py-1 animate-in fade-in slide-in-from-top-1 duration-100 origin-top-left">
                {DATE_OPTIONS.map((item) => {
                  const isSelected = dateFilterType === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setDateFilterType(item.value);
                        setIsDateDropdownOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface-2 text-left cursor-pointer transition-colors duration-70 select-none",
                        isSelected && "bg-surface-3 font-semibold text-accent"
                      )}
                    >
                      <span>{item.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Date Range Picker when selected */}
          {dateFilterType === 'CUSTOM' && (
            <DatePickerWithRange
              date={dateRange}
              setDate={setDateRange}
            />
          )}

        </div>

        {/* Right Side: Refresh and Reset Filters */}
        <div className="flex items-center justify-end shrink-0 gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 h-[34px] px-2.5 text-[12.5px] font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer group"
              title="Reset search and filters"
            >
              <RotateCcw className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-[-60deg]" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center gap-1.5 h-[34px] px-3 bg-surface border border-border rounded-btn text-[12.5px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary cursor-pointer transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefetching && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="border border-border rounded-card overflow-hidden bg-surface shadow-card">
        {/* Table Container Header */}
        <div className="flex items-center justify-between p-3.5 bg-surface border-b border-border/60">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              Recent Activity
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-2/65">
                {['Date & Time', 'Module', 'Type', 'User', 'Description'].map((h) => (
                  <th key={h} className="text-[9.5px] font-bold uppercase tracking-[0.6px] text-text-secondary px-4 py-3 text-left border-b border-border whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    {/* Date & Time */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Skeleton width={80} height={12} borderRadius={4} />
                        <Skeleton width={50} height={10} borderRadius={4} className="mt-0.5" />
                      </div>
                    </td>

                    {/* Module */}
                    <td className="px-4 py-3">
                      <Skeleton width={90} height={12} borderRadius={4} />
                    </td>

                    {/* Type / Action Badge */}
                    <td className="px-4 py-3">
                      <Skeleton width={55} height={16} borderRadius={9999} />
                    </td>

                    {/* User Avatar & Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Skeleton width={28} height={28} borderRadius="50%" />
                        <Skeleton width={100} height={12} borderRadius={4} />
                      </div>
                    </td>

                    {/* Styled Description */}
                    <td className="px-4 py-3">
                      <Skeleton width={i % 2 === 0 ? 220 : 160} height={12} borderRadius={4} />
                    </td>
                  </tr>
                ))}

              {!isLoading && isError && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[12.5px] text-red font-medium">
                    Failed to load activity logs. Please try again.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[12.5px] text-text-muted font-medium">
                    No activity logs found for this patient matching your filters.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && filteredLogs.map((entry) => {
                const { dateFormatted, timeFormatted } = formatLogDate(entry.createdAt);
                return (
                  <tr key={entry.id} className="hover:bg-surface-2/30 transition-colors border-b border-border last:border-b-0">
                    {/* Date & Time */}
                    <td className="px-4 py-3 text-[12.5px] text-text-primary whitespace-nowrap leading-relaxed">
                      <div className="font-medium text-text-secondary">{dateFormatted}</div>
                      <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-500 mt-0.5">{timeFormatted}</div>
                    </td>

                    {/* Module */}
                    <td className="px-4 py-3 text-[12.5px] whitespace-nowrap">
                      <span className="font-medium text-text-secondary">
                        {getModuleLabel(entry.tableName)}
                      </span>
                    </td>

                    {/* Type / Action Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={ACTION_BADGE_VARIANT[entry.action] as any}>{entry.action}</Badge>
                    </td>

                    {/* User Avatar & Name */}
                    <td className="px-4 py-3 text-[12.5px] text-text-secondary whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0 select-none">
                          {getInitials(entry.user.firstName, entry.user.lastName)}
                        </div>
                        <span className="font-medium text-text-secondary">
                          {formatUserName(entry.user, entry.userRole)}
                        </span>
                      </div>
                    </td>

                    {/* Styled Description */}
                    <td className="px-4 py-3 text-[12.5px] min-w-[280px]">
                      {getReadableDescription(entry)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-surface border-t border-border/60 text-[12px] text-text-secondary select-none rounded-b-lg">
            <div className="text-[12px] text-text-muted">
              Showing <span className="font-semibold text-text-secondary">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-text-secondary">
                {Math.min(page * limit, data.meta.total)}
              </span>{' '}
              of <span className="font-semibold text-text-secondary">{data.meta.total}</span> logs
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                className="flex items-center justify-center w-8 h-8 rounded-btn border border-border bg-surface text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:text-text-secondary transition-all cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-[12px] px-2 text-text-muted">
                Page <span className="font-semibold text-text-secondary">{page}</span> of{' '}
                <span className="font-semibold text-text-secondary">{data.meta.totalPages}</span>
              </span>
              
              <button
                type="button"
                disabled={page === data.meta.totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, data.meta.totalPages))}
                className="flex items-center justify-center w-8 h-8 rounded-btn border border-border bg-surface text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:hover:text-text-secondary transition-all cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
