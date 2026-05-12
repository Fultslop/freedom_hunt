export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section"
  | "image-picker";

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
