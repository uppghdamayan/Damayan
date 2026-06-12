import { create } from 'zustand';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'DOCTOR' | 'NURSE' | 'ADMIN';
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: () => set({ user: null, accessToken: null }),
}));
