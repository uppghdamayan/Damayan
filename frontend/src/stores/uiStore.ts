import { create } from 'zustand';

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

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  documentationPanelOpen: false,
  activeScreen: 'dashboard',
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setDocumentationPanelOpen: (v) => set({ documentationPanelOpen: v }),
  setActiveScreen: (s) => set({ activeScreen: s }),
}));
