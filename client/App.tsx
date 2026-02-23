import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import AppLayout from "@/components/layout/AppLayout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Queue from "./pages/Queue";
import Reception from "./pages/Reception";
import Teller from "./pages/Teller";
import Display from "./pages/Display";
import TicketStatus from "./pages/TicketStatus";
import Track from "./pages/Track";
import Login from "./pages/Login";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import RoleSelector from "./pages/RoleSelector";
import Profile from "./pages/Profile";
import { AuthProvider, useAuth, useSessionLostRedirect } from "@/hooks/use-auth";
import { RequireAuth } from "@/components/auth/RequireAuth";

// Lazy load pages with heavy dependencies to reduce initial bundle
const Admin = lazy(() => import("./pages/Admin"));
const Employee = lazy(() => import("./pages/Employee"));
const Archiever = lazy(() => import("./pages/Archiever"));
const TellerWindow = lazy(() => import("./pages/TellerWindow"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

function TellerHomeRedirect() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "teller" && user.windowId)
    return <Navigate to={`/teller/${user.windowId}`} replace />;
  // Admins should go to admin panel, not teller console
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  // If user has multiple roles and is on this page, redirect to role selector
  if (user.roles && user.roles.length > 1)
    return <Navigate to="/role-selector" replace />;
  return <Navigate to="/" replace />;
}

// Component to monitor session state and redirect on logout
function SessionMonitor() {
  useSessionLostRedirect();
  return null;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SessionMonitor />
            <Routes>
              {/* Public routes without AppLayout (no header/footer) */}
              <Route path="/track" element={<Track />} />

              {/* All other routes with AppLayout */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/role-selector" element={<RoleSelector />} />
                <Route element={<RequireAuth role="reception" />}>
                  <Route path="/reception" element={<Reception />} />
                </Route>
                <Route path="/queue" element={<Queue />} />
                <Route path="/teller" element={<TellerHomeRedirect />} />
                <Route element={<RequireAuth role="teller" />}>
                  <Route
                    path="/teller/:id"
                    element={
                      <Suspense fallback={<LoadingFallback />}>
                        <TellerWindow />
                      </Suspense>
                    }
                  />
                </Route>
                <Route element={<RequireAuth role="employee" />}>
                  <Route
                    path="/employee"
                    element={
                      <Suspense fallback={<LoadingFallback />}>
                        <Employee />
                      </Suspense>
                    }
                  />
                </Route>
                <Route element={<RequireAuth role="archiever" />}>
                  <Route
                    path="/archiever"
                    element={
                      <Suspense fallback={<LoadingFallback />}>
                        <Archiever />
                      </Suspense>
                    }
                  />
                </Route>
                <Route element={<RequireAuth role="admin" />}>
                  <Route
                    path="/admin"
                    element={
                      <Suspense fallback={<LoadingFallback />}>
                        <Admin />
                      </Suspense>
                    }
                  />
                </Route>
                <Route path="/display" element={<Display />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/tickets/:code" element={<TicketStatus />} />
                <Route path="/login" element={<Login />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
