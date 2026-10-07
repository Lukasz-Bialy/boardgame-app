"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Coins, Link2Off, Lock, Minus, Pencil, Plus, Target, Trash2, Trophy, X, Zap } from "lucide-react";
import { betResult, exactHit, fmtOdds, fmtPts, poolOdds, seedOf, stakeRange } from "@/lib/pickem-rules";
import { api } from "@/lib/client";
import { Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import type { PickemMatch, PickemTeam } from "@/lib/pickem";
import { formatMatchTime, timeLeft } from "@/lib/pickem-time";
import { TeamLogo, slotHint } from "./parts";

export default function MatchCard({
  token,
  match: m,
  teams,
  matches,
  players,
  me,
  now,
  isAdmin,
  onEdit,
  onResult,
  ranks,
  wallet,
}: {
  token: string;
  match: PickemMatch;
  teams: Map<string, PickemTeam>;
  matches: Map<string, PickemMatch>;
  players: string[];
  me: string;
  now: number;
  isAdmin: boolean;
  onEdit: () => void;
  onResult: () => void;
  ranks: Map<string, number>; // miejsce drużyny w Global Power Rankings (LoL)
  wallet: number; // wolne żetony widza (bez stawki w tym meczu)
}) {
  const router = useRouter();
  const [pick, setPick] = useState(m.myPick);
  const [lw, setLw] = useState(m.myLoserWins); // typ wyniku: ile map wygra przegrany
  const [stake, setStake] = useState(m.myStake); // żetony postawione na typ
  const [stakeInput, setStakeInput] = useState(String(m.myStake)); // pole stawki w trakcie wpisywania
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Start sprawdzany też na bieżąco w przeglądarce — po minięciu terminu przyciski gasną od razu
  const started = m.started || new Date(m.starts_at).getTime() <= now;
  const known = !!(m.a && m.b);
  const canPick = !started && known && !m.winner_id;
  const decided = !!m.winner_id;
  const need = Math.ceil(m.best_of / 2);
  const scoreText = (loserWins: number) => `${need}:${loserWins}`;

  // Stawka w tym meczu może sięgać wolnych żetonów plus tego, co już tu leży
  // Minimum = punkty meczu (albo wszystko, co jest w portfelu)
  const { min: minStake, max: maxStake } = stakeRange(m.points, wallet + m.myStake);

  // Stawka z licznika/pola: przycięta do dozwolonego zakresu, zapis tylko przy zmianie
  function setStakeTo(n: number) {
    const next = Number.isFinite(n) ? Math.min(maxStake, Math.max(minStake, Math.round(n))) : stake;
    setStakeInput(String(next));
    if (next !== stake) save(pick, lw, next);
  }
  const stepBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-line text-cream transition enabled:hover:border-gold/50 disabled:opacity-30";

  // Cofnięcie typu kasuje też zakład; zmiana drużyny przenosi stawkę na nowy typ, nowy typ startuje od minimum
  async function save(nextPick: string | null, nextLw: number | null, nextStake = Math.max(stake, minStake)) {
    if (!canPick || busy) return;
    const prev = [pick, lw, stake] as const;
    setPick(nextPick);
    setLw(nextPick ? nextLw : null);
    setStake(nextPick ? nextStake : 0);
    setStakeInput(String(nextPick ? nextStake : 0));
    setBusy(true);
    setError("");
    const res = await api(`/api/pickem/${token}/matches/${m.id}/pick`, "PUT", {
      team_id: nextPick,
      loser_wins: nextPick ? nextLw : null,
      stake: nextPick ? nextStake : 0,
    });
    setBusy(false);
    if (!res.ok) {
      setPick(prev[0]);
      setLw(prev[1]);
      setStake(prev[2]);
      setStakeInput(String(prev[2]));
      return setError(res.error!);
    }
    router.refresh();
  }

  // Ponowne kliknięcie wybranej drużyny cofa typ; typ wyniku zostaje przy zmianie drużyny (liczy się od zwycięzcy)
  const choose = (teamId: string) => save(pick === teamId ? null : teamId, lw);
  // Mecz na wynik: jedno kliknięcie = zwycięzca + wynik; ponowne cofa typ
  const chooseScore = (team: string, n: number) => save(pick === team && lw === n ? null : team, n);
  // W meczu na wynik typuje się przez przyciski wyniku, nie przez kliknięcie drużyny
  const teamClickable = canPick && !m.exact;

  async function remove() {
    if (!confirm("Usunąć ten mecz wraz z typami? Mecze, które z niego brały drużynę, wrócą do „do ustalenia”.")) return;
    const res = await api(`/api/pickem/${token}/matches/${m.id}`, "DELETE");
    if (!res.ok) return alert(res.error);
    router.refresh();
  }

  // Przed startem tylko kurs bazowy z rankingu — rozkład stawek innych graczy jest tajny do zamknięcia typowania
  const odds = poolOdds(m.probA, seedOf(m.points), m.pool ?? undefined);
  const oddsOf = (id: string | null) => (id === m.a ? odds.a : odds.b);
  const oddsTitle = m.pool
    ? "Kurs z puli: cała pula ÷ punkty postawione na tę drużynę"
    : "Kurs bazowy z rankingu — ostateczny wyjdzie z puli po starcie meczu";

  // Lista głosujących liczona lokalnie, żeby własny typ pojawiał się bez czekania na odświeżenie
  const voters = new Set(m.voters);
  if (pick) voters.add(me);
  else voters.delete(me);

  function side(id: string | null, slot: PickemMatch["slotA"], score: number | null) {
    const t = id ? teams.get(id) : null;
    const mine = !!id && pick === id;
    const won = decided && m.winner_id === id;
    const lost = decided && !won;
    const backers = m.picks ? Object.entries(m.picks).filter(([, p]) => p.team_id === id) : [];

    return (
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <button
          type="button"
          onClick={() => id && teamClickable && choose(id)}
          disabled={!teamClickable || !id}
          className={`relative flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition ${
            won
              ? "border-gold/70 bg-gold/10"
              : mine
                ? "border-felt bg-felt/[0.12] shadow-glow-felt"
                : teamClickable
                  ? "border-line hover:border-felt/50 hover:bg-panel2"
                  : "border-line/60"
          } ${lost ? "opacity-50" : ""} ${teamClickable ? "cursor-pointer" : "cursor-default"}`}
        >
          {mine && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-felt px-1.5 py-0.5 text-[10px] font-bold text-onaccent">
              <Check size={10} strokeWidth={3} /> TY
            </span>
          )}
          {won && <Trophy size={14} className="absolute right-2 top-2 text-gold" />}
          <TeamLogo team={t} size={40} />
          <span className={`w-full truncate text-sm font-semibold ${t ? "" : "text-muted"}`}>
            {t ? t.name : slotHint(slot, matches, teams)}
          </span>
          {id && ranks.has(id) && (
            <span className="font-mono text-[11px] text-muted" title="Miejsce w Global Power Rankings">
              #{ranks.get(id)} na świecie
            </span>
          )}
          {known && id && (
            <span className="font-mono text-[11px] text-gold/80" title={oddsTitle}>
              kurs {m.pool ? "" : "~"}
              {fmtOdds(oddsOf(id))}
            </span>
          )}
          {decided && score !== null && <span className="font-mono text-2xl font-extrabold tabular-nums">{score}</span>}
        </button>
        {m.picks && id && (
          <div className="flex min-h-6 flex-wrap justify-center gap-1">
            {backers.map(([u, p]) => {
              const exact = exactHit(m, p);
              return (
                <span
                  key={u}
                  title={`${displayNameOf(u)}${p.loser_wins !== null ? ` · wynik ${scoreText(p.loser_wins)}` : ""}${exact ? " · trafiony!" : ""}`}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className="relative">
                    <Avatar username={u} size={22} />
                    {decided && (
                      <span
                        className={`absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-panel ${
                          won ? "bg-felt text-onaccent" : "bg-danger text-white"
                        }`}
                      >
                        {won ? <Check size={9} strokeWidth={4} /> : <X size={9} strokeWidth={4} />}
                      </span>
                    )}
                  </span>
                  {p.loser_wins !== null && (
                    <span className={`font-mono text-[10px] leading-none ${exact ? "font-bold text-gold" : "text-muted"}`}>
                      {scoreText(p.loser_wins)}
                    </span>
                  )}
                  {!!p.stake && (
                    <span className="inline-flex items-center gap-px font-mono text-[10px] leading-none text-gold" title={`Zakład: ${p.stake} żet.`}>
                      <Coins size={9} />
                      {p.stake}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const exactMine = pick ? exactHit(m, { team_id: pick, loser_wins: lw }) : false;
  const gained = decided && pick ? (pick === m.winner_id ? m.points + m.bonus + (exactMine ? m.exactBonus : 0) : 0) : null;
  const pickedTeam = pick ? teams.get(pick) : null;
  const myBet = decided && pick && stake ? betResult(stake, pick === m.winner_id, oddsOf(m.winner_id)) : null;
  const pickOdds = pick ? oddsOf(pick) : 0;

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-cream">{m.label ?? m.stage ?? "Mecz"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{formatMatchTime(m.starts_at)}</span>
            <span className="font-mono">Bo{m.best_of}</span>
            {m.exact && (
              <span className="inline-flex items-center gap-0.5 text-gold" title="Typuje się dokładny wynik serii">
                <Target size={11} /> na wynik
              </span>
            )}
            {isAdmin && m.ext && m.locked && (
              <span className="inline-flex items-center gap-0.5" title="Poprawiony ręcznie — synchronizacja z lolesports go pomija">
                <Link2Off size={11} /> ręcznie
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 text-muted">
          {/* Punkty bazowe za trafienie — zawsze widoczne, także przy 1 pkt */}
          <span
            className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-xs font-bold text-gold"
            title="Punkty bazowe za trafiony typ (bez bonusu pod prąd)"
          >
            {m.points} pkt
          </span>
          {isAdmin && (
            <>
              {known && (
                <button onClick={onResult} className="transition hover:text-gold" title="Wynik" aria-label="Wpisz wynik">
                  <Trophy size={16} />
                </button>
              )}
              <button onClick={onEdit} className="transition hover:text-cream" title="Edytuj" aria-label="Edytuj mecz">
                <Pencil size={15} />
              </button>
              <button onClick={remove} className="transition hover:text-danger" title="Usuń" aria-label="Usuń mecz">
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2">
        {side(m.a, m.slotA, m.score_a)}
        <span className="mt-11 shrink-0 font-display text-xs font-bold uppercase text-muted">vs</span>
        {side(m.b, m.slotB, m.score_b)}
      </div>


      {/* Mecz na dokładny wynik: wszystkie możliwe wyniki serii, zapisane jako A:B */}
      {m.exact && canPick && m.a && m.b && (
        <div className="rounded-xl bg-panel2/50 px-3 py-2.5">
          <p className="mb-2 text-xs text-muted">
            Typuj wynik ({teams.get(m.a)?.short ?? "A"} : {teams.get(m.b)?.short ?? "B"}) ·{" "}
            <span className="text-gold">trafiony wynik +{m.exactBonus} pkt</span>
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {[
              ...Array.from({ length: need }, (_, n) => ({ team: m.a!, n, text: `${need}:${n}` })),
              ...Array.from({ length: need }, (_, i) => need - 1 - i).map((n) => ({ team: m.b!, n, text: `${n}:${need}` })),
            ].map((o) => {
              const on = pick === o.team && lw === o.n;
              return (
                <button
                  key={o.text}
                  type="button"
                  onClick={() => chooseScore(o.team, o.n)}
                  disabled={busy}
                  title={`${teams.get(o.team)?.name} wygrywa ${need}:${o.n}`}
                  className={`min-w-[52px] rounded-lg border px-2.5 py-1.5 font-mono text-sm font-bold transition ${
                    on ? "border-felt bg-felt text-onaccent" : "border-line text-cream hover:border-felt/50"
                  }`}
                >
                  {o.text}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {m.exact && !canPick && pick && lw !== null && !m.picks && (
        <p className="text-xs text-muted">
          Twój typ: <b className="font-mono text-cream">{pickedTeam?.short ?? pickedTeam?.name} {scoreText(lw)}</b>
        </p>
      )}

      {/* Zakład: dodatkowe punkty na własny typ — trafienie wypłaca z puli, pudło je zabiera */}
      {canPick && pick && (
        <div className="rounded-xl bg-panel2/50 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Coins size={12} className="text-gold" /> Zakład na {pickedTeam?.short ?? pickedTeam?.name}
            </span>
            {maxStake > 0 && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setStakeTo(stake - 1)} disabled={busy || stake <= minStake} className={stepBtn} aria-label="Mniej">
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={minStake}
                  max={maxStake}
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  onBlur={() => setStakeTo(Number(stakeInput))}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  disabled={busy}
                  className="w-14 rounded-lg border border-gold/50 bg-gold/10 px-1 py-1 text-center font-mono text-sm font-bold text-gold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
                  aria-label="Stawka"
                />
                <button type="button" onClick={() => setStakeTo(stake + 1)} disabled={busy || stake >= maxStake} className={stepBtn} aria-label="Więcej">
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setStakeTo(maxStake)}
                  disabled={busy || stake >= maxStake}
                  className="ml-1 rounded-lg border border-danger/50 px-2 py-1 text-xs font-bold uppercase text-danger transition enabled:hover:bg-danger/10 disabled:opacity-30"
                  title={`Postaw wszystkie wolne żetony (${maxStake})`}
                >
                  All-in
                </button>
              </div>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-muted">
            {stake
              ? `Przy kursie bazowym ~${fmtOdds(pickOdds)}: trafienie +${fmtPts(stake * (pickOdds - 1))}, pudło −${stake} żet. Ostateczny kurs wyjdzie z puli po starcie.`
              : "Pusty portfel — typujesz bez zakładu. Żetony dostaniesz za trafione typy."}{" "}
            <span className="text-gold/80">Wolne: {fmtPts(Math.max(0, wallet + m.myStake - stake))} żet.</span>
          </p>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/50 pt-3 text-xs">
        {canPick ? (
          <span className="inline-flex items-center gap-1 text-gold">
            <Clock size={13} /> Typowanie zamyka się {timeLeft(m.starts_at, now)}
          </span>
        ) : decided ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className={gained ? "font-semibold text-felt" : "text-muted"}>
              {gained === null ? "Bez Twojego typu" : gained ? `Trafiony · +${gained} pkt` : "Pudło · 0 pkt"}
            </span>
            {m.bonus > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold"
                title="Na zwycięzcę typowała najwyżej 1/3 graczy — trafienie dostaje bonus"
              >
                <Zap size={11} /> Pod prąd +{m.bonus}
              </span>
            )}
            {exactMine && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold">
                <Target size={11} /> Dokładny wynik +{m.exactBonus}
              </span>
            )}
            {myBet !== null && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                  myBet >= 0 ? "bg-gold/15 text-gold" : "bg-danger/15 text-danger"
                }`}
                title={`Zakład ${stake} żet. (ranking hazardu)`}
              >
                <Coins size={11} /> Zakład {myBet >= 0 ? "+" : "−"}
                {fmtPts(Math.abs(myBet))}
              </span>
            )}
          </span>
        ) : started ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <Lock size={12} /> Trwa — czeka na wynik
            {stake > 0 && <span className="text-gold">· Twój zakład: {stake} żet.</span>}
          </span>
        ) : (
          <span className="text-muted">Czeka na drużyny</span>
        )}

        {/* Przed startem jawne jest tylko to, kto już zagłosował */}
        {!m.picks && (
          <span className="flex items-center gap-1" title="Kto już typował">
            {players.map((u) => (
              <span key={u} className={voters.has(u) ? "" : "opacity-25 grayscale"} title={`${displayNameOf(u)}: ${voters.has(u) ? "zagłosował(a)" : "jeszcze nie"}`}>
                <Avatar username={u} size={20} />
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
