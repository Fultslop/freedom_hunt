import type { StatsDoc } from "./storyline";

export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section"
  | "image-picker"
  | "coord-picker"
  | "random_value";

export interface FormField {
  id?: string;
  type: FormFieldType;
  label: string;
  subtext?: string;
  options?: string[];
  values?: string[];
  min?: number;
  max?: number;
  isRequired?: boolean;
}

export interface Challenge {
  name: string;
  description: string;
  notes?: string;
  form: FormField[];
}

/** Raw shape before form resolution — `form` may be a filename string. Internal to loading utilities. */
export interface RawChallenge extends Omit<Challenge, "form"> {
  form: FormField[] | string;
}

export interface LocationName {
  label?: string;
  value: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  title: string;
  image?: string;
  name: LocationName;
  address?: string;
  coordinates?: Coordinates;
  storyline: string;
  storylineElements?: Record<string, StatsDoc>;
  breadcrumb?: string;
  challenge: Challenge;
  themeColor?: string;
}

export interface RouteDefinition {
  description: string;
  locations: string[];
}

export type RoutesData = Record<string, RouteDefinition>;

export interface City {
  id: string;
  name: string;
  image?: string;
  country: string;
  description?: string;
  coordinates?: Coordinates;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

export interface ApplicationText {
  "app.title": string;
  "app.tagline": string;
}

export interface ProjectsText {
  items: Project[];
  "page.subtitle": string;
}

export interface CitiesText {
  items: City[];
  [key: string]: string | City[] | undefined;
}

/** Free-form project metadata from <projectId>.yaml */
export type ProjectMeta = Record<string, unknown>;

/** Free-form city metadata from <cityId>.yaml */
export type CityText = Record<string, unknown>;

export interface HuntSettings {
  storeFormsInLocalStorage: boolean;
  formRequired: boolean;
  canFormsSkip: boolean;
  allowResubmit: boolean;
}

export interface PhotoUploadStatus {
  status: "success" | "error";
  httpCode: number;
  previewDataUrl?: string;
}

export interface FormState {
  values: Record<string, unknown>;
  uploads: Record<string, PhotoUploadStatus>;
  submitted: boolean;
  skipped: boolean;
}

export interface FormValidationStatus {
  missingLabels: string[];
}

export interface NavBarConfig {
  visible?: boolean;
}

export interface LocationEntry extends Location {
  "template-type"?: "location";
  "nav-bar"?: NavBarConfig;
}

export interface TextEntry {
  "template-type": "text";
  image?: string;
  title: string;
  text: string;
  margin?: string;
  "nav-bar"?: NavBarConfig;
}

export type SplashShader = "none" | "grayscale" | "duotone" | "vignette" | "darken";
export type SplashEffectName = "confetti" | "shooting-stars" | "fireworks";

export interface SplashAnchor {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "center" | "bottom";
}

export interface SplashEffectConfig {
  type: SplashEffectName;
  /** Random cooldown range (seconds) between iterations. `min` defaults to `max` if omitted; `max` defaults to 1 if the whole block is omitted. */
  cooldown?: { min?: number; max?: number };
  /** Number of iterations within a single visit. Default 1. Negative = loop until the participant leaves the screen. */
  max?: number;
}

export interface SplashEntry {
  "template-type": "splash";
  image: string;
  shader?: SplashShader;
  effect?: SplashEffectConfig;
  title: string;
  anchor?: SplashAnchor;
  "nav-bar"?: NavBarConfig;
}

export type OptionTarget =
  | { type: "link"; value: string }
  | { type: "page"; value: "title" | "project" | "start_route" | "gallery" | "continue" };

export interface OptionsEntry {
  "template-type": "options";
  image?: string;
  title: string;
  text?: string;
  options: Array<{ text: string; target: OptionTarget; track?: boolean }>;
  "nav-bar"?: NavBarConfig;
}

export interface FormsRequirement {
  type: "forms";
  requires_all_forms_completed?: boolean;
  min_completed_forms?: number;
  include_skipped?: boolean;
  on_fail: { message: string; include_missing_forms?: boolean };
}

export interface PeriodBound {
  operator?: "<" | "<=" | "=" | ">" | ">=";
  date: string;
}

export interface PeriodRequirement {
  type: "period";
  start?: PeriodBound;
  end?: PeriodBound;
  on_fail: { message: string; include_period?: boolean };
}

export type RouteRequirement = FormsRequirement | PeriodRequirement;

export interface CheckpointEntryGate {
  requirements?: RouteRequirement[];
  skippable?: boolean;
  on_succeed?: { message: string; include_missing_forms?: boolean };
}

export interface CheckpointReEntryGate {
  blocked_after_exit?: boolean;
}

export interface CheckpointEntry {
  "template-type": "checkpoint";
  entry?: CheckpointEntryGate;
  "re-entry"?: boolean | CheckpointReEntryGate;
}

export type RouteEntry = LocationEntry | TextEntry | SplashEntry | OptionsEntry | CheckpointEntry;
