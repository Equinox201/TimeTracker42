import { NavLink } from "react-router-dom";

import { navTabs } from "./tabs";

// Left rail for md and up: wordmark and navigation, so desktop is not a stretched phone layout.
export function SideNav() {
  return (
    <aside className="sticky top-0 hidden h-screen flex-col border-r border-tt42-border px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <span
          aria-hidden
          className="grid h-8 w-8 place-items-center rounded-lg bg-tt42-accent text-[13px] font-bold tracking-tight text-tt42-on-accent"
        >
          42
        </span>
        <span className="text-base font-semibold tracking-tight">TimeTracker</span>
      </div>

      <nav aria-label="Primary">
        <ul className="space-y-1">
          {navTabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  [
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                    isActive
                      ? "bg-tt42-accent/15 text-tt42-accent"
                      : "text-tt42-muted hover:bg-tt42-surface2 hover:text-tt42-text"
                  ].join(" ")
                }
              >
                <span aria-hidden className="w-4 text-center text-sm leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
