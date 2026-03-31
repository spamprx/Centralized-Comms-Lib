import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { navCategories } from "../constants/navigation";
import { getNavIcon } from "../lib/navIcons";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const iconSlotBase =
    "flex h-12 w-full items-center justify-center rounded-md transition-colors";
  // Keep icon color consistent (brand blue) across all icons.
  const iconSlotIdle = "bg-transparent text-indigo-400";
  const iconSlotHover = "hover:bg-gray-800/70 hover:text-indigo-300";
  const iconSlotActive = "bg-gray-800 text-indigo-300";

  const iconClass =
    "[&>svg]:text-indigo-400 [&>svg]:transition-colors";
  const iconClassHover =
    "group-hover:[&>svg]:text-indigo-300";
  const iconClassActive =
    "[&>svg]:text-indigo-300";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-14 flex-col border-r border-gray-700 bg-gray-900 text-gray-300">
      <div className="flex flex-1 flex-col gap-1 py-3">
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
                className={`${iconSlotBase} ${iconSlotIdle} ${iconSlotHover} ${active ? iconSlotActive : ""}`}
              >
                <span
                  className={`group ${iconClass} ${iconClassHover} ${active ? iconClassActive : ""} [&_svg]:text-2xl`}
                >
                  {icon}
                </span>
              </Link>
            );
          }

          return (
            <div key={cat.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(isOpen ? null : cat.label)}
                title={cat.label}
                className={`${iconSlotBase} ${iconSlotIdle} ${iconSlotHover} ${isOpen ? iconSlotActive : ""}`}
              >
                <span
                  className={`group ${iconClass} ${iconClassHover} ${isOpen ? iconClassActive : ""} [&_svg]:text-2xl`}
                >
                  {icon}
                </span>
              </button>
              {isOpen && (
                <>
                  <div
                    className="fixed inset-0 z-0"
                    aria-hidden
                    onClick={() => setOpenDropdown(null)}
                  />
                  <div className="absolute left-full top-0 z-10 ml-0 min-w-[11rem] rounded-r-md border border-gray-700 bg-gray-800 py-1 shadow-lg">
                    {cat.items.map((item) => {
                      const active = pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setOpenDropdown(null)}
                          className={`block px-4 py-2 text-sm transition-colors hover:bg-gray-700 hover:text-white ${
                            active ? "bg-gray-700 text-white" : ""
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
      <div className="py-3 border-t border-gray-700">
        <button
          onClick={handleLogout}
          title="Logout"
          className={`${iconSlotBase} ${iconSlotIdle} ${iconSlotHover}`}
        >
          <span className={`group ${iconClass} ${iconClassHover} [&_svg]:text-2xl`}>
            <LogOut />
          </span>
        </button>
      </div>
    </aside>
  );
}
