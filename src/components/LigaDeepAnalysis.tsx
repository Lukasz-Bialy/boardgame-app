"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Flag, Loader2, Microscope, TrendingDown, Users } from "lucide-react";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/client";
import { displayNameOf } from "@/lib/users";
import type { LeagueGame } from "@/lib/riot";
import type { AnalysisResult, Insight } from "@/lib/match-analysis";

// Tyle samo co w /api/liga/analiza — 2 zapytania na mecz przy limicie 100 na 2 min
const MAX_GAMES = 30;
const COUNTS = [5, 10, 20, 30];
const REFRESH_MS = 35_000;

type Scope = { kind: "last"; count: number } | { kind: "one"; id: string };
type Response = { result: AnalysisResult; missing: string[]; analyzed: string[] };

function InsightCard({ i, tone }: { i: Insight; tone: "bad" | "good" }) {
  return (
    <div
      className={`rounded-xl border p-3 ${tone === "bad" ? "border-danger/40 bg-danger/[0.05]" : "border-felt/40 bg-felt/[0.05]"}`}
    >
      <div className="flex items-start gap-2">
        {tone === "bad" ? (
          <TrendingDown size={16} className="mt-0.5 shrink-0 text-danger" />
        ) : (
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-felt" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold">{i.title}</div>
          <div className="text-xs text-muted">{i.detail}</div>
          {tone === "bad" && <div className="mt-1.5 text-xs leading-relaxed">{i.tip}</div>}
        </div>
      </div>
    </div>
  );
}

function InsightList({ weak, strong, emptyWeak }: { weak: Insight[]; strong: Insight[]; emptyWeak: string }) {
  return (
    <div className="space-y-2">
      {weak.length === 0 ? (
        <div className="rounded-xl border border-line/60 p-3 text-xs text-muted">{emptyWeak}</div>
      ) : (
        weak.map((i) => <InsightCard key={i.key} i={i} tone="bad" />)
      )}
      {strong.length > 0 && (
        <div className="pt-1">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Mocne strony</div>
          <div className="space-y-2">
            {strong.map((i) => (
              <InsightCard key={i.key} i={i} tone="good" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Średnia przewaga złota drużyny minuta po minucie
function GoldCurve({ points }: { points: { minute: number; diff: number }[] }) {
  if (points.length < 3) return null;
  const W = 640;
  const H = 180;
  const pad = { l: 44, r: 8, t: 10, b: 22 };
  const maxAbs = Math.max(1000, ...points.map((p) => Math.abs(p.diff)));
  const lastMin = points[points.length - 1].minute;
  const x = (m: number) => pad.l + (m / lastMin) * (W - pad.l - pad.r);
  const y = (d: number) => pad.t + ((maxAbs - d) / (2 * maxAbs)) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.minute).toFixed(1)},${y(p.diff).toFixed(1)}`).join(" ");
  const area = `${line} L${x(lastMin)},${y(0)} L${x(0)},${y(0)} Z`;
  const ticks = [maxAbs, maxAbs / 2, 0, -maxAbs / 2, -maxAbs];
  const step = lastMin > 30 ? 10 : 5;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Przewaga złota drużyny w czasie">
      <defs>
        <clipPath id="gc-pos">
          <rect x="0" y="0" width={W} height={y(0)} />
        </clipPath>
        <clipPath id="gc-neg">
          <rect x="0" y={y(0)} width={W} height={H} />
        </clipPath>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--c-line))" strokeWidth={t === 0 ? 1.5 : 0.6} />
          <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="rgb(var(--c-muted))">
            {t === 0 ? "0" : `${t > 0 ? "+" : "−"}${(Math.abs(t) / 1000).toFixed(1)}k`}
          </text>
        </g>
      ))}
      {Array.from({ length: Math.floor(lastMin / step) + 1 }, (_, i) => i * step).map((m) => (
        <text key={m} x={x(m)} y={H - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--c-muted))">
          {m}&apos;
        </text>
      ))}
      <path d={area} fill="var(--viz-pos)" opacity="0.25" clipPath="url(#gc-pos)" />
      <path d={area} fill="var(--viz-neg)" opacity="0.25" clipPath="url(#gc-neg)" />
      <path d={line} fill="none" stroke="rgb(var(--c-cream))" strokeWidth="1.8" />
    </svg>
  );
}

export default function LigaDeepAnalysis({
  games,
  lineup,
  ver,
  target,
}: {
  games: LeagueGame[]; // już po filtrze typu gry
  lineup: string[];
  ver: string;
  target: string | null; // mecz wybrany przyciskiem „Analizuj” w historii
}) {
  // Kandydaci: mecze na Summoner's Rift z kimś z wybranego składu (bez Areny, ARAM-u i remake'ów)
  const candidates = useMemo(() => {
    const set = new Set(lineup);
    return games.filter(
      (g) => !g.arena && g.mode !== "aram" && g.players.some((p) => set.has(p.username) && !p.remake && p.position)
    );
  }, [games, lineup]);

  const [scope, setScope] = useState<Scope>(target ? { kind: "one", id: target } : { kind: "last", count: 10 });
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);
  const lastIds = useRef<string[]>([]);

  const ids = useMemo(
    () =>
      scope.kind === "one"
        ? [scope.id]
        : candidates.slice(0, Math.min(scope.count, MAX_GAMES)).map((g) => g.id),
    [scope, candidates]
  );

  async function run(list = ids) {
    if (!list.length) return;
    const id = ++req.current;
    lastIds.current = list;
    setLoading(true);
    setError(null);
    const res = await api("/api/liga/analiza", "POST", { ids: list, gracze: lineup });
    if (id !== req.current) return;
    setLoading(false);
    if (res.ok) setData(res.data as Response);
    else setError(res.error ?? "Analiza się nie udała");
  }

  // Mecz z przycisku „Analizuj” — od razu liczymy
  useEffect(() => {
    if (!target) return;
    setScope({ kind: "one", id: target });
    run([target]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Brakujące szczegóły (limit Riot API) — ponawiamy sami
  useEffect(() => {
    if (!data?.missing.length) return;
    const t = setTimeout(() => run(lastIds.current), REFRESH_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function change(next: Scope) {
    req.current++;
    setScope(next);
    setData(null);
    setLoading(false);
    setError(null);
  }

  const r = data?.result;
  const oneGame = scope.kind === "one" ? games.find((g) => g.id === scope.id) : undefined;

  return (
    <div className="space-y-4">
      <section className="panel flex flex-wrap items-end gap-4 p-5">
        <div className="mr-auto min-w-0 max-w-xl">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            <Microscope size={18} /> Co poszło najgorzej
          </h3>
          <p className="text-xs text-muted">
            Pobiera z Riot API szczegóły i oś czasu meczów (2 zapytania na mecz, ok. 45 meczów na 2 minuty — potem zostają
            w bazie) i porównuje każdego z rywalem z linii, a drużynę z przeciwnikami.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Zakres</span>
          <div className="flex flex-wrap gap-1.5">
            {COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => change({ kind: "last", count: n })}
                className={`h-9 rounded-lg border px-3 text-xs font-medium transition ${
                  scope.kind === "last" && scope.count === n
                    ? "border-felt/50 bg-felt/[0.14] text-cream"
                    : "border-line/60 text-muted hover:text-cream"
                }`}
              >
                Ostatnie {n}
              </button>
            ))}
            <select
              className="input h-9 w-auto max-w-[18rem] py-0 text-xs"
              value={scope.kind === "one" ? scope.id : ""}
              onChange={(e) => e.target.value && change({ kind: "one", id: e.target.value })}
              aria-label="Jeden mecz"
            >
              <option value="">Jeden mecz…</option>
              {candidates.slice(0, 100).map((g) => {
                const mine = g.players.filter((p) => lineup.includes(p.username));
                return (
                  <option key={g.id} value={g.id}>
                    {mine[0]?.win ? "W" : "P"} · {g.startedLabel} · {mine.map((p) => p.champion).join(", ")} · {g.queue}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <button className="btn-primary h-9" onClick={() => run()} disabled={loading || !ids.length}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Microscope size={16} />}
          Analizuj {scope.kind === "one" ? "mecz" : `${ids.length} meczów`}
        </button>
      </section>

      {!candidates.length && (
        <div className="panel p-8 text-center text-sm text-muted">
          Brak meczów na Summoner&apos;s Rift w wybranym zakresie dat, typach gry i składzie.
        </div>
      )}

      {error && (
        <div className="panel flex items-center gap-3 p-4 text-sm text-danger">
          <AlertTriangle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {data && data.missing.length > 0 && (
        <div className="panel flex items-center gap-3 p-4 text-sm text-gold">
          <Loader2 size={16} className="shrink-0 animate-spin" />
          Wynik wstępny z {data.analyzed.length} meczów — dociągam jeszcze {data.missing.length} (limit Riot API, ok.{" "}
          {Math.ceil(data.missing.length / 45) * 2} min). Analiza przeliczy się sama.
        </div>
      )}

      {!data && loading && (
        <div className="panel flex items-center justify-center gap-2 p-10 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Pobieram szczegóły meczów i analizuję…
        </div>
      )}

      {r && r.games === 0 && (
        <div className="panel p-8 text-center text-sm text-muted">Żaden z wybranych meczów nie nadaje się do analizy.</div>
      )}

      {r && r.games > 0 && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {/* Podsumowanie */}
          <div className="panel flex flex-wrap items-center gap-x-8 gap-y-2 p-4">
            {r.single && oneGame ? (
              <div className="text-sm">
                <span className={`font-bold ${r.single.win ? "text-felt" : "text-danger"}`}>
                  {r.single.win ? "Zwycięstwo" : "Porażka"}
                </span>{" "}
                · {oneGame.queue} · {oneGame.startedLabel} · {Math.round(r.single.minutes)} min
              </div>
            ) : (
              <>
                <div>
                  <div className="text-xl font-bold">{r.games}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted">przeanalizowanych meczów</div>
                </div>
                <div>
                  <div className="text-xl font-bold">
                    <span className="text-felt">{r.wins}</span>–<span className="text-danger">{r.games - r.wins}</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted">bilans</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{Math.round(r.avgMinutes)} min</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted">średnia długość</div>
                </div>
              </>
            )}
          </div>

          {/* Drużyna */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <section className="panel p-5 lg:col-span-3">
              <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                <Users size={18} /> Drużynowo
              </h3>
              <InsightList
                weak={r.team.weaknesses}
                strong={r.team.strengths}
                emptyWeak="Nic wyraźnie nie odstaje od przeciwników — dobra robota."
              />
            </section>
            <div className="space-y-4 lg:col-span-2">
              <section className="panel p-5">
                <h3 className="mb-1 font-display text-base font-bold">Przewaga złota w czasie</h3>
                <p className="mb-2 text-xs text-muted">
                  {r.single ? "Złoto drużyny minus złoto przeciwników" : "Średnio z przeanalizowanych meczów"}
                </p>
                <GoldCurve points={r.team.goldCurve} />
              </section>
              <section className="panel p-5">
                <h3 className="mb-3 font-display text-base font-bold">Cele{r.single ? "" : " (średnio na mecz)"}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted">
                      <th className="pb-1 text-left font-medium" />
                      <th className="pb-1 text-right font-medium">My</th>
                      <th className="pb-1 text-right font-medium">Oni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/30">
                    {r.team.objectives.map((o) => (
                      <tr key={o.label}>
                        <td className="py-1.5">{o.label}</td>
                        <td className={`py-1.5 text-right font-mono ${o.ours >= o.theirs ? "text-felt" : ""}`}>
                          {o.ours.toFixed(r.single ? 0 : 1)}
                        </td>
                        <td className={`py-1.5 text-right font-mono ${o.theirs > o.ours ? "text-danger" : ""}`}>
                          {o.theirs.toFixed(r.single ? 0 : 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </div>

          {/* Kluczowe momenty pojedynczego meczu */}
          {r.single && r.single.moments.length > 0 && (
            <section className="panel p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                <Flag size={18} /> Kluczowe momenty
              </h3>
              <ol className="space-y-1.5">
                {r.single.moments.map((m, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        m.tone === "bad" ? "bg-danger" : m.tone === "good" ? "bg-felt" : "bg-muted"
                      }`}
                    />
                    <span className="w-11 shrink-0 font-mono tabular-nums text-muted">
                      {Math.floor(m.t / 60)}:{String(m.t % 60).padStart(2, "0")}
                    </span>
                    <span>{m.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Indywidualnie */}
          <section>
            <h3 className="mb-3 font-display text-lg font-bold">Indywidualnie · względem rywala z linii</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {r.players.map((p) => (
                <div key={p.username} className="panel p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <Avatar username={p.username} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{displayNameOf(p.username)}</div>
                      <div className="truncate text-xs text-muted">
                        {r.single ? p.roles[0] : `${p.games} ${p.games === 1 ? "mecz" : "meczów"} · ${p.roles.join(", ")}`}
                      </div>
                    </div>
                    <span className="flex -space-x-1.5">
                      {p.champions.slice(0, 4).map((c) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={c}
                          src={`https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${c}.png`}
                          alt={c}
                          title={c}
                          width={26}
                          height={26}
                          loading="lazy"
                          className="h-[26px] w-[26px] rounded-md ring-2 ring-panel"
                        />
                      ))}
                    </span>
                  </div>
                  <InsightList
                    weak={p.weaknesses}
                    strong={p.strengths}
                    emptyWeak="Na tle rywali z linii nic wyraźnie nie odstaje."
                  />
                </div>
              ))}
            </div>
          </section>

          <p className="text-xs text-muted">
            Słabości to statystyki z największą stratą do rywala z linii (drużynowo: do przeciwników) w tych samych
            meczach. „Zgony z dala od drużyny” są szacowane z pozycji zapisywanych co minutę.
          </p>
        </div>
      )}
    </div>
  );
}
