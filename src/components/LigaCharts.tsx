"use client";

import { useRef, useState } from "react";
import { Table2 } from "lucide-react";
import { displayNameOf } from "@/lib/users";
import type { LeagueGame, PlayerPerformance } from "@/lib/riot";

// Jeden występ gracza (bez remake'ów) po filtrach ze strony
export type Row = { p: PlayerPerformance; game: LeagueGame };

type WL = { w: number; l: number };
const TOTAL = "__ekipa";

// Każda gra raz: wspólny mecz kilku osób to jedna wygrana/porażka ekipy, a nie kilka.
// Gra, w której wybrani gracze stali po przeciwnych stronach (różne wyniki), nie ma wyniku ekipy — pomijamy ją.
function teamGames(rows: Row[]): Row[] {
  const byGame = new Map<string, Row[]>();
  for (const r of rows) byGame.set(r.game.id, [...(byGame.get(r.game.id) ?? []), r]);
  return [...byGame.values()].filter((rs) => rs.every((r) => r.p.win === rs[0].p.win)).map((rs) => rs[0]);
}

/* ─── Tooltip: jeden na kartę wykresu, na hover i na focus ─── */

type Tip = { x: number; y: number; value: string; title: string; detail: string } | null;

function useTip() {
  const card = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  function show(el: HTMLElement, t: Omit<NonNullable<Tip>, "x" | "y">) {
    const c = card.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!c) return;
    setTip({ ...t, x: r.left - c.left + r.width / 2, y: r.top - c.top });
  }
  const bind = (t: Omit<NonNullable<Tip>, "x" | "y">) => ({
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => show(e.currentTarget, t),
    onFocus: (e: React.FocusEvent<HTMLElement>) => show(e.currentTarget, t),
    onPointerLeave: () => setTip(null),
    onBlur: () => setTip(null),
    tabIndex: 0,
  });
  const node = tip && (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs shadow-panel-sm"
      style={{ left: tip.x, top: tip.y - 6 }}
    >
      <div className="text-sm font-bold text-cream">{tip.value}</div>
      <div className="text-muted">{tip.title}</div>
      <div className="text-muted">{tip.detail}</div>
    </div>
  );
  return { card, bind, node };
}

function ChartCard({
  title,
  subtitle,
  children,
  cardRef,
  tip,
  legend,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  cardRef: React.RefObject<HTMLDivElement>;
  tip: React.ReactNode;
  legend?: React.ReactNode;
}) {
  return (
    <section ref={cardRef} className="panel relative p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        {legend}
      </div>
      {children}
      {tip}
    </section>
  );
}

const pct = (wl: WL) => Math.round((wl.w / (wl.w + wl.l)) * 100);
const games = (n: number) => (n === 1 ? "1 gra" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? `${n} gry` : `${n} gier`);

/* ─── Heatmapa winrate: gracze × kategorie ─── */

// Rozbieżna skala: czerwony (0%) ← szary (50%) → niebieski (100%)
function cellStyle(wl: WL) {
  return winrateStyle(wl.w / (wl.w + wl.l));
}

export function winrateStyle(wr: number): { background: string; color?: string } {
  const t = (wr - 0.5) * 2;
  const pole = t >= 0 ? "var(--viz-pos)" : "var(--viz-neg)";
  const mix = Math.round(Math.abs(t) * 100);
  return {
    background: `color-mix(in oklab, ${pole} ${mix}%, var(--viz-mid))`,
    // Tekst w mocno wypełnionej komórce — biały; przy słabym wypełnieniu zwykły kolor tekstu
    color: Math.abs(t) > 0.55 ? "#fff" : undefined,
  };
}

function ScaleLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted" aria-label="Skala winrate od 0 do 100 procent">
      <span>0%</span>
      <span
        className="h-2.5 w-28 rounded-full"
        style={{ background: "linear-gradient(90deg, var(--viz-neg), var(--viz-mid), var(--viz-pos))" }}
      />
      <span>100%</span>
      <span className="ml-1">winrate</span>
    </div>
  );
}

