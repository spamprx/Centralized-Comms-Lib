import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, LogOut, Menu, X } from "lucide-react";
import { navCategories } from "../constants/navigation";
import { getNavIcon } from "../lib/navIcons";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const iconSlotBase =
    "relative flex h-11 w-11 items-center justify-center rounded-app-md transition-all duration-200";
  const iconSlotIdle =
    "bg-transparent text-app-accent/90 hover:bg-white/[0.06] hover:text-app-accent-hover";
  const iconSlotActive =
    "bg-app-accent-muted text-app-accent-hover shadow-[0_0_24px_-4px_rgba(147,124,248,0.45)]";

  const iconClass = "[&>svg]:transition-transform [&>svg]:duration-200";
  const iconClassHover = "group-hover:[&>svg]:scale-110";

  const rail = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-center py-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-app-md bg-gradient-to-br from-app-accent to-cyan-500 shadow-[0_8px_28px_-6px_rgba(147,124,248,0.55)] ring-2 ring-white/10"
          title="CommsLib"
        >
          <BookOpen size={20} className="text-white" aria-hidden />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-2 pb-2">
        {navCategories.map((cat) => {
          const isSingle = cat.items.length === 1;
          const isOpen = openDropdown === cat.label;
          const icon = getNavIcon(cat);

          if (isSingle) {
            const item = cat.items[0];
            const active = pathname === item.path;
            return (
              <Link
                key={cat.label}
                to={item.path}
                title={item.label}
                className={`group ${iconSlotBase} ${iconSlotIdle} focus-visible:outline-offset-2 ${
                  active ? iconSlotActive : ""
                }`}
              >
                {active ? (
                  <span
                    className="absolute -left-2 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-app-accent to-cyan-400"
                    aria-hidden
                  />
                ) : null}
                <span className={`${iconClass} ${iconClassHover} [&_svg]:text-[1.35rem]`}>
                  {icon}
                </span>
              </Link>
            );
          }

          return (
            <div key={cat.label} className="relative">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="true"
                onClick={() => setOpenDropdown(isOpen ? null : cat.label)}
                title={cat.label}
                className={`group ${iconSlotBase} w-full ${iconSlotIdle} focus-visible:outline-offset-2 ${
                  isOpen ? iconSlotActive : ""
                }`}
              >
                {isOpen ? (
                  <span
                    className="absolute -left-2 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-app-accent to-cyan-400"
                    aria-hidden
                  />
                ) : null}
                <span className={`${iconClass} ${iconClassHover} [&_svg]:text-[1.35rem]`}>
                  {icon}
                </span>
              </button>
              {isOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    aria-hidden
                    onClick={() => setOpenDropdown(null)}
                  />
                  <div
                    role="menu"
                    className="absolute left-full top-0 z-40 ml-1 min-w-[13rem] overflow-hidden rounded-app-lg border border-app-border/90 bg-app-bg/85 py-1 shadow-app-glow backdrop-blur-xl"
                  >
                    {cat.items.map((item) => {
                      const active = pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          role="menuitem"
                          to={item.path}
                          onClick={() => setOpenDropdown(null)}
                          className={`block px-4 py-2.5 text-sm transition-colors hover:bg-app-surface-hover hover:text-app-text ${
                            active
                              ? "bg-app-accent-muted font-medium text-app-accent-hover"
                              : "text-app-muted"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-app-border/80 px-2 py-3">
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className={`group ${iconSlotBase} w-full ${iconSlotIdle} text-app-faint hover:text-red-300 focus-visible:outline-offset-2`}
        >
          <span className={`${iconClass} ${iconClassHover} [&_svg]:text-[1.35rem]`}>
            <LogOut aria-hidden />
          </span>
        </button>
      </div>
    </div>
  );

  const mobileNav = (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main">
      {navCategories.flatMap((cat) =>
        cat.items.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={`${cat.label}-${item.path}`}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`rounded-app-md px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-app-accent-muted text-app-accent-hover shadow-app-soft"
                  : "text-app-muted hover:bg-app-surface-hover hover:text-app-text"
              }`}
            >
              {item.label}
            </Link>
          );
        }),
      )}
      <button
        type="button"
        onClick={() => {
          handleLogout();
          setMobileOpen(false);
        }}
        className="mt-4 flex items-center gap-2 rounded-app-md px-3 py-2.5 text-left text-sm font-medium text-red-300/95 hover:bg-red-500/10"
      >
        <LogOut size={18} aria-hidden />
        Log out
      </button>
    </nav>
  );

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col border-r border-app-border/80 bg-app-bg/80 shadow-[4px_0_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl supports-[backdrop-filter]:bg-app-bg/55 md:flex"
        aria-label="Primary"
      >
        {rail}
      </aside>

      <button
        type="button"
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl border border-app-border/90 bg-app-bg/85 text-app-text shadow-app-glow backdrop-blur-md transition-transform hover:scale-105 active:scale-95 md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-expanded={mobileOpen}
        aria-controls="app-mobile-nav"
        aria-label="Open menu"
      >
        <Menu size={24} aria-hidden />
      </button>

      {mobileOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="app-mobile-nav"
            className="fixed bottom-0 left-0 top-0 z-50 flex w-[min(21rem,90vw)] flex-col border-r border-app-border/90 bg-app-bg/92 shadow-app-glow backdrop-blur-xl md:hidden"
          >
            <div className="flex items-center justify-between border-b border-app-border/80 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-app-md bg-gradient-to-br from-app-accent to-cyan-500">
                  <BookOpen size={18} className="text-white" aria-hidden />
                </div>
                <span className="text-sm font-semibold tracking-wide text-app-text">
                  CommsLib
                </span>
              </div>
              <button
                type="button"
                className="rounded-app-md p-2 text-app-muted hover:bg-app-surface-hover hover:text-app-text"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{mobileNav}</div>
          </aside>
        </>
      ) : null}
    </>
  );
}
