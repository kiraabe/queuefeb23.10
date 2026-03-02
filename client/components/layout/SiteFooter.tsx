import { Link } from "react-router-dom";
import LanguageSwitch from "./LanguageSwitch";
import { useTranslation } from "@/hooks/use-translation";

const SiteFooter = () => {
  const { t } = useTranslation();

  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-background/60">
      <div className="py-5">
        <div className="container flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>
            {t("common.copyright", { year: new Date().getFullYear() })}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              className="transition-colors hover:text-primary"
              to="/privacy"
            >
              {t("common.privacy")}
            </Link>
            <Link className="transition-colors hover:text-primary" to="/terms">
              {t("common.terms")}
            </Link>
            <a
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary"
              href="#status"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              {t("common.liveStatus")}
            </a>
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
