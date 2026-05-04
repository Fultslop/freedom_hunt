import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export default function AdminRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeAuth, authLoading, isLoggingOut } = useAuth();
  if (authLoading || isLoggingOut) return null;
  if (!activeAuth?.isAdmin) return <Navigate to="/" replace />;
  return children;
}