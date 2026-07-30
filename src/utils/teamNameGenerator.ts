export const TEAM_NAME_ADJECTIVES = [
  "Red", "Funny", "Clear", "Bold", "Swift", "Clever", "Jolly", "Sneaky",
  "Bright", "Curious", "Daring", "Eager", "Fuzzy", "Giant", "Happy", "Icy",
  "Jumpy", "Kind", "Lucky", "Mighty", "Nifty", "Orange", "Plucky", "Quick",
  "Rowdy", "Silly", "Tiny", "Upbeat", "Vivid", "Wacky", "Zesty", "Golden",
];

export const TEAM_NAME_NOUNS = [
  "Pyjama", "Car", "Clown", "Team", "Falcon", "Pretzel", "Wizard", "Penguin",
  "Rocket", "Ninja", "Taco", "Panther", "Unicorn", "Otter", "Compass",
  "Dragon", "Marmot", "Biscuit", "Voyager", "Comet", "Lantern", "Wombat",
  "Trailblazer", "Puzzle", "Kangaroo", "Cactus", "Sailor", "Sparrow",
  "Tornado", "Walrus", "Yeti", "Detective",
];

export function generateTeamName(seedNouns?: string[]): string {
  const adjective =
    TEAM_NAME_ADJECTIVES[Math.floor(Math.random() * TEAM_NAME_ADJECTIVES.length)];
  const nounPool = seedNouns && seedNouns.length > 0 ? seedNouns : TEAM_NAME_NOUNS;
  const noun = nounPool[Math.floor(Math.random() * nounPool.length)];
  return `${adjective} ${noun}`;
}
