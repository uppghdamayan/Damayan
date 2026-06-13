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

interface UiState {
  sidebarCollapsed: boolean;
  documentationPanelOpen: boolean;
  activeScreen: ActiveScreen;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setDocumentationPanelOpen: (v: boolean) => void;
  setActiveScreen: (s: ActiveScreen) => void;
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
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDocumentationPanelOpen: (v) => set({ documentationPanelOpen: v }),
      setActiveScreen: (s) => set({ activeScreen: s }),
    }),
    {
      name: 'damayan-ui-sidebar',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
