"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Swords,
  KeyRound,
  Castle,
  Search,
  CornerDownLeft,
  Users,
  ListOrdered,
  BarChart3,
  BrainCircuit,
  Crown,
  Trophy,
} from "lucide-react";
import { Avatar, Logo, Wordmark } from "@/components/ui";
import SleighIcon from "@/components/SleighIcon";
import ThemeToggle from "@/components/ThemeToggle";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import type { Session } from "@/lib/auth";

type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

type NavItem = {
  href: string;
  label: string;
  desc: string;
  icon: IconType;
  accent: "felt" | "gold";
  match?: string; // prefiks ścieżki podświetlający link (domyślnie href)
  // Zakładka strony w parametrze URL (np. /liga?widok=wykresy); isDefault — aktywna, gdy parametru brak
  tab?: { param: string; value: string; isDefault?: boolean };
  festive?: boolean;
};

// Bieżące położenie: ścieżka + parametry (zakładki Ligi siedzą w ?widok=)
type Loc = { pathname: string; search: URLSearchParams };

// Karta wyróżnienia po prawej stronie rozwijanego menu
type NavFeature = {
  icon: IconType;
  title: string;
  desc: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
};

// Pozycja belki: pojedynczy link albo grupa z rozwijanym menu
type NavEntry = {
  key: string;
  label: string;
  icon: IconType;
  item?: NavItem;
  items?: NavItem[];
  feature?: NavFeature;
  festive?: boolean;
};

const I: Record<"dashboard" | "games" | "history" | "wishlist" | "draw" | "calendar" | "polls" | "kebab" | "ligaMecze" | "ligaWykresy" | "ligaAnalityka" | "ligaHarnas" | "pickem" | "przygoda" | "swieta", NavItem> = {
  dashboard: { href: "/dashboard", label: "Pulpit", desc: "Podsumowanie klubu", icon: LayoutDashboard, accent: "felt" },
  games: { href: "/games", label: "Kolekcja gier", desc: "Pudełka, oceny i rozegrane partie", icon: Dices, accent: "felt" },
  history: { href: "/history", label: "Moja historia", desc: "Twoje wyniki i miejsca na podium", icon: History, accent: "gold" },
  wishlist: { href: "/wishlist", label: "Wishlista", desc: "Gry, które warto kupić", icon: Heart, accent: "gold" },
  draw: { href: "/draw", label: "Losowanie", desc: "Kto zaczyna, kto na jakiej roli", icon: Shuffle, accent: "felt" },
  calendar: { href: "/calendar", label: "Kalendarz", desc: "Terminy spotkań", icon: CalendarDays, accent: "felt" },
  polls: { href: "/polls", label: "Ankiety", desc: "W co i kiedy gramy", icon: Vote, accent: "gold" },
  kebab: { href: "/kebab", label: "Kącik kebabowy", desc: "Zamówienia, rozliczenia i oceny", icon: UtensilsCrossed, accent: "gold" },
  ligaMecze: { href: "/liga", label: "Mecze", desc: "Historia gier ekipy w LoL", icon: ListOrdered, accent: "felt", tab: { param: "widok", value: "mecze", isDefault: true } },
  ligaWykresy: { href: "/liga?widok=wykresy", label: "Wykresy", desc: "Statystyki graczy na wykresach", icon: BarChart3, accent: "felt", tab: { param: "widok", value: "wykresy" } },
  ligaAnalityka: { href: "/liga?widok=analityka", label: "Analityka", desc: "Role, progres, kontry i nawyki", icon: BrainCircuit, accent: "gold", tab: { param: "widok", value: "analityka" } },
  ligaHarnas: { href: "/liga?widok=harnas", label: "Ranking Harnasia", desc: "Kto najczęściej ciągnie ekipę", icon: Crown, accent: "gold", tab: { param: "widok", value: "harnas" } },
  pickem: { href: "/pickem", label: "Pick'em", desc: "Typowanie meczów turnieju, np. Worlds", icon: Trophy, accent: "gold" },
  przygoda: { href: "/przygoda", label: "Przygoda", desc: "Kampania RPG z AI jako Mistrzem Gry", icon: Castle, accent: "gold" },
  swieta: { href: "/swieta/prezenty", match: "/swieta", label: "Święta", desc: "Losowanie prezentów", icon: SleighIcon, accent: "gold", festive: true },
};

