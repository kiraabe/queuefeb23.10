import { Outlet, useLocation } from "react-router-dom";

import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

const AppLayout = () => {
  const { pathname } = useLocation();
  const isAdminPage = pathname.startsWith("/admin");
  const isEmployeePage = pathname.startsWith("/employee");
  const hideNavigation = isAdminPage || isEmployeePage;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {!hideNavigation && <SiteHeader />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!hideNavigation && <SiteFooter />}
    </div>
  );
};

export default AppLayout;
