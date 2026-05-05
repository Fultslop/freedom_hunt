import { writable } from "svelte/store";

export interface TitleBarState {
  title?: string;
  progress?: { current: number; total: number } | null;
  backPath?: string | null;
}

export const titleBarStore = writable<TitleBarState>({
  title: "Freedom Hunt",
  progress: null,
  backPath: null,
});