const ENTRIES: NavEntry[] = [
  { key: "pulpit", label: "Pulpit", icon: LayoutDashboard, item: I.dashboard },
  {
    key: "planszowki",
    label: "Planszówki",
    icon: Dices,
    items: [I.games, I.history, I.wishlist],
    feature: {
      icon: Dices,
      title: "Co dziś na stole?",
      desc: "Przejrzyj kolekcję i sprawdź, co warto dokupić.",
      primary: { label: "Kolekcja", href: "/games" },
      secondary: { label: "Wishlista", href: "/wishlist" },
    },
  },
  { key: "losowanie", label: "Losowanie", icon: Shuffle, item: I.draw },
  {
    key: "spotkania",
    label: "Spotkania",
    icon: Users,
    items: [I.calendar, I.polls, I.kebab],
    feature: {
      icon: CalendarDays,
      title: "Najbliższe granie",
      desc: "Sprawdź termin i zagłosuj, w co gramy.",
      primary: { label: "Kalendarz", href: "/calendar" },
      secondary: { label: "Ankiety", href: "/polls" },
    },
  },
  {
    key: "liga",
    label: "League of Legends",
    icon: Swords,
    items: [I.ligaMecze, I.ligaWykresy, I.ligaAnalityka, I.ligaHarnas],
    feature: {
      icon: Swords,
      title: "Kto jest kotwicą?",
      desc: "Ostatnie mecze ekipy i miesięczny Ranking Harnasia.",
      primary: { label: "Mecze", href: "/liga" },
      secondary: { label: "Ranking", href: "/liga?widok=harnas" },
    },
  },
  { key: "pickem", label: "Pick'em", icon: Trophy, item: I.pickem },
  { key: "przygoda", label: "Przygoda", icon: Castle, item: I.przygoda },
  { key: "swieta", label: "Święta", icon: SleighIcon, item: I.swieta, festive: true },
];

const ALL_ITEMS: (NavItem & { group?: string })[] = ENTRIES.flatMap((e) =>
  e.items ? e.items.map((it) => ({ ...it, group: e.label })) : e.item ? [e.item] : [],
);

function isActive(loc: Loc, item: NavItem) {
  const base = item.match ?? item.href.split("?")[0];
  if (loc.pathname !== base && !loc.pathname.startsWith(base + "/")) return false;
  if (!item.tab) return true;
  const { param, value, isDefault } = item.tab;
  return (loc.search.get(param) ?? (isDefault ? value : null)) === value;
}

function entryActive(loc: Loc, e: NavEntry) {
  return e.item ? isActive(loc, e.item) : !!e.items?.some((it) => isActive(loc, it));
}

