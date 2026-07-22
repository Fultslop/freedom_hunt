import { writable } from "svelte/store";
import { replace } from "svelte-spa-router";
import type { AuthState, EditorAuthState, ParticipantAuthState } from "../types/auth";
import { fetchAuthMe } from "../utils/api";

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

  function handleEditorSession(data: Awaited<ReturnType<typeof fetchAuthMe>>) {
    const editorAuth: EditorAuthState = {
      kind: "editor",
      userId: data.userId!,
      email: data.email ?? "",
      username: data.username ?? "",
      capabilities: data.capabilities ?? [],
    };
    upd((state) => ({ ...state, activeAuth: editorAuth }));
  }

  function handleParticipantSession(data: Awaited<ReturnType<typeof fetchAuthMe>>) {
    const participantAuth: ParticipantAuthState = {
      kind: "participant",
      projectId: data.project!,
      teamName: data.teamName ?? "",
      contact: data.contact ?? null,
      isAdmin: data.isAdmin ?? false,
    };
    upd((state) => ({ ...state, activeAuth: participantAuth }));
  }

  async function init() {
    try {
      const data = await fetchAuthMe();
      if (data.ok && data.userId) {
        handleEditorSession(data);
      } else if (data.ok && data.project) {
        handleParticipantSession(data);
      }
    } catch {
      /* ignore network errors on auth check */
    }
    upd((state) => ({ ...state, authLoading: false }));
  }

  function loginEditor(
    userId: string,
    email: string,
    username: string,
    capabilities: string[],
  ) {
    const editorAuth: EditorAuthState = { kind: "editor", userId, email, username, capabilities };
    upd((state) => ({ ...state, activeAuth: editorAuth }));
  }

  function loginParticipant(
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin = false,
  ) {
    const participantAuth: ParticipantAuthState = { kind: "participant", projectId, teamName, contact, isAdmin };
    upd((state) => ({ ...state, activeAuth: participantAuth }));
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

  // Exposed for tests only
  function setForTest(state: AuthStoreState) {
    set(state);
  }

  return { subscribe, init, loginEditor, loginParticipant, logout, setForTest };
}

export const authStore = createAuthStore();
