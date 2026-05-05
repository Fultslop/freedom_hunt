import { writable } from "svelte/store";

function createLanguageStore() {
  const { subscribe, set } = writable<{ currentLang: string }>({
    currentLang: "en",
  });
  return {
    subscribe,
    setLang: (lang: string) => set({ currentLang: lang }),
  };
}

export const languageStore = createLanguageStore();