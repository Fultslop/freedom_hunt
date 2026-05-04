export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  options?: string[];
  min?: number;
  max?: number;
}

export interface Challenge {
  name: string;
  description: string;
  notes?: string;
  form: FormField[];
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
  locationId: number;
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
