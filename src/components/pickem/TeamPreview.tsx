"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Clock } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import type { GprTeam } from "@/lib/gpr";
import type { LolPlayer, LolRole } from "@/lib/lolesports";
import type { PickemMatch, PickemTeam } from "@/lib/pickem";
import { formatMatchTime } from "@/lib/pickem-time";
import { TeamLogo } from "./parts";
import { RankTrend } from "./PowerRanking";

const ROLES: { role: LolRole; label: string }[] = [
  { role: "top", label: "Top" },
  { role: "jungle", label: "Dżungla" },
  { role: "mid", label: "Mid" },
  { role: "bottom", label: "Bot (ADC)" },
  { role: "support", label: "Support" },
  { role: "none", label: "Inni" },
];

const monthFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", month: "short", year: "numeric" });
const pct = (w: number, l: number) => (w + l ? Math.round((w / (w + l)) * 100) : 0);

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line/60 bg-panel2/40 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 font-display text-xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted/80">{title}</h3>
      {children}
    </section>
  );
}

function Roster({ slug }: { slug: string }) {
  const [players, setPlayers] = useState<LolPlayer[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/pickem/roster?slug=${encodeURIComponent(slug)}`, "GET").then((res) =>
      res.ok ? setPlayers(res.data.players) : setError(res.error!),
    );
  }, [slug]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!players) return <p className="text-sm text-muted">Wczytywanie składu…</p>;
  if (!players.length) return <p className="text-sm text-muted">lolesports nie podaje składu tej drużyny.</p>;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ROLES.flatMap(({ role, label }) =>
          players
            .filter((p) => p.role === role)
            .map((p) => (
              <div key={`${role}:${p.nick}`} className="flex items-center gap-2.5 rounded-xl border border-line/60 bg-panel2/40 p-2">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-panel object-cover object-top" />
                ) : (
                  <span className="h-10 w-10 shrink-0 rounded-lg bg-panel" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.nick}</span>
                  <span className="block truncate text-xs text-muted">
                    {label} · {p.name}
                  </span>
                </span>
              </div>
            )),
        )}
      </div>
      <p className="text-xs text-muted">
        Skład z lolesports — obejmuje też akademię i rezerwowych, API nie oznacza podstawowej piątki.
      </p>
    </div>
  );
}

export default function TeamPreview({
  team,
  gpr,
  ranks,
  teams,
  matches,
  onClose,
}: {
  team: PickemTeam;
  gpr: GprTeam;
  ranks: Map<string, number>; // miejsca w rankingu drużyn turnieju (rywale)
  teams: Map<string, PickemTeam>;
  matches: PickemMatch[];
  onClose: () => void;
}) {
  const diff = gpr.prevRank === null ? 0 : gpr.prevRank - gpr.rank;
  const hist = gpr.history;
  const ranksSeen = hist.map((h) => h.rank);
  const best = Math.min(...ranksSeen, gpr.rank);
  const worstSeen = Math.max(...ranksSeen, gpr.rank);

  // Mecze tej drużyny w turnieju
  const mine = matches.filter((m) => m.a === team.id || m.b === team.id);
  const played = mine.filter((m) => m.winner_id);
  const wins = played.filter((m) => m.winner_id === team.id).length;
  const next = mine.find((m) => !m.winner_id && !m.started);
  const opp = (m: PickemMatch) => teams.get(m.a === team.id ? m.b! : m.a!);

  return (
    <Modal open onClose={onClose} title={team.name} wide>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <TeamLogo team={team} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-2xl font-extrabold">#{gpr.rank} na świecie</span>
              {diff !== 0 && (
                <span className={`inline-flex items-center text-sm font-semibold ${diff > 0 ? "text-felt" : "text-danger"}`}>
                  {diff > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  {Math.abs(diff)} od poprzedniego przeliczenia
                </span>
              )}
            </div>
            <p className="text-sm text-muted">
              {gpr.league ?? "—"} · najwyżej w sezonie #{best}, najniżej #{worstSeen}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="GPR" value={gpr.score} sub={gpr.avgOpponentScore ? `rywale śr. ${gpr.avgOpponentScore}` : undefined} />
          <Stat label="Mecze w sezonie" value={`${gpr.wins}-${gpr.losses}`} sub={`${pct(gpr.wins, gpr.losses)}% wygranych`} />
          <Stat label="Mapy w sezonie" value={`${gpr.gameWins}-${gpr.gameLosses}`} sub={`${pct(gpr.gameWins, gpr.gameLosses)}% wygranych`} />
          <Stat label="W tym turnieju" value={played.length ? `${wins}-${played.length - wins}` : "—"} sub={`${mine.length} meczów w terminarzu`} />
        </div>

        {next && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gold/40 bg-gold/[0.07] px-4 py-3 text-sm">
            <Clock size={16} className="shrink-0 text-gold" />
            <span className="text-muted">Najbliższy mecz:</span>
            {opp(next) ? (
              <span className="inline-flex items-center gap-2 font-semibold">
                vs <TeamLogo team={opp(next)} size={22} /> {opp(next)!.name}
                {ranks.has(opp(next)!.id) && <span className="font-mono text-xs text-muted">#{ranks.get(opp(next)!.id)} na świecie</span>}
              </span>
            ) : (
              <span className="font-semibold">rywal do ustalenia</span>
            )}
            <span className="text-muted">
              · {formatMatchTime(next.starts_at)} · Bo{next.best_of}
            </span>
          </div>
        )}

        <Section title="Miejsce w rankingu w sezonie">
          <div className="rounded-xl border border-line/60 bg-panel2/40 p-3">
            <div className="flex justify-between text-[11px] text-muted">
              <span>#{best}</span>
              <span>
                {hist.length ? `${monthFmt.format(new Date(hist[0].date))} – ${monthFmt.format(new Date(hist[hist.length - 1].date))}` : ""}
              </span>
            </div>
            <RankTrend history={hist} worst={worstSeen} points={hist.length} W={440} H={90} fluid />
            <div className="text-[11px] text-muted">#{worstSeen}</div>
          </div>
        </Section>

        {played.length > 0 && (
          <Section title="Wyniki w tym turnieju">
            <ul className="divide-y divide-line/40 rounded-xl border border-line/60">
              {played.map((m) => {
                const won = m.winner_id === team.id;
                const o = opp(m);
                const my = m.a === team.id ? m.score_a : m.score_b;
                const their = m.a === team.id ? m.score_b : m.score_a;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span
                      className={`w-6 shrink-0 rounded text-center text-xs font-bold ${won ? "bg-felt/15 text-felt" : "bg-danger/15 text-danger"}`}
                    >
                      {won ? "W" : "P"}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      vs <TeamLogo team={o} size={20} /> <span className="truncate">{o?.name}</span>
                    </span>
                    {my !== null && their !== null && <span className="font-mono">{my}:{their}</span>}
                    <span className="hidden text-xs text-muted sm:inline">{m.stage}</span>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {gpr.tournaments.length > 0 && (
          <Section title="Turnieje w sezonie">
            <div className="overflow-x-auto rounded-xl border border-line/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line/60 text-[11px] uppercase tracking-wider text-muted/80">
                    <th className="px-3 py-2 text-left font-semibold">Turniej</th>
                    <th className="px-3 py-2 text-right font-semibold">Bilans</th>
                    <th className="px-3 py-2 text-right font-semibold">Miejsce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {gpr.tournaments.map((t) => (
                    <tr key={`${t.name}:${t.start}`}>
                      <td className="px-3 py-2">
                        {t.name}
                        {t.state === "inProgress" && <span className="ml-2 text-xs text-gold">trwa</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {t.wins}-{t.losses}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {t.placement ? (
                          <span className={t.placement === 1 ? "font-bold text-gold" : ""}>
                            {t.placement}.{t.teams ? <span className="text-muted">/{t.teams}</span> : null}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <Section title="Skład">
          <Roster slug={gpr.slug} />
        </Section>
      </div>
    </Modal>
  );
}
