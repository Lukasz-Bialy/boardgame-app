import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13151A",
        panel: "#1B1E26",
        panel2: "#232732",
        line: "#2C313D",
        felt: {
          DEFAULT: "#34A578",
          dark: "#2A8862",
          soft: "#15392E",
        },
        gold: {
          DEFAULT: "#E8B04B",
          dark: "#C8943A",
        },
        cream: "#ECEEF2",
        muted: "#9AA2B1",
        danger: "#E5564B",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 30px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
