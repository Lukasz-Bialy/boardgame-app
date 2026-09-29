"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, BrainCircuit, CalendarRange, Check, Gamepad2, ListOrdered, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import LigaCharts, { type Row } from "@/components/LigaCharts";
import LigaAnalytics from "@/components/LigaAnalytics";
import type { ClubLeagueData, GameMode, LeagueGame, PlayerPerformance } from "@/lib/riot";

export type LigaView = "mecze" | "wykresy" | "analityka";

type Range = { from: string; to: string; today: string; earliest: string };

const SIZES = [1, 2, 3, 4, 5];
const sizeLabel = (n: number) => (n === 1 ? "Solo" : `${n} os.`);
// Kolejność i etykiety filtra typu gry (klucze jak GAME_MODES w riot.ts)
const MODES: [GameMode, string, string?][] = [
  ["flex", "Flex"],
  ["solo", "Solo/Duo"],
  ["draft", "Normal Draft"],
  ["arena", "Arena"],
  ["aram", "ARAM"],
  [
    "inne",
    "Inne",
    "Pozostałe kolejki: Normal Blind, Swiftplay, Quickplay, Clash, URF i inne tryby rotacyjne (np. One for All), gry z botami i gry niestandardowe.",
  ],
];
// days = null → cała dostępna historia (Riot trzyma ok. 2 lat)
const PRESETS: { days: number | null; label: string }[] = [
  { days: 7, label: "7 dni" },
  { days: 30, label: "30 dni" },
  { days: 90, label: "90 dni" },
  { days: 365, label: "Rok" },
  { days: null, label: "Wszystko" },
];
const PAGE = 30;
const REFRESH_MS = 35_000;

const POSITIONS: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};

function shiftDay(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function duration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function kdaRatio(m: { kills: number; deaths: number; assists: number }) {
  return m.deaths === 0 ? "Perfect" : ((m.kills + m.assists) / m.deaths).toFixed(2);
}

/* ─── Filtry ──────────────────────────────────────────────────────────────── */

function Toggle({
  on,
  onClick,
  children,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  hint?: string; // wyjaśnienie w dymku (hover i focus z klawiatury)
}) {
  const hintId = useId();
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-describedby={hint ? hintId : undefined}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
        on
          ? "border-felt/50 bg-felt/[0.14] text-cream"
          : "border-line/60 bg-panel/40 text-muted hover:border-line hover:text-cream"
      }`}
    >
      {/* Miejsce na ✓ zarezerwowane zawsze — szerokość nie zależy od zaznaczenia */}
      <Check size={13} strokeWidth={3} className={on ? "text-felt" : "invisible"} aria-hidden />

      {children}
    </button>
  );
  if (!hint) return button;
  return (
    <span className="group relative inline-flex">
      {button}
      <span
        id={hintId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-line bg-panel px-3 py-2 text-xs font-normal leading-snug text-cream opacity-0 shadow-panel-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {hint}
      </span>
    </span>
  );
}

function FilterGroup({
  label,
  icon,
  children,
  off,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  off?: string; // powód, dla którego grupa nie działa w bieżącym widoku
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 transition-opacity ${off ? "pointer-events-none opacity-35" : ""}`}
      title={off}
      aria-disabled={off ? true : undefined}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
        {icon} {label}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/* ─── Lista meczów ────────────────────────────────────────────────────────── */

function toneOf(p: PlayerPerformance) {
  if (p.remake) return { bar: "bg-muted", text: "text-muted", label: "Remake" };
  const label = p.placement ? `${p.placement}. miejsce` : p.win ? "Zwycięstwo" : "Porażka";
  return p.win
    ? { bar: "bg-felt", text: "text-felt", label }
    : { bar: "bg-danger", text: "text-danger", label };
}

function ItemSlot({ id, ver }: { id: number; ver: string }) {
  if (!id) return <span className="h-7 w-7 rounded-md border border-line/50 bg-surface/60" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://ddragon.leagueoflegends.com/cdn/${ver}/img/item/${id}.png`}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      className="h-7 w-7 rounded-md ring-1 ring-line/60"
    />
  );
}

