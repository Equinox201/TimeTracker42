import { NavLink } from "react-router-dom";

import { navTabs } from "./tabs";

// Bottom navigation for phones. From md up the SideNav takes over.
export function TabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-tt42-border bg-tt42-surface/90 px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4 gap-2">
        {navTabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                [
                  "flex h-12 flex-col items-center justify-center rounded-xl text-xs font-medium transition",
                  isActive
                    ? "bg-tt42-accent/15 text-tt42-accent"
                    : "text-tt42-muted hover:bg-tt42-surface2 hover:text-tt42-text"
                ].join(" ")
              }
            >
              <span className="text-sm leading-none">{tab.icon}</span>
              <span className="mt-1">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
