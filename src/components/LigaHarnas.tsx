"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Calculator, Crown, Info, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/client";
import { displayNameOf } from "@/lib/users";
import { HARNAS_METRICS, HARNAS_MIN_CLUB } from "@/lib/harnas";
import type { GameMode, LeagueGame } from "@/lib/riot";

// Odpowiedź /api/liga/harnas
type HGame = Pick<LeagueGame, "id" | "queue" | "mode" | "startedLabel" | "harnas"> & {
  players: { username: string; champion: string; win: boolean; score: number | null; harnas: boolean }[];
};
type HMonth = { month: string; missing: number; incomplete: boolean; games: HGame[] };

type PlayerStat = {
  username: string;
  harnas: number;
  games: number;
  sum: number;
  best: { score: number; champion: string; label: string } | null;
};

const MONTHS_BACK = 24;
const REFRESH_MS = 35_000;
const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const monthLabel = (m: string) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const avg = (s: PlayerStat) => (s.games ? s.sum / s.games : 0);

function lastMonths(today: string, earliest: string): string[] {
  let [y, m] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < MONTHS_BACK; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key < earliest.slice(0, 7)) break;
    out.push(key);
    if (--m === 0) [y, m] = [y - 1, 12];
  }
  return out;
}

function ChampIcon({ champion, ver, size = 28 }: { champion: string; ver: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${champion}.png`}
      alt={champion}
      title={champion}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-lg ring-1 ring-line/60"
      style={{ width: size, height: size }}
    />
  );
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="panel p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Podium({ stats, ver }: { stats: PlayerStat[]; ver: string }) {
  // Na telefonie w kolejności miejsc, szerzej klasyczne podium 2 · 1 · 3
  const smOrder = ["sm:order-2", "sm:order-1", "sm:order-3"];
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-center">
      {stats.map((s, i) => {
        const place = i + 1;
        const first = place === 1;
        return (
          <div
            key={s.username}
            className={`panel relative flex flex-col items-center gap-2 px-4 text-center sm:w-64 ${smOrder[i]} ${
              first ? "harnas-card py-7" : "py-5"
            }`}
          >
            {first && <HarnasSparks />}
            <span className={first ? "harnas-avatar harnas-avatar-lg" : ""}>
              <Avatar username={s.username} size={first ? 64 : 48} />
              {first && (
                <span className="harnas-beer" aria-hidden>
                  🍺
                </span>
              )}
            </span>
            <div className="text-sm font-semibold">{displayNameOf(s.username)}</div>
            <div className={`font-display font-extrabold tabular-nums ${first ? "text-5xl text-gold" : "text-3xl"}`}>
              {s.harnas}×
            </div>
            <div className="text-[11px] uppercase tracking-wider text-muted">
              {first ? <span className="harnas-badge">Harnaś miesiąca</span> : `${place}. miejsce`}
            </div>
            {s.best && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <ChampIcon champion={s.best.champion} ver={ver} size={20} /> rekord {s.best.score.toFixed(1)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HarnasSparks({ ghost = false }: { ghost?: boolean }) {
  return (
    <span className="harnas-sparks" aria-hidden>
      {ghost && <Crown className="harnas-ghost" />}
      <i>✦</i>
      <i>✧</i>
      <i>✦</i>
      <i>✧</i>
      <i>✦</i>
    </span>
  );
}

export default function LigaHarnas({
  lineup,
  modes,
  ver,
  today,
  earliest,
}: {
  lineup: string[];
  modes: GameMode[];
  ver: string;
  today: string;
  earliest: string;
}) {
  const months = useMemo(() => lastMonths(today, earliest), [today, earliest]);
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState<HMonth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0); // odpowiedź dla miesiąca, z którego już przełączono, jest ignorowana

  async function calculate(m: string) {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    const res = await api(`/api/liga/harnas?miesiac=${m}`, "GET");
    if (id !== req.current) return;
    setLoading(false);
    if (res.ok) setData(res.data as HMonth);
    else setError(res.error ?? "Nie udało się policzyć rankingu");
  }

  function pickMonth(m: string) {
    req.current++;
    setMonth(m);
    setData(null);
    setLoading(false);
    setError(null);
  }

  // Statystyki części meczów jeszcze się dociągają (limit Riot API) — ponawiamy sami
  useEffect(() => {
    if (!data || (data.missing === 0 && !data.incomplete)) return;
    const t = setTimeout(() => calculate(data.month), REFRESH_MS);
    return () => clearTimeout(t);
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return null;
    const mSet = new Set(modes);
    const lSet = new Set(lineup);
    const games = data.games.filter(
      (g) => g.harnas && mSet.has(g.mode) && g.players.some((p) => lSet.has(p.username))
    );
    const per = new Map<string, PlayerStat>(
      lineup.map((u) => [u, { username: u, harnas: 0, games: 0, sum: 0, best: null }])
    );
    const crowned: { game: HGame; username: string; champion: string; score: number }[] = [];
    for (const g of games) {
      for (const p of g.players) {
        const s = per.get(p.username);
        if (!s || p.score === null) continue;
        s.games++;
        s.sum += p.score;
        if (p.harnas) {
          s.harnas++;
          crowned.push({ game: g, username: p.username, champion: p.champion, score: p.score });
        }
        if (!s.best || p.score > s.best.score) s.best = { score: p.score, champion: p.champion, label: g.startedLabel };
      }
    }
    const ranking = [...per.values()].sort((a, b) => b.harnas - a.harnas || avg(b) - avg(a));
    const record = crowned.reduce<(typeof crowned)[number] | null>((a, c) => (!a || c.score > a.score ? c : a), null);
    return { games: games.length, ranking, crowned, record };
  }, [data, modes, lineup]);

  const pending = !!data && (data.missing > 0 || data.incomplete);
  const podium = stats?.ranking.filter((s) => s.harnas > 0).slice(0, 3) ?? [];

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center gap-4 p-5">
        <div className="mr-auto min-w-0">
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
            <Crown size={20} className="text-gold" /> Ranking Harnasia
          </h2>
          <p className="text-sm text-muted">
            Harnasia dostaje najlepszy z ekipy w meczu, w którym grało nas co najmniej {HARNAS_MIN_CLUB} — kto zdobył go
            najczęściej?
          </p>
        </div>
        <select
          className="input h-10 w-auto py-0 text-sm"
          value={month}
          onChange={(e) => pickMonth(e.target.value)}
          aria-label="Miesiąc"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <button className="btn-primary" onClick={() => calculate(month)} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
          Oblicz
        </button>
      </div>

      {error && (
        <div className="panel flex items-center gap-3 p-4 text-sm text-danger">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {pending && (
        <div className="panel flex items-center gap-3 p-4 text-sm text-gold">
          <Loader2 size={16} className="shrink-0 animate-spin" />
          <span>
            Wynik wstępny — dociągam statystyki z Riot API (limit 100 zapytań na 2 min):{" "}
            {data!.incomplete ? "lista meczów jest jeszcze niepełna" : `brakuje jeszcze ${data!.missing} meczów`}
            {data!.missing > 0 && ` (ok. ${Math.ceil(data!.missing / 95) * 2} min)`}. Ranking przeliczy się sam.
          </span>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="panel p-10 text-center text-sm text-muted">
          Wybierz miesiąc i kliknij <span className="font-semibold text-cream">Oblicz</span>.
        </div>
      )}
      {!data && loading && (
        <div className="panel flex items-center justify-center gap-2 p-10 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Liczę {monthLabel(month).toLowerCase()}…
        </div>
      )}

      {stats && data && (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Ocenione mecze" value={stats.games} sub={monthLabel(data.month)} />
            <Tile
              label="Lider miesiąca"
              value={<span className="text-gold">{podium[0] ? `${podium[0].harnas}×` : "—"}</span>}
              sub={podium[0] ? displayNameOf(podium[0].username) : undefined}
            />
            <Tile
              label="Rekord miesiąca"
              value={stats.record ? stats.record.score.toFixed(1) : "—"}
              sub={
                stats.record
                  ? `${displayNameOf(stats.record.username)} · ${stats.record.champion} · ${stats.record.game.startedLabel}`
                  : undefined
              }
            />
          </div>

          {stats.games === 0 ? (
            <div className="panel p-8 text-center text-sm text-muted">
              Brak ocenionych meczów w tym miesiącu dla wybranych graczy i typów gry. Harnaś jest przyznawany tylko w
              grach, w których grało co najmniej {HARNAS_MIN_CLUB} osoby z ekipy (bez Areny i remake'ów).
            </div>
          ) : (
            <>
              {podium.length > 0 && <Podium stats={podium} ver={ver} />}

              <div className="panel overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line/60 text-left text-[11px] uppercase tracking-wider text-muted">
                      <th className="px-4 py-2.5 font-medium">#</th>
                      <th className="px-4 py-2.5 font-medium">Gracz</th>
                      <th className="px-4 py-2.5 text-right font-medium">Harnaś</th>
                      <th className="px-4 py-2.5 text-right font-medium">Mecze</th>
                      <th className="px-4 py-2.5 text-right font-medium">% meczów</th>
                      <th className="px-4 py-2.5 text-right font-medium">Śr. score</th>
                      <th className="px-4 py-2.5 font-medium">Najlepszy mecz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {stats.ranking.map((s, i) => (
                      <tr key={s.username} className={i === 0 && s.harnas > 0 ? "bg-gold/[0.06]" : ""}>
                        <td className="px-4 py-2.5 font-mono text-muted">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2 font-semibold">
                            <Avatar username={s.username} size={26} /> {displayNameOf(s.username)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1 font-mono text-base font-bold text-gold">
                            {s.harnas > 0 && <Crown size={14} />} {s.harnas}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{s.games}</td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {s.games ? `${Math.round((s.harnas / s.games) * 100)}%` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{s.games ? avg(s).toFixed(1) : "—"}</td>
                        <td className="px-4 py-2.5">
                          {s.best ? (
                            <span className="flex items-center gap-2 text-xs text-muted">
                              <ChampIcon champion={s.best.champion} ver={ver} size={22} />
                              <span className="font-mono text-cream">{s.best.score.toFixed(1)}</span> {s.best.label}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {stats.crowned.length > 0 && (
                <div className="panel p-4">
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                    <Crown size={13} /> Mecze z Harnasiem ({stats.crowned.length})
                  </div>
                  <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                    {stats.crowned.map((c) => (
                      <div
                        key={c.game.id}
                        className="flex items-center gap-2.5 rounded-xl border border-gold/25 bg-gold/[0.05] px-3 py-2"
                      >
                        <ChampIcon champion={c.champion} ver={ver} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{displayNameOf(c.username)}</div>
                          <div className="truncate text-xs text-muted">
                            {c.game.queue} · {c.game.startedLabel}
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-gold">{c.score.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <details className="panel group p-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <Info size={15} className="text-muted" /> Jak liczony jest score?
        </summary>
        <p className="mt-3 text-muted">
          Każdą statystykę porównujemy z typowym wynikiem na tej samej roli (z meczów ekipy) — support z typowym
          supportem, top z typowym topem, więc każda rola ma równe szanse. 50 pkt to typowy mecz na danej roli, każde
          odchylenie ponad przeciętną podnosi wynik, a skrajności są przycinane, żeby jedna statystyka (np. 0 śmierci)
          nie wygrywała sama. Harnasia dostaje ten z ekipy, kto ma najwyższy score — tylko w grach, w których grało
          co najmniej {HARNAS_MIN_CLUB} osoby z ekipy. Na ARAM-ie (bez ról) porównujemy z resztą meczu, bez złota,
          wizji i wardów. Harnaś nie jest przyznawany na Arenie i w remake'ach.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {HARNAS_METRICS.map((m) => (
            <li key={m.key} className="flex items-start justify-between gap-3 border-b border-line/30 pb-1.5">
              <span>
                {m.label}
                {m.lowerBetter && <span className="text-muted"> (im mniej, tym lepiej)</span>}
                {m.hint && <span className="block text-xs text-muted">{m.hint}</span>}
              </span>
              <span className="font-mono text-gold">{m.weight}%</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
