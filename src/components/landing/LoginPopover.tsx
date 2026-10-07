"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Logo } from "@/components/ui";
import LoginForm from "@/components/LoginForm";

// Karta logowania rozwijana z klikniętego przycisku „Zaloguj się”, w tym samym miejscu ekranu.
// Przycisk na czas otwarcia znika, a karta jest odsłaniana przez clip-path: wycięcie startuje w kształcie
// przycisku (w jego kolorze) i rośnie do pełnej karty. Bez scale(), więc rogi przez cały czas zostają
// zaokrąglone, a treść się nie rozciąga. Przy zamknięciu wycięcie wraca do przycisku.
// Stan siedzi w adresie (/?login), więc przekierowanie z middleware (/?login&from=/games) też otwiera
// kartę — wtedy z przycisku w belce. history.pushState zamiast router.push: Next synchronizuje
// useSearchParams bez zapytania do serwera.

let originEl: HTMLElement | null = null;

export function openLogin(from?: HTMLElement) {
  originEl = from ?? null;
  window.history.pushState(null, "", "/?login");
}

export function LoginButton({ className, children, header = false }: { className?: string; children: React.ReactNode; header?: boolean }) {
  return (
    <a
      href="/?login"
      data-login-trigger={header ? "header" : ""}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        openLogin(e.currentTarget);
      }}
    >
      {children}
    </a>
  );
}

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const GUTTER = 16;

// Ustawia kartę przy przycisku: przy prawej krawędzi wyrównana do jego prawego boku, gdzie indziej
// wyśrodkowana na nim; górna krawędź na wysokości przycisku, ale tak, żeby karta mieściła się w oknie.
function place(card: HTMLElement, o: DOMRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const center = o.left + o.width / 2;
  let left = center > vw * 0.66 ? o.right - w : center - w / 2;
  left = Math.min(Math.max(left, GUTTER), vw - GUTTER - w);
  const top = Math.max(GUTTER, Math.min(o.top, vh - GUTTER - h));
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  return { left, top, w, h };
}

const OPEN_CLIP = "inset(0px 0px 0px 0px round 16px)";

// Wycięcie karty dokładnie w miejscu i kształcie przycisku
function buttonClip(o: DOMRect, r: { left: number; top: number; w: number; h: number }, radius: string) {
  const top = Math.max(0, o.top - r.top);
  const left = Math.max(0, o.left - r.left);
  const right = Math.max(0, r.left + r.w - o.right);
  const bottom = Math.max(0, r.top + r.h - o.bottom);
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius})`;
}

export default function LoginPopover() {
  const params = useSearchParams();
  const open = params.has("login");
  const from = params.get("from");
  const [shown, setShown] = useState(open);
  const cardRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const collapsedClip = useRef<string | null>(null);

  function close() {
    window.history.replaceState(null, "", "/");
  }

  if (open && !shown) setShown(true);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const shell = shellRef.current;
    const tint = tintRef.current;
    const content = contentRef.current;
    if (!shown || !card || !shell || !tint || !content) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduced ? 0 : 460;

    if (open) {
      // Bez klikniętego przycisku (np. po przekierowaniu) karta wyrasta z przycisku w belce
      if (!originEl || !originEl.isConnected) originEl = document.querySelector<HTMLElement>('[data-login-trigger="header"]');
      const o = originEl?.getBoundingClientRect();
      if (!o) {
        card.style.left = `calc(50% - ${card.offsetWidth / 2}px)`;
        card.style.top = "96px";
        return;
      }
      const r = place(card, o);
      const clip = (collapsedClip.current = buttonClip(o, r, getComputedStyle(originEl!).borderRadius || "12px"));
      shell.style.transition = "none";
      shell.style.clipPath = clip;
      tint.style.transition = "none";
      tint.style.opacity = "1";
      content.style.transition = "none";
      content.style.opacity = "0";
      void shell.offsetWidth; // wymusza stan początkowy przed przejściem
      originEl!.style.visibility = "hidden";

      shell.style.transition = `clip-path ${dur}ms ${EASE}`;
      shell.style.clipPath = OPEN_CLIP;
      tint.style.transition = `opacity ${dur * 0.6}ms ease-out ${dur * 0.15}ms`;
      tint.style.opacity = "0";
      content.style.transition = `opacity ${dur / 2}ms ease-out ${dur * 0.5}ms`;
      content.style.opacity = "1";
      const t = window.setTimeout(() => inputRef.current?.focus(), dur * 0.6);
      return () => window.clearTimeout(t);
    }

    // Zamknięcie: treść gaśnie, karta zwija się w przycisk, przycisk wraca
    const o = originEl?.getBoundingClientRect();
    content.style.transition = `opacity ${dur / 4}ms ease-in`;
    content.style.opacity = "0";
    if (o && collapsedClip.current) {
      tint.style.transition = `opacity ${dur / 2}ms ease-in ${dur * 0.15}ms`;
      tint.style.opacity = "1";
      shell.style.transition = `clip-path ${dur * 0.8}ms ${EASE}`;
      shell.style.clipPath = collapsedClip.current;
    }
    const t = window.setTimeout(() => {
      if (originEl) originEl.style.visibility = "";
      originEl = null;
      setShown(false);
    }, o ? dur * 0.8 : 0);
    return () => window.clearTimeout(t);
  }, [open, shown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    // Przycisk-źródło nie przesuwa się razem z kartą, więc na czas otwarcia strona stoi w miejscu
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    html.style.paddingRight = scrollbar ? `${scrollbar}px` : "";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = "";
      html.style.paddingRight = "";
    };
  }, [open]);

  if (!shown) return null;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!open}>
      {/* Przezroczysta warstwa: klik obok karty ją zamyka, strona zostaje widoczna */}
      <div onClick={close} className="absolute inset-0" />
      {/* Cień jako drop-shadow na zewnętrznym elemencie — clip-path na karcie by go uciął */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="absolute w-[min(22rem,calc(100vw-2rem))] [filter:drop-shadow(0_20px_32px_rgba(0,0,0,0.55))]"
      >
        <div ref={shellRef} className="relative overflow-hidden rounded-2xl border border-line bg-panel" style={{ clipPath: OPEN_CLIP }}>
          {/* Kolor przycisku, który przechodzi w kartę */}
          <div
            ref={tintRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 opacity-0"
            style={{ background: "linear-gradient(135deg, var(--btn-from), var(--btn-to))" }}
          />
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-felt/15 blur-3xl" />

          <div ref={contentRef} className="relative p-6">
            <div className="mb-5 flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <Logo size={68} />
                <h2 id="login-title" className="font-display text-lg font-extrabold tracking-tight">
                  Witaj przy stole
                </h2>
              </span>
              <button
                onClick={close}
                className="-mr-2 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-panel2 hover:text-cream"
                aria-label="Zamknij"
              >
                <X size={17} />
              </button>
            </div>
            {from && <p className="-mt-2 mb-4 text-sm text-muted">Zaloguj się, żeby przejść dalej.</p>}
            <LoginForm ref={inputRef} from={from} />
          </div>
        </div>
      </div>
    </div>
  );
}
