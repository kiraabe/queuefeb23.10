import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-translation";
import { LanguageSwitcher } from "@/components/language/LanguageSwitcher";

const SiteHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const NAV_LINKS = [
    { label: t("navigation.home"), to: "/" },
    { label: t("navigation.reception"), to: "/reception" },
    { label: t("navigation.queue"), to: "/queue" },
    { label: t("navigation.teller"), to: "/teller" },
    { label: t("navigation.display"), to: "/display" },
  ];

  const ADMIN_NAV_LINKS = [{ label: t("navigation.admin"), to: "/admin" }];

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="relative sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sm:gap-6 py-3 sm:py-4">
        <Link to="/" className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <img
            src="/logos/aa-landholding-logo.webp"
            alt="CTTCS Solution logo"
            className="h-9 sm:h-10 w-9 sm:w-10 rounded-full object-cover flex-shrink-0"
          />
          <div className="hidden sm:flex flex-col min-w-0">
            <span className="font-display text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
              CTTCS Solution
            </span>
            <span className="text-xs text-muted-foreground truncate">
              Track cases, ensure compliance
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMenu}
              className={({ isActive }) =>
                cn(
                  "relative rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition",
                  "hover:text-foreground",
                  isActive &&
                    "text-foreground after:absolute after:inset-x-2 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-primary",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <>
              <div className="h-6 w-px bg-border/50" />
              {ADMIN_NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    cn(
                      "relative rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition",
                      "hover:text-foreground",
                      isActive &&
                        "text-foreground after:absolute after:inset-x-2 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-primary",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher variant="dropdown-icon" />
          {user ? (
            <>
              <button
                onClick={() => navigate("/profile")}
                className="text-sm font-semibold text-primary hover:underline cursor-pointer"
              >
                {user.role} - {user.fullName || user.username}
              </button>
              <Button
                variant="outline"
                onClick={async () => {
                  await logout();
                  navigate(`/login`);
                }}
              >
                sign out topbr
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => navigate(`/login`)}>
              {t("login.signIn")}
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
          onClick={toggleMenu}
          aria-label={isMenuOpen ? t("buttons.close") : "Open menu"}
        >
          {isMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div
        className={cn(
          "md:hidden",
          "absolute left-0 right-0 top-full z-40 origin-top bg-background/95 backdrop-blur transition-all duration-200",
          isMenuOpen
            ? "pointer-events-auto visible translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-3 opacity-0",
        )}
      >
        <div className="w-full flex flex-col gap-3 py-6 px-4">
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMenu}
              className={({ isActive }) =>
                cn(
                  "rounded-2xl border border-border/70 bg-card px-5 py-3 text-base font-semibold text-muted-foreground transition",
                  "hover:border-primary/40 hover:text-foreground",
                  isActive && "border-primary/60 text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <>
              <div className="h-px bg-border/50 my-2" />
              {ADMIN_NAV_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    cn(
                      "rounded-2xl border border-border/70 bg-card px-5 py-3 text-base font-semibold text-muted-foreground transition",
                      "hover:border-primary/40 hover:text-foreground",
                      isActive && "border-primary/60 text-foreground",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          {/* Mobile Auth Section */}
          <div className="flex flex-col gap-2 border-t border-border/40 pt-4 mt-2">
            <div className="px-2">
              <p className="text-xs text-muted-foreground mb-2">{t("language.select")}</p>
              <LanguageSwitcher variant="select" className="w-full" />
            </div>
            {user ? (
              <>
                <button
                  onClick={() => {
                    navigate("/profile");
                    closeMenu();
                  }}
                  className="px-5 py-2 text-sm hover:opacity-80 cursor-pointer text-left"
                >
                  <p className="font-bold text-primary capitalize">
                    {user.role}
                  </p>
                  <p className="text-xs font-semibold text-primary">
                    {user.fullName || user.username}
                  </p>
                </button>
                <Button
                  variant="destructive"
                  className="w-full h-10 text-sm font-medium"
                  onClick={async () => {
                    await logout();
                    closeMenu();
                    navigate("/login");
                  }}
                >
                  sign out topbr
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="w-full h-10 text-sm font-medium"
                onClick={() => {
                  closeMenu();
                  navigate("/login");
                }}
              >
                {t("login.signIn")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
