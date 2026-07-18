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
    }),
    {
      name: 'damayan-ui-sidebar',
      partialize: (state) => ({ 
        sidebarCollapsed: state.sidebarCollapsed,
        uiScale: state.uiScale 
      }),
    },
  ),
);
