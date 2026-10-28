import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { decode } from "base-64";
import axios from "axios";
import { environment } from "@config/env";
import type { AuthUser, Company, SessionPayload } from "@modules/auth/types";
import { queryClient } from "../api/queryClient";

// some RN engines lack `atob`, used below to read the JWT expiry
const runtimeGlobal = globalThis as unknown as { atob?: typeof decode };
if (!runtimeGlobal.atob) runtimeGlobal.atob = decode;

interface AuthState {
  user: AuthUser | null;
  company: Company | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isAuthChecked: boolean;

  setSession: (s: SessionPayload) => void;
  setProfile: (user: AuthUser, company: Company) => void;
  updateTokens: (token: string, refreshToken: string) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
}

export function isTokenExpired(token: string | null) {
  if (!token) return true;
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(part));
    return exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

/** SecureStore (OS keystore) on native; localStorage on web. */
export const secureStorage: StateStorage = {
  getItem: async (name) => {
    if (Platform.OS === "web") {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name, value) => {
    if (Platform.OS === "web") {
      try {
        localStorage.setItem(name, value);
      } catch {
        /* private window, quota — the session just won't persist */
      }
      return;
    }
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    if (Platform.OS === "web") {
      try {
        localStorage.removeItem(name);
      } catch {
        /* nothing to do */
      }
      return;
    }
    await SecureStore.deleteItemAsync(name);
  },
};

/** Single-flight: a burst of 401s triggers one refresh, not twenty. */
let refreshPromise: Promise<string | null> | null = null;

const STORAGE_KEY = "callos-auth";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      company: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isAuthChecked: false,

      setSession: ({ user, company, accessToken, refreshToken }) =>
        set({ user, company, token: accessToken, refreshToken, isAuthenticated: true, isAuthChecked: true }),

      setProfile: (user, company) => set({ user, company }),

      updateTokens: (token, refreshToken) => set({ token, refreshToken, isAuthenticated: true }),

      logout: async () => {
        const { token } = get();
        set({ user: null, company: null, token: null, refreshToken: null, isAuthenticated: false });
        queryClient.clear();
        await secureStorage.removeItem(STORAGE_KEY);
        if (token && !isTokenExpired(token)) {
          // ends the session server-side; the session TTL reclaims it otherwise
          await axios
            .post(`${environment.apiUrl}/auth/logout`, {}, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 10_000,
            })
            .catch(() => {});
        }
      },

      refreshSession: async () => {
        if (refreshPromise) return refreshPromise;
        refreshPromise = (async () => {
          try {
            const { refreshToken } = get();
            if (!refreshToken) {
              await get().logout();
              return null;
            }
            const rs = await axios.post(`${environment.apiUrl}/auth/refresh`, { refreshToken });
            const { accessToken, refreshToken: next } = rs.data.data;
            get().updateTokens(accessToken, next);
            return accessToken as string;
          } catch (err) {
            // only a refusal signs out; a dropped network must not
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 403) await get().logout();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
        return refreshPromise;
      },

      initializeAuth: async () => {
        const { token, refreshToken } = get();
        if (!token && !refreshToken) {
          set({ isAuthChecked: true });
          return;
        }
        if (!isTokenExpired(token)) {
          set({ isAuthenticated: true, isAuthChecked: true });
          return;
        }
        await get().refreshSession();
        // the refresh token survived, so it was the network: boot with the cached user
        set({ isAuthenticated: !!get().refreshToken, isAuthChecked: true });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ user: s.user, company: s.company, token: s.token, refreshToken: s.refreshToken }),
    },
  ),
);
