"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const root = document.documentElement;
    const next = !light;
    root.classList.add("theme-transition");
    root.classList.toggle("light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {}
    setLight(next);
    window.setTimeout(() => root.classList.remove("theme-transition"), 350);
  }

  return (
    <button
      onClick={toggle}
      className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-line/60 bg-panel/40 text-muted transition hover:border-line hover:bg-panel2 hover:text-cream ${className}`}
      aria-label={light ? "Włącz tryb ciemny" : "Włącz tryb jasny"}
      title={light ? "Tryb ciemny" : "Tryb jasny"}
    >
      <Sun
        size={17}
        className={`absolute transition-all duration-500 ${light ? "rotate-0 scale-100 opacity-100 text-gold" : "-rotate-90 scale-0 opacity-0"}`}
      />
      <Moon
        size={17}
        className={`absolute transition-all duration-500 ${light ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      />
    </button>
  );
}
