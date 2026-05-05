import { writable } from "svelte/store";

export type FontSize = "small" | "medium" | "large";
export const FONT_SIZES: FontSize[] = ["small", "medium", "large"];

const LS_KEY = "fontSizePref";

function createFontSizeStore() {
  const initial = (localStorage.getItem(LS_KEY) as FontSize) || "small";
  const { subscribe, set } = writable<{ fontSize: FontSize }>({
    fontSize: initial,
  });

  function setFontSize(size: FontSize) {
    localStorage.setItem(LS_KEY, size);
    set({ fontSize: size });
  }

  return { subscribe, setFontSize };
}

export const fontSizeStore = createFontSizeStore();
