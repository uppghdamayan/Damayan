# Phase 12: Audit Logs — Agentic Implementation Guide (v2)

**Project:** DAMAYAN EMR
**Phase:** 12 of 14 (Development Roadmap, MVP V6)
**Dependencies:** Phase 11 (Document Management) — complete
**Unblocks:** Phase 13 (Notifications), Phase 14 (Analytics Dashboard)
**Stack:** NestJS (backend) + Next.js App Router (frontend) + shadcn/ui + Tailwind CSS
**Design reference:** `design-standard.md` v2.1 (§6, §9, §12, §14) — this guide inherits every token, component mapping, and breakpoint rule from that document. Do not invent new colors, spacing, or font sizes; if something isn't covered below, look it up there first.

This guide supersedes the prior draft. It is written for an AI coding assistant to execute directly against the existing DAMAYAN monorepo. It documents the current repo state, all authoritative contracts, exact shadcn/ui component usage (including the Date Picker and filter bar the design standard calls for), and every file to create or touch.

---

## 1. Scope of Phase 12

Phase 12 deliverables: **an audit log interceptor that writes an `AuditLog` row for every mutable API action, a backend query endpoint for logs, and a frontend Admin UI page to browse them using shadcn/ui components throughout.**

### What must be built

| Layer | Item | Notes |
|---|---|---|
| Backend | `AuditLogInterceptor` (NestJS `NestInterceptor`) | Fires after successful responses; writes `AuditLog` row. |
| Backend | `AuditLogsService` — `create()` and `findAll()` methods | `create()` used by the interceptor. `findAll()` powers the admin query endpoint. |
| Backend | `AuditLogsController` — `GET /audit-logs` | Admin-only. Supports query filters: `userId`, `patientId`, `action`, `tableName`, `from`, `to`, pagination. |
| Backend | Wire interceptor globally in `main.ts` | See §4.6. |
| Frontend | `useAuditLogs.ts` hook | React Query hook for `GET /audit-logs`. |
| Frontend | `/admin/audit-logs/page.tsx` | New admin tab page listing audit log entries with shadcn filter bar (Select + Popover/Calendar date range + search Input). |
| Frontend | `components/ui/date-range-picker.tsx` | New reusable shadcn Popover+Calendar range picker (does not exist yet — build per §6.3). |
| Frontend | Update `AdminTabsNav` in `admin/layout.tsx` | Add "Audit Logs" tab. |

### Explicitly out of scope
- Logging failed/rejected requests (only log successful actions).
- Logging `VIEW` actions on every GET endpoint.
- Retroactive back-fill of historical data.
- Real-time / WebSocket push of new log entries.

---

## 2. Current Repo State — What Already Exists

### 2.1 Database — AuditLog model (already in schema, do NOT recreate)

File: `backend/prisma/schema.prisma` (lines 362–381)

Fields: `id`, `userId`, `userRole`, `action` (`AuditAction` enum), `tableName`, `recordId`, `patientId` (optional), `changes` (`Json?`), `ipAddress` (optional), `createdAt`.

`AuditAction` enum values: `CREATE`, `UPDATE`, `DELETE`, `VIEW`, `GENERATE`.

Relations already declared:
- In `User` model: `auditLogs AuditLog[] @relation("AuditLogUser")`
- In `Patient` model: `auditLogs AuditLog[] @relation("AuditLogPatient")`

### 2.2 Backend — `AuditLogsModule` scaffold (empty, needs implementation)

File: `backend/src/audit-logs/audit-logs.module.ts` — currently just an empty `@Module({})`.

Already registered in `AppModule` (`backend/src/app.module.ts`, line 36). Do NOT add it again.

### 2.3 Backend — `audit-logs/dto/` is currently empty

File: `backend/src/audit-logs/dto/` — empty. Create DTOs here.

### 2.4 Backend — No interceptor exists yet

File: `backend/src/common/interceptors/` — empty directory. Create the interceptor here.

### 2.5 Frontend — No audit logs UI, hook, or date-range picker exists yet

- No `frontend/src/hooks/useAuditLogs.ts`
- No `frontend/src/app/admin/audit-logs/` directory or page
- No `frontend/src/components/ui/date-range-picker.tsx`
- `AdminTabsNav` in `frontend/src/app/admin/layout.tsx` has 3 tabs (Staff Accounts, Patient Accounts, Dashboard) — needs a 4th tab added
- shadcn `Popover` and `Calendar` primitives already exist in the project (used elsewhere per design-standard §9 for DOB/visit datetime pickers — confirm at `frontend/src/components/ui/popover.tsx` and `frontend/src/components/ui/calendar.tsx`; if either is missing, run `npx shadcn@latest add popover calendar` before proceeding)

