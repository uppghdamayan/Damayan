import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

// Viewport-aware default: collapse on screens < 1440px
const getDefaultSidebarCollapsed = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1440;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: getDefaultSidebarCollapsed(),
      documentationPanelOpen: false,
      activeScreen: 'dashboard',
      activeNoteEditor: { patientId: null, noteId: null, mode: null },
      setSidebarCollapsed: (v) => set((state) => {
        const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1280;
        return {
          sidebarCollapsed: v,
          documentationPanelOpen: isMobileOrTablet && !v ? false : state.documentationPanelOpen,
        };
      }),
      toggleSidebar: () => set((state) => {
        const nextCollapsed = !state.sidebarCollapsed;
        const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1280;
        return {
          sidebarCollapsed: nextCollapsed,
          documentationPanelOpen: isMobileOrTablet && !nextCollapsed ? false : state.documentationPanelOpen,
        };
      }),
      setDocumentationPanelOpen: (v) => set((state) => {
        const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1280;
        return {
          documentationPanelOpen: v,
          sidebarCollapsed: isMobileOrTablet && v ? true : state.sidebarCollapsed,
        };
      }),
      setActiveScreen: (s) => set({ activeScreen: s }),
      openNewProgressNote: (patientId) => set((state) => {
        const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1280;
        return {
          activeNoteEditor: { patientId, noteId: null, mode: 'new' },
          documentationPanelOpen: true,
          sidebarCollapsed: isMobileOrTablet ? true : state.sidebarCollapsed,
        };
      }),
      openExistingProgressNote: (patientId, noteId) => set((state) => {
        const isMobileOrTablet = typeof window !== 'undefined' && window.innerWidth < 1280;
        return {
          activeNoteEditor: { patientId, noteId, mode: 'edit' },
          documentationPanelOpen: true,
          sidebarCollapsed: isMobileOrTablet ? true : state.sidebarCollapsed,
        };
      }),
      closeNoteEditor: () => set({
        activeNoteEditor: { patientId: null, noteId: null, mode: null },
      }),
    }),
    {
      name: 'damayan-ui-sidebar',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
