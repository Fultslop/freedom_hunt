export interface AuthState {
  projectId: string;
  teamName: string;
  contact: string | null;
  isAdmin: boolean;
}

export interface TokenPayload {
  project: string;
  teamName: string;
  contact: string;
  isAdmin: boolean;
  exp: number;
}
