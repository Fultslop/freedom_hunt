import { writable } from "svelte/store";

export interface TitleBarState {
  title?: string;
  progress?: { current: number; total: number } | null;
  backPath?: string | null;
  subtitle?: string;
  isDirty?: boolean;
}

export const titleBarStore = writable<TitleBarState>({
  title: "Freedom Hunt",
  progress: null,
  backPath: null,
});
