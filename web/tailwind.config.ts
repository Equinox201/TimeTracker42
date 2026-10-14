import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tt42: {
          accent: "rgb(var(--tt42-accent-rgb) / <alpha-value>)",
          "on-accent": "rgb(var(--tt42-on-accent-rgb) / <alpha-value>)",
          warn: "rgb(var(--tt42-warn-rgb) / <alpha-value>)",
          danger: "rgb(var(--tt42-danger-rgb) / <alpha-value>)",
          bg: "rgb(var(--tt42-bg-rgb) / <alpha-value>)",
          surface: "rgb(var(--tt42-surface-rgb) / <alpha-value>)",
          surface2: "rgb(var(--tt42-surface-2-rgb) / <alpha-value>)",
          text: "rgb(var(--tt42-text-rgb) / <alpha-value>)",
          muted: "rgb(var(--tt42-text-muted-rgb) / <alpha-value>)",
          border: "rgb(var(--tt42-border-rgb) / <alpha-value>)"
        }
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Inter Fallback"', "Inter", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "system-ui", "sans-serif"]
      },
      boxShadow: {
        float: "0 8px 24px rgba(0, 0, 0, 0.18)"
      },
      borderRadius: {
        card: "16px"
      }
    }
  },
  plugins: []
} satisfies Config;
