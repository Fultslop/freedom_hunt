import {
  createContext,
  useContext,
  useState,
  useEffect,
  startTransition,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { AuthState } from "../types/auth";

interface AuthContextValue {
  activeAuth: AuthState | null;
  authLoading: boolean;
  isLoggingOut: boolean;
  login: (
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin?: boolean,
  ) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [activeAuth, setActiveAuth] = useState<AuthState | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Reset the logout flag once navigation has committed (location changed).
  // We can't reset it inside logout() because React 18 batches it with
  // setActiveAuth(null), which defeats the ProtectedRoute guard.
  useEffect(() => {
    startTransition(() => {
      setIsLoggingOut(false);
    });
  }, [location.pathname]);

  useEffect(() => {
    fetch("/auth/me")
      .then((r) => r.json() as Promise<Record<string, unknown>>)
      .then((data) => {
        if (data.ok) {
          setActiveAuth({
            projectId: data.project as string,
            teamName: data.teamName as string,
            contact: (data.contact as string) ?? null,
            isAdmin: (data.isAdmin as boolean) ?? false,
          });
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  function login(
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin = false,
  ) {
    setActiveAuth({ projectId, teamName, contact, isAdmin });
  }

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch {
      /* ignore logout errors */
    }
    setActiveAuth(null);
    navigate("/", { replace: true });
  }

  return (
    <AuthContext.Provider
      value={{ activeAuth, authLoading, login, logout, isLoggingOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}