import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { navCategories } from "../constants/navigation";
import { getNavIcon } from "../lib/navIcons";

export default function Sidebar() {
  const { pathname } = useLocation();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
                className={`flex h-12 w-full items-center justify-center transition-colors hover:bg-gray-800 hover:text-white ${
                  active ? "bg-gray-800 text-white" : ""
                }`}
              >
                <span className="[&>.MuiSvgIcon-root]:text-2xl">{icon}</span>
              </Link>
            );
          }

          return (
            <div key={cat.label} className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(isOpen ? null : cat.label)}
                title={cat.label}
                className={`flex h-12 w-full items-center justify-center transition-colors hover:bg-gray-800 hover:text-white ${
                  isOpen ? "bg-gray-800 text-white" : ""
                }`}
              >
                <span className="[&>.MuiSvgIcon-root]:text-2xl">{icon}</span>
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
    </aside>
  );
}
