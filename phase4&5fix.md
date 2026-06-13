# DAMAYAN EMR — Feature Implementation Specification

**Version 1.0 · Goals: Forced Password Change, Empty State Redesign, 3-Column Layout**
*Prepared for the DAMAYAN project · NestJS + Next.js 16 + Supabase + Prisma stack*

---

## Table of Contents

1. [Goal 1: Mandatory Password Change on Initial Login](#goal-1-mandatory-password-change-on-initial-login)
2. [Goal 2: Modern SaaS "No Patient Selected" Empty State](#goal-2-modern-saas-no-patient-selected-empty-state)
3. [Goal 3: Complete 3-Column Layout & Loading Optimization](#goal-3-complete-3-column-layout--loading-optimization)

---

## Goal 1: Mandatory Password Change on Initial Login

### Overview

When an admin creates a new account, a cryptographically random temporary password is generated and returned once. The user must change this password on their very first successful login. Until they do, their JWT is **restricted** — it authenticates them but authorizes nothing except the password-change endpoint.

---

### 1.1 Database Schema Changes

**File: `backend/prisma/schema.prisma`**

Add a single boolean column to the `User` model:

```
requiresPasswordChange  Boolean  @default(false) @map("requires_password_change")
```

Place this field after `isActive` in the field list. The column maps to snake_case in PostgreSQL. It defaults to `false` so that existing accounts (including the seeded Admin) are unaffected.

**Generate the migration:**

Run `prisma migrate dev --name add_requires_password_change` to produce the migration SQL. The migration file should contain a single `ALTER TABLE "users" ADD COLUMN "requires_password_change" BOOLEAN NOT NULL DEFAULT false;` statement. Do not modify the migration file manually.

---

### 1.2 Backend Architecture

#### 1.2.1 AccountsService — Set flag on account creation

**File: `backend/src/accounts/accounts.service.ts`**

In the `create()` method, after calling `supabase.auth.admin.createUser`, set `requiresPasswordChange: true` in the Prisma `user.create()` call:

```
await this.prisma.user.create({
  data: {
    id: data.user.id,
    email: dto.email,
    firstName: dto.firstName,
    lastName: dto.lastName,
    middleName: dto.middleName,
    role: dto.role,
    isActive: true,
    requiresPasswordChange: true,   // <-- add this line
  },
});
```

The `resetPassword()` method must also set `requiresPasswordChange: true` after calling `supabase.auth.admin.updateUserById`, using a Prisma `user.update()` call targeting the user's `id`.

#### 1.2.2 AuthService — Expose the flag on `getMe()`

**File: `backend/src/auth/auth.service.ts`**

In the `getMe()` method, add `requiresPasswordChange` to the returned object:

```
return {
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  middleName: user.middleName,
  extension: user.extension,
  role: user.role,
  isActive: user.isActive,
  requiresPasswordChange: user.requiresPasswordChange,   // <-- add this
};
```

This field travels in the `/auth/me` response that the frontend calls immediately after Supabase sign-in, making it the single source of truth for the frontend's routing decision.

#### 1.2.3 AuthService — Enforce flag in `changePassword()`

**File: `backend/src/auth/auth.service.ts`**

Extend the existing `changePassword()` method. After successfully calling `supabase.auth.admin.updateUserById`, add a Prisma `user.update()` call that sets `requiresPasswordChange: false` for `user.id`. This atomically clears the flag the moment the password is committed:

```
await this.prisma.user.update({
  where: { id: user.id },
  data: { requiresPasswordChange: false },
});
```

Return `{ message: 'Password updated successfully.', requiresPasswordChange: false }` so the frontend can immediately update local state without a round-trip to `/auth/me`.

#### 1.2.4 JwtAuthGuard — Block restricted users

**File: `backend/src/auth/guards/jwt-auth.guard.ts`**

After the existing `isActive` check, add a route-aware restriction. Read the current request URL and HTTP method. If `user.requiresPasswordChange` is `true` and the request is **not** `POST /auth/change-password`, throw a `ForbiddenException` with a clear message such as `"Password change required before accessing this resource."`.

Implementation pattern:

```
const path = request.path as string;
const method = request.method as string;

if (
  user.requiresPasswordChange &&
  !(method === 'POST' && path === '/auth/change-password')
) {
  throw new ForbiddenException(
    'Your account requires a password change before you can continue.'
  );
}
```

This means every existing route — patients, visits, notes, accounts — returns HTTP 403 for a restricted user. Only `POST /auth/change-password` passes through.

#### 1.2.5 ChangePasswordDto — Validate new password strength

**File: `backend/src/auth/dto/change-password.dto.ts`**

Add a `@Matches` validator that enforces at least one uppercase letter, one lowercase letter, one digit, and one special character. The `minLength` should remain at 12. Add a `@IsNotEmpty()` guard. This ensures the user cannot substitute one weak password for another.

#### 1.2.6 Swagger documentation

Add `@ApiResponse({ status: 403, description: 'Password change required.' })` to every controller route that is now blocked by the guard. This keeps the Swagger UI accurate.

---

### 1.3 Frontend Flow

#### 1.3.1 AuthStore — Add the flag to state

**File: `frontend/src/stores/authStore.ts`**

Add `requiresPasswordChange: boolean` to the `AuthUser` interface and to the `AuthState` interface. Add a setter `setRequiresPasswordChange: (v: boolean) => void` to the store. Initialize the field as `false`.

After the `/auth/me` fetch in the login flow (`frontend/src/app/login/page.tsx`), read `profile.requiresPasswordChange` and call `setRequiresPasswordChange(profile.requiresPasswordChange)` before the role-based redirect.

#### 1.3.2 Login page — Route to password change wall

**File: `frontend/src/app/login/page.tsx`**

Replace the role-based redirect block with a three-way branch:

```
if (profile.requiresPasswordChange) {
  router.replace('/change-password');
} else if (profile.role === 'ADMIN') {
  router.replace('/admin/accounts');
} else {
  router.replace('/dashboard');
}
```

The `/change-password` route is a standalone top-level page, not nested under `/dashboard` or `/admin`, so it inherits no layout that assumes a fully authenticated state.

#### 1.3.3 Create the password-change wall page

**File: `frontend/src/app/change-password/page.tsx`** (new file)

This is a `'use client'` page. It has no topbar, no sidebar — just a centered card. It must:

- Read `user` and `requiresPasswordChange` from `useAuthStore`.
- If `requiresPasswordChange` is `false`, redirect immediately to `/dashboard` (prevents direct URL access after the flag is cleared).
- Render a form with two fields: `newPassword` and `confirmPassword`.
- Validate that both fields match client-side before calling the API.
- Call `POST /auth/change-password` via `apiRequest`.
- On success, call `setRequiresPasswordChange(false)` on the store, then redirect to `/dashboard` or `/admin/accounts` based on role.
- Display the user's name and email at the top to confirm whose account is being updated.
- The card must explain clearly why this screen is appearing: *"Your account was provisioned with a temporary password. Set a permanent password to continue."*

#### 1.3.4 Middleware — Protect the route at the edge

**File: `frontend/src/proxy.ts`** (note: rename to `middleware.ts` — see note below)

> **Note:** This file is currently named `proxy.ts` but Supabase SSR and Next.js 16 expect the middleware to live at `src/middleware.ts`. Rename and adjust if needed.

Add a fourth case to the routing logic:

- If `session` exists and `pathname === '/change-password'` — allow the request to pass through (the page itself handles the redirect-if-not-required logic).
- Add `/change-password` to the `matcher` config array.
- If `session` does not exist and `pathname === '/change-password'`, redirect to `/login`.

The middleware cannot read the `requiresPasswordChange` DB flag (it only has the Supabase session). The page-level guard in `change-password/page.tsx` handles the case where an authenticated user without the flag tries to visit this URL.

#### 1.3.5 Dashboard and admin layouts — Add passive guard

**File: `frontend/src/app/dashboard/layout.tsx`**
**File: `frontend/src/app/admin/layout.tsx`**

In each layout's `useEffect`, add a check: if `user.requiresPasswordChange` is `true`, immediately call `router.replace('/change-password')`. This is a belt-and-suspenders guard against any future code path that bypasses the login page redirect.

---

### 1.4 UX Considerations

- The "Change Temporary Password" card should visually resemble the existing login card — same background (`#F0F2F5`), same card dimensions (`maxWidth: 400`), same IBM Plex Sans typography — so the branding is consistent even in this restricted state.
- Do not show a "forgot password" link or any other navigation on this page. The only exit is completing the form or signing out.
- Show a "Sign Out" button below the card so a user who accidentally lands here can escape.
- After the password is successfully changed, show a brief success message before redirecting (300ms is sufficient).

---

## Goal 2: Modern SaaS "No Patient Selected" Empty State

### Overview

The current empty state (`frontend/src/app/dashboard/page.tsx`) is a minimal centered message. This goal redesigns it into a purposeful, information-rich landing screen that helps users understand the product's value and guides them to their next action. The redesign must align exactly with the DAMAYAN design token system defined in `frontend/design-standard.md`.

---

### 2.1 File Scope

**Primary file: `frontend/src/app/dashboard/page.tsx`**

This is the page rendered when no `patientId` is in the URL. It currently outputs a single div with an emoji and two lines of text. The replacement is a full-height centered layout with structured content zones.

---

### 2.2 UI/UX Blueprint

#### 2.2.1 Layout Structure

The page is divided into two vertical zones separated by a faint horizontal rule at the midpoint:

**Zone A — Primary Action Area (upper half, centered)**

This is the main call-to-action. It contains:

- A large icon container: a rounded square (40×40px, `border-radius: 8px`) filled with `--accent-light`, containing a Lucide `UserSearch` icon in `--accent` color at 22px.
- A headline: "Select a patient to begin" — rendered at 20px, weight 700, `--text-primary`.
- A subline: "Search the sidebar or register a new patient to open their clinical record." — rendered at 13px, `--text-muted`, max-width 340px, centered.
- A primary CTA button: `+ New Patient` — using the exact same style as the sidebar's "New Patient" button (`background: --accent`, white text, `border-radius: 6px`, height 34px). This button calls `setNewPatientOpen(true)` from a local state. This duplicates the sidebar button for users who miss it. This button should only render if `user.role === 'DOCTOR' || user.role === 'ADMIN'`.

**Zone B — Feature Orientation Grid (lower half)**

Below the rule, a 3-column grid of "capability cards" helps new users understand what the system does. Each card contains:

- A Lucide icon (20px, `--accent` color) in a small icon container (32×32px, `--accent-light` background, `border-radius: 6px`).
- A card title at 12px, weight 600, `--text-primary`.
- A one-sentence description at 11px, `--text-muted`.

The three cards must be:

| Icon | Title | Description |
|---|---|---|
| `ClipboardList` (Lucide) | Problem-Oriented Notes | All clinical findings are organized by problem, not by date. |
| `Activity` (Lucide) | Cumulative Medication List | A single medication list carries forward across every visit automatically. |
| `FileText` (Lucide) | One-Click Documents | Generate prescriptions, lab requests, and charge slips from any visit. |

These cards are purely informational — no click behavior, no hover state. They are visual anchors that explain the product's value to new staff.

#### 2.2.2 Structural Dimensions

- The entire page fills 100% of the available viewport height minus the topbar (use `height: calc(100vh - 56px)` or flex with `flex: 1` from the parent).
- Zone A occupies the upper 50% (use `flex: 1` in a column flex layout, with `align-items: center` and `justify-content: center`).
- Zone B occupies roughly the lower 40%, padded `20px` from the bottom of the viewport.
- Total horizontal content width is capped at 600px, centered.

#### 2.2.3 The Separator Rule

Between Zone A and Zone B, render a full-width horizontal rule using a `div` with `height: 1px`, `background: --border`, `width: 100%`, `max-width: 600px`, `margin: 0 auto 24px`.

This rule is load-bearing — it signals that the orientation cards are supplementary context, not primary actions.

---

### 2.3 Design System Alignment

#### Color Tokens

Use exclusively the tokens defined in `design-standard.md § 2.1`. Never hardcode hex values.

| Element | Token |
|---|---|
| Page background | `--bg` (`#F0F2F5`) |
| Headline text | `--text-primary` (`#0D1117`) |
| Subline / descriptions | `--text-muted` (`#6B7280`) |
| Card titles | `--text-primary` |
| Icon container background | `--accent-light` (`#D4EDE9`) |
| Icon fill/stroke | `--accent` (`#0A6E5F`) |
| Capability card border | `--border` (`#D1D5E0`) |
| Capability card background | `--surface` (`#FFFFFF`) |
| CTA button | `--accent` background, white text, `--accent-hover` border |

#### Typography

All text must use `font-family: 'IBM Plex Sans', sans-serif`. Timestamps or IDs should use `'IBM Plex Mono', monospace`. The headline is the only element at 20px; everything else follows the type scale from `design-standard.md § 3.1`.

#### Spacing

Follow the 4px-multiple scale:
- Gap between icon and headline: 12px (`md`)
- Gap between headline and subline: 8px (`sm`)
- Gap between subline and CTA: 20px (`lg`)
- Gap between capability cards: 16px (`lg`)
- Card padding: `12px 14px` (`md` × 3)

#### Component Mapping (from `design-standard.md § 14`)

The capability cards map to the `.card` pattern:

- `background: --surface`, `border: 1px solid --border`, `border-radius: 8px`, `box-shadow: 0 4px 12px rgba(0,0,0,0.05)`.
- The card header strip (icon + title) maps to `.card-header`: `background: --surface-2`, `border-bottom: 1px solid --border`, `padding: 10px 14px`.
- The description text maps to `.card-body`: `padding: 12px 14px`.

Do not apply `.card.updated` or `.card.alert` variants — these are purely informational cards with no state.

#### Lucide vs Emoji

The current implementation uses emoji (👤). Replace all emoji with Lucide React icons. Lucide is already installed (`lucide-react@1.17.0` per `package.json`). Icon import pattern: `import { UserSearch, ClipboardList, Activity, FileText } from 'lucide-react'`.

Icons at 20–22px should have `strokeWidth={1.5}` for the clean, modern weight that aligns with the DAMAYAN aesthetic.

---

### 2.4 State Dependencies

This page must not import `usePatients` or trigger any API call. It is a static UI shell. It does need:

- `useAuthStore()` to read `user.role` (to conditionally show the "+ New Patient" CTA).
- A local `useState` for `newPatientOpen` to control the `NewPatientModal`.
- `NewPatientModal` imported from `@/components/patients/NewPatientModal`.

After successful patient creation in the modal, call `router.push('/dashboard/' + patient.id)` to immediately navigate to the new patient's workspace.

---

## Goal 3: Complete 3-Column Layout & Loading Optimization

### Overview

The wireframe (`wireframe3.html`) defines a precise 3-zone layout: Left Sidebar (280px, collapsible), Middle Column (flexible, scrollable), and Right Documentation Panel (420px, collapsible and resizable). The current `dashboard/layout.tsx` implements only the topbar and sidebar; the documentation panel is absent. This goal fully assembles the layout and adds a performant loading strategy.

---

### 3.1 Component Hierarchy

#### 3.1.1 The Shell

The dashboard layout is the outermost shell. It must:

- Be the only place that renders `<Topbar />` and `<Sidebar />`.
- Occupy 100% of the viewport height with no overflow at the shell level.
- Hold the horizontal flex row that contains the sidebar, middle column, and documentation panel.

**File: `frontend/src/app/dashboard/layout.tsx`**

The layout's JSX structure must follow this hierarchy exactly:

```
<div id="shell"> <!-- full-height column flex, font-family: IBM Plex Sans -->
  <Topbar />
  <div id="body"> <!-- flex: 1, overflow: hidden, height: calc(100vh - 56px) -->
    <Sidebar />                          <!-- fixed 280px or 0px, flex-shrink: 0 -->
    <div id="middle-column">            <!-- flex: 1, flex-direction: column, overflow: hidden -->
      {children}                        <!-- PatientWorkspaceLayout or DashboardIndexPage -->
    </div>
    <DocumentationPanel />             <!-- fixed 420px or 0px, flex-shrink: 0 -->
  </div>
</div>
```

The `DocumentationPanel` is a new component that must be created. It is separate from the page content.

#### 3.1.2 DocumentationPanel Component

**New file: `frontend/src/components/layout/DocumentationPanel.tsx`**

This is a `'use client'` component. It renders the right panel that `wireframe3.html` calls `#documentation-panel`.

**State:**
- It reads `documentationPanelOpen` from `useUiStore()`.
- If `documentationPanelOpen` is `false`, it renders as `width: 0, overflow: hidden, border-left-color: transparent`.
- It has a drag-to-resize handle on its left edge (a 5px-wide `div` with `cursor: ew-resize`).

**Internal structure:**
- A sticky header bar with title "Progress Note", autosave indicator, status badge, and Save/Finalize buttons.
- A scrollable body area that renders the Patient Context block (problems, meds, latest vitals, allergies) from `usePatientStore()`.
- The note-writing workspace (Subjective, Objective, Labs, Problem List, Diagnostics, Medications) is Phase 6–9 work and should render as a placeholder `<div>` with a "Progress note workspace — Phase 6" message for now.

**Resize logic:**
- On `mousedown` of the resize handle, set an `isResizing` flag in local state.
- On `document.mousemove`, calculate `newWidth = window.innerWidth - e.clientX` and clamp between 300px and 60% of viewport width.
- Update a CSS custom property `--documentation-panel-width` on the document root using `document.documentElement.style.setProperty`.
- On `mouseup`, clear the flag.
- The panel's width style must reference this CSS variable: `width: var(--documentation-panel-width, 420px)`.

**Design tokens:**
- Header background: `--accent-light`
- Header border: `1px solid --accent-mid`
- Header title: 13px, weight 700, `--accent-hover`
- Body background: `--surface-2`
- Resize handle: 5px wide, `background: transparent`, hover state turns it `--accent`

#### 3.1.3 PatientWorkspaceLayout (already exists, minor edits)

**File: `frontend/src/app/dashboard/[patientId]/layout.tsx`**

This layout renders inside the middle column. It currently wraps `<ScreenNav />` and the page content in a column flex. This structure is correct and requires only one change: remove the explicit `height: 100%` and replace with `flex: 1; overflow: hidden` so it fills the available middle-column space correctly inside the new 3-column shell.

The `padding: '16px 20px'` on the content area div is correct per design-standard.md.

#### 3.1.4 Sidebar (minor edits)

**File: `frontend/src/components/layout/Sidebar.tsx`**

The sidebar currently returns `null` when collapsed. Change this to render the sidebar element with `width: 0; overflow: hidden; border-right-color: transparent` instead of not rendering at all. This prevents layout shift on toggle, as the DOM element persists and CSS handles the collapse smoothly.

Add a CSS transition: `transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1)` to the aside element's style. This matches `wireframe3.html`'s `.collapsed` behavior.

#### 3.1.5 Topbar — Wire up documentation panel toggle

**File: `frontend/src/components/layout/Topbar.tsx`**

Add a button between the `+ New Note` button and the user avatar that toggles the documentation panel:

- Icon: a Lucide `PanelRightOpen` icon (active) or `PanelRightClose` (when panel is open), 16px, `strokeWidth={1.5}`.
- Reads `documentationPanelOpen` from `useUiStore()` and calls `setDocumentationPanelOpen(!documentationPanelOpen)` on click.
- Styled as a ghost `tb-btn`: `height: 34px`, `background: --surface-2`, transparent border, hover changes to `--surface-3`.

---

### 3.2 Suspense Boundaries

#### Philosophy

Place Suspense boundaries at the level of data-dependent components, not at the page level. This ensures the chrome (topbar, sidebar, screen nav) renders immediately while data zones load independently.

#### 3.2.1 PatientDashboardPage

**File: `frontend/src/app/dashboard/[patientId]/page.tsx`**

Wrap each major section independently so a slow vitals response doesn't block the patient banner:

```
Suspense 1: <PatientBanner />        — wraps usePatient(patientId)
Suspense 2: <VitalsStrip />          — wraps useVitals(patientId)  [Phase 10]
Suspense 3: grid of Problem + Meds   — wraps useProblems + useMedications [Phase 8-9]
Suspense 4: <VisitHistoryCard />     — wraps useVisits(patientId)
```

The `PatientBanner` should load first because it uses a cached query (`['patient', id]`) that the sidebar likely already populated. Subsequent sections cascade below it visually as their data arrives.

#### 3.2.2 Sidebar Patient List

**File: `frontend/src/components/layout/Sidebar.tsx`**

Wrap the patient list rendering block in a `<Suspense fallback={<SidebarSkeleton />}>`. The sidebar is always visible; a skeleton prevents a blank white column during first load.

#### 3.2.3 Screen Nav

The `<ScreenNav />` does not fetch data — it only reads the current URL and `useAuthStore`. No Suspense boundary is needed here.

---

### 3.3 Skeleton Loaders

#### 3.3.1 Create the base Skeleton primitive

**New file: `frontend/src/components/ui/skeleton.tsx`**

The skeleton is a `div` with:

- `background: --surface-3` (`#EFF1F5`)
- `border-radius` matching the element it represents (6px for inputs/text, 8px for cards, 50% for avatars)
- A CSS keyframe animation named `shimmer` that transitions `background-position` from `-200%` to `200%` on a linear 1.5s infinite cycle, using a gradient of `--surface-3 → --surface-2 → --surface-3`.
- Props: `width`, `height`, `borderRadius`, `className`.

#### 3.3.2 PatientBanner Skeleton

**New file: `frontend/src/components/patients/PatientBannerSkeleton.tsx`**

Mirrors the geometry of `PatientBanner`:
- An outer div: `background: --surface`, `border: 1px solid --border`, `border-radius: 8px`, `padding: 16px`, flex row with `gap: 16px`.
- Left: a 48×48px circle skeleton (the avatar).
- Right: a column of three skeleton bars — 200px wide × 20px tall (name), 300px × 13px (demographics), 160px × 13px (address) — with 8px gaps between them.

#### 3.3.3 VitalsStrip Skeleton

**New file: `frontend/src/components/vitals/VitalsStripSkeleton.tsx`**

A 5-column grid matching `VitalsStripEmpty`. Each cell is a card skeleton:
- Outer card: `background: --surface-2`, `border: 1px solid --border`, `border-radius: 8px`, `padding: 10px 12px`.
- Inside each: a short skeleton bar (label-sized, ~60px wide × 9px tall), then a large skeleton bar (value-sized, ~70px wide × 18px tall), then a small bar (unit, ~40px × 10px).

#### 3.3.4 Sidebar Patient List Skeleton

**New file: `frontend/src/components/layout/SidebarSkeleton.tsx`**

Five patient row skeletons stacked vertically. Each row mirrors the real patient row geometry:
- 32×32px circle skeleton (avatar), flex 1 column with a 100px × 12px bar (name) and 120px × 11px bar (meta), gap 4px.
- `padding: 7px 12px`.
- Rows separated by no border (match the real list's style).

#### 3.3.5 VisitHistoryCard Skeleton

Render inside `VisitHistoryCard.tsx` when `isLoading` is true. Show three visit row skeletons. Each row:
- 90px × 12px bar (date), then a flex-1 column with 180px × 12px (type + physician) and 240px × 11px (preview).
- `padding: 10px 14px`, `border-bottom: 1px solid --border`.

---

### 3.4 Data Fetching Optimization

#### 3.4.1 Prefetch patient on sidebar hover

**File: `frontend/src/components/layout/Sidebar.tsx`**

On `onMouseEnter` of each patient row button, call `queryClient.prefetchQuery` with `queryKey: ['patient', p.id]` and `queryFn: () => apiRequest('/patients/' + p.id)`. This fires a background fetch 200–300ms before the user clicks, so when they navigate to `/dashboard/[patientId]`, the `PatientBanner` renders immediately from cache.

Implementation:
- Import `useQueryClient` from `@tanstack/react-query`.
- Call `const qc = useQueryClient()` at the top of the Sidebar component.
- In the button's `onMouseEnter`, call `qc.prefetchQuery({ queryKey: ['patient', p.id], queryFn: () => apiRequest('/patients/' + p.id), staleTime: 30000 })`.

#### 3.4.2 usePatients — Caching strategy

**File: `frontend/src/hooks/usePatients.ts`**

- `staleTime: 30_000` (30 seconds) — correct as currently set.
- Add `gcTime: 5 * 60 * 1000` (5 minutes) to retain data in memory after navigating away. This prevents a full refetch when the user returns to the dashboard.
- Add `placeholderData: keepPreviousData` (imported from `@tanstack/react-query`) to the `usePatients` query. This prevents the sidebar list from blanking when the search query changes — the previous results stay visible while new results load.

#### 3.4.3 usePatient (single patient) — Populate from list cache

**File: `frontend/src/hooks/usePatients.ts`**

In `usePatient(id)`, add an `initialData` option that attempts to find the patient in the list cache before fetching:

```typescript
initialData: () => {
  // Walk all cached pages of patient lists
  const listData = qc.getQueriesData<PatientsResponse>({ queryKey: ['patients'] });
  for (const [, data] of listData) {
    const found = data?.data.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
},
initialDataUpdatedAt: () => {
  const state = qc.getQueryState(['patients', '', 1, 200]);
  return state?.dataUpdatedAt;
},
```

This means the first render of `PatientBanner` uses sidebar-cached data (stale: acceptable for the banner). A background refetch still runs to get the full patient object (which includes `_count` and `allergies`).

#### 3.4.4 useVisits — Caching strategy

**File: `frontend/src/hooks/useVisits.ts`**

- `staleTime: 30_000` — correct as currently set.
- Add `gcTime: 3 * 60 * 1000` (3 minutes).
- The `enabled: !!patientId` guard is correct.
- When the expanded state changes (5 visits → 20 visits), the query key changes (`limit: 5` vs `limit: 20`). Add `placeholderData: keepPreviousData` to prevent the "Loading visit history…" flash when expanding — the 5-item list remains visible while the 20-item fetch completes.

#### 3.4.5 QueryClient configuration

**File: `frontend/src/components/providers/QueryProvider.tsx`**

Update the default options to align with the caching strategy above:

```typescript
defaultOptions: {
  queries: {
    staleTime: 20_000,      // 20 seconds globally
    gcTime: 5 * 60_000,     // 5 minutes globally
    retry: 1,
    refetchOnWindowFocus: false,   // Add this: avoid surprise refetches in a clinical app
  },
},
```

The `refetchOnWindowFocus: false` is especially important in a clinical context — a doctor switching windows should not trigger data re-renders mid-note.

---

### 3.5 Layout Shift Elimination Checklist

The following must all be true before the layout is considered complete:

- The sidebar never unmounts — it collapses to `width: 0` via CSS only.
- The documentation panel never unmounts — same pattern.
- The middle column always fills exactly the remaining space with `flex: 1; overflow: hidden`.
- Patient banner height is fixed at approximately 90px (includes padding). The skeleton must be the same height.
- Vitals strip height is fixed at approximately 120px (5 cards at `padding: 9px 11px`, value at 18px). The skeleton must be the same height.
- The ScreenNav is always 52px tall. It must never reflow.
- `usePatient` returns `initialData` from the list cache, so `PatientBanner` renders on the first paint without a loading state in the common path.
- No `<img>` tags exist without `width` and `height` attributes (no images are currently used in the main layout, but this is a guard for Phase 11+).

---

### 3.6 UiStore — Ensure persistsence of sidebar state

**File: `frontend/src/stores/uiStore.ts`**

Per `design-standard.md § 4.3`, the sidebar collapse state must persist in `localStorage`. Upgrade the store to use `zustand/middleware`'s `persist` middleware:

- Persist only `sidebarCollapsed` (not `documentationPanelOpen` or `activeScreen`).
- Storage key: `damayan-ui-sidebar`.
- On first visit (no stored value), default to `false` on viewports ≥ 1440px and `true` on viewports 1280–1439px. Detect viewport width using `typeof window !== 'undefined' && window.innerWidth < 1440` at store initialization.

---

## Cross-Cutting Implementation Notes

### File Creation Summary

The following files must be **created** (do not exist yet):

| Path | Purpose |
|---|---|
| `frontend/src/app/change-password/page.tsx` | Password change wall |
| `frontend/src/components/layout/DocumentationPanel.tsx` | Right panel component |
| `frontend/src/components/ui/skeleton.tsx` | Base skeleton primitive |
| `frontend/src/components/patients/PatientBannerSkeleton.tsx` | Banner loading state |
| `frontend/src/components/vitals/VitalsStripSkeleton.tsx` | Vitals loading state |
| `frontend/src/components/layout/SidebarSkeleton.tsx` | Sidebar loading state |

The following files must be **modified**:

| Path | Change Summary |
|---|---|
| `backend/prisma/schema.prisma` | Add `requiresPasswordChange` field |
| `backend/src/accounts/accounts.service.ts` | Set flag on create and reset |
| `backend/src/auth/auth.service.ts` | Expose and clear flag |
| `backend/src/auth/guards/jwt-auth.guard.ts` | Block restricted users |
| `backend/src/auth/dto/change-password.dto.ts` | Add password strength validation |
| `frontend/src/stores/authStore.ts` | Add `requiresPasswordChange` field and setter |
| `frontend/src/stores/uiStore.ts` | Add localStorage persistence |
| `frontend/src/app/login/page.tsx` | Route to `/change-password` when required |
| `frontend/src/app/dashboard/layout.tsx` | Add DocumentationPanel, fix sidebar collapse |
| `frontend/src/app/dashboard/page.tsx` | Full empty state redesign |
| `frontend/src/app/dashboard/[patientId]/layout.tsx` | Fix flex sizing |
| `frontend/src/app/dashboard/[patientId]/page.tsx` | Add Suspense boundaries |
| `frontend/src/app/admin/layout.tsx` | Add passive password-change guard |
| `frontend/src/components/layout/Topbar.tsx` | Add panel toggle button |
| `frontend/src/components/layout/Sidebar.tsx` | CSS-only collapse, prefetch on hover |
| `frontend/src/components/providers/QueryProvider.tsx` | Update default query options |
| `frontend/src/hooks/usePatients.ts` | Add initialData, gcTime, placeholderData |
| `frontend/src/hooks/useVisits.ts` | Add gcTime, placeholderData |
| `frontend/src/proxy.ts` | Add change-password to matcher |

### Migration Sequence

Execute backend changes in this exact order to avoid runtime errors:

1. Update `schema.prisma`.
2. Run `prisma migrate dev`.
3. Update `accounts.service.ts` (uses the new Prisma field).
4. Update `auth.service.ts`.
5. Update `jwt-auth.guard.ts`.
6. Restart the NestJS dev server.
7. Test: create an account, log in, verify HTTP 403 on GET /patients, verify POST /auth/change-password clears the flag.

Execute frontend changes in this order:

1. Update `authStore.ts` (add the field — later code depends on it).
2. Update `uiStore.ts` (add persistence).
3. Create `change-password/page.tsx`.
4. Update `login/page.tsx` (add the redirect branch).
5. Update `proxy.ts` (add the route to matcher).
6. Create skeleton components.
7. Create `DocumentationPanel.tsx`.
8. Update `dashboard/layout.tsx`.
9. Update `dashboard/page.tsx` (empty state).
10. Update `dashboard/[patientId]/page.tsx` (Suspense).
11. Update hooks.
12. Update `QueryProvider.tsx`.

---

*End of DAMAYAN Feature Implementation Specification v1.0*