function Heatmap({
  title,
  subtitle,
  cols,
  rows,
  players,
  bucket,
}: {
  title: string;
  subtitle: string;
  cols: string[];
  rows: Row[];
  players: string[];
  bucket: (r: Row) => number; // indeks kolumny
}) {
  const { card, bind, node } = useTip();

  const grid = new Map<string, WL[]>();
  for (const key of [TOTAL, ...players]) grid.set(key, cols.map(() => ({ w: 0, l: 0 })));
  const add = (key: string, r: Row) => {
    const cell = grid.get(key)?.[bucket(r)];
    if (!cell) return;
    if (r.p.win) cell.w++;
    else cell.l++;
  };
  for (const r of rows) add(r.p.username, r);
  for (const r of teamGames(rows)) add(TOTAL, r);

  // Gracze bez gier w zakresie nie dostają pustego wiersza — tylko wzmiankę pod tabelą
  const active = players.filter((u) => grid.get(u)!.some((c) => c.w + c.l > 0));
  const idle = players.filter((u) => !active.includes(u));
  const rowKeys = active.length > 1 ? [TOTAL, ...active] : active;
  const label = (key: string) => (key === TOTAL ? "Gry ekipy" : displayNameOf(key));

  return (
    <ChartCard title={title} subtitle={subtitle} cardRef={card} tip={node} legend={<ScaleLegend />}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="w-28" />
              {cols.map((c) => (
                <th key={c} className="pb-1 text-center text-[11px] font-medium tabular-nums text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((key) => (
              <tr key={key}>
                <th
                  scope="row"
                  className={`pr-3 text-left text-xs font-semibold ${key === TOTAL ? "text-cream" : "text-muted"}`}
                >
                  {label(key)}
                </th>
                {grid.get(key)!.map((wl, i) => {
                  const n = wl.w + wl.l;
                  if (n === 0)
                    return (
                      <td key={i} className="h-12 rounded-md bg-panel2/40 text-center text-xs text-muted/60">
                        —
                      </td>
                    );
                  return (
                    <td
                      key={i}
                      className="h-12 cursor-default rounded-md text-center outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-felt"
                      style={cellStyle(wl)}
                      {...bind({
                        value: `${pct(wl)}% winrate`,
                        title: `${label(key)} · ${cols[i]}`,
                        detail: `${wl.w} W – ${wl.l} P · ${games(n)}`,
                      })}
                    >
                      <div className="text-sm font-bold leading-tight">{pct(wl)}%</div>
                      <div className="text-[10px] leading-tight opacity-80 tabular-nums">
                        {wl.w}–{wl.l}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {idle.length > 0 && (
        <p className="mt-2 text-xs text-muted">Bez gier w tym zakresie: {idle.map(displayNameOf).join(", ")}</p>
      )}
    </ChartCard>
  );
}

/* ─── Gry w czasie: słupki skumulowane wygrane/porażki (dni / tygodnie / miesiące) ─── */

function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

function mondayOf(day: string) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// Długie zakresy grupujemy, żeby słupki nie miały po 1 px: >120 dni tygodnie, >540 dni miesiące
type Grain = "dzień" | "tydzień" | "miesiąc";
const GRAIN = {
  dzień: { title: "Gry dzień po dniu", col: "Dzień", key: (d: string) => d, label: shortDay, tip: shortDay },
  tydzień: {
    title: "Gry tydzień po tygodniu",
    col: "Tydzień od",
    key: mondayOf,
    label: shortDay,
    tip: (k: string) => `tydzień od ${shortDay(k)}.${k.slice(0, 4)}`,
  },
  miesiąc: {
    title: "Gry miesiąc po miesiącu",
    col: "Miesiąc",
    key: (d: string) => d.slice(0, 7),
    label: (k: string) => `${k.slice(5, 7)}.${k.slice(2, 4)}`,
    tip: (k: string) =>
      new Date(k + "-01T12:00:00Z").toLocaleDateString("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" }),
  },
} satisfies Record<Grain, { title: string; col: string; key: (d: string) => string; label: (k: string) => string; tip: (k: string) => string }>;

function DailyChart({ rows, from, to }: { rows: Row[]; from: string; to: string }) {
  const { card, bind, node } = useTip();
  const [table, setTable] = useState(false);

  const allDays = dayList(from, to);
  const grain: Grain = allDays.length > 540 ? "miesiąc" : allDays.length > 120 ? "tydzień" : "dzień";
  const g = GRAIN[grain];
  const days = [...new Set(allDays.map(g.key))]; // klucze kolejnych słupków
  const byDay = new Map(days.map((d) => [d, { w: 0, l: 0 }]));
  for (const r of teamGames(rows)) {
    const c = byDay.get(g.key(r.game.day));
    if (!c) continue;
    if (r.p.win) c.w++;
    else c.l++;
  }
  const max = Math.max(1, ...[...byDay.values()].map((c) => c.w + c.l));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const every = Math.ceil(days.length / 12);
  const PLOT = 180;

  return (
    <ChartCard
      title={g.title}
      subtitle="Gry wybranych graczy — wspólna gra liczy się raz"
      cardRef={card}
      tip={node}
      legend={
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--viz-pos)" }} /> Wygrane
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--viz-neg)" }} /> Porażki
          </span>
          <button
            className="btn-ghost px-2 py-1 text-xs"
            onClick={() => setTable((v) => !v)}
            aria-pressed={table}
          >
            <Table2 size={13} /> {table ? "Wykres" : "Tabela"}
          </button>
        </div>
      }
    >
      {table ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 font-medium">{g.col}</th>
                <th className="py-2 text-right font-medium">Wygrane</th>
                <th className="py-2 text-right font-medium">Porażki</th>
                <th className="py-2 text-right font-medium">Winrate</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => byDay.get(d)!.w + byDay.get(d)!.l > 0)
                .reverse()
                .map((d) => {
                  const c = byDay.get(d)!;
                  return (
                    <tr key={d} className="border-b border-line/40 last:border-0">
                      <td className="py-1.5">{g.tip(d)}</td>
                      <td className="py-1.5 text-right tabular-nums">{c.w}</td>
                      <td className="py-1.5 text-right tabular-nums">{c.l}</td>
                      <td className="py-1.5 text-right tabular-nums">{pct(c)}%</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2 pt-3">
          {/* Oś Y */}
          <div className="relative w-6 shrink-0 text-right text-[11px] tabular-nums text-muted" style={{ height: PLOT }}>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height: PLOT }}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className={`absolute inset-x-0 h-px ${t === 0 ? "bg-line" : "bg-line/40"}`}
                  style={{ bottom: `${(t / top) * 100}%` }}
                />
              ))}
              <div className="absolute inset-0 flex">
                {days.map((d) => {
                  const c = byDay.get(d)!;
                  const n = c.w + c.l;
                  return (
                    <div
                      key={d}
                      className="group flex h-full flex-1 flex-col items-center justify-end outline-none"
                      {...(n > 0
                        ? bind({
                            value: `${c.w} W – ${c.l} P`,
                            title: g.tip(d),
                            detail: `${pct(c)}% winrate · ${games(n)}`,
                          })
                        : {})}
                    >
                      {/* Porażki na górze (zaokrąglony koniec), 2px przerwy, wygrane od linii bazowej */}
                      <div
                        className="flex w-[60%] max-w-[24px] flex-col gap-[2px] transition group-hover:brightness-110 group-focus-visible:brightness-110"
                        style={{ height: `${(n / top) * 100}%` }}
                      >
                        {c.l > 0 && (
                          <div
                            className="rounded-t-[4px]"
                            style={{ flexGrow: c.l, background: "var(--viz-neg)" }}
                          />
                        )}
                        {c.w > 0 && (
                          <div
                            className={c.l === 0 ? "rounded-t-[4px]" : ""}
                            style={{ flexGrow: c.w, background: "var(--viz-pos)" }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Oś X */}
            <div className="mt-1.5 flex text-[11px] tabular-nums text-muted">
              {days.map((d, i) => (
                <span key={d} className="flex-1 text-center">
                  {i % every === 0 ? g.label(d) : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

/* ─── Zestaw wykresów ─── */

// Wieczór godzina po godzinie (19:00–01:00), reszta doby w jednej kolumnie
const HOUR_COLS = ["19–20", "20–21", "21–22", "22–23", "23–00", "00–01", "01–19"];
const hourBucket = (h: number) => (h >= 19 ? h - 19 : h === 0 ? 5 : 6);
const WEEKDAY_COLS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const PARTY_COLS = ["Solo", "2 os.", "3 os.", "4 os.", "5 os."];

export default function LigaCharts({
  rows,
  players,
  from,
  to,
}: {
  rows: Row[];
  players: string[];
  from: string;
  to: string;
}) {
  if (rows.length === 0) {
    return <div className="panel p-8 text-center text-sm text-muted">Brak meczów dla wybranych filtrów.</div>;
  }
  return (
    <div className="space-y-4">
      <Heatmap
        title="Winrate wg pory dnia"
        subtitle="Godzina rozpoczęcia gry (czas polski) · 19:00–01:00 co godzinę, ostatnia kolumna to reszta doby"
        cols={HOUR_COLS}
        rows={rows}
        players={players}
        bucket={(r) => hourBucket(r.game.hour)}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Heatmap
          title="Winrate wg dnia tygodnia"
          subtitle="Dzień rozpoczęcia gry"
          cols={WEEKDAY_COLS}
          rows={rows}
          players={players}
          bucket={(r) => r.game.weekday}
        />
        <Heatmap
          title="Winrate wg premade"
          subtitle="Ilu z nas grało w jednej drużynie"
          cols={PARTY_COLS}
          rows={rows}
          players={players}
          bucket={(r) => Math.min(r.p.partySize, 5) - 1}
        />
      </div>
      <DailyChart rows={rows} from={from} to={to} />
    </div>
  );
}
