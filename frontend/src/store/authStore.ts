import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthState {
  activeTenant: string | null;
  token: string | null;
  isAuthenticated: boolean;
  theme: 'dark' | 'light';
  role: string | null;
  email: string | null;
  isFirstLogin: boolean;
  setTenant: (tenant: string | null) => void;
  setToken: (token: string | null) => void;
  login: (token: string, tenant: string, role: string, email: string, isFirstLogin: boolean) => void;
  updatePasswordReset: () => void;
  logout: () => void;
  toggleTheme: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      activeTenant: null,
      token: null,
      isAuthenticated: false,
      theme: 'dark',
      role: null,
      email: null,
      isFirstLogin: false,
      setTenant: (tenant) => set({ activeTenant: tenant }),
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      login: (token, tenant, role, email, isFirstLogin) => set({
        token,
        activeTenant: tenant,
        isAuthenticated: true,
        role,
        email,
        isFirstLogin
      }),
      updatePasswordReset: () => set({ isFirstLogin: false }),
      logout: () => set({
        token: null,
        activeTenant: null,
        isAuthenticated: false,
        role: null,
        email: null,
        isFirstLogin: false
      }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'synq-auth',
    }
  )
)