// Link do zakładki z tej samej strony zachowuje pozostałe parametry (np. filtry i zakres dat Ligi)
function itemHref(loc: Loc, item: NavItem) {
  const base = item.href.split("?")[0];
  if (!item.tab || loc.pathname !== base) return item.href;
  const q = new URLSearchParams(loc.search);
  if (item.tab.isDefault) q.delete(item.tab.param);
  else q.set(item.tab.param, item.tab.value);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

function NavIcon({ icon: Icon, festive, size = 17 }: { icon: IconType; festive?: boolean; size?: number }) {
  if (!festive) return <Icon size={size} />;
  return (
    <span className="xmas-icon">
      <Icon size={size} className="xmas-sleigh" />
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

// Pozycja belki: sam tekst, bez ramek
function barItemClass(active: boolean, open = false) {
  return `relative flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-base transition-colors ${
    active || open ? "text-cream" : "text-muted hover:text-cream"
  }`;
}

// Kropka pod aktywną pozycją
function ActiveDot() {
  return (
    <span
      aria-hidden
      className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-felt shadow-[0_0_6px_var(--nav-active-glow)]"
    />
  );
}

// Podświetlenie przesuwające się za kursorem (belka: w poziomie, lista w rozwijanym menu: w pionie).
// instant: przy pierwszym pojawieniu się staje od razu pod kursorem zamiast wjeżdżać z poprzedniego miejsca
function useHoverPill(axis: "x" | "y") {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ pos: 0, size: 0, shown: false, instant: true });

  // Pozycja względem kontenera z getBoundingClientRect: offsetLeft przycisku grupy liczy się od jego
  // własnego (relative) kontenera, więc dawał 0
  function on(el: HTMLElement) {
    const box = ref.current;
    if (!box) return;
    const r = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const pos = axis === "x" ? r.left - b.left : r.top - b.top;
    const size = axis === "x" ? el.offsetWidth : el.offsetHeight;
    setPill((p) => ({ pos, size, shown: true, instant: !p.shown }));
  }
  const off = () => setPill((p) => ({ ...p, shown: false }));

  useEffect(() => {
    if (!pill.instant || !pill.shown) return;
    const f = requestAnimationFrame(() => setPill((p) => ({ ...p, instant: false })));
    return () => cancelAnimationFrame(f);
  }, [pill.instant, pill.shown]);

  const [posProp, sizeProp] = axis === "x" ? ["left", "width"] : ["top", "height"];
  const ease = "cubic-bezier(.22,1,.36,1)";
  const style: React.CSSProperties = {
    [posProp]: pill.pos,
    [sizeProp]: pill.size,
    opacity: pill.shown ? 1 : 0,
    transform: pill.shown ? "scale(1)" : "scale(0.96)",
    transition: pill.instant
      ? "opacity .2s, transform .25s"
      : `${posProp} .3s ${ease}, ${sizeProp} .3s ${ease}, opacity .2s, transform .25s`,
  };
  return { ref, on, off, style };
}

function HoverPill({ axis, style }: { axis: "x" | "y"; style: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute rounded-lg border border-felt/25 bg-gradient-to-b from-felt/[0.18] to-felt/[0.04] shadow-[0_0_28px_-8px_var(--nav-active-glow),inset_0_1px_0_rgb(255_255_255/0.07)] motion-reduce:!transition-none ${
        axis === "x" ? "inset-y-0" : "inset-x-0"
      }`}
      style={style}
    >
      {axis === "x" ? (
        <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-felt to-transparent" />
      ) : (
        <span className="absolute inset-y-2 -left-px w-px bg-gradient-to-b from-transparent via-felt to-transparent" />
      )}
    </span>
  );
}

function ItemTile({ item, size = 36 }: { item: NavItem; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ${item.accent === "felt" ? "bg-felt-soft text-felt" : "bg-gold-soft text-gold"}`}
      style={{ width: size, height: size }}
    >
      <NavIcon icon={item.icon} festive={item.festive} size={size * 0.47} />
    </span>
  );
}

/* ─── Menu użytkownika ────────────────────────────────────────────────────── */

