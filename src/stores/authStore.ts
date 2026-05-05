import { writable } from "svelte/store";
import { replace } from "svelte-spa-router";
import type { AuthState } from "../types/auth";

interface AuthStoreState {
  activeAuth: AuthState | null;
  authLoading: boolean;
  isLoggingOut: boolean;
}

function createAuthStore() {
  const {
    subscribe,
    set,
    update: upd,
  } = writable<AuthStoreState>({
    activeAuth: null,
    authLoading: true,
    isLoggingOut: false,
  });

  async function init() {
    try {
      const res = await fetch("/auth/me");
      const data = (await res.json()) as Record<string, unknown>;
      if (data.ok) {
        upd((state) => ({
          ...state,
          activeAuth: {
            projectId: data.project as string,
            teamName: data.teamName as string,
            contact: (data.contact as string) ?? null,
            isAdmin: (data.isAdmin as boolean) ?? false,
          },
        }));
      }
    } catch {
      /* ignore network errors on auth check */
    }
    upd((state) => ({ ...state, authLoading: false }));
  }

  function login(
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin = false,
  ) {
    upd((state) => ({
      ...state,
      activeAuth: { projectId, teamName, contact, isAdmin },
    }));
  }

  async function logout() {
    upd((state) => ({ ...state, isLoggingOut: true }));
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch {
      /* ignore logout errors */
    }
    set({ activeAuth: null, authLoading: false, isLoggingOut: false });
    replace("/");
  }

  return { subscribe, init, login, logout };
}

export const authStore = createAuthStore();
