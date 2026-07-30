import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TEAM_NAME_ADJECTIVES,
  TEAM_NAME_NOUNS,
  generateTeamName,
} from "../utils/teamNameGenerator";

describe("teamNameGenerator", () => {
  it("has exactly 32 adjectives and 32 nouns", () => {
    expect(TEAM_NAME_ADJECTIVES).toHaveLength(32);
    expect(TEAM_NAME_NOUNS).toHaveLength(32);
  });

  it("has no duplicate words within each list", () => {
    expect(new Set(TEAM_NAME_ADJECTIVES).size).toBe(32);
    expect(new Set(TEAM_NAME_NOUNS).size).toBe(32);
  });

  it("generates a name composed of one adjective and one noun", () => {
    const name = generateTeamName();
    const [adjective, noun] = name.split(" ");
    expect(TEAM_NAME_ADJECTIVES).toContain(adjective);
    expect(TEAM_NAME_NOUNS).toContain(noun);
  });

  it("picks the first word of each list when Math.random returns 0", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(generateTeamName()).toBe(
      `${TEAM_NAME_ADJECTIVES[0]} ${TEAM_NAME_NOUNS[0]}`,
    );
    spy.mockRestore();
  });

  it("picks the last word of each list when Math.random returns just under 1", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(generateTeamName()).toBe(
      `${TEAM_NAME_ADJECTIVES[TEAM_NAME_ADJECTIVES.length - 1]} ${TEAM_NAME_NOUNS[TEAM_NAME_NOUNS.length - 1]}`,
    );
    spy.mockRestore();
  });
});

describe("generateTeamName with seedNouns", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 'Adjective Noun' from the default global lists with no argument", () => {
    const name = generateTeamName();
    const [adjective, noun] = name.split(" ");
    expect(TEAM_NAME_ADJECTIVES).toContain(adjective);
    expect(TEAM_NAME_NOUNS).toContain(noun);
  });

  it("draws the noun from seedNouns when provided and non-empty", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const name = generateTeamName(["Vredespaleis", "Binnenhof"]);
    expect(name.endsWith("Vredespaleis")).toBe(true);
  });

  it("falls back to the global noun list when seedNouns is empty", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const name = generateTeamName([]);
    const [, noun] = name.split(" ");
    expect(TEAM_NAME_NOUNS).toContain(noun);
  });
});
