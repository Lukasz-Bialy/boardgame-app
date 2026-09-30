"use client";

import { useMemo, useState } from "react";
import { ShieldAlert, Swords, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import { winrateStyle } from "@/components/LigaCharts";
import type { LeagueGame } from "@/lib/riot";

const ROLES = [
  ["TOP", "Top"],
  ["JUNGLE", "Jungle"],
  ["MIDDLE", "Mid"],
  ["BOTTOM", "ADC"],
  ["UTILITY", "Support"],
] as const;

type Stat = { n: number; w: number; score: number; scored: number; k: number; d: number; a: number };
const empty = (): Stat => ({ n: 0, w: 0, score: 0, scored: 0, k: 0, d: 0, a: 0 });

// Winrate przyciągany do 50% przy małej liczbie gier — 1 przegrana nie robi z championa „kontry”
const A = 3;
const shrunk = (s: Stat) => (s.w + A * 0.5) / (s.n + A);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const avgScore = (s: Stat) => (s.scored ? (s.score / s.scored).toFixed(1) : "—");

function ChampRow({ name, s, ver, showScore }: { name: string; s: Stat; ver: string; showScore?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${name}.png`}
        alt=""
        width={28}
        height={28}
        loading="lazy"
        className="h-7 w-7 rounded-lg ring-1 ring-line/60"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      {showScore && (
        <span className="w-12 text-right font-mono text-xs text-muted" title="Średni score Harnasia w tych meczach">
          {avgScore(s)}
        </span>
      )}
      <span className="w-12 text-right font-mono text-xs text-muted">
        {s.w}–{s.n - s.w}
      </span>
      <span
        className="w-12 rounded-md px-1.5 py-0.5 text-center font-mono text-xs font-semibold"
        style={winrateStyle(s.w / s.n)}
      >
        {pct(s.w / s.n)}
      </span>
    </div>
  );
}

function ChampList({
  title,
  subtitle,
  icon,
  entries,
  ver,
  showScore,
  empty: emptyText,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  entries: [string, Stat][];
  ver: string;
  showScore?: boolean;
  empty: string;
}) {
  return (
    <div className="panel p-4">
      <h3 className="flex items-center gap-2 font-display text-base font-bold">
        {icon} {title}
      </h3>
      <p className="mb-2 text-xs text-muted">{subtitle}</p>
      {entries.length === 0 ? (
        <div className="py-3 text-xs text-muted">{emptyText}</div>
      ) : (
        <div className="divide-y divide-line/30">
          <div className="flex items-center gap-2.5 pb-1 text-[10px] uppercase tracking-wider text-muted">
            <span className="flex-1">Champion</span>
            {showScore && <span className="w-12 text-right" title="Średni score Harnasia (50 = typowy mecz na roli)">score</span>}
            <span className="w-12 text-right">W–P</span>
            <span className="w-12 text-center">winrate</span>
          </div>
          {entries.map(([name, s]) => (
            <ChampRow key={name} name={name} s={s} ver={ver} showScore={showScore} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LigaCounters({ games, lineup, ver }: { games: LeagueGame[]; lineup: string[]; ver: string }) {
  const [who, setWho] = useState<string | null>(null); // null = cały skład
  const players = who ? [who] : lineup;

  const model = useMemo(() => {
    const set = new Set(players);
    const lane = new Map<string, Stat>();
    const enemy = new Map<string, Stat>();
    const own = new Map<string, Stat>();
    const roles = new Map<string, Stat>(ROLES.map(([r]) => [r, empty()]));
    const add = (map: Map<string, Stat>, key: string, win: boolean, score: number | null, kda?: [number, number, number]) => {
      const s = map.get(key) ?? empty();
      s.n++;
      s.w += win ? 1 : 0;
      if (score !== null) {
        s.score += score;
        s.scored++;
      }
      if (kda) [s.k, s.d, s.a] = [s.k + kda[0], s.d + kda[1], s.a + kda[2]];
      map.set(key, s);
    };
    let counted = 0;
    for (const g of games) {
      if (g.arena) continue;
      const mine = g.players.filter((p) => set.has(p.username) && !p.remake);
      if (!mine.length) continue;
      counted++;
      for (const p of mine) {
        add(own, p.champion, p.win, p.score);
        if (p.opponent) add(lane, p.opponent, p.win, p.score);
        if (roles.has(p.position)) add(roles, p.position, p.win, p.score, [p.kills, p.deaths, p.assists]);
      }
      // Drużyna przeciwna liczona raz na mecz — z perspektywy drużyny, w której grało więcej z nas
      const teams = new Map<number, number>();
      for (const p of mine) teams.set(p.team, (teams.get(p.team) ?? 0) + 1);
      const ours = [...teams.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const win = mine.find((p) => p.team === ours)!.win;
      for (const c of g.champs) if (c.team !== ours) add(enemy, c.champion, win, null);
    }
    const worst = (map: Map<string, Stat>, min: number, n = 8) =>
      [...map.entries()].filter(([, s]) => s.n >= min && s.w < s.n).sort((a, b) => shrunk(a[1]) - shrunk(b[1]) || b[1].n - a[1].n).slice(0, n);
    const best = (map: Map<string, Stat>, min: number, n = 5) =>
      [...map.entries()].filter(([, s]) => s.n >= min && s.w > 0).sort((a, b) => shrunk(b[1]) - shrunk(a[1]) || b[1].n - a[1].n).slice(0, n);
    const laneList = ROLES.map(([r, label]) => ({ role: r, label, s: roles.get(r)! })).filter((x) => x.s.n > 0);
    const weakest = laneList.filter((x) => x.s.n >= 3).sort((a, b) => shrunk(a.s) - shrunk(b.s))[0];
    return {
      counted,
      laneWorst: worst(lane, 2),
      enemyWorst: worst(enemy, 3),
      ownWorst: worst(own, 3, 6),
      ownBest: best(own, 3, 6),
      laneList,
      weakest,
    };
  }, [games, players]);

  if (!lineup.length)
    return <div className="panel p-8 text-center text-sm text-muted">Zaznacz w filtrze „Gracze” osoby do analizy.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted">Dla kogo</span>
        {[null, ...lineup].map((u) => (
          <button
            key={u ?? "all"}
            onClick={() => setWho(u)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
              who === u ? "border-felt/50 bg-felt/[0.14] text-cream" : "border-line/60 bg-panel/40 text-muted hover:text-cream"
            }`}
          >
            {u ? (
              <>
                <Avatar username={u} size={18} /> {displayNameOf(u)}
              </>
            ) : (
              <>
                <Users size={13} /> Cały skład
              </>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">{model.counted} meczów z wybranego zakresu i typów gry</span>
      </div>

      {/* Linie */}
      <section className="panel p-5">
        <h3 className="mb-1 font-display text-lg font-bold">Na której linii idzie najgorzej</h3>
        <p className="mb-4 text-xs text-muted">
          Wszystkie występy {who ? displayNameOf(who) : "wybranych graczy"} na danej roli · winrate, średni score
          Harnasia (50 = typowy mecz na roli) i KDA
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {model.laneList.map(({ role, label, s }) => {
            const weak = model.weakest?.role === role;
            return (
              <div
                key={role}
                className={`rounded-xl border p-3 ${weak ? "border-danger/60 bg-danger/[0.06]" : "border-line/60 bg-panel2/40"}`}
              >
                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted">
                  {label}
                  {weak && <span className="text-danger">najsłabsza</span>}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{pct(s.w / s.n)}</div>
                <div className="text-xs text-muted">
                  {s.w}–{s.n - s.w} · score {avgScore(s)}
                </div>
                <div className="text-xs text-muted">
                  KDA {(s.k / s.n).toFixed(1)}/{(s.d / s.n).toFixed(1)}/{(s.a / s.n).toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChampList
          title="Najtrudniejsi rywale na linii"
          subtitle="Champion przeciwnika na tej samej roli · od najgorszego bilansu (min. 2 gry)"
          icon={<Swords size={16} className="text-danger" />}
          entries={model.laneWorst}
          ver={ver}
          showScore
          empty="Za mało gier przeciwko tym samym championom."
        />
        <ChampList
          title="Najgroźniejsi w drużynie wroga"
          subtitle="Champion w drużynie przeciwnej, na dowolnej roli · kandydaci do bana (min. 3 gry)"
          icon={<ShieldAlert size={16} className="text-danger" />}
          entries={model.enemyWorst}
          ver={ver}
          empty="Za mało gier przeciwko tym samym championom."
        />
        <ChampList
          title="Własne picki, którymi przegrywacie"
          subtitle="Championi, którymi graliście · od najgorszego bilansu (min. 3 gry)"
          icon={<TrendingDown size={16} className="text-danger" />}
          entries={model.ownWorst}
          ver={ver}
          showScore
          empty="Brak championów z 3+ grami i przegranymi."
        />
        <ChampList
          title="Najlepsze własne picki"
          subtitle="Championi z najlepszym bilansem (min. 3 gry) — warto ich wybierać częściej"
          icon={<TrendingUp size={16} className="text-felt" />}
          entries={model.ownBest}
          ver={ver}
          showScore
          empty="Brak championów z 3+ grami i wygranymi."
        />
      </div>
      <p className="text-xs text-muted">
        Kolejność list uwzględnia liczbę gier (winrate przyciągany do 50% przy małej próbie), więc 0–1 nie wyprzedza
        0–5. Arena i remake&apos;i są pominięte, rywal z linii tylko w grach z przypisanymi rolami.
      </p>
    </div>
  );
}
