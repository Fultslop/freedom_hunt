/**
 * Decorative, fictional place-name labels for SearchPlane's procedural
 * attract animation (e.g. the "search" mode label on a newly-current node).
 * Not real locations, and not the team-name generator — see teamNameGenerator.ts.
 */
export const PLACE_NAMES = [
  "Old Market", "Station Square", "Canal Bridge", "The Windmill",
  "North Gate", "Garden Court", "Merchant Row", "Clocktower",
  "Riverside Walk", "The Arcade", "Chapel Lane", "Harbor View",
  "Founders Square", "The Promenade", "Mill Corner", "East Bastion",
  "Wall Walk", "Crumbly Castle", "Fearsome Fortress", "Marvelous Mall",
  "Art District", "Breakaway Beach", "Middle Park", "Statue Square",
  "Famous Building", "Slightly less Famous Building", "The Zoo",
  "Botanical Garden"
];

/** Picks an unused name if one exists, otherwise a random repeat. */
export function pickPlaceName(used: Set<string>, rand: () => number = Math.random): string {
  const unused = PLACE_NAMES.filter((name) => !used.has(name));
  const pool = unused.length > 0 ? unused : PLACE_NAMES;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}
