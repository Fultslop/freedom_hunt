import { get } from "svelte/store";
import { themeStore } from "../stores/themeStore";
import { fontSizeStore, FONT_SIZES } from "../stores/fontSizeStore";
import { titleBarStore } from "../stores/titleBarStore";
import { languageStore } from "../stores/languageStore";
import { authStore } from "../stores/authStore";
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

describe("authStore", () => {
  beforeEach(() => {
    authStore.setForTest({ activeAuth: null, authLoading: true, isLoggingOut: false });
    vi.restoreAllMocks();
  });

  describe("init() — editor session", () => {
    it("sets EditorAuthState when /auth/me returns userId", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          userId: "u1",
          email: "a@b.com",
          username: "alice",
          capabilities: ["editor"],
        }),
      } as Response);
      await authStore.init();
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
      expect(state.activeAuth?.kind).toBe("editor");
      if (state.activeAuth?.kind === "editor") {
        expect(state.activeAuth.userId).toBe("u1");
        expect(state.activeAuth.email).toBe("a@b.com");
        expect(state.activeAuth.username).toBe("alice");
        expect(state.activeAuth.capabilities).toEqual(["editor"]);
      }
    });

    it("sets capabilities to empty array when /auth/me omits capabilities", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        json: async () => ({ ok: true, userId: "u2", email: "b@c.com", username: "bob" }),
      } as Response);
      await authStore.init();
      const state = get(authStore);
      expect(state.activeAuth?.kind).toBe("editor");
      if (state.activeAuth?.kind === "editor") {
        expect(state.activeAuth.capabilities).toEqual([]);
      }
    });
  });

  describe("init() — participant session", () => {
    it("sets ParticipantAuthState when /auth/me returns project", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          project: "democrats_abroad",
          teamName: "Team A",
          contact: "a@b.com",
          isAdmin: false,
        }),
      } as Response);
      await authStore.init();
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
      expect(state.activeAuth?.kind).toBe("participant");
      if (state.activeAuth?.kind === "participant") {
        expect(state.activeAuth.projectId).toBe("democrats_abroad");
        expect(state.activeAuth.teamName).toBe("Team A");
        expect(state.activeAuth.isAdmin).toBe(false);
      }
    });
  });

  describe("init() — unauthenticated", () => {
    it("leaves activeAuth null when /auth/me returns ok: false", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        json: async () => ({ ok: false, error: "Not authenticated" }),
      } as Response);
      await authStore.init();
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
      expect(state.activeAuth).toBeNull();
    });

    it("leaves activeAuth null and does not throw when fetch rejects", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
      await authStore.init();
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
      expect(state.activeAuth).toBeNull();
    });
  });

  describe("loginEditor", () => {
    it("sets EditorAuthState immediately", () => {
      authStore.loginEditor("u3", "c@d.com", "carol", ["organizer"]);
      const state = get(authStore);
      expect(state.activeAuth?.kind).toBe("editor");
      if (state.activeAuth?.kind === "editor") {
        expect(state.activeAuth.userId).toBe("u3");
        expect(state.activeAuth.capabilities).toEqual(["organizer"]);
      }
    });
  });

  describe("loginParticipant", () => {
    it("sets ParticipantAuthState immediately", () => {
      authStore.loginParticipant("proj_x", "Team B", "b@c.com", false);
      const state = get(authStore);
      expect(state.activeAuth?.kind).toBe("participant");
      if (state.activeAuth?.kind === "participant") {
        expect(state.activeAuth.projectId).toBe("proj_x");
        expect(state.activeAuth.teamName).toBe("Team B");
        expect(state.activeAuth.isAdmin).toBe(false);
      }
    });

    it("defaults isAdmin to false when omitted", () => {
      authStore.loginParticipant("proj_y", "Team C", "c@d.com");
      const state = get(authStore);
      if (state.activeAuth?.kind === "participant") {
        expect(state.activeAuth.isAdmin).toBe(false);
      }
    });
  });
});
