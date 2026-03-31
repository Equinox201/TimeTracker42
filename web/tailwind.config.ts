import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tt42: {
          magenta: "var(--tt42-magenta)",
          mint: "var(--tt42-mint)",
          teal: "var(--tt42-teal)",
          bg: "var(--tt42-bg)",
          surface: "var(--tt42-surface)",
          surface2: "var(--tt42-surface-2)",
          text: "var(--tt42-text)",
          muted: "var(--tt42-text-muted)",
          border: "var(--tt42-border)",
          success: "var(--tt42-success)",
          danger: "var(--tt42-danger)"
        }
      },
      boxShadow: {
        soft: "0 12px 32px rgba(0, 0, 0, 0.24)",
        ring: "0 0 24px rgba(255, 15, 138, 0.20)"
      },
      borderRadius: {
        card: "18px"
      }
    }
  },
  plugins: []
} satisfies Config;
