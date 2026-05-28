import { Link, useRouterState } from "@tanstack/react-router";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { HealthBadge } from "./HealthBadge";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Story" },
  { to: "/architecture", label: "Architecture" },
  { to: "/app", label: "Boardroom" },
  { to: "/skills", label: "Skills" },
  { to: "/policy", label: "Policy" },
];

export function TopNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <header className="sticky top-0 z-40 glass">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground font-bold">T</span>
          <span className="font-semibold tracking-tight">
            Titus<span className="accent-text">-Prime</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  active ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <HealthBadge />
          <ThemeSwitcher />
          <Link
            to="/app"
            className="hidden sm:inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            Open Boardroom
          </Link>
        </div>
      </div>
    </header>
  );
}