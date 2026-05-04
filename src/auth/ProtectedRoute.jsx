import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import PropTypes from "prop-types";

export default function ProtectedRoute({ children }) {
  const { activeAuth, authLoading, isLoggingOut } = useAuth();
  const { project } = useParams();
  if (authLoading || isLoggingOut) return null;
  if (!activeAuth) return <Navigate to={`/login/${project}`} replace />;
  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node,
};

ProtectedRoute.propTypes = {
  children: PropTypes.node,
};
