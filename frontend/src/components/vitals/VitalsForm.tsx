'use client';

import { useState, useEffect } from 'react';
import { usePatient } from '@/hooks/usePatients';
import { initials } from '@/lib/patient-utils';
import { X } from 'lucide-react';
import type { VitalSign, CreateVitalsInput, UpdateVitalsInput } from '@/types/vitals';

interface VitalsFormModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  editing: VitalSign | null;
  onSave: (values: CreateVitalsInput | (UpdateVitalsInput & { id: string })) => void;
  saving: boolean;
}

export function VitalsFormModal({ open, onClose, patientId, editing, onSave, saving }: VitalsFormModalProps) {
  const { data: patient } = usePatient(patientId);

  // Form state
  const [sbp, setSbp] = useState<string>('');
  const [dbp, setDbp] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [oxygenSaturation, setOxygenSaturation] = useState<string>('');
  
  const [measureDate, setMeasureDate] = useState<string>('');
  const [measureTime, setMeasureTime] = useState<string>('');

  useEffect(() => {
    if (open) {
      if (editing) {
        setSbp(editing.sbp?.toString() ?? '');
        setDbp(editing.dbp?.toString() ?? '');
        setHeartRate(editing.heartRate?.toString() ?? '');
        setRespiratoryRate(editing.respiratoryRate?.toString() ?? '');
        setTemperature(editing.temperature ?? '');
        setOxygenSaturation(editing.oxygenSaturation?.toString() ?? '');
        const d = new Date(editing.measuredAt);
        const pad = (n: number) => n.toString().padStart(2, '0');
        setMeasureDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setMeasureTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      } else {
        setSbp('');
        setDbp('');
        setHeartRate('');
        setRespiratoryRate('');
        setTemperature('');
        setOxygenSaturation('');
        const d = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        setMeasureDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setMeasureTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      }
      setErrors({});
    }
  }, [open, editing]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    const parse = (val: string) => (val === '' ? null : Number(val));

    const s = parse(sbp);
    const d = parse(dbp);
    const hr = parse(heartRate);
    const rr = parse(respiratoryRate);
    const t = parse(temperature);
    const o2 = parse(oxygenSaturation);

    if (s === null) errs.sbp = 'Required';
    else if (s < 50 || s > 300) errs.sbp = '50–300';
    
    if (d === null) errs.dbp = 'Required';
    else if (d < 20 || d > 200) errs.dbp = '20–200';
    
    if (hr === null) errs.heartRate = 'Required';
    else if (hr < 20 || hr > 300) errs.heartRate = '20–300';
    
    if (rr === null) errs.respiratoryRate = 'Required';
    else if (rr < 5 || rr > 60) errs.respiratoryRate = '5–60';

    if (t !== null && (t < 30.0 || t > 45.0)) errs.temperature = '30.0–45.0';
    if (o2 !== null && (o2 < 50 || o2 > 100)) errs.oxygenSaturation = '50–100';

    if (!measureDate || !measureTime) {
      errs.measuredAt = 'Date and Time are required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRequiredChange = (field: string, val: string, setter: (val: string) => void) => {
    setter(val);
    if (!val) {
      setErrors(prev => ({ ...prev, [field]: 'Required' }));
    } else {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const parse = (val: string) => (val === '' ? undefined : Number(val));
    
    const payload = {
      sbp: parse(sbp),
      dbp: parse(dbp),
      heartRate: parse(heartRate),
      respiratoryRate: parse(respiratoryRate),
      temperature: parse(temperature),
      oxygenSaturation: parse(oxygenSaturation),
      measuredAt: new Date(`${measureDate}T${measureTime}`).toISOString(),
    };

    if (editing) {
      onSave({ id: editing.id, ...payload });
    } else {
      onSave(payload as CreateVitalsInput);
    }
  };

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/45 backdrop-blur-[4px] z-[500] flex items-center justify-center animate-in fade-in duration-150"
    >
      <div className="bg-surface border border-border rounded-[10px] w-[600px] max-h-[90vh] overflow-y-auto shadow-modal">
        <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
          <h2 className="text-[15px] font-bold flex-1 text-text-primary">
            {editing ? 'Edit Vitals' : 'Record Vitals'}
          </h2>
          <button onClick={onClose} aria-label="Close modal"
            className="w-6 h-6 rounded-btn bg-transparent border-transparent hover:bg-surface-2 hover:border-border transition-all duration-150 inline-flex items-center justify-center text-text-muted cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Patient Identifier Banner (Slim Strip) */}
        {patient && (
          <div className="flex items-center gap-3 px-[18px] py-2 bg-surface-2 border-b border-border">
            <div className="w-8 h-8 rounded-full bg-accent-light border border-accent flex items-center justify-center text-[11px] font-bold text-accent-hover flex-shrink-0">
              {initials(patient.firstName, patient.lastName)}
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="font-bold text-text-primary">
                {patient.lastName}, {patient.firstName}
              </span>
              <span className="font-mono text-[10px] text-text-muted bg-surface border border-border rounded px-1.5 py-[1px]">
                #{patient.patientCode}
              </span>
              <span className="text-text-muted ml-2">
                {patient.sex === 'MALE' ? 'M' : patient.sex === 'FEMALE' ? 'F' : 'O'} • {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}y
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-[18px] flex flex-col gap-5">
          <div className="grid grid-cols-2 max-[1023px]:grid-cols-1 gap-4">
            <div className="col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-1">Date <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span></label>
              <input
                type="date"
                disabled={saving}
                className={`w-full h-[34px] px-2 border ${errors.measuredAt ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-border focus:border-accent focus:shadow-accent-focus'} rounded-[6px] bg-surface text-[13px] font-mono text-text-primary outline-none transition-colors disabled:bg-surface-2 disabled:text-text-muted disabled:cursor-not-allowed`}
                value={measureDate}
                onChange={(e) => { 
                  setMeasureDate(e.target.value); 
                  if (!e.target.value) setErrors(er => ({ ...er, measuredAt: 'Required' }));
                  else setErrors(er => { const next = {...er}; delete next.measuredAt; return next; });
                }}
              />
              {errors.measuredAt && !measureDate && <div className="text-[10px] text-red mt-1">Required</div>}
            </div>

            <div className="col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-1">Time <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span></label>
              <input
                type="time"
                disabled={saving}
                className={`w-full h-[34px] px-2 border ${errors.measuredAt ? 'border-red-border focus:border-red-border focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-border focus:border-accent focus:shadow-accent-focus'} rounded-[6px] bg-surface text-[13px] font-mono text-text-primary outline-none transition-colors disabled:bg-surface-2 disabled:text-text-muted disabled:cursor-not-allowed`}
                value={measureTime}
                onChange={(e) => { 
                  setMeasureTime(e.target.value); 
                  if (!e.target.value) setErrors(er => ({ ...er, measuredAt: 'Required' }));
                  else setErrors(er => { const next = {...er}; delete next.measuredAt; return next; });
                }}
              />
              {errors.measuredAt && !measureTime && <div className="text-[10px] text-red mt-1">Required</div>}
            </div>

            <div className="col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-1">Systolic BP <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span></label>
              <div className="flex items-center gap-2">
                <div className={`flex flex-1 items-center border ${errors.sbp ? 'border-red-border focus-within:border-red-border focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-border focus-within:border-accent focus-within:shadow-accent-focus'} rounded-[6px] ${saving ? 'bg-surface-2' : 'bg-surface'} transition-all h-[34px]`}>
                  <input
                    type="number"
                    disabled={saving}
                    className="w-full bg-transparent px-3 text-[13px] text-text-primary outline-none disabled:text-text-muted disabled:cursor-not-allowed"
                    value={sbp}
                    onChange={(e) => handleRequiredChange('sbp', e.target.value, setSbp)}
                  />
                </div>
                <span className="text-[11px] text-text-muted w-[40px]">mmHg</span>
              </div>
              {errors.sbp && <div className="text-[10px] text-red mt-1">{errors.sbp}</div>}
            </div>

            <div className="col-span-1">
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-1">Diastolic BP <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span></label>
              <div className="flex items-center gap-2">
                <div className={`flex flex-1 items-center border ${errors.dbp ? 'border-red-border focus-within:border-red-border focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-border focus-within:border-accent focus-within:shadow-accent-focus'} rounded-[6px] ${saving ? 'bg-surface-2' : 'bg-surface'} transition-all h-[34px]`}>
                  <input
                    type="number"
                    disabled={saving}
                    className="w-full bg-transparent px-3 text-[13px] text-text-primary outline-none disabled:text-text-muted disabled:cursor-not-allowed"
                    value={dbp}
                    onChange={(e) => handleRequiredChange('dbp', e.target.value, setDbp)}
                  />
                </div>
                <span className="text-[11px] text-text-muted w-[40px]">mmHg</span>
              </div>
              {errors.dbp && <div className="text-[10px] text-red mt-1">{errors.dbp}</div>}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-1">Heart Rate <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span></label>
              <div className="flex items-center gap-2">
                <div className={`flex flex-1 items-center border ${errors.heartRate ? 'border-red-border focus-within:border-red-border focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-border focus-within:border-accent focus-within:shadow-accent-focus'} rounded-[6px] ${saving ? 'bg-surface-2' : 'bg-surface'} transition-all h-[34px]`}>
                  <input
                    type="number"
                    disabled={saving}
                    className="w-full bg-transparent px-3 text-[13px] text-text-primary outline-none disabled:text-text-muted disabled:cursor-not-allowed"
                    value={heartRate}
                    onChange={(e) => handleRequiredChange('heartRate', e.target.value, setHeartRate)}
                  />
                </div>
                <span className="text-[11px] text-text-muted w-[30px]">bpm</span>
              </div>
              {errors.heartRate && <div className="text-[10px] text-red mt-1">{errors.heartRate}</div>}
            </div>
            
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-1">Resp Rate <span className="text-red font-bold text-[11px] align-top ml-[2px]">*</span></label>
              <div className="flex items-center gap-2">
                <div className={`flex flex-1 items-center border ${errors.respiratoryRate ? 'border-red-border focus-within:border-red-border focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-border focus-within:border-accent focus-within:shadow-accent-focus'} rounded-[6px] ${saving ? 'bg-surface-2' : 'bg-surface'} transition-all h-[34px]`}>
                  <input
                    type="number"
                    disabled={saving}
                    className="w-full bg-transparent px-3 text-[13px] text-text-primary outline-none disabled:text-text-muted disabled:cursor-not-allowed"
                    value={respiratoryRate}
                    onChange={(e) => handleRequiredChange('respiratoryRate', e.target.value, setRespiratoryRate)}
                  />
                </div>
                <span className="text-[11px] text-text-muted w-[30px]">/min</span>
              </div>
              {errors.respiratoryRate && <div className="text-[10px] text-red mt-1">{errors.respiratoryRate}</div>}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-1">Temperature <span className="text-text-muted font-normal normal-case tracking-normal ml-1">(optional)</span></label>
              <div className="flex items-center gap-2">
                <div className={`flex flex-1 items-center border ${errors.temperature ? 'border-red-border focus-within:border-red-border focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-border focus-within:border-accent focus-within:shadow-accent-focus'} rounded-[6px] ${saving ? 'bg-surface-2' : 'bg-surface'} transition-all h-[34px]`}>
                  <input
                    type="number"
                    step="0.1"
                    disabled={saving}
                    className="w-full bg-transparent px-3 text-[13px] text-text-primary outline-none disabled:text-text-muted disabled:cursor-not-allowed"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                  />
                </div>
                <span className="text-[11px] text-text-muted w-[30px]">°C</span>
              </div>
              {errors.temperature && <div className="text-[10px] text-red mt-1">{errors.temperature}</div>}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.5px] text-text-secondary mb-1">O2 Saturation <span className="text-text-muted font-normal normal-case tracking-normal ml-1">(optional)</span></label>
              <div className="flex items-center gap-2">
                <div className={`flex flex-1 items-center border ${errors.oxygenSaturation ? 'border-red-border focus-within:border-red-border focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : 'border-border focus-within:border-accent focus-within:shadow-accent-focus'} rounded-[6px] ${saving ? 'bg-surface-2' : 'bg-surface'} transition-all h-[34px]`}>
                  <input
                    type="number"
                    disabled={saving}
                    className="w-full bg-transparent px-3 text-[13px] text-text-primary outline-none disabled:text-text-muted disabled:cursor-not-allowed"
                    value={oxygenSaturation}
                    onChange={(e) => setOxygenSaturation(e.target.value)}
                  />
                </div>
                <span className="text-[11px] text-text-muted w-[30px]">%</span>
              </div>
              {errors.oxygenSaturation && <div className="text-[10px] text-red mt-1">{errors.oxygenSaturation}</div>}
            </div>
          </div>

          {errors.form && (
            <div className="text-[12px] text-red bg-red-bg px-3 py-2 rounded border border-red-border">
              {errors.form}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-[28px] px-3 rounded-btn text-[11px] font-semibold text-text-secondary bg-surface-2 border border-border hover:bg-surface-3 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`h-[28px] px-3 rounded-btn text-[11px] font-semibold text-white border transition-all duration-150 flex items-center justify-center gap-1.5 ${saving ? 'bg-accent-hover border-accent-hover cursor-not-allowed' : 'bg-accent border-accent-hover shadow-btn-primary hover:bg-accent-hover cursor-pointer'}`}
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : editing ? 'Save Changes' : 'Record Vitals'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
