import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  documentationPanelOpen: boolean;
  activeScreen: ActiveScreen;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setDocumentationPanelOpen: (v: boolean) => void;
  setActiveScreen: (s: ActiveScreen) => void;
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

// Viewport-aware default: collapse on screens < 1440px
const getDefaultSidebarCollapsed = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1440;
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: getDefaultSidebarCollapsed(),
      documentationPanelOpen: false,
      activeScreen: 'dashboard',
      activeNoteEditor: { patientId: null, noteId: null, mode: null },
      uiScale: UI_SCALE_DEFAULT,
      increaseUiScale: () => set((state) => {
        const nextScale = Math.min(UI_SCALE_MAX, state.uiScale + UI_SCALE_STEP);
        const isSmallScreen = typeof window !== 'undefined' && (window.innerWidth / (nextScale / 100)) <= 1100;
        return {
          uiScale: nextScale,
          sidebarCollapsed: isSmallScreen && state.documentationPanelOpen ? true : state.sidebarCollapsed
        };
      }),
      decreaseUiScale: () => set((state) => {
        const nextScale = Math.max(UI_SCALE_MIN, state.uiScale - UI_SCALE_STEP);
        const isSmallScreen = typeof window !== 'undefined' && (window.innerWidth / (nextScale / 100)) <= 1100;
        return {
          uiScale: nextScale,
          sidebarCollapsed: isSmallScreen && state.documentationPanelOpen ? true : state.sidebarCollapsed
        };
      }),
      resetUiScale: () => set((state) => {
        const isSmallScreen = typeof window !== 'undefined' && (window.innerWidth / (UI_SCALE_DEFAULT / 100)) <= 1100;
        return {
          uiScale: UI_SCALE_DEFAULT,
          sidebarCollapsed: isSmallScreen && state.documentationPanelOpen ? true : state.sidebarCollapsed
        };
      }),
      setSidebarCollapsed: (v) => set((state) => {
        const isSmallScreen = typeof window !== 'undefined' && (window.innerWidth / (state.uiScale / 100)) <= 1100;
        return {
          sidebarCollapsed: v,
          documentationPanelOpen: isSmallScreen && !v ? false : state.documentationPanelOpen,
        };
      }),
      toggleSidebar: () => set((state) => {
        const isSmallScreen = typeof window !== 'undefined' && (window.innerWidth / (state.uiScale / 100)) <= 1100;
        const newCollapsed = !state.sidebarCollapsed;
        return {
          sidebarCollapsed: newCollapsed,
          documentationPanelOpen: isSmallScreen && !newCollapsed ? false : state.documentationPanelOpen,
        };
      }),
      setDocumentationPanelOpen: (v) => set((state) => {
        const isSmallScreen = typeof window !== 'undefined' && (window.innerWidth / (state.uiScale / 100)) <= 1100;
        return {
          documentationPanelOpen: v,
          sidebarCollapsed: isSmallScreen && v ? true : state.sidebarCollapsed,
        };
      }),
      setActiveScreen: (s) => set({ activeScreen: s }),
      openNewProgressNote: (patientId) => set((state) => {
        const isSmallScreen = typeof window !== 'undefined' && (window.innerWidth / (state.uiScale / 100)) <= 1100;
        return {
          activeNoteEditor: { patientId, noteId: null, mode: 'new' },
          documentationPanelOpen: true,
          sidebarCollapsed: isSmallScreen ? true : state.sidebarCollapsed,
        };
      }),
      openExistingProgressNote: (patientId, noteId) => set((state) => {
        const isSmallScreen = typeof window !== 'undefined' && (window.innerWidth / (state.uiScale / 100)) <= 1100;
        return {
          activeNoteEditor: { patientId, noteId, mode: 'edit' },
          documentationPanelOpen: true,
          sidebarCollapsed: isSmallScreen ? true : state.sidebarCollapsed,
        };
      }),
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
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        uiScale: state.uiScale,
        problemEditLock: state.problemEditLock,
        medicationEditLock: state.medicationEditLock,
      }),
    },
  ),
);
