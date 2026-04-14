import { useState, useRef, useEffect, type ElementType } from "react";
import { Users, Shield, Activity, Settings, LayoutDashboard, LogOut, ChevronLeft } from "lucide-react";

export type AdminTab = "users" | "roles" | "monitoring" | "settings";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

const navItems: {
  id: AdminTab;
  label: string;
  icon: ElementType;
}[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "roles", label: "Roles & Groups", icon: Shield },
  { id: "monitoring", label: "Monitoring", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

function getMonogram(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [showUserPopover, setShowUserPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [indicatorTop, setIndicatorTop] = useState(0);

  // Calculate active indicator position
  useEffect(() => {
    if (navRef.current) {
      const idx = navItems.findIndex((item) => item.id === activeTab);
      // Each button is ~44px tall, starting after some padding
      setIndicatorTop(idx * 44);
    }
  }, [activeTab]);

  // Close popover on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowUserPopover(false);
      }
    };
    if (showUserPopover) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showUserPopover]);

  return (
    <aside
      className="admin-noise hidden md:flex flex-col shrink-0 border-r border-app-border bg-app-bg-subtle overflow-hidden"
      style={{
        width: expanded ? 220 : 64,
        transition: "width 200ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => {
        setExpanded(false);
        setShowUserPopover(false);
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-4 border-b border-app-border relative z-[1]"
        style={{ minHeight: 56 }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 admin-glass">
          <LayoutDashboard size={16} className="text-app-accent" />
        </div>
        <span
          className="text-[13px] font-semibold tracking-wide text-app-accent whitespace-nowrap overflow-hidden"
          style={{
            opacity: expanded ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
        >
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        className="flex-1 flex flex-col gap-0.5 p-2 relative z-[1]"
        aria-label="Admin sections"
      >
        {/* Active indicator bar */}
        <div
          className="absolute left-0 w-[3px] rounded-r-full bg-app-accent"
          style={{
            top: `calc(${indicatorTop}px + 8px + 10px)`,
            height: 24,
            transition: "top 250ms cubic-bezier(0.22, 1, 0.36, 1)",
            boxShadow: "0 0 8px rgba(147, 124, 248, 0.4)",
          }}
        />

        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              className={`flex items-center gap-2.5 rounded-lg border-none p-2.5 text-left transition-all duration-150 admin-btn-lift ${
                isActive
                  ? "bg-app-accent-muted text-app-accent-hover"
                  : "bg-transparent text-app-muted hover:bg-app-surface-hover hover:text-app-text"
              }`}
              style={{ height: 44 }}
              onClick={() => onTabChange(id)}
              title={expanded ? undefined : label}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isActive ? "bg-app-accent/20" : "bg-transparent"
                }`}
              >
                <Icon size={18} aria-hidden />
              </div>
              <span
                className="text-[13px] font-medium whitespace-nowrap overflow-hidden"
                style={{
                  opacity: expanded ? 1 : 0,
                  width: expanded ? "auto" : 0,
                  transition: "opacity 200ms ease",
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Back to Dashboard link */}
      <div className="px-2 pb-1 relative z-[1]">
        <a
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg p-2.5 text-app-faint hover:text-app-muted hover:bg-app-surface-hover no-underline transition-colors duration-150"
          style={{ height: 44 }}
          title={expanded ? undefined : "Back to Dashboard"}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center">
            <ChevronLeft size={16} aria-hidden />
          </div>
          <span
            className="text-[12px] font-medium whitespace-nowrap overflow-hidden"
            style={{
              opacity: expanded ? 1 : 0,
              width: expanded ? "auto" : 0,
              transition: "opacity 200ms ease",
            }}
          >
            Dashboard
          </span>
        </a>
      </div>

      {/* User area */}
      <div className="border-t border-app-border px-2 py-2 relative z-[1]" ref={popoverRef}>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full rounded-lg border-none p-2 bg-transparent text-left transition-colors duration-150 hover:bg-app-surface-hover"
          onClick={() => setShowUserPopover((v) => !v)}
          title={expanded ? undefined : "Admin User"}
        >
          {/* Glassy monogram badge */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-app-text admin-glass"
            style={{ letterSpacing: "0.5px" }}
          >
            {getMonogram("Admin User")}
          </div>
          <div
            className="flex-1 min-w-0 overflow-hidden"
            style={{
              opacity: expanded ? 1 : 0,
              width: expanded ? "auto" : 0,
              transition: "opacity 200ms ease",
            }}
          >
            <span className="block text-[13px] font-medium text-app-text truncate">
              Admin User
            </span>
            <span className="block text-[11px] text-app-faint truncate">
              admin@example.com
            </span>
          </div>
        </button>

        {/* Popover */}
        {showUserPopover && expanded && (
          <div className="absolute bottom-full left-2 right-2 mb-1 admin-glass rounded-lg p-1 shadow-app-soft admin-modal-enter">
            <button
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2 bg-transparent border-none rounded-md text-app-muted text-[13px] text-left transition-colors duration-100 hover:bg-app-surface-hover hover:text-red-400"
              onClick={() => {
                setShowUserPopover(false);
              }}
            >
              <LogOut size={14} />
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
