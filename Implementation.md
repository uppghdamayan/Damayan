# Audit Logs Table — Refresh Strategy

## Scope
This covers **frontend refresh behavior** for the Audit Logs table/view (Phase 12). Backend writes are a separate concern — see note at the bottom.

## Core Principle
Audit logs are historical, append-only records — not live/collaborative data. There's no need to treat them like a chat feed or a live dashboard. Refresh should be **triggered by user intent**, not by continuous polling.

## When to Refetch

| Trigger | Behavior | Why |
|---|---|---|
| Page mount / navigation | Fetch on load | Standard first-load |
| Filter change (date range, user, action type) | Refetch with new query key | Bulk of refetches — filters ARE the query |
| Pagination change | Refetch with new page param | Same as above |
| Manual "Refresh" button | Explicit refetch | Users check audit logs *because* something just happened — give them control to get current state |
| Window refocus | Keep TanStack Query default (`refetchOnWindowFocus: true`) | Low-cost, useful if clinician tabs away and back |
| Related mutation succeeds (e.g. note edit, attachment upload) | `invalidateQueries` on the audit log query key inside `onSuccess` | If the audit panel is open in a side panel/tab while the user performs an auditable action, the new entry should appear without a manual refresh |

## What to Avoid

- ❌ `refetchInterval` polling — no real-time benefit, just adds DB load
- ❌ Optimistic updates — audit rows are system-generated from the backend interceptor, not user-mutated client-side, so there's nothing to optimistically render
- ❌ Aggressive `staleTime: 0` — audit data doesn't change once written; a reasonable `staleTime` (e.g. 30s–1min) avoids redundant refetches on rapid filter toggling

## Example: TanStack Query Setup

```ts
// audit-logs query
const { data } = useQuery({
  queryKey: ['audit-logs', { userId, actionType, dateRange, page }],
  queryFn: () => fetchAuditLogs({ userId, actionType, dateRange, page }),
  staleTime: 30_000,
  refetchOnWindowFocus: true,
});

// invalidate from a related mutation (e.g. note edit)
const editNoteMutation = useMutation({
  mutationFn: updateNote,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
  },
});
```

## Note: Backend Write Timing (separate concern)
Audit record **writes** (the interceptor side) should always happen synchronously, inside the same transaction/request lifecycle as the action being audited — not deferred, queued, or batched — so there's no risk of an action succeeding without a corresponding audit entry. This doc only covers when the *frontend* re-reads that data, not when the backend writes it.