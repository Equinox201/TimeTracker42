import { NavLink } from "react-router-dom";

type Tab = {
  to: string;
  label: string;
  icon: string;
};

const tabs: Tab[] = [
  { to: "/app/main", label: "Main", icon: "◉" },
  { to: "/app/history", label: "History", icon: "▥" },
  { to: "/app/settings", label: "Settings", icon: "⚙" }
];

export function TabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-tt42-border bg-tt42-surface/95 px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:left-1/2 md:w-[520px] md:-translate-x-1/2 md:rounded-t-card md:border md:border-b-0">
      <ul className="grid grid-cols-3 gap-2">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                [
                  "flex h-12 flex-col items-center justify-center rounded-xl border text-xs transition",
                  isActive
                    ? "border-tt42-magenta/60 bg-tt42-magenta/15 text-tt42-text shadow-ring"
                    : "border-transparent text-tt42-muted hover:border-tt42-border hover:bg-tt42-surface2"
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
