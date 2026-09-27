import type { Config } from "tailwindcss";

// Kolory pochodzą ze zmiennych CSS (globals.css: :root = ciemny, html.light = jasny),
// kanały RGB pozwalają działać modyfikatorom przezroczystości (np. bg-panel/40).
const c = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: c("ink"),
        surface: c("surface"),
        panel: c("panel"),
        panel2: c("panel2"),
        panel3: c("panel3"),
        line: c("line"),
        felt: {
          DEFAULT: c("felt"),
          dark: c("felt-dark"),
          soft: c("felt-soft"),
        },
        gold: {
          DEFAULT: c("gold"),
          dark: c("gold-dark"),
          soft: c("gold-soft"),
        },
        cream: c("cream"),
        muted: c("muted"),
        danger: c("danger"),
        // Tekst na akcentach (felt/gold) — ciemny w obu motywach
        onaccent: "#0D1117",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        "panel-sm": "var(--shadow-panel-sm)",
        "glow-felt": "0 0 28px -4px rgb(var(--c-felt) / 0.35)",
        "glow-gold": "0 0 28px -4px rgb(var(--c-gold) / 0.30)",
      },
    },
  },
  plugins: [],
};

export default config;
