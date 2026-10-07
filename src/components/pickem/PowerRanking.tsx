"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { GprTeam } from "@/lib/gpr";
import type { PickemMatch, PickemTeam } from "@/lib/pickem";
import { TeamLogo } from "./parts";
import TeamPreview from "./TeamPreview";

export type TournamentRanking = {
  updated: string;
  byTeam: Record<string, GprTeam>; // id drużyny turnieju → wpis z rankingu
};

const dateFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "short" });

// Miejsce w rankingu w czasie: jedna seria, oś odwrócona (1. miejsce na górze), skala wspólna dla tabeli,
// żeby wykresy w wierszach dało się porównywać
export function RankTrend({
  history,
  worst,
  points = 12,
  W = 112,
  H = 30,
  fluid = false,
}: {
  history: GprTeam["history"];
  worst: number;
  points?: number;
  W?: number;
  H?: number;
  fluid?: boolean; // szerokość kontenera (viewBox skaluje wykres)
}) {
  const pts = history.slice(-points);
  if (pts.length < 2) return <span className="text-xs text-muted">—</span>;
  const pad = 4;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (rank: number) => pad + ((rank - 1) / Math.max(1, worst - 1)) * (H - 2 * pad);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={fluid ? "100%" : W} height={fluid ? undefined : H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible" role="img" aria-label={`Miejsce w rankingu: od ${pts[0].rank}. do ${last.rank}.`}>
      <path d={d} fill="none" stroke="rgb(var(--c-felt))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        // Duży, niewidoczny cel najechania + podpowiedź z datą i miejscem
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.rank)} r={7} fill="transparent">
            <title>{`${dateFmt.format(new Date(p.date))}: ${p.rank}. miejsce (${p.score} pkt)`}</title>
          </circle>
          {i === pts.length - 1 && <circle cx={x(i)} cy={y(p.rank)} r={3} fill="rgb(var(--c-felt))" stroke="rgb(var(--c-panel))" strokeWidth={2} />}
        </g>
      ))}
    </svg>
  );
}

function Change({ rank, prev }: { rank: number; prev: number | null }) {
  const diff = prev === null ? 0 : prev - rank;
  if (!diff) return <Minus size={12} className="text-muted/60" aria-label="bez zmian" />;
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center text-xs font-semibold ${up ? "text-felt" : "text-danger"}`} title={`Poprzednio ${prev}.`}>
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(diff)}
    </span>
  );
}

export default function PowerRanking({
  ranking,
  error,
  teams,
  matches,
}: {
  ranking: TournamentRanking | null;
  error: string | null;
  teams: PickemTeam[];
  matches: PickemMatch[];
}) {
  const [preview, setPreview] = useState<PickemTeam | null>(null);
  if (!ranking) {
    return (
      <div className="panel p-8 text-center text-sm text-muted">{error ?? "Power ranking jest niedostępny."}</div>
    );
  }

  // Bilans w tym turnieju z wpisanych wyników
  const record = new Map<string, { w: number; l: number }>();
  for (const m of matches) {
    if (!m.winner_id || !m.a || !m.b) continue;
    const loser = m.winner_id === m.a ? m.b : m.a;
    const w = record.get(m.winner_id) ?? { w: 0, l: 0 };
    const l = record.get(loser) ?? { w: 0, l: 0 };
    w.w++;
    l.l++;
    record.set(m.winner_id, w);
    record.set(loser, l);
  }

  const ranked = teams
    .filter((t) => ranking.byTeam[t.id])
    .sort((a, b) => ranking.byTeam[a.id].rank - ranking.byTeam[b.id].rank);
  const unranked = teams.filter((t) => !ranking.byTeam[t.id]);
  const worst = Math.max(...ranked.flatMap((t) => ranking.byTeam[t.id].history.slice(-12).map((h) => h.rank)), 2);

  return (
    <div className="space-y-3">
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line/60 text-[11px] uppercase tracking-wider text-muted/80">
              <th className="px-3 py-2.5 text-left font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Drużyna</th>
              <th className="px-3 py-2.5 text-right font-semibold" title="Miejsce w Global Power Rankings">Świat</th>
              <th className="px-3 py-2.5 text-right font-semibold">GPR</th>
              <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell" title="Bilans meczów (mapy) w sezonie">Sezon</th>
              <th className="px-3 py-2.5 text-right font-semibold" title="Bilans meczów w tym turnieju">Turniej</th>
              <th className="hidden px-3 py-2.5 text-left font-semibold md:table-cell">Miejsce w czasie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {ranked.map((t, i) => {
              const g = ranking.byTeam[t.id];
              const rec = record.get(t.id);
              return (
                <tr key={t.id} onClick={() => setPreview(t)} className="cursor-pointer transition hover:bg-panel2/40">
                  <td className="px-3 py-2.5 font-mono font-bold text-muted">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    {/* Przycisk dla klawiatury; kliknięcie w cały wiersz robi to samo */}
                    <button type="button" className="group flex items-center gap-2.5 text-left" onClick={(e) => (e.stopPropagation(), setPreview(t))}>
                      <TeamLogo team={t} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold group-hover:text-felt">{t.name}</span>
                        {g.league && <span className="text-xs text-muted">{g.league}</span>}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <Change rank={g.rank} prev={g.prevRank} />
                      <span className="font-mono font-bold">{g.rank}.</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{g.score}</td>
                  <td className="hidden px-3 py-2.5 text-right font-mono sm:table-cell">
                    {g.wins}-{g.losses}
                    <span className="block text-xs text-muted">
                      mapy {g.gameWins}-{g.gameLosses}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{rec ? `${rec.w}-${rec.l}` : "—"}</td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    <RankTrend history={g.history} worst={worst} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {unranked.length > 0 && (
        <p className="px-1 text-xs text-muted">
          Bez miejsca w rankingu: {unranked.map((t) => t.short ?? t.name).join(", ")}
        </p>
      )}
      <p className="px-1 text-xs text-muted">
        Źródło: Global Power Rankings, lolesports.com · przeliczono {dateFmt.format(new Date(ranking.updated))}. Strzałka
        pokazuje zmianę od poprzedniego przeliczenia. Kliknij drużynę, żeby zobaczyć skład i formę.
      </p>
      {preview && (
        <TeamPreview
          team={preview}
          gpr={ranking.byTeam[preview.id]}
          ranks={new Map(ranked.map((t) => [t.id, ranking.byTeam[t.id].rank]))}
          teams={new Map(teams.map((t) => [t.id, t]))}
          matches={matches}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
