import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0D1117",
        surface: "#090C18",
        panel: "#161E30",
        panel2: "#1E2740",
        panel3: "#263055",
        line: "#263355",
        felt: {
          DEFAULT: "#2ECC8A",
          dark: "#24A870",
          soft: "#0D2820",
        },
        gold: {
          DEFAULT: "#F0B42A",
          dark: "#C8901F",
          soft: "#2A1E08",
        },
        cream: "#E5DFD2",
        muted: "#6B7D9C",
        danger: "#E5534A",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel:
          "0 0 0 1px rgba(255,255,255,0.045) inset, 0 1px 0 0 rgba(80,160,255,0.06) inset, 0 20px 60px -16px rgba(0,0,0,0.85)",
        "panel-sm": "0 4px 20px -4px rgba(0,0,0,0.65)",
        "glow-felt": "0 0 28px -4px rgba(46,204,138,0.35)",
        "glow-gold": "0 0 28px -4px rgba(240,180,41,0.30)",
      },
    },
  },
  plugins: [],
};

export default config;
