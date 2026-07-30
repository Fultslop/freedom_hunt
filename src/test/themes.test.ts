import { describe, it, expect } from "vitest";
import { themes } from "../theme/themes";

describe("searchTeamColors", () => {
  const themeNames = Object.keys(themes) as (keyof typeof themes)[];

  it("every theme defines at least 3 team colors", () => {
    for (const name of themeNames) {
      expect(themes[name].searchTeamColors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every theme's team colors are all distinct from each other", () => {
    for (const name of themeNames) {
      const colors = themes[name].searchTeamColors;
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it("every theme's team colors are distinct from that theme's primary pin color", () => {
    for (const name of themeNames) {
      const theme = themes[name];
      expect(theme.searchTeamColors).not.toContain(theme.searchPinHead);
    }
  });
});
