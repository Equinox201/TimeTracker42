export type NavTab = {
  to: string;
  label: string;
  icon: string;
};

export const navTabs: NavTab[] = [
  { to: "/app/main", label: "Main", icon: "◉" },
  { to: "/app/history", label: "History", icon: "▥" },
  { to: "/app/plan", label: "Plan", icon: "◇" },
  { to: "/app/settings", label: "Settings", icon: "⚙" }
];