function UserMenu({
  session,
  onLogout,
  onChangePassword,
}: {
  session: Session;
  onLogout: () => void;
  onChangePassword: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pill = useHoverPill("y");

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
        className="nav-ctrl flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar username={session.username} size={32} />
        <span className="hidden text-base font-semibold text-cream 2xl:inline">{session.displayName}</span>
        <ChevronDown size={16} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        // Wygląd jak rozwijane menu Planszówek/Spotkań, z tym samym przesuwającym się podświetleniem
        <div
          role="menu"
          className="nav-drop absolute right-0 top-full z-20 mt-3 w-[270px] rounded-2xl border border-line/70 bg-panel p-2 shadow-panel"
        >
          <div className="mb-1 flex items-center gap-3 border-b border-line/60 px-2 pb-3 pt-1.5">
            <Avatar username={session.username} size={42} />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-cream">{session.displayName}</div>
              <div className="text-sm text-muted">
                {session.role === "admin" ? "Administrator" : "Gracz"} · @{session.username}
              </div>
            </div>
          </div>
          <div ref={pill.ref} className="relative" onMouseLeave={pill.off}>
            <HoverPill axis="y" style={pill.style} />
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChangePassword();
              }}
              onMouseEnter={(ev) => pill.on(ev.currentTarget)}
              className="relative flex w-full items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-base text-muted transition-colors hover:text-cream"
            >
              <KeyRound size={19} className="text-gold" /> Zmień hasło
            </button>
            <button
              role="menuitem"
              onClick={onLogout}
              onMouseEnter={(ev) => pill.on(ev.currentTarget)}
              className="relative flex w-full items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-base text-muted transition-colors hover:text-danger"
            >
              <LogOut size={19} className="text-danger" /> Wyloguj się
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Grupa z rozwijanym menu ─────────────────────────────────────────────── */

