import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, Menu, Settings, X } from 'lucide-react';
import { navCategories, type NavCategory, type NavItem } from '../constants/navigation';
import { getNavIcon } from '../lib/navIcons';
import { useAuth } from '../context/AuthContext';
import { isGlobalAdmin } from '../lib/userRole';

function filterNavForRole(categories: NavCategory[], isAdmin: boolean): NavCategory[] {
  return categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item: NavItem) => item.path !== '/admin' || isAdmin),
    }))
    .filter((cat) => cat.items.length > 0);
}

function isActivePath(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) return true;
  if (itemPath === '/dashboard') return pathname.startsWith('/dashboard');
  if (itemPath === '/library') return pathname.startsWith('/library');
  if (itemPath === '/templates') return pathname.startsWith('/templates');
  if (itemPath === '/review')
    return pathname.startsWith('/review') || pathname.startsWith('/history');
  if (itemPath === '/my-content') return pathname.startsWith('/my-content');
  if (itemPath === '/assets') return pathname.startsWith('/assets');
  if (itemPath === '/analytics') return pathname.startsWith('/analytics');
  if (itemPath === '/ai-tutor') return pathname.startsWith('/ai-tutor');
  if (itemPath === '/profile') return pathname.startsWith('/profile');
  if (itemPath === '/admin') return pathname.startsWith('/admin');
  return pathname.startsWith(`${itemPath}/`);
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const visibleNav = filterNavForRole(navCategories, isGlobalAdmin(user?.role));
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  /** Close flyout menus when the route changes so the sidebar does not stay “stuck” open. */
  useEffect(() => {
    setOpenDropdown(null);
  }, [pathname]);

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const iconSlotBase =
    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-[transform,box-shadow,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none';
  const iconSlotIdle =
    'border border-transparent bg-transparent text-app-muted hover:-translate-y-0.5 hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-app-accent hover:shadow-[0_0_32px_-10px_rgba(147,124,248,0.5)] motion-reduce:hover:translate-y-0 active:translate-y-0';
  const iconSlotActive =
    'border border-app-accent/30 bg-gradient-to-br from-app-accent-muted via-white/[0.05] to-app-accent-2/[0.12] text-app-accent-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1px_rgba(147,124,248,0.35),0_14px_44px_-18px_rgba(147,124,248,0.55)] motion-reduce:translate-y-0';

  const iconClass =
    '[&>svg]:transition-transform [&>svg]:duration-300 [&>svg]:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:[&>svg]:transition-none';
  const iconClassHover =
    'group-hover:[&>svg]:scale-110 motion-reduce:group-hover:[&>svg]:scale-100';

  const activeRail = (
    <span
      className="pointer-events-none absolute left-0.5 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-app-accent via-app-accent-hover to-app-accent-2 shadow-[0_0_18px_rgba(147,124,248,0.85)]"
      aria-hidden
    />
  );

  const rail = (
    <div className="relative z-10 flex h-full flex-col">
      <div className="flex items-center justify-center px-2 pb-1 pt-5">
        <div
          className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-app-accent via-violet-500 to-app-accent-2 shadow-[0_12px_40px_-10px_rgba(147,124,248,0.65),inset_0_1px_0_rgba(255,255,255,0.22)] ring-1 ring-white/15 transition-[transform,box-shadow] duration-300 ease-out motion-reduce:transition-none group-hover/sidebar:shadow-[0_16px_48px_-10px_rgba(147,124,248,0.75),inset_0_1px_0_rgba(255,255,255,0.25)]"
          title="CommsLib"
        >
          <span
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.35),transparent_55%)]"
            aria-hidden
          />
          <BookOpen size={20} className="relative text-white drop-shadow-sm" aria-hidden />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-2 pb-2 pt-1">
        {visibleNav.map((cat) => {
          const isSingle = cat.items.length === 1;
          const isOpen = openDropdown === cat.label;
          const icon = getNavIcon(cat);

          if (isSingle) {
            const item = cat.items[0];
            const active = isActivePath(pathname, item.path);
            return (
              <Link
                key={cat.label}
                to={item.path}
                title={item.label}
                className={`group ${iconSlotBase} ${iconSlotIdle} focus-visible:outline-offset-2 ${
                  active ? iconSlotActive : ''
                }`}
              >
                {active ? activeRail : null}
                <span className={`${iconClass} ${iconClassHover} [&_svg]:text-[1.35rem]`}>
                  {icon}
                </span>
              </Link>
            );
          }

          return (
            <div
              key={cat.label}
              className="relative"
              onMouseEnter={() => setOpenDropdown(cat.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="true"
                onClick={() => setOpenDropdown(isOpen ? null : cat.label)}
                title={cat.label}
                className={`group ${iconSlotBase} w-full ${iconSlotIdle} focus-visible:outline-offset-2 ${
                  isOpen ? iconSlotActive : ''
                }`}
              >
                {isOpen ? activeRail : null}
                <span className={`${iconClass} ${iconClassHover} [&_svg]:text-[1.35rem]`}>
                  {icon}
                </span>
              </button>
              {isOpen && (
                <div className="absolute left-full top-0 z-40 flex max-h-[min(24rem,calc(100vh-4rem))] min-h-[2.75rem] items-stretch">
                  {/* Invisible bridge so the cursor can cross the gap without closing the menu */}
                  <span className="w-2 shrink-0" aria-hidden />
                  <div
                    role="menu"
                    className="animate-fade-in min-w-[13.5rem] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-app-bg/70 py-1.5 shadow-[0_28px_72px_-16px_rgba(0,0,0,0.55),0_0_0_1px_rgba(147,124,248,0.1),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl motion-reduce:animate-none"
                  >
                    {cat.items.map((item) => {
                      const active = isActivePath(pathname, item.path);
                      return (
                        <Link
                          key={item.path}
                          role="menuitem"
                          to={item.path}
                          onClick={() => setOpenDropdown(null)}
                          className={`relative mx-1 block rounded-xl px-3 py-2.5 pl-3.5 text-sm transition-[transform,background-color,color,box-shadow] duration-200 ease-out hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-app-text motion-reduce:hover:translate-x-0 ${
                            active
                              ? "bg-gradient-to-r from-app-accent-muted/90 to-transparent font-medium text-app-accent-hover shadow-[inset_0_0_0_1px_rgba(147,124,248,0.12)] before:absolute before:left-1.5 before:top-1/2 before:h-6 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-gradient-to-b before:from-app-accent before:to-app-accent-2 before:shadow-[0_0_12px_rgba(147,124,248,0.75)] before:content-['']"
                              : 'text-app-muted'
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="relative border-t border-white/[0.07] px-2 py-3 before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-app-accent/30 before:to-transparent before:content-['']">
        {/* <Link
          to={isGlobalAdmin(user?.role) ? "/admin" : "/profile"}
          title="Settings"
          className={`group ${iconSlotBase} ${iconSlotIdle} mb-1 w-full text-app-faint hover:text-app-text focus-visible:outline-offset-2`}
        >
          <span className={`${iconClass} ${iconClassHover} [&_svg]:text-[1.35rem]`}>
            <Settings aria-hidden />
          </span>
        </Link> */}
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
      {visibleNav.map((cat) => (
        <div key={cat.label} className="mb-2">
          <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-faint/90">
            {cat.label}
          </div>
          <div className="flex flex-col gap-1">
            {cat.items.map((item) => {
              const active = isActivePath(pathname, item.path);
              return (
                <Link
                  key={`${cat.label}-${item.path}`}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`relative overflow-hidden rounded-xl px-3 py-2.5 pl-3.5 text-sm font-medium transition-[transform,background-color,color,box-shadow] duration-200 ease-out before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:opacity-0 before:transition-opacity before:duration-200 before:content-[''] motion-reduce:transition-none ${
                    active
                      ? 'translate-x-0 bg-gradient-to-r from-app-accent-muted/90 to-white/[0.03] text-app-accent-hover shadow-[inset_0_0_0_1px_rgba(147,124,248,0.15),0_8px_28px_-14px_rgba(147,124,248,0.45)] before:bg-gradient-to-b before:from-app-accent before:to-app-accent-2 before:opacity-100 before:shadow-[0_0_14px_rgba(147,124,248,0.8)]'
                      : 'text-app-muted hover:translate-x-0.5 hover:bg-white/[0.05] hover:text-app-text motion-reduce:hover:translate-x-0'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setMobileOpen(false);
          navigate(isGlobalAdmin(user?.role) ? '/admin' : '/profile');
        }}
        className="mt-2 flex items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-app-muted transition-[transform,background-color,color,border-color] duration-200 hover:translate-x-0.5 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-app-text motion-reduce:hover:translate-x-0"
      >
        <Settings size={18} aria-hidden />
        Settings
      </button>
      <button
        type="button"
        onClick={() => {
          handleLogout();
          setMobileOpen(false);
        }}
        className="mt-4 flex items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm font-medium text-red-300/95 transition-[transform,background-color,border-color] duration-200 hover:translate-x-0.5 hover:border-red-400/20 hover:bg-red-500/10 motion-reduce:hover:translate-x-0"
      >
        <LogOut size={18} aria-hidden />
        Log out
      </button>
    </nav>
  );

  return (
    <>
      <aside
        className="group/sidebar fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col border-r border-white/[0.08] bg-app-bg/40 shadow-[4px_0_48px_-12px_rgba(0,0,0,0.55),inset_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-2xl supports-[backdrop-filter]:bg-app-bg/30 md:flex"
        aria-label="Primary"
      >
        {/* overflow-hidden only here so flyouts (absolute left-full) stay unclipped on the aside */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] via-transparent to-transparent" />
          <div className="absolute -left-14 top-[10%] h-52 w-36 rounded-full bg-app-accent/12 blur-3xl" />
          <div className="absolute bottom-[15%] -left-10 h-40 w-36 rounded-full bg-app-accent-2/10 blur-3xl" />
        </div>
        {rail}
      </aside>

      <button
        type="button"
        className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-app-bg/55 text-app-text shadow-[0_10px_40px_-10px_rgba(0,0,0,0.55),0_0_0_1px_rgba(147,124,248,0.12),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-300 ease-out hover:scale-105 hover:border-app-accent/35 hover:shadow-[0_14px_48px_-10px_rgba(147,124,248,0.35)] active:scale-95 motion-reduce:transition-none md:hidden"
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
            className="fixed inset-0 z-40 bg-[radial-gradient(ellipse_at_bottom_left,rgba(147,124,248,0.12),transparent_50%),radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.08),transparent_45%),rgba(0,0,0,0.62)] backdrop-blur-md md:hidden"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="app-mobile-nav"
            className="fixed bottom-0 left-0 top-0 z-50 flex w-[min(21rem,90vw)] flex-col overflow-hidden border-r border-white/10 bg-app-bg/65 shadow-[8px_0_64px_-20px_rgba(0,0,0,0.6),inset_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-2xl md:hidden"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-app-accent/[0.08] to-transparent"
              aria-hidden
            />
            <div className="relative z-10 flex items-center justify-between border-b border-white/[0.08] px-4 py-4">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-app-accent via-violet-500 to-app-accent-2 shadow-[0_8px_28px_-8px_rgba(147,124,248,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/15">
                  <span
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_12%,rgba(255,255,255,0.4),transparent_50%)]"
                    aria-hidden
                  />
                  <BookOpen size={18} className="relative text-white drop-shadow" aria-hidden />
                </div>
                <span className="text-sm font-semibold tracking-wide text-app-text">CommsLib</span>
              </div>
              <button
                type="button"
                className="rounded-xl border border-transparent p-2 text-app-muted transition-[transform,background-color,color,border-color] duration-200 hover:border-white/10 hover:bg-white/[0.06] hover:text-app-text active:scale-95"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="relative z-10 flex-1 overflow-y-auto">{mobileNav}</div>
          </aside>
        </>
      ) : null}
    </>
  );
}
