import { writable } from "svelte/store";
import { replace } from "svelte-spa-router";
import type { AuthState } from "../types/auth";
import { fetchAuthMe, postLogout } from "../utils/api";

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
      const data = await fetchAuthMe();
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
      await postLogout();
    } catch {
      /* ignore logout errors */
    }
    set({ activeAuth: null, authLoading: false, isLoggingOut: false });
    replace("/");
  }

  return { subscribe, init, login, logout };
}

export const authStore = createAuthStore();
