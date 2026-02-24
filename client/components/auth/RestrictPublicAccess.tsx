import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

/**
 * Component that restricts access to public routes for logged-in admin, teller, and archiever users.
 * These roles should only be able to access their respective dashboards.
 */
export function RestrictPublicAccess() {
  const { user } = useAuth();
  const loc = useLocation();

  if (user === undefined) return null; // loading state

  // If user is logged in and is one of the restricted roles, redirect to their dashboard
  if (user) {
    if (user.role === "admin") {
      return <Navigate to="/admin" replace />;
    }
    if (user.role === "teller" && user.windowId) {
      return <Navigate to={`/teller/${user.windowId}`} replace />;
    }
    if (user.role === "archiever") {
      return <Navigate to="/archiever" replace />;
    }
  }

  // Allow access to public routes for non-restricted roles or unauthenticated users
  return <Outlet />;
}