---

## 3. Authoritative API Contract

### 3.1 Route

`GET /audit-logs` — Admin only — paginated, filterable.

Query params: `userId` (UUID), `patientId` (UUID), `action` (`AuditAction`), `tableName` (string), `from` (ISO date), `to` (ISO date), `page` (number, default 1), `limit` (number, default 50, max 200).

Response:
```json
{
  "data": [ /* AuditLogEntry[] */ ],
  "meta": { "total": 0, "page": 1, "limit": 50, "totalPages": 0 }
}
```
Each `AuditLogEntry` includes a `user` relation: `{ firstName, lastName, email }`.

### 3.2 Action-to-table mapping

| Route | Action | Table |
|---|---|---|
| `POST /patients` | CREATE | patients |
| `PATCH /patients/:id` | UPDATE | patients |
| `PATCH /patients/:id/deactivate` | UPDATE | patients |
| `PATCH /patients/:id/reactivate` | UPDATE | patients |
| `POST /visits` | CREATE | visits |
| `PATCH /visits/:id` | UPDATE | visits |
| `POST /initial-notes` | CREATE | initial_notes |
| `PATCH /initial-notes/:id` | UPDATE | initial_notes |
| `POST /progress-notes` | CREATE | progress_notes |
| `PATCH /progress-notes/:id` | UPDATE | progress_notes |
| `POST /problems` | CREATE | problems |
| `PATCH /problems/:id` | UPDATE | problems |
| `DELETE /problems/:id` | DELETE | problems |
| `POST /medications` | CREATE | medications |
| `PATCH /medications/:id` | UPDATE | medications |
| `DELETE /medications/:id` | DELETE | medications |
| `POST /attachments/upload` | CREATE | attachments |
| `DELETE /attachments/:id` | DELETE | attachments |
| `POST /patients/:patientId/documents/generate` | GENERATE | documents |
| `POST /accounts` | CREATE | users |
| `PATCH /accounts/:id` | UPDATE | users |
| `DELETE /accounts/:id` | DELETE | users |
| `POST /accounts/:id/reset-password` | UPDATE | users |

Do NOT log: all `GET` endpoints, `POST /auth/change-password`, `GET /auth/me`.

---

## 4. Backend Implementation

### 4.1 DTOs — `backend/src/audit-logs/dto/`

**`create-audit-log.dto.ts`**
- `userId: string`
- `userRole: Role` (from `@prisma/client`)
- `action: AuditAction` (from `@prisma/client`)
- `tableName: string`
- `recordId: string`
- `patientId?: string`
- `changes?: Record<string, unknown>`
- `ipAddress?: string`

**`query-audit-logs.dto.ts`** (use `class-validator` decorators)
- `@IsOptional() @IsUUID() userId?: string`
- `@IsOptional() @IsUUID() patientId?: string`
- `@IsOptional() @IsEnum(AuditAction) action?: AuditAction`
- `@IsOptional() tableName?: string`
- `@IsOptional() @IsDateString() from?: string`
- `@IsOptional() @IsDateString() to?: string`
- `@IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number`
- `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number`

### 4.2 Service — `backend/src/audit-logs/audit-logs.service.ts`

Inject: `private prisma: PrismaService`.

`create(dto: CreateAuditLogDto)`:
- **CRITICAL:** wrap in `try/catch`. Never throw. `console.error` on failure.
- Call `this.prisma.auditLog.create({ data: dto })`.
- Fire-and-forget — caller does not `await`.

`findAll(query: QueryAuditLogsDto)`:
- Build a Prisma `where` clause from the provided filters (only include keys that are present).
- `from`/`to` map to `createdAt: { gte, lte }`.
- Use `Promise.all([findMany(...), count(...)])`.
- `orderBy: { createdAt: 'desc' }`.
- `include: { user: { select: { firstName: true, lastName: true, email: true } } }`.
- Apply `skip = (page - 1) * limit`, `take = limit`.
- Return `{ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }`.

### 4.3 Controller — `backend/src/audit-logs/audit-logs.controller.ts`

```ts
@ApiTags('Audit Logs')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(@Query() query: QueryAuditLogsDto) {
    return this.auditLogsService.findAll(query);
  }
}
```

