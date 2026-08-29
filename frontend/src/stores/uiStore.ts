import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { progressDraftKey } from '@/lib/note-drafts';
import { BP } from '@/lib/breakpoints';

const UI_SCALE_MIN = 80;
const UI_SCALE_MAX = 150;
const UI_SCALE_STEP = 10;
const UI_SCALE_DEFAULT = 100;

type ActiveScreen =
  | 'dashboard'
  | 'vitals'
  | 'note-timeline'
  | 'initial-note'
  | 'problems'
  | 'medications'
  | 'documents'
  | 'logs';

interface ActiveNoteEditorState {
  patientId: string | null;
  noteId: string | null;       // null = new note, set = editing existing draft
  mode: 'new' | 'edit' | null; // null = panel idle / nothing being edited
}

type ProblemEditOwner = 'master' | 'note';

// Mutual-exclusion lock between the Master Problem List and a Progress
// Note's in-note Assessment editor — only one may be in draft-edit mode at a
// time, so a publish from one side never clobbers unpublished edits from the
// other. Persisted (see partialize below) so a restored draft after reload
// keeps the other side locked; scoped per-patient so switching patients
// doesn't leave a stale lock behind.
interface ProblemEditLock {
  patientId: string;
  owner: ProblemEditOwner;
  noteId?: string;
  acquiredAt: string;
}

// Same mutual-exclusion lock, mirrored for the Master Medications List vs. a
// Progress Note's in-note "Current Medication List" editor — kept as its own
// independent lock (not shared with ProblemEditLock) since a doctor editing
// medications shouldn't be blocked by an unrelated problem-list edit, and
// vice versa.
type MedicationEditOwner = 'master' | 'note';

interface MedicationEditLock {
  patientId: string;
  owner: MedicationEditOwner;
  noteId?: string;
  acquiredAt: string;
}

interface UiState {
  sidebarCollapsed: boolean;
  // True once the user has collapsed/expanded the sidebar themselves. Until
  // then AppWidthEffect may pick a width-appropriate default for them.
  sidebarUserSet: boolean;
  documentationPanelOpen: boolean;
  activeScreen: ActiveScreen;
  // Measured width of #app-root, fed by AppWidthEffect. 0 = not measured yet.
  // This is the only width the store branches on, and deliberately not
  // window.innerWidth: it is the same box the `@container app` rules in
  // globals.css measure, so the JS branches and the CSS branches stay in
  // agreement even under the zoom-based UI scale.
  appWidth: number;
  setAppWidth: (width: number) => void;
  setSidebarCollapsed: (v: boolean, opts?: { userInitiated?: boolean }) => void;
  toggleSidebar: () => void;
  setDocumentationPanelOpen: (v: boolean) => void;
  setActiveScreen: (s: ActiveScreen) => void;
  // Last user-dragged panel widths, in px. null = never resized, so the
  // breakpoint tier's default applies. Persisted so a resize survives reload.
  sidebarWidthPx: number | null;
  docPanelWidthPx: number | null;
  setSidebarWidthPx: (px: number | null) => void;
  setDocPanelWidthPx: (px: number | null) => void;
  activeNoteEditor: ActiveNoteEditorState;
  openNewProgressNote: (patientId: string) => void;
  openExistingProgressNote: (patientId: string, noteId: string) => void;
  closeNoteEditor: () => void;
  uiScale: number;
  increaseUiScale: () => void;
  decreaseUiScale: () => void;
  resetUiScale: () => void;
  onPublishAndSwitch: (() => Promise<boolean>) | null;
  registerPublishHandler: (handler: (() => Promise<boolean>) | null) => void;
  problemEditLock: ProblemEditLock | null;
  // Returns false (without acquiring) if the lock is already held by the
  // *other* owner for this patient. Re-acquiring as the same owner (e.g. a
  // restored draft) always succeeds and refreshes acquiredAt.
  acquireProblemEditLock: (patientId: string, owner: ProblemEditOwner, noteId?: string) => boolean;
  // No-ops if the lock isn't currently held by `owner` — a stale release
  // (e.g. from an unmounting component that never actually held it) must
  // never clear the other side's active lock.
  releaseProblemEditLock: (owner: ProblemEditOwner) => void;
  medicationEditLock: MedicationEditLock | null;
  acquireMedicationEditLock: (patientId: string, owner: MedicationEditOwner, noteId?: string) => boolean;
  releaseMedicationEditLock: (owner: MedicationEditOwner) => void;
}

