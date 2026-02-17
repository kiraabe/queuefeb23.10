const SiteFooter = () => {
  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-background/60">
      <div className="py-5">
        <div className="container flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} Powered by{" "}
            <a
              href="https://ekd-tech-solutions.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              EKD Tech solutions
            </a>
            . All rights reserved.
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <a className="hover:text-foreground" href="#privacy">
              Privacy
            </a>
            <a className="hover:text-foreground" href="#terms">
              Terms
            </a>
            <a
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary"
              href="#status"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Live status
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
