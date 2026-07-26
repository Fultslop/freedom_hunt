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
  | "coord-picker";

export interface FormField {
  id?: string;
  type: FormFieldType;
  label: string;
  options?: string[];
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
  coordinates: Coordinates;
  storyline: string;
  breadcrumb: string;
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

export interface LocationEntry extends Location {
  "template-type"?: "location";
}

export interface TextEntry {
  "template-type": "text";
  image?: string;
  title: string;
  text: string;
  margin?: string;
}

export type SplashShader = "none" | "grayscale" | "duotone" | "vignette" | "darken";
export type SplashEffectName = "confetti" | "shooting-stars" | "fireworks";

export interface SplashAnchor {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "center" | "bottom";
}

export interface SplashEntry {
  "template-type": "splash";
  image: string;
  shader?: SplashShader;
  effect?: SplashEffectName;
  "repeat-effect"?: { cooldown: number; max: number };
  title: string;
  anchor?: SplashAnchor;
}

export type OptionTarget =
  | { type: "link"; value: string }
  | { type: "page"; value: "title" | "project" | "start_route" | "gallery" };

export interface OptionsEntry {
  "template-type": "options";
  image?: string;
  title: string;
  options: Array<{ text: string; target: OptionTarget }>;
}

export type RouteEntry = LocationEntry | TextEntry | SplashEntry | OptionsEntry;