function PerformanceRow({ p, game, ver }: { p: PlayerPerformance; game: LeagueGame; ver: string }) {
  const tone = toneOf(p);
  const csPerMin = game.duration ? (p.cs / (game.duration / 60)).toFixed(1) : "0";

  return (
    <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 py-2.5 pl-4 pr-3">
      <span className={`absolute inset-y-1.5 left-0 w-1 rounded-full ${tone.bar}`} aria-hidden />

      <div className="flex w-36 items-center gap-2.5">
        <Avatar username={p.username} size={30} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{displayNameOf(p.username)}</div>
          <div className={`text-xs font-medium ${tone.text}`}>{tone.label}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${p.champion}.png`}
            alt={p.champion}
            width={44}
            height={44}
            loading="lazy"
            className="h-11 w-11 rounded-xl ring-1 ring-line/60"
          />
          <span className="absolute -bottom-1 -right-1 rounded-md border border-line bg-panel px-1 font-mono text-[10px]">
            {p.champLevel}
          </span>
        </div>
        <div className="w-24">
          <div className="truncate text-sm font-semibold">{p.champion}</div>
          <div className="text-xs text-muted">{game.arena ? "Arena" : POSITIONS[p.position] ?? "—"}</div>
        </div>
      </div>

      <div className="w-28">
        <div className="font-mono text-base font-bold tabular-nums">
          {p.kills} / <span className="text-danger">{p.deaths}</span> / {p.assists}
        </div>
        <div className="text-xs text-muted">KDA {kdaRatio(p)}</div>
      </div>

      <div className="w-32 text-xs text-muted">
        {!game.arena && (
          <div>
            <span className="font-mono text-cream">{p.cs}</span> CS ({csPerMin}/min)
          </div>
        )}
        <div>
          <span className="font-mono text-cream">{Math.round(p.killParticipation * 100)}%</span> udział w killach
        </div>
        <div>
          <span className="font-mono text-cream">{(p.damage / 1000).toFixed(1)}k</span> obrażeń
        </div>
      </div>

      <div className="flex items-center gap-1">
        {p.items.map((id, i) => (
          <ItemSlot key={i} id={id} ver={ver} />
        ))}
        <span className="ml-1">
          <ItemSlot id={p.trinket} ver={ver} />
        </span>
      </div>
    </div>
  );
}

function GameCard({ game, rows, ver }: { game: LeagueGame; rows: PlayerPerformance[]; ver: string }) {
  const party = Math.max(...game.players.map((p) => p.partySize));
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line/60 px-4 py-2 text-xs text-muted">
        <span className="font-semibold text-cream">{game.queue}</span>
        <span>{duration(game.duration)}</span>
        <span>{game.startedLabel}</span>
        {party > 1 && (
          <span className="chip ml-auto">
            <Users size={12} /> premade {party} os.
          </span>
        )}
      </div>
      <div className="divide-y divide-line/40 px-2">
        {rows.map((p) => (
          <PerformanceRow key={p.username} p={p} game={game} ver={ver} />
        ))}
      </div>
    </div>
  );
}

/* ─── Karty graczy ────────────────────────────────────────────────────────── */

function PlayerCard({
  username,
  riotId,
  error,
  perf,
  ver,
}: {
  username: string;
  riotId: string;
  error: string | null;
  perf: PlayerPerformance[];
  ver: string;
}) {
  const games = perf.length;
  const wins = perf.filter((p) => p.win).length;
  const sum = perf.reduce(
    (a, p) => ({ kills: a.kills + p.kills, deaths: a.deaths + p.deaths, assists: a.assists + p.assists }),
    { kills: 0, deaths: 0, assists: 0 }
  );
  const avg = (n: number) => (games ? (n / games).toFixed(1) : "0");
  const champs = new Map<string, number>();
  for (const p of perf) champs.set(p.champion, (champs.get(p.champion) ?? 0) + 1);
  const top = [...champs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Avatar username={username} size={36} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{displayNameOf(username)}</div>
          <div className="truncate font-mono text-[11px] text-muted">{riotId}</div>
        </div>
        {top && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${top}.png`}
            alt={top}
            title={`Najczęściej: ${top}`}
            width={32}
            height={32}
            loading="lazy"
            className="ml-auto h-8 w-8 rounded-lg ring-1 ring-line/60"
          />
        )}
      </div>
      {error ? (
        <div className="text-xs text-danger">{error}</div>
      ) : games === 0 ? (
        <div className="py-1.5 text-xs text-muted">Brak gier dla wybranych filtrów</div>
      ) : (
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="font-mono text-xl font-bold">
              <span className="text-felt">{wins}</span>
              <span className="text-muted">–</span>
              <span className="text-danger">{games - wins}</span>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted">
              {games ? Math.round((wins / games) * 100) : 0}% winrate
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-semibold">
              {avg(sum.kills)}/{avg(sum.deaths)}/{avg(sum.assists)}
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted">KDA {kdaRatio(sum)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Widok ───────────────────────────────────────────────────────────────── */

export default function LigaClient({
  data,
  ver,
  range,
  initial,
}: {
  data: ClubLeagueData;
  ver: string;
  range: Range;
  initial: { players: string[]; sizes: number[]; modes: GameMode[]; view: LigaView };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [players, setPlayers] = useState<string[]>(initial.players);
  const [sizes, setSizes] = useState<number[]>(initial.sizes);
  const [modes, setModes] = useState<GameMode[]>(initial.modes);
  const [view, setView] = useState<LigaView>(initial.view);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [shown, setShown] = useState(PAGE);

  // Po odświeżeniu z serwera (np. korekta zakresu) pola dat idą za danymi
  useEffect(() => {
    setFrom(range.from);
    setTo(range.to);
  }, [range.from, range.to]);

  const all = data.accounts.map((a) => a.username);

  type Next = { from?: string; to?: string; players?: string[]; sizes?: number[]; modes?: GameMode[]; view?: LigaView };

  function query(next: Next) {
    const s = { from, to, players, sizes, modes, view, ...next };
    const q = new URLSearchParams({ od: s.from, do: s.to });
    if (s.players.length !== all.length) q.set("gracze", s.players.join(","));
    if (s.sizes.length !== SIZES.length) q.set("premade", s.sizes.join(","));
    if (s.modes.length !== MODES.length) q.set("tryb", s.modes.join(","));
    if (s.view !== "mecze") q.set("widok", s.view);
    return `/liga?${q}`;
  }

  // Filtry graczy/premade/typu gry/widoku działają na pobranych danych — tylko aktualizujemy URL
  function applyLocal(next: Omit<Next, "from" | "to">) {
    if (next.players) setPlayers(next.players);
    if (next.sizes) setSizes(next.sizes);
    if (next.modes) setModes(next.modes);
    if (next.view) setView(next.view);
    setShown(PAGE);
    window.history.replaceState(null, "", query(next));
  }

  // Zmiana zakresu dat wymaga nowych danych z serwera
  function applyRange(f: string, t: string) {
    if (!f || !t) return;
    if (f > t) [f, t] = [t, f];
    setFrom(f);
    setTo(t);
    startTransition(() => router.push(query({ from: f, to: t })));
  }

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Brakujące mecze (limit Riot API) — odświeżamy sami, aż wszystko się dociągnie
  useEffect(() => {
    if (data.missing === 0 && !data.incomplete) return;
    const t = setTimeout(() => router.refresh(), REFRESH_MS);
    return () => clearTimeout(t);
  }, [data, router]);

  const { games, rows } = useMemo(() => {
    const pSet = new Set(players);
    const sSet = new Set(sizes);
    const mSet = new Set(modes);
    const games: { game: LeagueGame; rows: PlayerPerformance[] }[] = [];
    const rows: Row[] = [];
    for (const game of data.games) {
      if (!mSet.has(game.mode)) continue;
      const picked = game.players.filter((p) => pSet.has(p.username) && sSet.has(Math.min(p.partySize, 5)));
      if (picked.length === 0) continue;
      games.push({ game, rows: picked });
      for (const p of picked) if (!p.remake) rows.push({ p, game });
    }
    return { games, rows };
  }, [data.games, players, sizes, modes]);

  // Analityka waży premade sama — dostaje gry tylko po filtrze typu gry
  const modeGames = useMemo(() => data.games.filter((g) => modes.includes(g.mode)), [data.games, modes]);

  const presetFrom = (days: number | null) => (days === null ? range.earliest : shiftDay(range.today, -(days - 1)));
  const presetOn = (days: number | null) => to === range.today && from === presetFrom(days);

  return (
    <div className="space-y-6">
      {/* Filtry — jeden pasek nad wszystkim, co filtrują */}
      <div className="panel flex flex-wrap items-start gap-x-8 gap-y-4 p-4">
        <FilterGroup label="Zakres dat" icon={<CalendarRange size={13} />}>
          {PRESETS.map(({ days, label }) => (
            <Toggle key={label} on={presetOn(days)} onClick={() => applyRange(presetFrom(days), range.today)}>
              {label}
            </Toggle>
          ))}
          <span className="flex items-center gap-1.5">
            <input
              type="date"
              className="input h-8 w-auto px-2 py-0 text-xs"
              value={from}
              min={range.earliest}
              max={range.today}
              onChange={(e) => applyRange(e.target.value, to)}
              aria-label="Od"
            />
            <span className="text-muted">–</span>
            <input
              type="date"
              className="input h-8 w-auto px-2 py-0 text-xs"
              value={to}
              min={range.earliest}
              max={range.today}
              onChange={(e) => applyRange(from, e.target.value)}
              aria-label="Do"
            />
          </span>
        </FilterGroup>

        <FilterGroup label="Gracze" icon={<Users size={13} />}>
          {all.map((u) => (
            <Toggle key={u} on={players.includes(u)} onClick={() => applyLocal({ players: toggle(players, u) })}>
              <Avatar username={u} size={18} />
              {displayNameOf(u)}
            </Toggle>
          ))}
          {/* Zawsze w układzie (tylko ukryty), żeby pasek filtrów nie przeskakiwał */}
          <button
            className={`px-1 text-xs text-muted underline-offset-2 hover:text-cream hover:underline ${
              players.length === all.length ? "invisible" : ""
            }`}
            onClick={() => applyLocal({ players: all })}
            tabIndex={players.length === all.length ? -1 : undefined}
            aria-hidden={players.length === all.length}
          >
            wszyscy
          </button>
        </FilterGroup>

        <FilterGroup
          label="Premade"
          icon={<Users size={13} />}
          off={view === "analityka" ? "W analityce premade uwzględniają wagi — filtr nie działa" : undefined}
        >
          {SIZES.map((n) => (
            <Toggle key={n} on={sizes.includes(n)} onClick={() => applyLocal({ sizes: toggle(sizes, n) })}>
              {sizeLabel(n)}
            </Toggle>
          ))}
        </FilterGroup>

        <FilterGroup label="Typ gry" icon={<Gamepad2 size={13} />}>
          {MODES.map(([m, label, hint]) => (
            <Toggle key={m} on={modes.includes(m)} hint={hint} onClick={() => applyLocal({ modes: toggle(modes, m) })}>
              {label}
            </Toggle>
          ))}
        </FilterGroup>
      </div>

      {(data.missing > 0 || data.incomplete) && (
        <div className="panel flex items-center gap-3 p-4 text-sm text-gold">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            Riot API ogranicza liczbę zapytań (100 na 2 min) — pobieram historię:{" "}
            {data.incomplete ? "lista meczów jest jeszcze niepełna" : `brakuje jeszcze ${data.missing} meczów`}
            {data.missing > 0 && ` (ok. ${Math.ceil(data.missing / 95) * 2} min)`}. Strona dociąga je sama, pobrane
            zostają w bazie na stałe.
          </span>
        </div>
      )}

      {/* Przy przeładowaniu zakresu trzymamy poprzedni widok, tylko przygaszony */}
      <div className={`space-y-6 transition-opacity ${pending ? "pointer-events-none opacity-50" : ""}`}>
        {/* Karty liczą się po filtrze premade, którego analityka nie używa — tam ich nie pokazujemy */}
        {view !== "analityka" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {data.accounts
              .filter((a) => players.includes(a.username))
              .map((a) => (
                <PlayerCard
                  key={a.username}
                  username={a.username}
                  riotId={a.riotId}
                  error={a.error}
                  perf={rows.filter((r) => r.p.username === a.username).map((r) => r.p)}
                  ver={ver}
                />
              ))}
          </div>
        )}

        <div className="inline-flex rounded-xl bg-panel/60 p-1" role="tablist">
          {(
            [
              ["mecze", "Mecze", ListOrdered],
              ["wykresy", "Wykresy", BarChart3],
              ["analityka", "Analityka", BrainCircuit],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => applyLocal({ view: key })}
              className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                view === key ? "bg-felt/[0.14] text-felt shadow-[inset_0_0_0_1px_var(--nav-active-ring)]" : "text-muted hover:text-cream"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {view === "mecze" ? (
          games.length === 0 ? (
            <div className="panel p-8 text-center text-sm text-muted">Brak meczów dla wybranych filtrów.</div>
          ) : (
            <div className="space-y-3">
              {games.slice(0, shown).map(({ game, rows }) => (
                <GameCard key={game.id} game={game} rows={rows} ver={ver} />
              ))}
              {games.length > shown && (
                <div className="text-center">
                  <button className="btn-ghost" onClick={() => setShown((n) => n + PAGE)}>
                    Pokaż więcej ({games.length - shown})
                  </button>
                </div>
              )}
            </div>
          )
        ) : view === "wykresy" ? (
          <LigaCharts rows={rows} players={all.filter((u) => players.includes(u))} from={range.from} to={range.to} />
        ) : (
          <LigaAnalytics
            games={modeGames}
            lineup={all.filter((u) => players.includes(u))}
            ver={ver}
            rangeDays={Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1}
            onWiderRange={() => applyRange(shiftDay(range.today, -89), range.today)}
          />
        )}
      </div>
    </div>
  );
}