### 4.4 Interceptor — `backend/src/common/interceptors/audit-log.interceptor.ts`

Implements `NestInterceptor`. Constructor injects `AuditLogsService`.

`resolveAudit(method, path)`:
- Returns `null` for all `GET` requests.
- Pattern-matches `method + path` to return `{ action: AuditAction; tableName: string } | null` using the table in §3.2.
- Use regex like `/^\/patients\/[^/]+$/` for `:id` patterns.
- Check more-specific paths **before** less-specific ones (e.g. `/deactivate`, `/reactivate`, `/reset-password` before the bare `/:id` pattern).

`intercept(context, next)`:
```ts
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const req = context.switchToHttp().getRequest();
  const { method, url, user, ip } = req;
  const path = url.split('?')[0];

  return next.handle().pipe(
    tap((responseBody) => {
      const resolved = resolveAudit(method, path);
      if (!resolved || !user?.id) return;

      const recordId = responseBody?.id ?? responseBody?.user?.id;
      const patientId = responseBody?.patientId ?? responseBody?.patient?.id;

      this.auditLogsService.create({
        userId: user.id,
        userRole: user.role,
        action: resolved.action,
        tableName: resolved.tableName,
        recordId,
        patientId,
        changes: req.body,
        ipAddress: ip,
      });
      // fire-and-forget — no await
    }),
  );
}
```

### 4.5 Module — update `backend/src/audit-logs/audit-logs.module.ts`

```ts
@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
```

`@Global()` is required so `AuditLogsService` can be injected into the interceptor (in `common/`) without every module importing `AuditLogsModule`.

### 4.6 Register in `main.ts`

After validation pipe setup, before `app.listen()`:

```ts
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { AuditLogsService } from './audit-logs/audit-logs.service';

const auditLogsService = app.get(AuditLogsService);
app.useGlobalInterceptors(new AuditLogInterceptor(auditLogsService));
```

---

## 5. Key Existing Files (backend)

### Guards (used by all controllers — copy this import pattern)

- `backend/src/auth/guards/jwt-auth.guard.ts` — validates Supabase JWT via `supabase.auth.getUser(token)`, loads full `User` Prisma record, sets `req.user`. Blocks inactive accounts and `requiresPasswordChange` accounts (except `/auth/me` and `/auth/change-password`).
- `backend/src/auth/guards/roles.guard.ts` — reads `ROLES_KEY` metadata from handler/class, checks `req.user.role` against required roles. No `@Roles()` decorator = any authenticated role is allowed.
- `backend/src/auth/decorators/roles.decorator.ts` — `export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);`
- `backend/src/auth/decorators/current-user.decorator.ts` — `@CurrentUser()` param decorator returning `req.user`.

### Prisma service

`backend/src/prisma/prisma.service.ts` — extends `PrismaClient`, implements `OnModuleInit`/`OnModuleDestroy`. Registered globally via `PrismaModule` — no need to import `PrismaModule` in `AuditLogsModule`.

### App module

`backend/src/app.module.ts` — `AuditLogsModule` already imported on line 36. Do NOT add again.

### `main.ts`

- `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true, transform: true` already global.
- Swagger tag `'Audit Logs'` already registered (line 66).
- Add `app.useGlobalInterceptors(new AuditLogInterceptor(...))` before `app.listen()`.

---

## 6. Frontend Implementation

### 6.1 Frontend infrastructure to reuse

- `frontend/src/lib/api.ts` — `apiRequest<T>(path, options)` attaches Supabase JWT automatically. On 401: auto-signs out and redirects to `/login`. Usage: `apiRequest<AuditLogsResponse>('/audit-logs?page=1&limit=50')`.
- `frontend/src/stores/authStore.ts` — `user.role` is `'DOCTOR' | 'NURSE' | 'ADMIN'`. Check `user?.role === 'ADMIN'` to gate the Audit Logs tab (per design-standard §12: "View Audit Logs — Admin only").
- `frontend/src/app/admin/layout.tsx` — contains `AdminTabsNav()` (lines 111–165). `activeTab` resolved via `pathname.includes(...)`. Layout already has an auth guard — `/admin/audit-logs` is automatically protected.
- `frontend/src/app/admin/accounts/page.tsx` — style reference. Follow this file's patterns: button sub-components (`PrimaryBtn`/`SecBtn`), table structure, `Skeleton` loading, pagination, badge components (`RoleBadge`/`StatusBadge`), toast notifications via Sonner.

