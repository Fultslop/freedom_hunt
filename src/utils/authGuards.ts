import { get } from "svelte/store";
import { replace } from "svelte-spa-router";
import { authStore } from "../stores/authStore";

export function requireAuth(detail: {
  params?: Record<string, string> | null;
}): boolean {
  const { activeAuth, authLoading, isLoggingOut } = get(authStore);
  if (authLoading || isLoggingOut) {
    return true;
  }
  if (!activeAuth) {
    replace(`/login/${detail.params?.project ?? ""}`);
    return false;
  }
  return true;
}

export function requireEditorAccess(): boolean {
  const { activeAuth, authLoading, isLoggingOut } = get(authStore);
  if (authLoading || isLoggingOut) {
    return true;
  }
  if (!activeAuth || activeAuth.kind !== "editor") {
    replace("/editor/login");
    return false;
  }
  const hasAccess =
    activeAuth.capabilities.includes("editor") ||
    activeAuth.capabilities.includes("organizer");
  if (!hasAccess) {
    replace("/editor/login");
    return false;
  }
  return true;
}
