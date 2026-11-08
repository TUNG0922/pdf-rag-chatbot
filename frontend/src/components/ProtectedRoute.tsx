import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  // Restrict to admins only (e.g. the PDF management page).
  requireAdmin?: boolean;
  // Restrict to regular users only (e.g. the chat page). Admins are sent to
  // their management page since admins do not have the chat function.
  requireUser?: boolean;
}

function ProtectedRoute({
  children,
  requireAdmin = false,
  requireUser = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Remember where the user was heading so we can return after login.
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  if (requireAdmin && !isAdmin) {
    // A regular user tried to reach an admin page -> send to chat.
    return <Navigate to="/" replace />;
  }

  if (requireUser && isAdmin) {
    // An admin tried to reach the chat page -> admins only manage PDFs.
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
