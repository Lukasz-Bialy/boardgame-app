"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Dices,
  History,
  Vote,
  CalendarDays,
  Heart,
  LogOut,
  Menu,
  X,
  Shuffle,
  UtensilsCrossed,
  ChevronDown,
} from "lucide-react";
import { Avatar } from "@/components/ui";
import SleighIcon from "@/components/SleighIcon";
import ThemeToggle from "@/components/ThemeToggle";
import type { Session } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  match?: string; // prefiks ścieżki podświetlający link (domyślnie href)
  festive?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Pulpit", icon: LayoutDashboard },
  { href: "/games", label: "Kolekcja gier", icon: Dices },
  { href: "/history", label: "Moja historia", icon: History },
  { href: "/polls", label: "Ankiety", icon: Vote },
  { href: "/calendar", label: "Kalendarz", icon: CalendarDays },
  { href: "/wishlist", label: "Wishlista", icon: Heart },
  { href: "/draw", label: "Losowanie", icon: Shuffle },
  { href: "/kebab", label: "Kącik kebabowy", icon: UtensilsCrossed },
  { href: "/swieta/prezenty", match: "/swieta", label: "Święta", icon: SleighIcon, festive: true },
];

function isActive(pathname: string, item: NavItem) {
  const base = item.match ?? item.href;
  return pathname === base || pathname.startsWith(base + "/");
}

function NavIcon({ item }: { item: NavItem }) {
  const Icon = item.icon;
  if (!item.festive) return <Icon size={17} />;
  return (
    <span className="xmas-icon">
      <Icon size={17} className="xmas-sleigh" />
      <span className="xmas-trail" aria-hidden />
    </span>
  );
}

function Snow() {
  return (
    <span className="xmas-snow" aria-hidden>
      <i>❄</i><i>✦</i><i>❅</i><i>✧</i><i>❄</i><i>✦</i>
    </span>
  );
}

/* ─── Menu użytkownika ────────────────────────────────────────────────────── */

function UserMenu({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition ${
          open ? "border-felt/50 bg-panel2" : "border-line/60 bg-panel/40 hover:border-line hover:bg-panel2/70"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar username={session.username} size={30} />
        <span className="hidden text-sm font-semibold text-cream xl:inline">{session.displayName}</span>
        <ChevronDown size={14} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="nav-pop absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-panel/95 shadow-panel backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 border-b border-line/60 p-3">
            <Avatar username={session.username} size={38} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-cream">{session.displayName}</div>
              <div className="text-xs text-muted">
                {session.role === "admin" ? "Administrator" : "Gracz"} · @{session.username}
              </div>
            </div>
          </div>
          <button
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-muted transition hover:bg-danger/10 hover:text-danger"
          >
            <LogOut size={15} /> Wyloguj się
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Belka nawigacji ─────────────────────────────────────────────────────── */

export default function Nav({ session }: { session: Session }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 md:px-8 md:pt-4">
      <div className="relative mx-auto flex max-w-[1440px] items-center gap-3 rounded-2xl border border-line/60 bg-surface/70 px-3 py-2 shadow-panel-sm backdrop-blur-xl">
        {/* Logo: na mobile małe w belce, od md plakietka zwisająca pod belką (belka zostaje smukła) */}
        <Link
          href="/dashboard"
          aria-label="Pulpit"
          className="shrink-0 overflow-hidden rounded-xl ring-1 ring-line/60 transition
            hover:ring-felt/50 md:absolute md:left-3 md:top-1.5 md:z-10 md:origin-top md:rounded-2xl
            md:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] md:ring-2 md:hover:rotate-[-3deg] md:hover:scale-105"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="Karas Drikers Club" className="h-10 w-12 object-cover md:h-[125px] md:w-[151px]" />
        </Link>
        {/* Rezerwuje miejsce na plakietkę w układzie belki */}
        <span aria-hidden className="hidden w-[151px] shrink-0 md:block" />

        {/* Desktop: pigułki z ikonami, aktywna rozwija się z nazwą */}
        <nav className="mx-auto hidden items-center gap-1 rounded-xl bg-panel/50 p-1 md:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <div key={item.href} className="group relative">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm 2xl:px-2 font-medium transition-all duration-300 ${
                    active
                      ? "bg-felt/[0.14] text-felt shadow-[inset_0_0_0_1px_var(--nav-active-ring)]"
                      : "text-muted hover:bg-panel2 hover:text-cream"
                  } ${item.festive ? "xmas-link" : ""}`}
                >
                  <NavIcon item={item} />
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
                      // Szeroki ekran (2xl): zawsze z nazwą; węższy: nazwa tylko przy aktywnej
                      active ? "max-w-[10rem] opacity-100" : "max-w-0 opacity-0 2xl:max-w-[10rem] 2xl:opacity-100"
                    } ${item.festive ? "xmas-label" : ""}`}
                  >
                    {item.label}
                  </span>
                  {item.festive && <Snow />}
                  {active && (
                    <span className="absolute inset-x-3 bottom-0.5 h-[2px] rounded-full bg-felt shadow-[0_0_8px_var(--nav-active-glow)]" />
                  )}
                </Link>
                {!active && (
                  <span className="nav-tip pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-medium text-cream opacity-0 shadow-panel-sm transition group-hover:opacity-100 2xl:hidden">
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <div className="hidden md:block">
            <UserMenu session={session} onLogout={logout} />
          </div>
          <span className="md:hidden">
            <Avatar username={session.username} size={30} />
          </span>
          <button
            className="btn-ghost px-2.5 py-2 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile: siatka kafelków */}
      {open && (
        <div className="nav-pop mx-auto mt-2 max-w-[1440px] rounded-2xl border border-line/60 bg-surface/95 p-3 shadow-panel backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-3 gap-2">
            {NAV.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-medium transition ${
                    active
                      ? "border-felt/40 bg-felt/[0.12] text-felt"
                      : "border-line/50 bg-panel/40 text-muted hover:text-cream"
                  } ${item.festive ? "xmas-link" : ""}`}
                >
                  <NavIcon item={item} />
                  <span className={item.festive ? "xmas-label" : undefined}>{item.label}</span>
                  {item.festive && <Snow />}
                </Link>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2.5 border-t border-line/60 pt-3">
            <Avatar username={session.username} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-cream">{session.displayName}</div>
              <div className="text-xs text-muted">{session.role === "admin" ? "Administrator" : "Gracz"}</div>
            </div>
            <button onClick={logout} className="btn-ghost px-3 py-1.5 text-xs">
              <LogOut size={14} /> Wyloguj
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
