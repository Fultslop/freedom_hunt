import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";

export default function AdminRoute({ children }) {
  const { activeAuth, authLoading, isLoggingOut } = useAuth();
  if (authLoading || isLoggingOut) return null;
  if (!activeAuth?.isAdmin) return <Navigate to="/" replace />;
  return children;
}

AdminRoute.propTypes = {
  children: PropTypes.node,
};

AdminRoute.propTypes = {
  children: PropTypes.node,
};
