export interface SwipeConfig {
  mode: 'peek' | 'carousel' | 'snap';
  hint: number; // px of adjacent card visible at rest; always 0 for snap
}

export interface IntroConfig {
  motion: 'search' | 'static' | 'none';
  sheen: boolean;
}

export interface Theme {
  fontFamily: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  defaultButtonColor: "primary" | "secondary";
  barBackground: string;
  barBorder: string;
  barText: string;
  barTextSecondary: string;
  progressTrack: string;
  progressFill: string;
  clueBackground: string;
  clueBorderColor: string;
  swipe: SwipeConfig;
  searchGrid: string;
  searchEdge: string;
  searchEdgeActive: string;
  searchEdgeVisited: string;
  searchNode: string;
  searchNodeActive: string;
  searchNodeHalo: string;
  searchLabel: string;
  searchPinStem: string;
  searchPinHead: string;
  searchTeamColors: string[];
  introFog: string;
  introScrim: string;
  sheenImage: string;
  intro: IntroConfig;
}

export type ThemeName = "wireframe" | "app" | "GWC";