// Below this width there is not room for the patient sidebar and the
// documentation panel side by side, so opening one closes the other. appWidth
// is 0 until the first measurement lands — treat that as "unknown" and never
// force a panel closed on a guess.
const isCompact = (appWidth: number) => appWidth > 0 && appWidth <= BP.compact;

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      // Deterministic on the server and on the first client render. The
      // width-appropriate default is applied by AppWidthEffect once #app-root
      // has actually been measured, so there is no hydration mismatch left to
      // suppress.
      sidebarCollapsed: false,
      sidebarUserSet: false,
      documentationPanelOpen: false,
      activeScreen: 'dashboard',
      activeNoteEditor: { patientId: null, noteId: null, mode: null },
      appWidth: 0,
      sidebarWidthPx: null,
      docPanelWidthPx: null,
      uiScale: UI_SCALE_DEFAULT,
      setAppWidth: (width) => set((state) => {
        if (width <= 0 || width === state.appWidth) return { appWidth: state.appWidth };
        // Shrinking past the compact threshold with both panels open has to
        // resolve to one of them. Keep the note panel — it can be holding
        // unsaved clinical text — and collapse the patient list, which can't.
        if (isCompact(width) && state.documentationPanelOpen && !state.sidebarCollapsed) {
          return { appWidth: width, sidebarCollapsed: true };
        }
        return { appWidth: width };
      }),
      setSidebarWidthPx: (px) => set({ sidebarWidthPx: px }),
      setDocPanelWidthPx: (px) => set({ docPanelWidthPx: px }),
      // The scale actions no longer repeat the exclusion check. Changing the
      // scale changes the measured width of #app-root, which routes back
      // through setAppWidth above — one code path instead of four.
      increaseUiScale: () => set((state) => ({
        uiScale: Math.min(UI_SCALE_MAX, state.uiScale + UI_SCALE_STEP),
      })),
      decreaseUiScale: () => set((state) => ({
        uiScale: Math.max(UI_SCALE_MIN, state.uiScale - UI_SCALE_STEP),
      })),
      resetUiScale: () => set({ uiScale: UI_SCALE_DEFAULT }),
      setSidebarCollapsed: (v, opts) => set((state) => ({
        sidebarCollapsed: v,
        sidebarUserSet: state.sidebarUserSet || opts?.userInitiated !== false,
        documentationPanelOpen: isCompact(state.appWidth) && !v ? false : state.documentationPanelOpen,
      })),
      toggleSidebar: () => set((state) => {
        const newCollapsed = !state.sidebarCollapsed;
        return {
          sidebarCollapsed: newCollapsed,
          sidebarUserSet: true,
          documentationPanelOpen: isCompact(state.appWidth) && !newCollapsed ? false : state.documentationPanelOpen,
        };
      }),
      setDocumentationPanelOpen: (v) => set((state) => ({
        documentationPanelOpen: v,
        sidebarCollapsed: isCompact(state.appWidth) && v ? true : state.sidebarCollapsed,
      })),
      setActiveScreen: (s) => set({ activeScreen: s }),
      openNewProgressNote: (patientId) => set((state) => {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(progressDraftKey(patientId, null));
        }
        return {
          activeNoteEditor: { patientId, noteId: null, mode: 'new' as const },
          documentationPanelOpen: true,
          sidebarCollapsed: isCompact(state.appWidth) ? true : state.sidebarCollapsed,
        };
      }),
      openExistingProgressNote: (patientId, noteId) => set((state) => ({
        activeNoteEditor: { patientId, noteId, mode: 'edit' as const },
        documentationPanelOpen: true,
        sidebarCollapsed: isCompact(state.appWidth) ? true : state.sidebarCollapsed,
      })),
      closeNoteEditor: () => set({
        activeNoteEditor: { patientId: null, noteId: null, mode: null },
      }),
      onPublishAndSwitch: null,
      registerPublishHandler: (handler) => set({ onPublishAndSwitch: handler }),
      problemEditLock: null,
      acquireProblemEditLock: (patientId, owner, noteId) => {
        const current = get().problemEditLock;
        // A lock for a different patient is stale/irrelevant here — the
        // caller only cares about contention on its own patient.
        if (current && current.patientId === patientId && current.owner !== owner) {
          return false;
        }
        set({
          problemEditLock: { patientId, owner, noteId, acquiredAt: new Date().toISOString() },
        });
        return true;
      },
      releaseProblemEditLock: (owner) => set((state) => {
        if (state.problemEditLock?.owner !== owner) return {};
        return { problemEditLock: null };
      }),
      medicationEditLock: null,
      acquireMedicationEditLock: (patientId, owner, noteId) => {
        const current = get().medicationEditLock;
        if (current && current.patientId === patientId && current.owner !== owner) {
          return false;
        }
        set({
          medicationEditLock: { patientId, owner, noteId, acquiredAt: new Date().toISOString() },
        });
        return true;
      },
      releaseMedicationEditLock: (owner) => set((state) => {
        if (state.medicationEditLock?.owner !== owner) return {};
        return { medicationEditLock: null };
      }),
    }),
    {
      name: 'damayan-ui-sidebar',
      // appWidth is deliberately absent — it is a live measurement, and a
      // persisted stale value would make the first render branch on the
      // previous session's window size.
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarUserSet: state.sidebarUserSet,
        sidebarWidthPx: state.sidebarWidthPx,
        docPanelWidthPx: state.docPanelWidthPx,
        uiScale: state.uiScale,
        problemEditLock: state.problemEditLock,
        medicationEditLock: state.medicationEditLock,
      }),
    },
  ),
);
