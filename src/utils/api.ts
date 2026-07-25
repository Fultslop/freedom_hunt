import type { Location } from "../types/data";
import type { GalleryPhoto } from "../types/gallery";

// ---------------------------------------------------------------------------
// Challenge
// ---------------------------------------------------------------------------

export interface FormSubmitPayload {
  locationId: number;
  routeId?: string;
  cityId: string;
  teamName: string;
  contact: string;
  answers: Record<string, unknown>;
}

export async function postFormSubmit(
  payload: FormSubmitPayload,
): Promise<{ ok: boolean }> {
  const res = await fetch("/form-submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean }>;
}

export interface PhotoUploadPayload {
  locationId: number;
  cityId: string;
  routeId?: string;
  taskTitle: string;
  file: File;
}

export async function postPhotoUpload(
  payload: PhotoUploadPayload,
): Promise<{ ok: boolean; id?: string; key?: string }> {
  const body = new FormData();
  body.append("photo", payload.file);
  body.append("locationId", String(payload.locationId));
  body.append("cityId", payload.cityId);
  if (payload.routeId) {
    body.append("routeId", payload.routeId);
  }
  body.append("taskTitle", payload.taskTitle);
  const res = await fetch("/upload", { method: "POST", body });
  return res.json() as Promise<{ ok: boolean; id?: string; key?: string }>;
}

// ---------------------------------------------------------------------------
// Editor — locations
// ---------------------------------------------------------------------------

export interface LocationListEntry {
  filename: string;
  sha: string;
  location: Location;
}

export interface EditorLocationPayload {
  project: string;
  city: string;
  filename: string;
  existingSha: string | null;
  location: Record<string, unknown>;
}

export async function fetchEditorLocation(
  project: string,
  city: string,
  file: string,
): Promise<{ ok: boolean; sha?: string; location?: Record<string, unknown> }> {
  const res = await fetch(
    `/editor/location?project=${project}&city=${city}&file=${file}`,
  );
  return res.json() as Promise<{
    ok: boolean;
    sha?: string;
    location?: Record<string, unknown>;
  }>;
}

export async function saveEditorLocation(
  payload: EditorLocationPayload,
): Promise<{ ok: boolean; prUrl?: string; error?: string }> {
  const res = await fetch("/editor/location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; prUrl?: string; error?: string }>;
}

export async function fetchEditorLocations(
  project: string,
  city: string,
): Promise<{ ok: boolean; locations?: LocationListEntry[]; error?: string }> {
  const res = await fetch(
    `/editor/locations?project=${project}&city=${city}`,
  );
  return res.json() as Promise<{
    ok: boolean;
    locations?: LocationListEntry[];
    error?: string;
  }>;
}

export async function fetchPrStatuses(
  numbers: string[],
  project: string,
): Promise<{ ok: boolean; statuses?: Record<string, string> }> {
  const res = await fetch(
    `/editor/pr-status?project=${encodeURIComponent(project)}&numbers=${numbers.join(",")}`,
  );
  return res.json() as Promise<{
    ok: boolean;
    statuses?: Record<string, string>;
  }>;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginPayload {
  project: string;
  teamName: string;
  contact: string;
  password: string;
  email?: string;
}

export interface DemoSignupPayload {
  project: string;
  email: string;
  password: string;
}

export async function postDemoSignup(payload: DemoSignupPayload): Promise<LoginResponse> {
  const res = await fetch("/auth/participant-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<LoginResponse>;
}

export interface LoginResponse {
  ok: boolean;
  teamName?: string;
  contact?: string;
  isAdmin?: boolean;
  error?: string;
}

export async function postLogin(
  payload: LoginPayload,
): Promise<LoginResponse> {
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<LoginResponse>;
}

export async function postLogout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST" });
}

export interface AuthMeResponse {
  ok: boolean;
  // Editor/user session
  userId?: string;
  email?: string;
  username?: string;
  capabilities?: string[];
  // Participant session (unchanged)
  project?: string;
  teamName?: string;
  contact?: string;
  isAdmin?: boolean;
  error?: string;
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch("/auth/me");
  return res.json() as Promise<AuthMeResponse>;
}

// ---------------------------------------------------------------------------
// Auth — new user / invite endpoints
// ---------------------------------------------------------------------------

export interface SignupPayload {
  email: string;
  username: string;
  password: string;
  email_consent_results?: boolean;
  email_consent_marketing?: boolean;
}

export interface SignupResponse {
  ok: boolean;
  userId?: string;
  email?: string;
  username?: string;
  capabilities?: string[];
  error?: string;
}

export async function postSignup(payload: SignupPayload): Promise<SignupResponse> {
  const res = await fetch("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<SignupResponse>;
}

export interface UserLoginPayload {
  email: string;
  password: string;
}

export interface UserLoginResponse {
  ok: boolean;
  userId?: string;
  email?: string;
  username?: string;
  capabilities?: string[];
  isBootstrap?: boolean;
  project?: string;
  error?: string;
}

export async function postUserLogin(payload: UserLoginPayload): Promise<UserLoginResponse> {
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<UserLoginResponse>;
}

export interface InviteTokenInfo {
  ok: boolean;
  projectId?: string;
  capability?: string;
  expiresAt?: number;
  error?: string;
}

export async function fetchInviteToken(token: string): Promise<InviteTokenInfo> {
  const res = await fetch(`/auth/invite/${token}`);
  return res.json() as Promise<InviteTokenInfo>;
}

export interface InviteAcceptResponse {
  ok: boolean;
  projectId?: string;
  capabilities?: string[];
  userId?: string;
  email?: string;
  username?: string;
  error?: string;
}

export async function postInviteAccept(token: string): Promise<InviteAcceptResponse> {
  const res = await fetch("/auth/invite/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.json() as Promise<InviteAcceptResponse>;
}

export interface InviteCreateResponse {
  ok: boolean;
  token?: string;
  inviteUrl?: string;
  error?: string;
}

export async function postInviteCreate(
  projectId: string,
  capability = "editor",
): Promise<InviteCreateResponse> {
  const res = await fetch("/auth/invite/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, capability }),
  });
  return res.json() as Promise<InviteCreateResponse>;
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export interface GalleryPhotosResponse {
  ok: boolean;
  photos?: GalleryPhoto[];
  error?: string;
}

export async function fetchGalleryPhotos(
  project: string,
  city: string,
  filters?: { team?: string; task?: string },
): Promise<GalleryPhotosResponse> {
  const params = new URLSearchParams();
  if (filters?.team) {
    params.set("team", filters.team);
  }
  if (filters?.task) {
    params.set("task", filters.task);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/gallery/${project}/${city}/photos${query}`);
  return res.json() as Promise<GalleryPhotosResponse>;
}

export async function fetchRandomPhotos(
  project: string,
  city: string,
): Promise<GalleryPhotosResponse> {
  const res = await fetch(`/gallery/${project}/${city}/photos/random`);
  return res.json() as Promise<GalleryPhotosResponse>;
}