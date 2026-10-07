"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { id: "funkcje", label: "Możliwości" },
  { id: "ekrany", label: "Widoki" },
  { id: "liga", label: "League of Legends" },
  { id: "przygoda", label: "Przygoda RPG" },
  { id: "jak", label: "Jak zacząć" },
];

// Linki belki landingu z podświetleniem sekcji, w której jesteśmy (scroll-spy).
// Aktywna jest sekcja, przez którą przechodzi linia na 40% wysokości okna; w hero i w CTA żadna.
export default function LandingNav() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const { id } of LINKS) {
        const r = document.getElementById(id)?.getBoundingClientRect();
        if (r && r.top <= line && r.bottom > line) current = id;
      }
      setActive(current);
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  function go(e: React.MouseEvent, id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="ml-6 hidden items-center gap-1 whitespace-nowrap text-sm lg:flex">
      {LINKS.map(({ id, label }) => {
        const on = active === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => go(e, id)}
            aria-current={on ? "true" : undefined}
            className={`relative rounded-lg px-3 py-1.5 transition ${
              on ? "bg-panel2 text-cream" : "text-muted hover:bg-panel2 hover:text-cream"
            }`}
          >
            {label}
            {/* Kreska pod aktywnym linkiem, jak w belce aplikacji */}
            <span
              aria-hidden
              className={`absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-felt transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}
            />
          </a>
        );
      })}
    </div>
  );
}
