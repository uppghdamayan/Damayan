'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { cn, downloadCSV } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Activity,
  Stethoscope,
  Pill,
  ShieldCheck,
  TrendingUp,
  MapPin,
  PieChart as PieChartIcon,
  BarChart3,
  Table as TableIcon,
  FilterX,
  ListFilter,
  Download,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SummaryData {
  totalPatients: number;
  activePatients: number;
  inactivePatients: number;
  totalVisits: number;
  totalProblems: number;
  activeProblems: number;
  totalMedications: number;
  activeMedications: number;
}

interface NameCount {
  name: string;
  count: number;
}

interface DashboardData {
  summary: SummaryData;
  sexDistribution: { sex: string; count: number }[];
  topDiagnoses: NameCount[];
  topMedications: NameCount[];
  patientsByCity: { city: string; count: number }[];
  patientsByRegion: { region: string; count: number }[];
  registrationsOverTime: { month: string; count: number }[];
  visitsOverTime: { month: string; count: number }[];
  ageDistribution: { range: string; count: number }[];
  problemStatusBreakdown: { status: string; count: number }[];
  staffByRole: { role: string; count: number }[];
}

interface PaginatedResponse {
  data: NameCount[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type DashboardTab = 'overview' | 'diagnoses' | 'medications' | 'demographics' | 'patient-analytics';

// ─── Damayan Standard Color Palette ────────────────────────────────────────

const DAMAYAN_PALETTE = [
  '#0A6E5F', // Accent Teal (Primary)
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#0D9E8C', // Accent Mid
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#14532D', // Dark Green
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#0A6E5F',    // Accent Teal
  RESOLVED: '#3B82F6',  // Blue
  REMOVED: '#EF4444',   // Red
};

// ─── Custom Tooltip (Design Standard Compliant) ─────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-btn p-2.5 shadow-modal text-[11px] font-sans min-w-[140px]">
      <p className="font-bold text-text-primary mb-1.5 border-b border-border/60 pb-1">{label}</p>
      {payload.map((entry: TooltipPayloadEntry, i: number) => (
        <div key={i} className="flex items-center gap-2 font-medium py-0.5">
          <span
            className="w-2 h-2 rounded-full inline-block shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="font-semibold text-text-primary font-mono ml-auto">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Stat Card (Design Standard §6.1 & §6.3) ────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = '#0A6E5F',
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card shadow-card p-3.5 flex items-start gap-3 hover:border-border-strong transition-all duration-150">
      <div
        className="w-9 h-9 rounded-icon flex items-center justify-center shrink-0 border"
        style={{
          backgroundColor: `${accent}14`,
          borderColor: `${accent}30`,
          color: accent,
        }}
      >
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-muted mb-0.5">
          {label}
        </p>
        <p className="text-[20px] font-bold text-text-primary leading-tight font-mono">
          {value.toLocaleString()}
        </p>
        {sub && (
          <p className="text-[10px] text-text-muted mt-1 truncate">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Chart Card Wrapper (Design Standard §6.1) ──────────────────────────────

function ChartCard({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon?: React.ElementType | string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-surface border border-border rounded-card shadow-card overflow-hidden', className)}>
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-2 border-b border-border">
        <div className="w-[26px] h-[26px] rounded-icon bg-surface-3 flex items-center justify-center text-[12px] shrink-0 text-accent font-semibold border border-border/50">
          {typeof Icon === 'string' ? Icon : Icon ? <Icon size={14} strokeWidth={2.2} /> : '📊'}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.6px] text-text-secondary flex-1">
          {title}
        </span>
        {action}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

// ─── Table View with Legend (Design Standard §6.5 & §6.3) ────────────────────

function TopItemsTable({
  items,
  typeLabel,
}: {
  items: NameCount[];
  typeLabel: string;
}) {
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-2">
            <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[50px]">
              Rank
            </th>
            <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border">
              {typeLabel}
            </th>
            <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[120px]">
              Distribution
            </th>
            <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[80px]">
              Count
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const pct = Math.round((item.count / maxCount) * 100);
            const isTop3 = idx < 3;
            return (
              <tr
                key={item.name}
                className="hover:bg-surface-3 transition-colors border-b border-border last:border-b-0"
              >
                <td className="px-2.5 py-2">
                  <span
                    className={cn(
                      'text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center',
                      isTop3
                        ? 'bg-accent-light text-accent-hover border-accent'
                        : 'bg-surface-2 text-text-muted border-border'
                    )}
                  >
                    #{idx + 1}
                  </span>
                </td>
                <td className="px-2.5 py-2 text-[12px] text-text-primary font-medium truncate max-w-[200px]">
                  {item.name}
                </td>
                <td className="px-2.5 py-2">
                  <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden border border-border/40">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: DAMAYAN_PALETTE[idx % DAMAYAN_PALETTE.length],
                      }}
                    />
                  </div>
                </td>
                <td className="px-2.5 py-2 text-[12px] font-semibold text-text-primary font-mono text-right">
                  {item.count.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Paginated List Modal (Design Standard §6.7 & §6.5) ────────────────────

// ─── Paginated Data Table (Inline) ──────────────────────────────────────────

function PaginatedDataTable({
  title,
  endpoint,
  dateRange,
}: {
  title: string;
  endpoint: string;
  dateRange?: DateRange;
}) {
  const [data, setData] = useState<NameCount[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(
    async (page = 1, searchTerm = '') => {
      setLoading(true);
      try {
        let url = `/analytics/${endpoint}?page=${page}&limit=20`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (dateRange?.from && dateRange?.to) {
          url += `&from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`;
        }
        const res = await apiRequest<PaginatedResponse>(url);
        setData(res.data);
        setMeta(res.meta);
      } catch {
        toast.error(`Failed to load ${title.toLowerCase()}`);
      } finally {
        setLoading(false);
      }
    },
    [endpoint, dateRange, title]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(1, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]); // Refetch if dateRange changes

  const handleSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(1, val), 350);
  };

  const maxCountInView = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-surface border border-border rounded-card flex flex-col shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-border flex-shrink-0 bg-surface-2">
        <div className="w-6 h-6 rounded-icon bg-surface-3 flex items-center justify-center text-[12px] text-accent font-bold border border-border/50">
          <ListFilter size={13} />
        </div>
        <h2 className="text-[13px] uppercase tracking-[0.6px] font-bold flex-1 text-text-secondary">{title}</h2>
        <button
          onClick={async () => {
            try {
              let url = `/analytics/${endpoint}?page=1&limit=5000`;
              if (search) url += `&search=${encodeURIComponent(search)}`;
              if (dateRange?.from && dateRange?.to) {
                url += `&from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`;
              }
              const res = await apiRequest<PaginatedResponse>(url);
              if (res.data.length) {
                downloadCSV(res.data, `${title.replace(/\s+/g, '_').toLowerCase()}_export.csv`);
                toast.success('Export successful');
              } else {
                toast.error('No data to export');
              }
            } catch {
              toast.error('Export failed');
            }
          }}
          className="sec-btn flex items-center gap-1.5 h-[28px] px-3"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-[18px] pt-3 pb-2.5 flex-shrink-0 border-b border-border/40 bg-surface">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            className="w-full h-[34px] pl-8 pr-3 bg-surface border border-border rounded-btn text-[13px] text-text-primary outline-none transition-all duration-150 focus:border-accent focus:shadow-accent-focus placeholder:text-text-muted"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-x-auto min-h-[400px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 bg-surface-2 border-b border-border z-10">
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[60px]">
                Rank
              </th>
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border">
                Name
              </th>
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[200px]">
                Distribution
              </th>
              <th className="px-4 py-2 text-right text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[100px]">
                Count
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-b-0 animate-pulse">
                  <td className="px-4 py-3">
                    <Skeleton width={24} height={14} borderRadius={4} />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton width={200} height={14} borderRadius={4} />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton width={150} height={8} borderRadius={4} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Skeleton width={40} height={14} borderRadius={4} />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center text-[13px] text-text-muted">
                  No matching records found.
                </td>
              </tr>
            ) : (
              data.map((item, i) => {
                const globalRank = (meta.page - 1) * meta.limit + i + 1;
                const pct = Math.round((item.count / maxCountInView) * 100);
                const isTop3 = globalRank <= 3;
                return (
                  <tr
                    key={item.name}
                    className="hover:bg-surface-3 transition-colors border-b border-border last:border-b-0"
                  >
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'text-[9px] font-bold uppercase tracking-[0.5px] px-1.5 py-[2px] rounded-[4px] border inline-flex items-center',
                          isTop3
                            ? 'bg-accent-light text-accent-hover border-accent'
                            : 'bg-surface-2 text-text-muted border-border'
                        )}
                      >
                        #{globalRank}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-text-primary font-medium">
                      {item.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden border border-border/40">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length],
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-bold text-text-primary font-mono text-right">
                      {item.count.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {meta.totalPages > 1 && (
        <div className="px-[18px] py-3 border-t border-border flex items-center justify-between flex-shrink-0 bg-surface-2">
          <span className="text-[11px] text-text-muted font-medium">
            Showing page {meta.page} of {meta.totalPages} ({meta.total} total items)
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={meta.page <= 1}
              onClick={() => fetchData(meta.page - 1, search)}
              className="sec-btn px-2 h-[28px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (meta.totalPages <= 5) {
                pageNum = i + 1;
              } else if (meta.page <= 3) {
                pageNum = i + 1;
              } else if (meta.page >= meta.totalPages - 2) {
                pageNum = meta.totalPages - 4 + i;
              } else {
                pageNum = meta.page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => fetchData(pageNum, search)}
                  className={cn(
                    'w-7 h-[28px] rounded-btn text-[11px] font-semibold cursor-pointer border flex items-center justify-center transition-all duration-150',
                    pageNum === meta.page
                      ? 'bg-accent text-white border-accent-hover shadow-btn-primary'
                      : 'bg-surface text-text-secondary border-border hover:bg-surface-2 hover:border-border-strong hover:text-text-primary'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchData(meta.page + 1, search)}
              className="sec-btn px-2 h-[28px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PatientAnalyticsData {
  id: string;
  patientCode: string;
  name: string;
  sex: string;
  dateOfBirth: string;
  city: string;
  region: string;
  diagnoses: string[];
  medications: string[];
  createdAt: string;
}

// ─── Patient Analytics Panel ────────────────────────────────────────────────

function PatientAnalyticsPanel({ dateRange }: { dateRange?: DateRange }) {
  const [data, setData] = useState<PatientAnalyticsData[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medication, setMedication] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(
    async (page = 1, s = search, d = diagnosis, m = medication, c = city) => {
      setLoading(true);
      try {
        let url = `/analytics/patients?page=${page}&limit=20`;
        if (s) url += `&search=${encodeURIComponent(s)}`;
        if (d) url += `&diagnosis=${encodeURIComponent(d)}`;
        if (m) url += `&medication=${encodeURIComponent(m)}`;
        if (c) url += `&city=${encodeURIComponent(c)}`;
        if (dateRange?.from && dateRange?.to) {
          url += `&from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`;
        }
        const res = await apiRequest<{ data: PatientAnalyticsData[], meta: { total: number; page: number; limit: number; totalPages: number } }>(url);
        setData(res.data);
        setMeta(res.meta);
      } catch {
        toast.error('Failed to load patient analytics');
      } finally {
        setLoading(false);
      }
    },
    [dateRange, search, diagnosis, medication, city]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(1, search, diagnosis, medication, city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const handleFilterChange = (field: 'search'|'diagnosis'|'medication'|'city', val: string) => {
    if (field === 'search') setSearch(val);
    if (field === 'diagnosis') setDiagnosis(val);
    if (field === 'medication') setMedication(val);
    if (field === 'city') setCity(val);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(1, 
        field === 'search' ? val : search,
        field === 'diagnosis' ? val : diagnosis,
        field === 'medication' ? val : medication,
        field === 'city' ? val : city
      );
    }, 350);
  };

  const handleExport = async () => {
    try {
      let url = `/analytics/patients?page=1&limit=5000`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (diagnosis) url += `&diagnosis=${encodeURIComponent(diagnosis)}`;
      if (medication) url += `&medication=${encodeURIComponent(medication)}`;
      if (city) url += `&city=${encodeURIComponent(city)}`;
      if (dateRange?.from && dateRange?.to) {
        url += `&from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`;
      }
      const res = await apiRequest<{ data: any[] }>(url);
      if (res.data.length) {
        const exportData = res.data.map((p) => ({
          'Patient ID': p.patientCode,
          'Name': p.name,
          'Sex': p.sex,
          'City': p.city,
          'Region': p.region,
          'Diagnoses': p.diagnoses.join('; '),
          'Medications': p.medications.join('; ')
        }));
        downloadCSV(exportData, 'patient_analytics_export.csv');
        toast.success('Export successful');
      } else {
        toast.error('No data to export');
      }
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="bg-surface border border-border rounded-card flex flex-col shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-[18px] py-3.5 border-b border-border flex-shrink-0 bg-surface-2 justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-icon bg-surface-3 flex items-center justify-center text-[12px] text-accent font-bold border border-border/50">
            <Users size={13} />
          </div>
          <h2 className="text-[13px] uppercase tracking-[0.6px] font-bold flex-1 text-text-secondary">Patient Cohort Analysis</h2>
        </div>
        <button onClick={handleExport} className="sec-btn flex items-center gap-1.5 h-[28px] px-3">
          <Download size={13} /> Export CSV
        </button>
      </div>
      
      {/* Filters */}
      <div className="px-[18px] py-3 flex-shrink-0 border-b border-border/40 bg-surface grid grid-cols-4 gap-3 max-[1023px]:grid-cols-2 max-[767px]:grid-cols-1">
        <input type="text" placeholder="Search by name/ID..." value={search} onChange={(e) => handleFilterChange('search', e.target.value)} className="field-input w-full px-2.5 h-[34px]" />
        <input type="text" placeholder="Filter by Diagnosis..." value={diagnosis} onChange={(e) => handleFilterChange('diagnosis', e.target.value)} className="field-input w-full px-2.5 h-[34px]" />
        <input type="text" placeholder="Filter by Medication..." value={medication} onChange={(e) => handleFilterChange('medication', e.target.value)} className="field-input w-full px-2.5 h-[34px]" />
        <input type="text" placeholder="Filter by City..." value={city} onChange={(e) => handleFilterChange('city', e.target.value)} className="field-input w-full px-2.5 h-[34px]" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto min-h-[400px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="sticky top-0 bg-surface-2 border-b border-border z-10">
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[120px]">Patient Code</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[180px]">Name</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[80px]">Sex</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border w-[120px]">City</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border min-w-[200px]">Diagnoses</th>
              <th className="px-4 py-2 text-left text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary border-b border-border min-w-[200px]">Medications</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border animate-pulse"><td colSpan={6} className="px-4 py-3"><Skeleton height={20} /></td></tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-[13px] text-text-muted">No patients found.</td></tr>
            ) : (
              data.map((p) => (
                <tr key={p.id} className="hover:bg-surface-3 transition-colors border-b border-border">
                  <td className="px-4 py-2.5 text-[12px] font-mono font-medium text-text-secondary">{p.patientCode}</td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-text-primary">{p.name}</td>
                  <td className="px-4 py-2.5 text-[12px] text-text-secondary capitalize">{p.sex.toLowerCase()}</td>
                  <td className="px-4 py-2.5 text-[12px] text-text-secondary">{p.city}</td>
                  <td className="px-4 py-2.5 text-[12px] max-w-[200px] truncate text-text-secondary" title={p.diagnoses.join(', ')}>{p.diagnoses.join(', ') || '-'}</td>
                  <td className="px-4 py-2.5 text-[12px] max-w-[200px] truncate text-text-secondary" title={p.medications.join(', ')}>{p.medications.join(', ') || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {meta.totalPages > 1 && (
        <div className="px-[18px] py-3 border-t border-border flex items-center justify-between flex-shrink-0 bg-surface-2">
          <span className="text-[11px] text-text-muted font-medium">
            Showing page {meta.page} of {meta.totalPages} ({meta.total} total patients)
          </span>
          <div className="flex gap-1.5">
            <button disabled={meta.page <= 1} onClick={() => fetchData(meta.page - 1)} className="sec-btn px-2 h-[28px] disabled:opacity-40">Prev</button>
            <button disabled={meta.page >= meta.totalPages} onClick={() => fetchData(meta.page + 1)} className="sec-btn px-2 h-[28px] disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Month label formatter ──────────────────────────────────────────────────

function formatMonth(val: string) {
  const d = new Date(val + '-01');
  return d.toLocaleDateString('en-PH', { month: 'short', year: '2-digit' });
}

// ─── Main Analytics Dashboard Page ───────────────────────────────────────────

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // View mode toggles for top items cards ('chart' vs 'table')
  const [diagnosesViewMode, setDiagnosesViewMode] = useState<'chart' | 'table'>('chart');
  const [medicationsViewMode, setMedicationsViewMode] = useState<'chart' | 'table'>('chart');

  const fetchDashboard = useCallback(async (range?: DateRange) => {
    setLoading(true);
    try {
      let url = '/analytics/dashboard';
      if (range?.from && range?.to) {
        url += `?from=${range.from.toISOString()}&to=${range.to.toISOString()}`;
      }
      const res = await apiRequest<DashboardData>(url);
      setData(res);
    } catch {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboard(dateRange);
  }, [fetchDashboard, dateRange]);

  const handleDateChange = (range: DateRange | undefined) => {
    setDateRange(range);
  };

  const clearDateRange = () => {
    setDateRange(undefined);
  };

  // ── Loading Skeleton ─────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-[20px] font-bold text-text-primary mb-1">Analytics Dashboard</h1>
            <p className="text-[12px] text-text-muted">Loading analytics metrics…</p>
          </div>
        </div>
        {/* KPI Skeletons */}
        <div className="grid grid-cols-5 gap-3 max-[1279px]:grid-cols-3 max-[767px]:grid-cols-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-card shadow-card p-4 animate-pulse">
              <Skeleton width={80} height={10} borderRadius={4} />
              <div className="mt-2">
                <Skeleton width={60} height={22} borderRadius={4} />
              </div>
              <div className="mt-1">
                <Skeleton width={100} height={10} borderRadius={4} />
              </div>
            </div>
          ))}
        </div>
        {/* Chart Skeletons */}
        <div className="grid grid-cols-2 gap-4 max-[1023px]:grid-cols-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-card shadow-card overflow-hidden animate-pulse">
              <div className="px-4 py-3 bg-surface-2 border-b border-border">
                <Skeleton width={160} height={12} borderRadius={4} />
              </div>
              <div className="p-4">
                <Skeleton width="100%" height={230} borderRadius={8} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const {
    summary,
    sexDistribution,
    topDiagnoses,
    topMedications,
    patientsByCity,
    patientsByRegion,
    registrationsOverTime,
    visitsOverTime,
    ageDistribution,
    problemStatusBreakdown,
    staffByRole,
  } = data;

  const totalStaff = staffByRole.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-start mb-5 max-[767px]:flex-col max-[767px]:gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-text-primary mb-1">Analytics Dashboard</h1>
          <p className="text-[12px] text-text-muted">
            Aggregated population metrics, clinical diagnoses, medications, and demographic insights.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DatePickerWithRange date={dateRange} setDate={handleDateChange} size="sm" />
          {dateRange && (
            <button
              onClick={clearDateRange}
              className="sec-btn h-[32px] px-2.5 text-[11px]"
              title="Clear date filter"
            >
              <FilterX className="w-3.5 h-3.5 text-text-muted" /> Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* ─── Subtabs Navigation ──────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6 border-b border-border pb-px overflow-x-auto">
        {(['overview', 'patient-analytics', 'diagnoses', 'medications', 'demographics'] as DashboardTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-[12px] font-semibold capitalize border-b-2 transition-colors whitespace-nowrap",
              activeTab === tab 
                ? "border-accent text-text-primary" 
                : "border-transparent text-text-muted hover:text-text-secondary hover:border-border-strong"
            )}
          >
            {tab === 'patient-analytics' ? 'Patient Analytics' : tab === 'overview' ? 'Overview' : `${tab} Detail`}
          </button>
        ))}
      </div>

      {/* ─── Tab Content: Patient Analytics ─────────────────────────────────────── */}
      {activeTab === 'patient-analytics' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-card p-4">
            <h3 className="text-[14px] font-bold text-text-primary mb-2">Patient Analytics Analysis</h3>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Use this module to perform cohort analyses. Filter the population by diagnoses, medications, and geographical location to gain comprehensive insights into the clinic&apos;s demographics.
            </p>
          </div>
          <PatientAnalyticsPanel dateRange={dateRange} />
        </div>
      )}

      {/* ─── Tab Content: Overview ────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* ─── Summary KPI Cards (Design Standard §6.1 & §6.3) ──────────────── */}
      <div className="grid grid-cols-5 gap-3 max-[1279px]:grid-cols-3 max-[767px]:grid-cols-1">
        <StatCard
          icon={Users}
          label="Total Patients"
          value={summary.totalPatients}
          sub={`${summary.activePatients} active · ${summary.inactivePatients} inactive`}
          accent="#0A6E5F"
        />
        <StatCard
          icon={Activity}
          label="Total Visits"
          value={summary.totalVisits}
          accent="#3B82F6"
        />
        <StatCard
          icon={Stethoscope}
          label="Active Diagnoses"
          value={summary.activeProblems}
          sub={`${summary.totalProblems} total recorded`}
          accent="#8B5CF6"
        />
        <StatCard
          icon={Pill}
          label="Active Medications"
          value={summary.activeMedications}
          sub={`${summary.totalMedications} total recorded`}
          accent="#EC4899"
        />
        <StatCard
          icon={ShieldCheck}
          label="Staff Accounts"
          value={totalStaff}
          sub={staffByRole.map((s) => `${s.count} ${s.role.toLowerCase()}${s.count !== 1 ? 's' : ''}`).join(' · ')}
          accent="#F59E0B"
        />
      </div>

      {/* ─── Charts Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 max-[1023px]:grid-cols-1">
        {/* Patient Registrations Over Time */}
        <ChartCard icon={TrendingUp} title="Patient Registrations Over Time">
          {registrationsOverTime.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-12">No registration history available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={registrationsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  tickFormatter={formatMonth}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="New Patients"
                  stroke="#0A6E5F"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#0A6E5F', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#085A4E' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Visits Over Time */}
        <ChartCard icon={Activity} title="Clinic Visits Over Time">
          {visitsOverTime.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-12">No visit history available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={visitsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  tickFormatter={formatMonth}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Visits"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#3B82F6', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#1E3A8A' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top 10 Diagnoses */}
        <ChartCard
          icon={Stethoscope}
          title="Top 10 Diagnoses"
          action={
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDiagnosesViewMode((v) => (v === 'chart' ? 'table' : 'chart'))}
                className="sec-btn h-[24px] px-2 text-[10px]"
                title="Toggle chart/table view"
              >
                {diagnosesViewMode === 'chart' ? <TableIcon size={12} /> : <BarChart3 size={12} />}
                {diagnosesViewMode === 'chart' ? 'Table' : 'Chart'}
              </button>
              <button
                onClick={() => setActiveTab('diagnoses')}
                className="sec-btn primary h-[24px] px-2 text-[10px]"
              >
                View Detailed →
              </button>
            </div>
          }
        >
          {topDiagnoses.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-12">No diagnosis data available.</p>
          ) : diagnosesViewMode === 'table' ? (
            <TopItemsTable items={topDiagnoses} typeLabel="Diagnosis" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topDiagnoses}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10, fill: '#374151', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  width={140}
                  tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 18) + '…' : v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Patients" radius={[0, 4, 4, 0]}>
                  {topDiagnoses.map((_: NameCount, i: number) => (
                    <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top 10 Medications */}
        <ChartCard
          icon={Pill}
          title="Top 10 Prescribed Medications"
          action={
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMedicationsViewMode((v) => (v === 'chart' ? 'table' : 'chart'))}
                className="sec-btn h-[24px] px-2 text-[10px]"
                title="Toggle chart/table view"
              >
                {medicationsViewMode === 'chart' ? <TableIcon size={12} /> : <BarChart3 size={12} />}
                {medicationsViewMode === 'chart' ? 'Table' : 'Chart'}
              </button>
              <button
                onClick={() => setActiveTab('medications')}
                className="sec-btn primary h-[24px] px-2 text-[10px]"
              >
                View Detailed →
              </button>
            </div>
          }
        >
          {topMedications.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-12">No medication data available.</p>
          ) : medicationsViewMode === 'table' ? (
            <TopItemsTable items={topMedications} typeLabel="Medication" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topMedications}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10, fill: '#374151', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  width={140}
                  tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 18) + '…' : v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Prescriptions" radius={[0, 4, 4, 0]}>
                  {topMedications.map((_: NameCount, i: number) => (
                    <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Patients by City */}
        <ChartCard icon={MapPin} title="Patient Geographic Distribution (City)">
          {patientsByCity.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-12">No city demographic data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={patientsByCity} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="city"
                  tick={{ fontSize: 9, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Patients" radius={[4, 4, 0, 0]}>
                  {patientsByCity.map((_: { city: string; count: number }, i: number) => (
                    <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Patients by Region */}
        <ChartCard icon={MapPin} title="Patient Geographic Distribution (Region)">
          {patientsByRegion.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-12">No region demographic data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={patientsByRegion} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="region"
                  tick={{ fontSize: 9, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Patients" radius={[4, 4, 0, 0]}>
                  {patientsByRegion.map((_: { region: string; count: number }, i: number) => (
                    <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Sex Distribution */}
        <ChartCard icon={PieChartIcon} title="Patient Sex Demographics">
          {sexDistribution.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-12">No sex demographic data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={sexDistribution}
                  dataKey="count"
                  nameKey="sex"
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {sexDistribution.map((_: { sex: string; count: number }, i: number) => (
                    <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value: string) => (
                    <span className="text-[11px] font-medium text-text-secondary capitalize">
                      {value.toLowerCase()}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Age Distribution */}
        <ChartCard icon={Users} title="Patient Age Demographics">
          {ageDistribution.length === 0 ? (
            <p className="text-[12px] text-text-muted text-center py-12">No age demographic data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ageDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Patients" radius={[4, 4, 0, 0]}>
                  {ageDistribution.map((_: { range: string; count: number }, i: number) => (
                    <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ─── Problem Status Breakdown (Design Standard §6.1 & §6.3) ───────── */}
      <ChartCard icon={Stethoscope} title="Problem Status Breakdown">
        {problemStatusBreakdown.length === 0 ? (
          <p className="text-[12px] text-text-muted text-center py-12">No problem status data available.</p>
        ) : (
          <div className="flex items-center gap-8 max-[767px]:flex-col max-[767px]:gap-4">
            <div className="w-[280px] shrink-0 max-[767px]:w-full">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={problemStatusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {problemStatusBreakdown.map((entry: { status: string; count: number }, i: number) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] || DAMAYAN_PALETTE[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5 w-full">
              {problemStatusBreakdown.map((entry) => {
                const total = problemStatusBreakdown.reduce((sum, p) => sum + p.count, 0);
                const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
                const statusColor = STATUS_COLORS[entry.status] || DAMAYAN_PALETTE[0];

                return (
                  <div
                    key={entry.status}
                    className="flex items-center gap-3 p-2 bg-surface-2 rounded-btn border border-border/60"
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span className="text-[12px] font-semibold text-text-primary capitalize flex-1">
                      {entry.status.toLowerCase()} Problems
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-[10px] text-text-muted">({pct}%)</span>
                      <span className="text-[13px] font-bold text-text-primary">
                        {entry.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ChartCard>
        </>
      )}

      {/* ─── Tab Content: Diagnoses ────────────────────────────────────────── */}
      {activeTab === 'diagnoses' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-card p-4">
            <h3 className="text-[14px] font-bold text-text-primary mb-2">Diagnoses Detail Overview</h3>
            <p className="text-[12px] text-text-muted leading-relaxed">
              This section details the most frequently recorded active and resolved diagnoses across the patient population. 
              The chart below highlights the top 10 most common diagnoses. Use the paginated table further below to search and view the complete dataset.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 max-[1023px]:grid-cols-1">
            <ChartCard icon={Stethoscope} title="Top 10 Diagnoses">
              {topDiagnoses.length === 0 ? (
                <p className="text-[12px] text-text-muted text-center py-12">No diagnosis data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={topDiagnoses}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      allowDecimals={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 10, fill: '#374151', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      width={140}
                      tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 18) + '…' : v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Patients" radius={[0, 4, 4, 0]}>
                      {topDiagnoses.map((_: NameCount, i: number) => (
                        <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            
            <ChartCard icon={Activity} title="Problem Status Breakdown">
              {problemStatusBreakdown.length === 0 ? (
                <p className="text-[12px] text-text-muted text-center py-12">No problem status data available.</p>
              ) : (
                <div className="flex flex-col h-full justify-center gap-6 p-4">
                  <div className="w-full max-w-[280px] mx-auto">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={problemStatusBreakdown}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          paddingAngle={4}
                        >
                          {problemStatusBreakdown.map((entry: { status: string; count: number }, i: number) => (
                            <Cell key={i} fill={STATUS_COLORS[entry.status] || DAMAYAN_PALETTE[i]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5 w-full max-w-[320px] mx-auto">
                    {problemStatusBreakdown.map((entry) => {
                      const total = problemStatusBreakdown.reduce((sum, p) => sum + p.count, 0);
                      const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
                      const statusColor = STATUS_COLORS[entry.status] || DAMAYAN_PALETTE[0];

                      return (
                        <div
                          key={entry.status}
                          className="flex items-center gap-3 p-2 bg-surface-2 rounded-btn border border-border/60"
                        >
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: statusColor }}
                          />
                          <span className="text-[12px] font-semibold text-text-primary capitalize flex-1">
                            {entry.status.toLowerCase()} Problems
                          </span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-[10px] text-text-muted">({pct}%)</span>
                            <span className="text-[13px] font-bold text-text-primary">
                              {entry.count.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </ChartCard>
          </div>

          <PaginatedDataTable title="All Patient Diagnoses" endpoint="problems" dateRange={dateRange} />
        </div>
      )}

      {/* ─── Tab Content: Medications ──────────────────────────────────────── */}
      {activeTab === 'medications' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-card p-4">
            <h3 className="text-[14px] font-bold text-text-primary mb-2">Medications Detail Overview</h3>
            <p className="text-[12px] text-text-muted leading-relaxed">
              This section details the most frequently prescribed medications across the patient population. 
              The chart below highlights the top 10 most common medications. Use the paginated table further below to search and view the complete dataset.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 max-[1023px]:grid-cols-1">
            <ChartCard icon={Pill} title="Top 10 Prescribed Medications">
              {topMedications.length === 0 ? (
                <p className="text-[12px] text-text-muted text-center py-12">No medication data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={topMedications}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      allowDecimals={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 10, fill: '#374151', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      width={140}
                      tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 18) + '…' : v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Prescriptions" radius={[0, 4, 4, 0]}>
                      {topMedications.map((_: NameCount, i: number) => (
                        <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <PaginatedDataTable title="All Prescribed Medications" endpoint="medications" dateRange={dateRange} />
        </div>
      )}

      {/* ─── Tab Content: Demographics ─────────────────────────────────────── */}
      {activeTab === 'demographics' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-card p-4">
            <h3 className="text-[14px] font-bold text-text-primary mb-2">Detailed Demographic Insights</h3>
            <p className="text-[12px] text-text-muted leading-relaxed">
              This section breaks down the clinic population by critical demographic parameters including geographic location (City and Region), biological sex, and age groupings. Visual charts are supported by complete data tables below them.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 max-[1023px]:grid-cols-1">
            {/* Patients by City */}
            <ChartCard icon={MapPin} title="Patient Geographic Distribution (City)">
              {patientsByCity.length === 0 ? (
                <p className="text-[12px] text-text-muted text-center py-12">No city demographic data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={patientsByCity} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      dataKey="city"
                      tick={{ fontSize: 9, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Patients" radius={[4, 4, 0, 0]}>
                      {patientsByCity.map((_: { city: string; count: number }, i: number) => (
                        <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Patients by Region */}
            <ChartCard icon={MapPin} title="Patient Geographic Distribution (Region)">
              {patientsByRegion.length === 0 ? (
                <p className="text-[12px] text-text-muted text-center py-12">No region demographic data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={patientsByRegion} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      dataKey="region"
                      tick={{ fontSize: 9, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Patients" radius={[4, 4, 0, 0]}>
                      {patientsByRegion.map((_: { region: string; count: number }, i: number) => (
                        <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            
            {/* Sex Distribution */}
            <ChartCard icon={PieChartIcon} title="Patient Sex Demographics">
              {sexDistribution.length === 0 ? (
                <p className="text-[12px] text-text-muted text-center py-12">No sex demographic data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={sexDistribution}
                      dataKey="count"
                      nameKey="sex"
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      label={({ name, value }) => `${name} (${value})`}
                    >
                      {sexDistribution.map((_: { sex: string; count: number }, i: number) => (
                        <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value: string) => (
                        <span className="text-[11px] font-medium text-text-secondary capitalize">
                          {value.toLowerCase()}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Age Distribution */}
            <ChartCard icon={Users} title="Patient Age Demographics">
              {ageDistribution.length === 0 ? (
                <p className="text-[12px] text-text-muted text-center py-12">No age demographic data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ageDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      dataKey="range"
                      tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#4B5563', fontFamily: 'IBM Plex Sans, sans-serif' }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Patients" radius={[4, 4, 0, 0]}>
                      {ageDistribution.map((_: { range: string; count: number }, i: number) => (
                        <Cell key={i} fill={DAMAYAN_PALETTE[i % DAMAYAN_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Full Demographics Tables */}
          <div className="grid grid-cols-2 gap-4 max-[1023px]:grid-cols-1 pt-4 border-t border-border mt-4">
             <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
               <div className="px-3.5 py-2.5 bg-surface-2 border-b border-border flex items-center justify-between">
                 <h4 className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary flex items-center gap-2">
                   <TableIcon size={13} /> Complete City Data
                 </h4>
                 <button onClick={() => downloadCSV(patientsByCity, 'city_data_export.csv')} className="sec-btn flex items-center gap-1.5 h-[24px] px-2 text-[10px]">
                   <Download size={11} /> Export
                 </button>
               </div>
               <TopItemsTable items={patientsByCity.map(i => ({ name: i.city, count: i.count }))} typeLabel="City" />
             </div>
             
             <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
               <div className="px-3.5 py-2.5 bg-surface-2 border-b border-border flex items-center justify-between">
                 <h4 className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary flex items-center gap-2">
                   <TableIcon size={13} /> Complete Region Data
                 </h4>
                 <button onClick={() => downloadCSV(patientsByRegion, 'region_data_export.csv')} className="sec-btn flex items-center gap-1.5 h-[24px] px-2 text-[10px]">
                   <Download size={11} /> Export
                 </button>
               </div>
               <TopItemsTable items={patientsByRegion.map(i => ({ name: i.region, count: i.count }))} typeLabel="Region" />
             </div>

             <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
               <div className="px-3.5 py-2.5 bg-surface-2 border-b border-border flex items-center justify-between">
                 <h4 className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary flex items-center gap-2">
                   <TableIcon size={13} /> Complete Sex Data
                 </h4>
                 <button onClick={() => downloadCSV(sexDistribution, 'sex_data_export.csv')} className="sec-btn flex items-center gap-1.5 h-[24px] px-2 text-[10px]">
                   <Download size={11} /> Export
                 </button>
               </div>
               <TopItemsTable items={sexDistribution.map(i => ({ name: i.sex, count: i.count }))} typeLabel="Biological Sex" />
             </div>

             <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
               <div className="px-3.5 py-2.5 bg-surface-2 border-b border-border flex items-center justify-between">
                 <h4 className="text-[11px] font-bold uppercase tracking-[0.6px] text-text-secondary flex items-center gap-2">
                   <TableIcon size={13} /> Complete Age Group Data
                 </h4>
                 <button onClick={() => downloadCSV(ageDistribution, 'age_data_export.csv')} className="sec-btn flex items-center gap-1.5 h-[24px] px-2 text-[10px]">
                   <Download size={11} /> Export
                 </button>
               </div>
               <TopItemsTable items={ageDistribution.map(i => ({ name: i.range, count: i.count }))} typeLabel="Age Range" />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
