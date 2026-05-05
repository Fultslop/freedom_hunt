export interface SwipeConfig {
  mode: 'peek' | 'carousel' | 'snap';
  hint: number; // px of adjacent card visible at rest; always 0 for snap
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
  barBackground: string;
  barBorder: string;
  barText: string;
  barTextSecondary: string;
  progressTrack: string;
  progressFill: string;
  clueBackground: string;
  clueBorderColor: string;
  swipe: SwipeConfig;
}

export type ThemeName = "wireframe" | "app" | "GWC";
