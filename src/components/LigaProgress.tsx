"use client";

import { useMemo } from "react";
import { CalendarRange, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import type { LeagueGame } from "@/lib/riot";

const ROLES = [
  ["TOP", "Top"],
  ["JUNGLE", "Jungle"],
  ["MIDDLE", "Mid"],
  ["BOTTOM", "ADC"],
  ["UTILITY", "Support"],
] as const;

// Minimum gier w każdej połowie okresu, żeby mówić o trendzie
const MIN_HALF = 3;
// Zmiana średniego score'u (pkt), od której to już progres/regres, a nie szum
const TREND_PTS = 4;

type Game = { t: number; score: number | null; win: boolean; k: number; d: number; a: number; csMin: number; kp: number };
type Half = { n: number; scored: number; score: number; w: number; k: number; d: number; a: number; cs: number; kp: number };

const half = (list: Game[]): Half => {
  const h: Half = { n: 0, scored: 0, score: 0, w: 0, k: 0, d: 0, a: 0, cs: 0, kp: 0 };
  for (const g of list) {
    h.n++;
    if (g.score !== null) {
      h.scored++;
      h.score += g.score;
    }
    h.w += g.win ? 1 : 0;
    h.k += g.k;
    h.d += g.d;
    h.a += g.a;
    h.cs += g.csMin;
    h.kp += g.kp;
  }
  return h;
};

// Zmiany w statystykach składowych — pokazujemy tę, która najbardziej wyjaśnia trend
const PARTS: { label: string; get: (h: Half) => number; scale: number; fmt: (v: number) => string; lowerBetter?: boolean; skipSupport?: boolean }[] = [
  { label: "KDA", get: (h) => (h.k + h.a) / Math.max(1, h.d), scale: 0.8, fmt: (v) => v.toFixed(2) },
  { label: "zgony na mecz", get: (h) => h.d / h.n, scale: 1, fmt: (v) => v.toFixed(1), lowerBetter: true },
  { label: "CS/min", get: (h) => h.cs / h.n, scale: 0.6, fmt: (v) => v.toFixed(1), skipSupport: true },
  { label: "udział w killach", get: (h) => h.kp / h.n, scale: 0.06, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: "winrate", get: (h) => h.w / h.n, scale: 0.15, fmt: (v) => `${Math.round(v * 100)}%` },
];

// Score mecz po meczu z kroczącą średnią z 5 gier
function Sparkline({ games }: { games: Game[] }) {
  const pts = games.filter((g) => g.score !== null).map((g) => g.score!);
  if (pts.length < 3) return null;
  const roll = pts.map((_, i) => {
    const w = pts.slice(Math.max(0, i - 4), i + 1);
    return w.reduce((a, v) => a + v, 0) / w.length;
  });
  const W = 120;
  const H = 32;
  const lo = Math.min(30, ...pts);
  const hi = Math.max(70, ...pts);
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-full" aria-hidden>
      <line x1="0" x2={W} y1={y(50)} y2={y(50)} stroke="rgb(var(--c-line))" strokeDasharray="2 2" />
      {pts.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="1.4" fill="rgb(var(--c-muted))" />
      ))}
      <path
        d={roll.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
        fill="none"
        stroke="rgb(var(--c-cream))"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export default function LigaProgress({
  games,
  lineup,
  range,
  onLastMonth,
}: {
  games: LeagueGame[]; // już po filtrze typu gry
  lineup: string[];
  range: { from: string; to: string; today: string };
  onLastMonth: () => void;
}) {
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1;

  const rows = useMemo(() => {
    const per = new Map<string, Game[]>(); // `${username}|${rola}`
    for (const g of games) {
      if (g.arena) continue;
      for (const p of g.players) {
        if (!lineup.includes(p.username) || p.remake || !ROLES.some(([r]) => r === p.position)) continue;
        const key = `${p.username}|${p.position}`;
        if (!per.has(key)) per.set(key, []);
        per.get(key)!.push({
          t: g.endedAt,
          score: p.score,
          win: p.win,
          k: p.kills,
          d: p.deaths,
          a: p.assists,
          csMin: p.cs / Math.max(1, g.duration / 60),
          kp: p.killParticipation,
        });
      }
    }
    // Połowy okresu wg czasu (nie wg liczby gier) — progres to zmiana w czasie. Liczone od pierwszej do ostatniej
    // gry w zakresie, a nie od jego granic: przy „Wszystko” zakres zaczyna się w 2021 i cała historia wpadała
    // do drugiej połowy
    const times = [...per.values()].flat().map((g) => g.t);
    const mid = times.length ? (Math.min(...times) + Math.max(...times)) / 2 : 0;
    return lineup.map((u) => ({
      username: u,
      roles: ROLES.map(([role, label]) => {
        const list = (per.get(`${u}|${role}`) ?? []).sort((a, b) => a.t - b.t);
        const early = half(list.filter((g) => g.t < mid));
        const late = half(list.filter((g) => g.t >= mid));
        const enough = early.n >= MIN_HALF && late.n >= MIN_HALF && early.scored >= MIN_HALF && late.scored >= MIN_HALF;
        const delta = enough ? late.score / late.scored - early.score / early.scored : null;
        // Składowa z największą zmianą w tym samym kierunku co trend
        let why: string | null = null;
        if (delta !== null && Math.abs(delta) >= TREND_PTS) {
          const cands = PARTS.filter((p) => !(p.skipSupport && role === "UTILITY"))
            .map((p) => {
              const [a, b] = [p.get(early), p.get(late)];
              const change = ((b - a) * (p.lowerBetter ? -1 : 1)) / p.scale;
              return { p, a, b, change };
            })
            .filter((c) => Math.sign(c.change) === Math.sign(delta))
            .sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
          const c = cands[0];
          if (c && Math.abs(c.change) >= 0.5) why = `${c.p.label}: ${c.p.fmt(c.a)} → ${c.p.fmt(c.b)}`;
        }
        return { role, label, list, early, late, delta, why };
      }).filter((r) => r.list.length > 0),
    }));
  }, [games, lineup]);

  if (!lineup.length)
    return <div className="panel p-8 text-center text-sm text-muted">Zaznacz w filtrze „Gracze” osoby do analizy.</div>;

  const isLastMonth = range.to === range.today && days >= 28 && days <= 31;
  const unscored = rows.some((r) => r.roles.some((x) => x.list.some((g) => g.score === null)));

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4 text-sm">
        <div className="mr-auto min-w-0">
          <div className="font-semibold">
            Progres na rolach · {range.from.split("-").reverse().join(".")} – {range.to.split("-").reverse().join(".")} ({days} dni)
          </div>
          <div className="text-xs text-muted">
            Średni score Harnasia w drugiej połowie okresu minus w pierwszej (50 = typowy mecz na roli). Trend od ±
            {TREND_PTS} pkt, przy min. {MIN_HALF} grach w każdej połowie.
          </div>
        </div>
        {!isLastMonth && (
          <button className="btn-ghost h-9 text-xs" onClick={onLastMonth}>
            <CalendarRange size={14} /> Ostatnie 30 dni
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {rows.map(({ username, roles }) => (
          <section key={username} className="panel p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <Avatar username={username} size={30} />
              <div className="text-sm font-semibold">{displayNameOf(username)}</div>
            </div>
            {roles.length === 0 ? (
              <div className="text-xs text-muted">Brak gier na rolach w tym okresie.</div>
            ) : (
              <div className="space-y-2">
                {roles.filter((r) => r.delta !== null).length === 0 && (
                  <div className="text-xs text-muted">Na żadnej roli nie ma jeszcze {MIN_HALF} gier w obu połowach okresu.</div>
                )}
                {roles.filter((r) => r.delta !== null).map((r) => {
                  const trend = r.delta === null ? null : r.delta >= TREND_PTS ? "up" : r.delta <= -TREND_PTS ? "down" : "flat";
                  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
                  const cls = trend === "up" ? "text-felt" : trend === "down" ? "text-danger" : "text-muted";
                  return (
                    <div key={r.role} className="rounded-xl border border-line/60 bg-panel2/30 p-3">
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-[11px] font-medium uppercase tracking-wider text-muted">{r.label}</span>
                        <span className={`flex items-center gap-1 text-sm font-semibold ${cls}`}>
                          <Icon size={15} />
                          {trend === null
                            ? "za mało gier"
                            : trend === "up"
                            ? `progres +${r.delta!.toFixed(1)}`
                            : trend === "down"
                            ? `regres ${r.delta!.toFixed(1)}`
                            : `stabilnie ${r.delta! >= 0 ? "+" : ""}${r.delta!.toFixed(1)}`}
                        </span>
                        <span className="ml-auto text-xs tabular-nums text-muted">
                          {r.early.n} → {r.late.n} gier
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <div className="min-w-0 flex-1 text-xs text-muted">
                          {r.early.scored > 0 && r.late.scored > 0 && (
                            <div className="tabular-nums">
                              score {(r.early.score / r.early.scored).toFixed(1)} → {(r.late.score / r.late.scored).toFixed(1)} · winrate{" "}
                              {Math.round((r.early.w / Math.max(1, r.early.n)) * 100)}% → {Math.round((r.late.w / Math.max(1, r.late.n)) * 100)}%
                            </div>
                          )}
                          {r.why && <div className={cls}>najbardziej zmieniło się: {r.why}</div>}
                        </div>
                        <div className="w-28 shrink-0">
                          <Sparkline games={r.list} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {roles.some((r) => r.delta === null) && (
                  <div className="pt-1 text-xs text-muted">
                    Za mało gier na trend:{" "}
                    {roles
                      .filter((r) => r.delta === null)
                      .map((r) => `${r.label} (${r.list.length})`)
                      .join(", ")}
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      <p className="text-xs text-muted">
        Wykres: score każdego meczu (kropki) i średnia krocząca z 5 gier (linia), przerywana linia = 50. Winrate zależy
        od całej drużyny, dlatego trend liczymy ze score&apos;u — porównuje gracza z typowym wynikiem na roli.
        {unscored && " Część meczów nie ma score'u (stary zapis) — dociągają się same w ciągu kilku minut."}
      </p>
    </div>
  );
}
