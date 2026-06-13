import { create } from 'zustand';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  requiresPasswordChange: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  requiresPasswordChange: boolean;
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setRequiresPasswordChange: (v: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  requiresPasswordChange: false,
  setUser: (user) => set({ user, requiresPasswordChange: user?.requiresPasswordChange ?? false }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setRequiresPasswordChange: (requiresPasswordChange) => set({ requiresPasswordChange }),
  clear: () => set({ user: null, accessToken: null, requiresPasswordChange: false }),
}));