function GroupMenu({
  entry,
  loc,
  active,
  open,
  setOpen,
  onHover,
}: {
  entry: NavEntry;
  loc: Loc;
  active: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  onHover: (el: HTMLElement) => void;
}) {
  const closeTimer = useRef<number>();
  const feature = entry.feature;
  const pill = useHoverPill("y");
  // Najechanie otwiera, zjechanie zamyka z małym opóźnieniem (żeby dało się przejechać myszą do panelu)
  const enter = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const leave = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={(ev) => onHover(ev.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={barItemClass(active, open)}
      >
        {entry.label}
        <ChevronDown size={16} className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        {active && <ActiveDot />}
      </button>
      {open && (
        // pt-3: niewidoczny „mostek” między belką a panelem, żeby kursor nie zamykał menu po drodze
        <div className="absolute -left-3 top-full z-20 pt-3">
          {/* Własna animacja bez zmiany opacity: nav-pop (od opacity 0) w panelu wewnątrz belki z backdrop-filter
              Chrome po zakończeniu rysował przygaszony, jakby zamrożony na pierwszej klatce */}
          <div role="menu" className="nav-drop flex gap-2 rounded-2xl border border-line/70 bg-panel p-2 shadow-panel">
            <div className="w-[270px] py-1">
              <p className="px-3.5 pb-2.5 pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted/60">{entry.label}</p>
              <div ref={pill.ref} className="relative" onMouseLeave={pill.off}>
                <HoverPill axis="y" style={pill.style} />
                {entry.items!.map((it) => {
                  const on = isActive(loc, it);
                  const ItIcon = it.icon;
                  return (
                    <Link
                      key={it.href}
                      href={itemHref(loc, it)}
                      role="menuitem"
                      aria-current={on ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      onMouseEnter={(ev) => pill.on(ev.currentTarget)}
                      className={`relative flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-base transition-colors ${
                        on ? "bg-panel2 text-cream" : "text-muted hover:text-cream"
                      }`}
                    >
                      <ItIcon size={19} className={it.accent === "felt" ? "text-felt" : "text-gold"} />
                      {it.label}
                      {on && <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-felt" />}
                    </Link>
                  );
                })}
              </div>
            </div>
            {feature && (
              <div className="relative flex w-72 flex-col overflow-hidden rounded-xl border border-line/60 bg-panel2/60 p-5">
                {/* Siatka w tle karty */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(var(--c-line)/0.5)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--c-line)/0.5)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
                />
                <span className="relative mb-auto flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-felt-soft text-felt ring-1 ring-felt/30">
                  <feature.icon size={24} />
                </span>
                <p className="relative mt-10 text-base font-semibold text-cream">{feature.title}</p>
                <p className="relative mt-1.5 text-sm leading-snug text-muted">{feature.desc}</p>
                <div className="relative mt-4 flex gap-2">
                  <Link
                    href={feature.secondary.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-cream transition hover:bg-panel2"
                  >
                    {feature.secondary.label}
                  </Link>
                  <Link
                    href={feature.primary.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md bg-felt px-3 py-1.5 text-sm font-semibold text-ink transition hover:brightness-110"
                  >
                    {feature.primary.label}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Szybkie przejście (Ctrl+K) ──────────────────────────────────────────── */

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const f = fold(q.trim());
    if (!f) return ALL_ITEMS;
    return ALL_ITEMS.filter((it) => fold(`${it.label} ${it.desc} ${it.group ?? ""}`).includes(f));
  }, [q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  function go(it: NavItem | undefined) {
    if (!it) return;
    onClose();
    router.push(it.href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Szybkie przejście"
        className="nav-pop w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line/70 px-4">
          <Search size={18} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                go(results[sel]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Dokąd idziemy? np. kalendarz, liga, kebab…"
            className="h-14 flex-1 bg-transparent text-sm text-cream outline-none placeholder:text-muted/60"
          />
          <kbd className="rounded-md border border-line bg-panel2 px-1.5 py-0.5 font-mono text-[10px] text-muted">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Nic nie pasuje do „{q}”.</p>}
          {results.map((it, i) => (
            <button
              key={it.href}
              onMouseEnter={() => setSel(i)}
              onClick={() => go(it)}
              className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${i === sel ? "bg-panel2" : ""}`}
            >
              <ItemTile item={it} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-cream">{it.label}</span>
                <span className="block truncate text-xs text-muted">
                  {it.group ? `${it.group} · ` : ""}
                  {it.desc}
                </span>
              </span>
              {i === sel && <CornerDownLeft size={14} className="text-muted" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Belka nawigacji ─────────────────────────────────────────────────────── */

export default function Nav({ session }: { session: Session }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const loc = useMemo<Loc>(() => ({ pathname, search: new URLSearchParams(search) }), [pathname, search]);
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const activeKey = ENTRIES.find((e) => entryActive(loc, e))?.key ?? null;

  const pill = useHoverPill("x");

  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
  }, [pathname, search]);

  // Ctrl+K / Cmd+K otwiera szybkie przejście
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/50 bg-surface/80 backdrop-blur-xl">
      {/* Delikatna poświata u dołu belki */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-felt/30 to-transparent" />
      {/* Szersza niż treść: logo przy lewej krawędzi, menu na środku, profil przy prawej */}
      <div className="grid h-[68px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:px-8">
        {/* Logo i nazwa strony */}
        <Link href="/dashboard" aria-label="PawnSpawn — pulpit" className="flex shrink-0 items-center gap-2.5 justify-self-start transition hover:opacity-90">
          <Logo size={37} />
          <Wordmark className="text-[23px] text-cream" />
        </Link>

        {/* Desktop: tekstowe pozycje, grupy rozwijają panel w dół */}
        <nav aria-label="Główna nawigacja" className="col-start-2 hidden min-w-0 lg:block">
          <div ref={pill.ref} className="relative flex items-center gap-0.5" onMouseLeave={pill.off}>
            <HoverPill axis="x" style={pill.style} />
            {ENTRIES.map((e) => {
              const active = activeKey === e.key;
              if (e.items) {
                return (
                  <GroupMenu
                    key={e.key}
                    onHover={pill.on}
                    entry={e}
                    loc={loc}
                    active={active}
                    open={openGroup === e.key}
                    // Zamknięcie tylko własnej grupy: spóźniony timer zjechania z poprzedniej grupy
                    // nie może zamknąć tej, na którą właśnie przeszedł kursor
                    setOpen={(v) => setOpenGroup((cur) => (v ? e.key : cur === e.key ? null : cur))}
                  />
                );
              }
              const it = e.item!;
              return (
                <Link
                  key={e.key}
                  href={it.href}
                  aria-label={e.label}
                  aria-current={active ? "page" : undefined}
                  onMouseEnter={(ev) => pill.on(ev.currentTarget)}
                  className={`${barItemClass(active)} ${e.festive ? "xmas-link" : ""}`}
                >
                  {e.festive && <NavIcon icon={e.icon} festive size={18} />}
                  <span className={e.festive ? "xmas-label" : ""}>{e.label}</span>
                  {e.festive && <Snow />}
                  {active && <ActiveDot />}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="col-start-3 flex shrink-0 items-center gap-2 justify-self-end">
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden h-11 w-11 items-center justify-center gap-2.5 rounded-full text-sm nav-ctrl lg:flex xl:w-auto xl:pl-3.5 xl:pr-2"
            aria-label="Szybkie przejście (Ctrl+K)"
            title="Szybkie przejście (Ctrl+K)"
          >
            <Search size={18} />
            <kbd className="hidden rounded-md border border-line bg-panel2 px-1.5 py-0.5 font-mono text-xs xl:inline">Ctrl K</kbd>
          </button>
          <ThemeToggle large />
          <div className="hidden lg:block">
            <UserMenu session={session} onLogout={logout} onChangePassword={() => setPwOpen(true)} />
          </div>
          <span className="lg:hidden">
            <Avatar username={session.username} size={30} />
          </span>
          <button
            className="btn-ghost px-2.5 py-2 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile: grupy z nagłówkami, kafelki */}
      {mobileOpen && (
        <div className="nav-drop max-h-[calc(100vh-4.5rem)] overflow-y-auto border-t border-line/60 bg-surface/95 p-3 shadow-panel lg:hidden">
          <button
            onClick={() => {
              setMobileOpen(false);
              setPaletteOpen(true);
            }}
            className="mb-3 flex w-full items-center gap-2.5 rounded-xl border border-line/60 bg-panel/50 px-3 py-2.5 text-sm text-muted"
          >
            <Search size={16} /> Dokąd idziemy?
          </button>
          {[
            { label: "Klub", items: [I.dashboard, I.draw, I.pickem, I.przygoda, I.swieta] },
            ...ENTRIES.filter((e) => e.items).map((e) => ({ label: e.label, items: e.items! })),
          ].map((g) => (
            <div key={g.label} className="mb-3">
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted/70">{g.label}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {g.items.map((it) => {
                  const active = isActive(loc, it);
                  return (
                    <Link
                      key={it.href}
                      href={itemHref(loc, it)}
                      className={`relative flex items-center gap-2.5 rounded-xl border p-2.5 text-sm font-medium transition ${
                        active ? "border-felt/40 bg-felt/[0.12] text-felt" : "border-line/50 bg-panel/40 text-cream"
                      } ${it.festive ? "xmas-link" : ""}`}
                    >
                      <ItemTile item={it} size={30} />
                      <span className={`truncate ${it.festive ? "xmas-label" : ""}`}>{it.label}</span>
                      {it.festive && <Snow />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2.5 border-t border-line/60 pt-3">
            <Avatar username={session.username} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-cream">{session.displayName}</div>
              <div className="text-xs text-muted">{session.role === "admin" ? "Administrator" : "Gracz"}</div>
            </div>
            <button
              onClick={() => {
                setMobileOpen(false);
                setPwOpen(true);
              }}
              className="btn-ghost px-2.5 py-1.5 text-xs"
              aria-label="Zmień hasło"
              title="Zmień hasło"
            >
              <KeyRound size={14} />
            </button>
            <button onClick={logout} className="btn-ghost px-3 py-1.5 text-xs">
              <LogOut size={14} /> Wyloguj
            </button>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </header>
  );
}
