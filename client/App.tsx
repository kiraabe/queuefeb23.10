import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import AppLayout from "@/components/layout/AppLayout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Queue from "./pages/Queue";
import Reception from "./pages/Reception";
import Teller from "./pages/Teller";
import Employee from "./pages/Employee";
import Display from "./pages/Display";
import TicketStatus from "./pages/TicketStatus";
import Track from "./pages/Track";
import Login from "./pages/Login";
import TellerWindow from "./pages/TellerWindow";
import Admin from "./pages/Admin";
import RoleSelector from "./pages/RoleSelector";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { RequireAuth } from "@/components/auth/RequireAuth";

const queryClient = new QueryClient();

function TellerHomeRedirect() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/login?redirect=/teller" replace />;
  if (user.role === "teller" && user.windowId)
    return <Navigate to={`/teller/${user.windowId}`} replace />;
  if (user.role === "admin") return <Teller />;
  // If user has multiple roles and is on this page, redirect to role selector
  if (user.roles && user.roles.length > 1) return <Navigate to="/role-selector" replace />;
  return <Navigate to="/" replace />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/role-selector" element={<RoleSelector />} />
                <Route element={<RequireAuth role="reception" />}>
                  <Route path="/reception" element={<Reception />} />
                </Route>
                <Route path="/queue" element={<Queue />} />
                <Route path="/teller" element={<TellerHomeRedirect />} />
                <Route element={<RequireAuth role="teller" />}>
                  <Route path="/teller/:id" element={<TellerWindow />} />
                </Route>
                <Route element={<RequireAuth role="employee" />}>
                  <Route path="/employee" element={<Employee />} />
                </Route>
                <Route element={<RequireAuth role="admin" />}>
                  <Route path="/admin" element={<Admin />} />
                </Route>
                <Route path="/display" element={<Display />} />
                <Route path="/tickets/:code" element={<TicketStatus />} />
                <Route path="/login" element={<Login />} />
              </Route>
              {/* Public tracking route without AppLayout (no header/footer) */}
              <Route path="/track" element={<Track />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