### 6.2 `useAuditLogs.ts` hook — `frontend/src/hooks/useAuditLogs.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'GENERATE';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userRole: 'ADMIN' | 'DOCTOR' | 'NURSE';
  action: AuditAction;
  tableName: string;
  recordId: string;
  patientId: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
}

export interface AuditLogsResponse {
  data: AuditLogEntry[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AuditLogFilters {
  userId?: string;
  patientId?: string;
  action?: AuditAction;
  tableName?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  page?: number;
  limit?: number;
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
      return apiRequest<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
    },
    staleTime: 30_000, // logs are append-only; 30s is fine
  });
}
```

### 6.3 New shared component — `frontend/src/components/ui/date-range-picker.tsx`

Design standard §9 maps date inputs to `Popover` + `Calendar`. Audit Logs needs a **range**, so build one reusable component (usable by future phases too) rather than two separate single-date pickers.

```tsx
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { type DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({ value, onChange, placeholder = 'Filter by date', className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const label = value?.from
    ? value.to
      ? `${format(value.from, 'MMM d, yyyy')} – ${format(value.to, 'MMM d, yyyy')}`
      : format(value.from, 'MMM d, yyyy')
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-8 px-3 rounded-btn text-[11px] font-semibold bg-surface text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary hover:border-border-strong justify-start gap-[5px] whitespace-nowrap',
            !value?.from && 'text-text-muted',
            className,
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-[10px] border-border shadow-modal" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          initialFocus
        />
        <div className="flex justify-end gap-2 px-3 py-2 border-t border-border">
          <Button
            variant="ghost"
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold"
            onClick={() => { onChange(undefined); setOpen(false); }}
          >
            Clear
          </Button>
          <Button
            className="h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-accent text-white border border-accent-hover hover:bg-accent-hover"
            onClick={() => setOpen(false)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

If `react-day-picker`'s `DateRange` type or `date-fns` are not yet installed, run:
```bash
npm install date-fns
```
(`react-day-picker` ships with shadcn's `Calendar` install and is already a dependency.)

### 6.4 Audit Logs page — `frontend/src/app/admin/audit-logs/page.tsx`

`'use client'` directive required (has filter state).

**Layout, per design-standard §14 and §6.5 (Tables):**

```tsx
'use client';

import { useState } from 'react';
import { type DateRange } from 'react-day-picker';
import { useAuditLogs, type AuditAction, type AuditLogFilters } from '@/hooks/useAuditLogs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_BADGE_VARIANT: Record<AuditAction, string> = {
  CREATE: 'saved',      // green
  UPDATE: 'draft',      // amber
  DELETE: 'critical',   // red
  VIEW: 'info',         // blue
  GENERATE: 'published',// purple
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AuditAction | 'ALL'>('ALL');
  const [tableName, setTableName] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const limit = 50;

  const filters: AuditLogFilters = {
    page,
    limit,
    ...(action !== 'ALL' && { action }),
    ...(tableName && { tableName }),
    ...(dateRange?.from && { from: dateRange.from.toISOString() }),
    ...(dateRange?.to && { to: dateRange.to.toISOString() }),
  };

  const { data, isLoading, isError } = useAuditLogs(filters);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-text-primary">Audit Logs</h1>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex items-center gap-2 h-8 bg-surface border border-border rounded-btn px-3 max-w-[220px]">
          <SearchIcon className="w-3.5 h-3.5 text-text-muted" />
          <input
            className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-text-muted"
            placeholder="Filter by table name..."
            value={tableName}
            onChange={(e) => { setTableName(e.target.value); setPage(1); }}
          />
        </div>

        <Select value={action} onValueChange={(v) => { setAction(v as AuditAction | 'ALL'); setPage(1); }}>
          <SelectTrigger className="h-8 w-[140px] text-[11px] rounded-btn border-border">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
            <SelectItem value="VIEW">View</SelectItem>
            <SelectItem value="GENERATE">Generate</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker
          value={dateRange}
          onChange={(range) => { setDateRange(range); setPage(1); }}
          placeholder="Filter by date range"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-card overflow-hidden bg-surface">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Timestamp', 'Actor', 'Action', 'Table', 'Record ID', 'Patient ID', 'IP Address'].map((h) => (
                <th key={h} className="text-[9px] font-bold uppercase tracking-[0.6px] text-text-secondary px-2.5 py-2 text-left bg-surface-2 border-b border-border">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-2.5 py-2 border-b border-border">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading && isError && (
              <tr>
                <td colSpan={7} className="px-2.5 py-6 text-center text-[12px] text-red">
                  Failed to load audit logs. Please try again.
                </td>
              </tr>
            )}

            {!isLoading && !isError && data?.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2.5 py-8 text-center text-[12px] text-text-muted">
                  No audit log entries match your filters.
                </td>
              </tr>
            )}

            {!isLoading && !isError && data?.data.map((entry) => (
              <tr key={entry.id} className="hover:bg-surface-3 transition-colors">
                <td className="px-2.5 py-2 text-[12px] font-mono text-text-secondary border-b border-border">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-2.5 py-2 text-[12px] text-text-secondary border-b border-border">
                  <div className="flex flex-col">
                    <span className="font-medium text-text-primary">
                      {entry.user.firstName} {entry.user.lastName}
                    </span>
                    <span className="text-[11px] text-text-muted">{entry.userRole}</span>
                  </div>
                </td>
                <td className="px-2.5 py-2 border-b border-border">
                  <Badge variant={ACTION_BADGE_VARIANT[entry.action] as any}>{entry.action}</Badge>
                </td>
                <td className="px-2.5 py-2 text-[12px] text-text-secondary border-b border-border">{entry.tableName}</td>
                <td className="px-2.5 py-2 text-[12px] font-mono text-text-secondary border-b border-border" title={entry.recordId}>
                  {entry.recordId?.slice(0, 8)}…
                </td>
                <td className="px-2.5 py-2 text-[12px] font-mono text-text-secondary border-b border-border">
                  {entry.patientId ? `${entry.patientId.slice(0, 8)}…` : '—'}
                </td>
                <td className="px-2.5 py-2 text-[12px] font-mono text-text-muted border-b border-border">
                  {entry.ipAddress ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-[11px] text-text-secondary">
          <span>
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} entries
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                'h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              Previous
            </button>
            <button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className={cn(
                'h-[28px] px-3 rounded-btn text-[11px] font-semibold bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Notes:
- Badge `variant` values map to the design-standard §6.3 palette: `saved` (green) = CREATE, `draft` (amber) = UPDATE, `critical` (red) = DELETE, `info` (blue) = VIEW, `published` (purple) = GENERATE — matches the "Action badge colors: green=CREATE, amber=UPDATE, red=DELETE, blue=VIEW, purple=GENERATE" requirement using the badge system that already exists rather than inventing new colors.
- Table markup follows §6.5 exactly (`text-[9px]` uppercase header, `hover:bg-surface-3` rows, `border-b border-border last:border-b-0`).
- Search input + Select filters follow the §14 filter bar spec (`h-8`, `bg-surface`, `border-border`, `rounded-btn`, `text-[11px]`).
- Date range uses shadcn `Popover` + `Calendar` per §9's "Date input" row, extended to a range via `mode="range"`.
- Pagination buttons reuse the Secondary button classes from §6.2.

### 6.5 `AdminTabsNav` update — `frontend/src/app/admin/layout.tsx`

Add `'audit-logs'` to the `activeTab` resolver:
```ts
const activeTab = pathname.includes('/admin/audit-logs')
  ? 'audit-logs'
  : pathname.includes('/admin/accounts/patients')
    ? 'patients'
    : pathname.includes('/admin/accounts')
      ? 'staff'
      : 'dashboard'; // adjust to match existing conditional exactly
```

Add a 4th button in the `flex gap-6` tab container, matching the existing tab button style (active indicator = same absolute bottom line with `bg-accent`):
```tsx
<button
  onClick={() => router.push('/admin/audit-logs')}
  className={cn(
    'relative pb-2 text-[13px] font-semibold transition-colors',
    activeTab === 'audit-logs' ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
  )}
>
  Audit Logs
  {activeTab === 'audit-logs' && (
    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-full" />
  )}
</button>
```

Gate visibility: only render this tab button when `user?.role === 'ADMIN'` (per design-standard §12, Audit Logs is Admin-only — the layout's existing auth guard already redirects non-admins away from `/admin/audit-logs`, but the tab itself should not appear for non-admins even transiently).

---

## 7. Verification Checklist

**Backend**
- [ ] `AuditLogsService.create()` never throws — uses try/catch + `console.error`.
- [ ] Interceptor's `resolveAudit()` returns `null` for all `GET` requests.
- [ ] `GET /audit-logs` returns 403 for DOCTOR and NURSE roles.
- [ ] `GET /audit-logs` returns 200 with paginated shape for ADMIN.
- [ ] All filter params work independently and in combination.
- [ ] `POST /patients` creates audit log: `action=CREATE`, `tableName=patients`, correct `recordId`.
- [ ] `PATCH /patients/:id` creates audit log: `action=UPDATE`.
- [ ] `DELETE /problems/:id` creates audit log: `action=DELETE`, `tableName=problems`.
- [ ] `POST /patients/:id/documents/generate` creates audit log: `action=GENERATE`, `tableName=documents`.
- [ ] `POST /accounts` creates audit log: `tableName=users`, `recordId=`new user's id.
- [ ] `patientId` populated on patient-scoped resource logs.
- [ ] No audit log written for `GET` requests.

**Frontend**
- [ ] `/admin/audit-logs` page loads for Admin users.
- [ ] "Audit Logs" tab renders only for Admin and highlights when on `/admin/audit-logs`.
- [ ] Search input, Action `Select`, and `DateRangePicker` all update filters and re-fetch (React Query key includes filters).
- [ ] Pagination Previous/Next buttons work and disable at bounds.
- [ ] Action badges render with the correct color per §6.3 mapping.
- [ ] Loading state renders `Skeleton` rows matching the table's column count.
- [ ] Empty state renders a friendly message when no logs match filters.
- [ ] Error state renders inline (no `alert()`, per §11).
- [ ] Page blocked (redirected) for DOCTOR/NURSE roles.
- [ ] `DateRangePicker` clears correctly via the "Clear" button and closes on "Apply".

---

## 8. File Map Summary

| File | Status | Action |
|---|---|---|
| `backend/prisma/schema.prisma` | EXISTS — `AuditLog` model complete | No changes |
| `backend/src/app.module.ts` | EXISTS — `AuditLogsModule` imported | No changes |
| `backend/src/main.ts` | EXISTS | Add `app.useGlobalInterceptors(...)` |
| `backend/src/audit-logs/audit-logs.module.ts` | EXISTS — empty scaffold | Replace with `@Global()` module |
| `backend/src/audit-logs/audit-logs.service.ts` | MISSING | Create |
| `backend/src/audit-logs/audit-logs.controller.ts` | MISSING | Create |
| `backend/src/audit-logs/dto/create-audit-log.dto.ts` | MISSING | Create |
| `backend/src/audit-logs/dto/query-audit-logs.dto.ts` | MISSING | Create |
| `backend/src/common/interceptors/audit-log.interceptor.ts` | MISSING | Create |
| `frontend/src/hooks/useAuditLogs.ts` | MISSING | Create |
| `frontend/src/components/ui/date-range-picker.tsx` | MISSING | Create |
| `frontend/src/app/admin/audit-logs/page.tsx` | MISSING | Create directory + file |
| `frontend/src/app/admin/layout.tsx` | EXISTS | Add 4th tab to `AdminTabsNav`, gate by role |

---

## 9. Suggested Execution Order

1. Create `backend/src/audit-logs/dto/create-audit-log.dto.ts`.
2. Create `backend/src/audit-logs/dto/query-audit-logs.dto.ts`.
3. Create `backend/src/audit-logs/audit-logs.service.ts`.
4. Create `backend/src/audit-logs/audit-logs.controller.ts`.
5. Update `backend/src/audit-logs/audit-logs.module.ts` (add `@Global`, controller, service, exports).
6. Create `backend/src/common/interceptors/audit-log.interceptor.ts`.
7. Update `backend/src/main.ts` to register the global interceptor.
8. Test backend: `POST /patients` via Swagger, check `audit_logs` table in Supabase Studio.
9. Confirm `Popover` and `Calendar` shadcn primitives exist; install via `npx shadcn@latest add popover calendar` if missing.
10. Create `frontend/src/components/ui/date-range-picker.tsx`.
11. Create `frontend/src/hooks/useAuditLogs.ts`.
12. Create `frontend/src/app/admin/audit-logs/page.tsx`.
13. Update `frontend/src/app/admin/layout.tsx` (`AdminTabsNav` — add Audit Logs tab, gated to `role === 'ADMIN'`).
14. Test frontend: log in as Admin, navigate to Audit Logs tab, verify entries, filters, date range, and pagination all work. Log in as Doctor/Nurse, confirm tab is hidden and route redirects.

---

*End of Phase 12 Implementation Guide — DAMAYAN EMR*