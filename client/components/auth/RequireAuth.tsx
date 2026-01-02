import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export function RequireAuth({
  role,
}: {
  role?: "reception" | "teller" | "admin" | "employee" | "archiever";
}) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) return null; // loading state could show spinner
  if (!user)
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`}
        replace
      />
    );
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
