import { get } from "svelte/store";
import { themeStore } from "../stores/themeStore";
import { fontSizeStore, FONT_SIZES } from "../stores/fontSizeStore";
import { titleBarStore } from "../stores/titleBarStore";
import { languageStore } from "../stores/languageStore";
import type { TitleBarState } from "../stores/titleBarStore";

const TITLE_BAR_DEFAULT: TitleBarState = { title: "Freedom Hunt", progress: null, backPath: null };

describe("themeStore", () => {
  it("defaults to app theme", () => {
    const state = get(themeStore);
    expect(state.themeName).toBe("app");
    expect(state.theme.background).toBe("#0f172a");
  });

  it("setThemeName persists to localStorage and updates theme", () => {
    themeStore.setThemeName("GWC");
    const state = get(themeStore);
    expect(state.themeName).toBe("GWC");
    expect(state.theme.background).toBe("#ffffff");
    expect(localStorage.setItem).toHaveBeenCalledWith("themeName", "GWC");
  });
});

describe("fontSizeStore", () => {
  beforeEach(() => {
    fontSizeStore.setFontSize("small");
  });

  it("defaults to small", () => {
    expect(get(fontSizeStore).fontSize).toBe("small");
  });

  it("exposes FONT_SIZES constant", () => {
    expect(FONT_SIZES).toEqual(["small", "medium", "large"]);
  });

  it("setFontSize updates state and persists", () => {
    fontSizeStore.setFontSize("large");
    expect(get(fontSizeStore).fontSize).toBe("large");
    expect(localStorage.setItem).toHaveBeenCalledWith("fontSizePref", "large");
  });
});

describe("titleBarStore", () => {
  beforeEach(() => {
    titleBarStore.set(TITLE_BAR_DEFAULT);
  });

  it("has default title", () => {
    const state = get(titleBarStore);
    expect(state.title).toBe("Freedom Hunt");
    expect(state.progress).toBeNull();
    expect(state.backPath).toBeNull();
  });

  it("can be updated directly", () => {
    titleBarStore.set({
      title: "Den Haag",
      progress: { current: 2, total: 5 },
      backPath: "/test",
    });
    const state = get(titleBarStore);
    expect(state.title).toBe("Den Haag");
    expect(state.progress).toEqual({ current: 2, total: 5 });
  });
});

describe("languageStore", () => {
  it("defaults to en", () => {
    expect(get(languageStore).currentLang).toBe("en");
  });

  it("setLang updates language", () => {
    languageStore.setLang("nl");
    expect(get(languageStore).currentLang).toBe("nl");
  });
});
