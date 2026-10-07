"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpen, CalendarDays, Check, Coins, History, Link2, Plus, RefreshCw, Swords, Target, Trophy, Zap } from "lucide-react";
import { SEED_PER_POINT, START_TOKENS, TOKENS_PER_HIT, fmtPts, halfBonus } from "@/lib/pickem-rules";
import { api } from "@/lib/client";
import { Avatar } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import { displayNameOf } from "@/lib/users";
import type { PickemMatch, PickemStanding, PickemTournamentView } from "@/lib/pickem";
import TournamentForm from "./TournamentForm";
import TeamsManager from "./TeamsManager";
import MatchForm from "./MatchForm";
import ResultForm from "./ResultForm";
import MatchCard from "./MatchCard";
import PowerRanking, { type TournamentRanking } from "./PowerRanking";

// matches = mecze do obstawienia (domyślna), schedule = trwające i czekające na drużyny, history = rozstrzygnięte
type Tab = "matches" | "schedule" | "history" | "ranking" | "rules";
// Zakładka w adresie (?widok=…), żeby dało się ją podlinkować; strona serwera czyta te same wartości
const TAB_PARAM: Record<Exclude<Tab, "matches">, string> = {
  schedule: "harmonogram",
  history: "historia",
  ranking: "ranking",
  rules: "zasady",
};

// 1 mecz, 2–4 mecze, 5+ meczów (12–14 też „meczów”)
function meczow(n: number) {
  if (n === 1) return "mecz";
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? "mecze" : "meczów";
}

function ago(iso: string, now: number) {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h temu` : `${Math.round(h / 24)} dni temu`;
}

// Pasek turnieju podpiętego pod lolesports: kiedy ostatnio pobrano dane, błąd, ręczne odświeżenie
function SyncBar({ view, now, isAdmin }: { view: PickemTournamentView; now: number; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function sync() {
    setBusy(true);
    setMsg("");
    const res = await api(`/api/pickem/${view.token}/sync`, "POST");
    setBusy(false);
    if (!res.ok) return setMsg(res.error!);
    const { added, updated, teams } = res.data;
    setMsg(added || updated || teams ? `Nowe mecze: ${added}, zmienione: ${updated}, nowe drużyny: ${teams}` : "Bez zmian");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line/60 bg-panel/50 px-4 py-2.5 text-sm">
      <RefreshCw size={15} className={`text-felt ${busy ? "animate-spin" : ""}`} />
      <span className="text-muted">
        Mecze, drużyny i wyniki z <b className="text-cream">lolesports</b>
        {view.synced_at ? ` · zsynchronizowano ${ago(view.synced_at, now)}` : ""}
      </span>
      {view.sync_error && <span className="text-danger">{view.sync_error}</span>}
      {msg && <span className="text-felt">{msg}</span>}
      {isAdmin && (
        <button className="btn-ghost ml-auto px-3 py-1.5 text-xs" onClick={sync} disabled={busy}>
          {busy ? "Synchronizacja…" : "Synchronizuj"}
        </button>
      )}
    </div>
  );
}

// Najwięcej, ile da się wziąć z meczu: punkty + pod prąd + dokładny wynik
const maxOf = (m: PickemMatch) => m.points + halfBonus(m.points) + m.exactBonus;
const range = (xs: number[]) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
};

function RulesTable({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-line/40">
        {rows.map(([k, v], i) => (
          <tr key={i}>
            <td className="px-4 py-2 text-muted">{k}</td>
            <td className="px-4 py-2 text-right font-medium">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RulesPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line/60 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          {icon} {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

const RulesNote = ({ children }: { children: React.ReactNode }) => (
  <p className="border-t border-line/40 px-4 py-2.5 text-xs leading-relaxed text-muted">{children}</p>
);

function Rules({ matches }: { matches: PickemMatch[] }) {
  // Punkty bazowe w kolejności etapów (etap może mieć mecze o różnej wadze — wtedy zakres)
  const stages: { stage: string; points: number[]; max: number[] }[] = [];
  for (const m of matches) {
    const stage = m.stage ?? "Mecze";
    const s = stages.find((x) => x.stage === stage);
    if (s) {
      s.points.push(m.points);
      s.max.push(maxOf(m));
    } else stages.push({ stage, points: [m.points], max: [maxOf(m)] });
  }

  return (
    <div className="space-y-4">
      <RulesPanel title="Typowanie" icon={<Trophy size={17} className="text-gold" />}>
        <RulesTable
          rows={[
            ["Trafiony typ", "punkty meczu"],
            [
              <span key="u" className="inline-flex items-center gap-1 text-gold">
                <Zap size={12} /> Pod prąd
              </span>,
              "+50% (min. +1)",
            ],
            [
              <span key="e" className="inline-flex items-center gap-1 text-gold">
                <Target size={12} /> Trafiony wynik
              </span>,
              "+50% (min. +1)",
            ],
            ["Pudło lub brak typu", "0"],
            ["Typowanie", "do startu meczu"],
            ["Typy innych", "widoczne od startu"],
          ]}
        />
        <RulesNote>
          Pod prąd = trafienie, gdy typowały co najmniej 3 osoby, a na zwycięzcę postawiła najwyżej 1/3 z nich. Mecze
          oznaczone „na wynik” typuje się wynikiem serii (np. 2:1) — trafiony zwycięzca daje punkty, trafiony wynik
          dodatkowo bonus. Bonusy się sumują. Kliknij swój typ jeszcze raz, żeby go cofnąć.
        </RulesNote>
      </RulesPanel>

      <RulesPanel title="Hazard" icon={<Coins size={17} className="text-gold" />}>
        <RulesTable
          rows={[
            ["Portfel na start", `${START_TOKENS} żet.`],
            ["Trafiony typ", `+${TOKENS_PER_HIT} żet.`],
            ["Stawka", "min. punkty meczu, bez limitu"],
            ["Trafiony zakład", "stawka × kurs"],
            ["Pudło", "traci stawkę"],
            ["Wygrywa", "najpełniejszy portfel"],
          ]}
        />
        <RulesNote>
          Hazard to osobny ranking — nie zmienia punktów typowania. Każdy typ jest zakładem: stawiasz co najmniej tyle
          żetonów, ile punktów jest wart mecz (albo wszystko, co masz; z pustym portfelem typujesz bez zakładu). Górnego
          limitu nie ma — możesz iść all-in. Żetony postawione w meczach bez wyniku są zajęte.
          <br />
          <br />
          Stawki z meczu trafiają do puli razem z żetonami od gry ({SEED_PER_POINT} × punkty meczu, rozłożone według
          power rankingu). Trafieni dzielą całą pulę proporcjonalnie do stawek. Kurs = pula ÷ żetony na daną drużynę,
          więc pewniak płaci mało, a trafiony underdog dużo — a duża stawka sama obniża sobie kurs.
          <br />
          <br />
          Przed startem widać tylko kurs bazowy z rankingu (z „~”); stawki innych są tajne do zamknięcia typowania.
          Ostateczny kurs wychodzi z puli po starcie meczu.
        </RulesNote>
      </RulesPanel>

      {stages.length > 0 && (
        <RulesPanel title="Etapy" icon={<Swords size={17} className="text-gold" />}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted/80">
                <th className="px-4 py-2 text-left font-semibold">Etap</th>
                <th className="px-2 py-2 text-right font-semibold">Pkt</th>
                <th className="px-4 py-2 text-right font-semibold" title="Z oboma bonusami">
                  Maks.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {stages.map((s) => (
                <tr key={s.stage}>
                  <td className="px-4 py-2">{s.stage}</td>
                  <td className="px-2 py-2 text-right font-mono font-bold text-gold">{range(s.points)}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted">{range(s.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </RulesPanel>
      )}
    </div>
  );
}

// Ranking hazardu: stan portfela (żetony za trafienia + bilans zakładów)
function Gambling({ rows, me }: { rows: PickemStanding[]; me: string }) {
  const sorted = [...rows].sort((x, y) => y.wallet - x.wallet || y.bets - x.bets);
  const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmtPts(Math.abs(n));
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line/60 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Coins size={17} className="text-gold" /> Hazard
        </h2>
      </div>
      <ol className="divide-y divide-line/40">
        {sorted.map((s, i) => {
          const place = sorted.findIndex((r) => r.wallet === s.wallet) + 1;
          return (
            <li key={s.username} className={`flex items-center gap-3 px-4 py-2 ${s.username === me ? "bg-felt/[0.07]" : ""}`}>
              <span className={`w-5 text-center font-mono text-sm font-bold ${place === 1 ? "text-gold" : "text-muted"}`}>
                {i === 0 || sorted[i - 1].wallet !== s.wallet ? place : ""}
              </span>
              <Avatar username={s.username} size={26} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{displayNameOf(s.username)}</div>
                <div className="text-xs text-muted">
                  zakłady{" "}
                  <span className={s.bets > 0 ? "text-gold" : s.bets < 0 ? "text-danger" : ""}>{signed(s.bets)}</span>
                </div>
              </div>
              <span className="font-display text-lg font-extrabold tabular-nums" title="Żetony w portfelu">
                {fmtPts(s.wallet)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Standings({ rows, me }: { rows: PickemStanding[]; me: string }) {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line/60 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Trophy size={17} className="text-gold" /> Klasyfikacja
        </h2>
      </div>
      <ol className="divide-y divide-line/40">
        {rows.map((s, i) => {
          // Miejsce ex aequo przy równych punktach
          const place = rows.findIndex((r) => r.points === s.points) + 1;
          const acc = s.decided ? Math.round((s.correct / s.decided) * 100) : null;
          return (
            <li key={s.username} className={`flex items-center gap-3 px-4 py-2.5 ${s.username === me ? "bg-felt/[0.07]" : ""}`}>
              <span
                className={`w-5 text-center font-mono text-sm font-bold ${
                  place === 1 && s.points > 0 ? "text-gold" : "text-muted"
                }`}
              >
                {i === 0 || rows[i - 1].points !== s.points ? place : ""}
              </span>
              <Avatar username={s.username} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{displayNameOf(s.username)}</div>
                <div className="text-xs text-muted">
                  {s.correct}/{s.decided} trafień{acc !== null ? ` · ${acc}%` : ""}
                  {s.upsets > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-gold" title="Trafienia pod prąd">
                      <Zap size={10} /> {s.upsets}
                    </span>
                  )}
                  {s.exact > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-gold" title="Trafione dokładne wyniki">
                      <Target size={10} /> {s.exact}
                    </span>
                  )}
                </div>
              </div>
              <span className="font-display text-2xl font-extrabold tabular-nums">{s.points}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function PickemClient({
  view,
  me,
  isAdmin,
  syncing,
  shareUrl,
  ranking,
  initialTab,
}: {
  view: PickemTournamentView;
  me: string;
  isAdmin: boolean;
  syncing: boolean; // serwer właśnie pobiera dane z lolesports w tle
  shareUrl: string;
  ranking: { data: TournamentRanking | null; error: string | null } | null; // null = turniej bez rankingu
  initialTab: Tab;
}) {
  const router = useRouter();
  // Start z czasem serwera (ten sam render po obu stronach), potem zegar przeglądarki
  const [now, setNow] = useState(() => Date.parse(view.now));
  const [tab, setTabState] = useState<Tab>(initialTab);
  const ranks = useMemo(
    () => new Map(Object.entries(ranking?.data?.byTeam ?? {}).map(([id, g]) => [id, g.rank])),
    [ranking],
  );

  function setTab(t: Tab) {
    setTabState(t);
    const url = new URL(window.location.href);
    if (t !== "matches") url.searchParams.set("widok", TAB_PARAM[t]);
    else url.searchParams.delete("widok");
    window.history.replaceState(null, "", url);
  }
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<PickemMatch | "new" | null>(null);
  const [scoring, setScoring] = useState<PickemMatch | null>(null);

  const teams = useMemo(() => new Map(view.teams.map((t) => [t.id, t])), [view.teams]);
  const matchMap = useMemo(() => new Map(view.matches.map((m) => [m.id, m])), [view.matches]);
  const players = view.standings.map((s) => s.username);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // Synchronizacja w tle trwa kilka sekund — potem raz dociągamy świeże dane
  useEffect(() => {
    if (!syncing) return;
    const t = window.setTimeout(() => router.refresh(), 6000);
    return () => window.clearTimeout(t);
  }, [syncing, router]);

  // Gdy mecz się zaczyna, serwer odsłania typy — pobieramy je raz na każdy taki mecz
  const revealed = useRef(new Set<string>());
  useEffect(() => {
    const due = view.matches.filter((m) => !m.started && Date.parse(m.starts_at) <= now && !revealed.current.has(m.id));
    if (!due.length) return;
    due.forEach((m) => revealed.current.add(m.id));
    router.refresh();
  }, [now, view.matches, router]);

  // Podział meczów na zakładki: do obstawienia / harmonogram (trwające i bez znanych drużyn) / historia
  const isOpen = (m: PickemMatch) => !!(m.a && m.b) && !m.winner_id && Date.parse(m.starts_at) > now;
  const open = view.matches.filter(isOpen);
  const missing = open.filter((m) => !m.myPick).length;
  const schedule = view.matches.filter((m) => !m.winner_id && !isOpen(m));
  const history = view.matches.filter((m) => m.winner_id).sort((x, y) => y.starts_at.localeCompare(x.starts_at));
  const shown = tab === "schedule" ? schedule : tab === "history" ? history : open;

  // Etapy w kolejności pierwszego meczu na liście
  const groups: { stage: string; matches: PickemMatch[] }[] = [];
  for (const m of shown) {
    const stage = m.stage ?? "Mecze";
    const g = groups.find((x) => x.stage === stage);
    if (g) g.matches.push(m);
    else groups.push({ stage, matches: [m] });
  }
  const nextLater = schedule.find((m) => Date.parse(m.starts_at) > now);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      prompt("Skopiuj link:", shareUrl);
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="chip text-gold">
            <Trophy size={13} /> Pick&apos;em
          </span>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">{view.name}</h1>
          {view.description && <p className="mt-1 max-w-2xl whitespace-pre-line text-sm text-muted">{view.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={copyLink} title={shareUrl}>
            {copied ? <Check size={16} /> : <Link2 size={16} />} {copied ? "Skopiowano" : "Kopiuj link"}
          </button>
          {isAdmin && (
            <>
              <TournamentForm token={view.token} initial={{ name: view.name, description: view.description }} />
              <TeamsManager token={view.token} teams={view.teams} />
              <button className="btn-primary" onClick={() => setEditing("new")}>
                <Plus size={16} /> Dodaj mecz
              </button>
            </>
          )}
        </div>
      </div>

      {view.source === "lolesports" && <SyncBar view={view} now={now} isAdmin={isAdmin} />}

      <div className="flex gap-1 overflow-x-auto border-b border-line/60" role="tablist">
        {(
          [
            { v: "matches", l: "Do obstawienia", Icon: Swords },
            { v: "schedule", l: "Harmonogram", Icon: CalendarDays },
            { v: "history", l: "Historia", Icon: History },
            ...(ranking ? [{ v: "ranking", l: "Power ranking", Icon: BarChart3 } as const] : []),
            { v: "rules", l: "Zasady", Icon: BookOpen },
          ] as const
        ).map(({ v, l, Icon }) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === v ? "border-felt text-cream" : "border-transparent text-muted hover:text-cream"
            }`}
          >
            <Icon size={15} /> {l}
            {/* Ile meczów czeka na mój typ */}
            {v === "matches" && missing > 0 && (
              <span
                className="rounded-full bg-gold px-1.5 py-px font-mono text-[11px] font-bold text-onaccent"
                title={`${missing} ${meczow(missing)} bez Twojego typu`}
              >
                {missing}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {tab === "rules" ? (
          <Rules matches={view.matches} />
        ) : tab === "ranking" && ranking ? (
          <PowerRanking ranking={ranking.data} error={ranking.error} teams={view.teams} matches={view.matches} />
        ) : (
          <div className="space-y-6">
            {groups.length === 0 ? (
              <div className="panel flex flex-col items-center gap-3 p-12 text-center">
                <Swords size={36} className="text-muted" />
                <p className="text-muted">
                  {view.matches.length === 0
                    ? isAdmin
                      ? "Brak meczów. Dodaj drużyny, a potem pierwsze mecze."
                      : "Admin nie dodał jeszcze meczów."
                    : tab === "history"
                      ? "Żaden mecz nie ma jeszcze wyniku."
                      : tab === "schedule"
                        ? "Nic więcej w harmonogramie — wszystko jest do obstawienia albo już rozstrzygnięte."
                        : "Wszystko obstawione albo nic jeszcze nie jest otwarte."}
                </p>
                {tab === "matches" && nextLater && (
                  <button className="btn-ghost" onClick={() => setTab("schedule")}>
                    <CalendarDays size={16} /> Zobacz harmonogram
                  </button>
                )}
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.stage} className="space-y-3">
                  <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted/80">{g.stage}</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {g.matches.map((m) => (
                      <MatchCard
                        // Nowy typ z serwera (np. unieważniony po poprawce drabinki) resetuje stan karty
                        key={`${m.id}:${m.myPick}:${m.myLoserWins}:${m.myStake}`}
                        token={view.token}
                        match={m}
                        teams={teams}
                        matches={matchMap}
                        players={players}
                        me={me}
                        now={now}
                        isAdmin={isAdmin}
                        onEdit={() => setEditing(m)}
                        onResult={() => setScoring(m)}
                        ranks={ranks}
                        wallet={view.myWallet}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Standings rows={view.standings} me={me} />
          <Gambling rows={view.standings} me={me} />
          {isAdmin && (
            <DeleteButton
              url={`/api/pickem/${view.token}`}
              confirmText={`Usunąć turniej „${view.name}” ze wszystkimi meczami i typami?`}
              redirectTo="/pickem"
              label="Usuń turniej"
            />
          )}
        </aside>
      </div>

      {editing && (
        <MatchForm
          key={editing === "new" ? "new" : editing.id}
          token={view.token}
          match={editing === "new" ? null : editing}
          matches={view.matches}
          teams={view.teams}
          open
          onClose={() => setEditing(null)}
        />
      )}
      {scoring && <ResultForm token={view.token} match={scoring} teams={teams} onClose={() => setScoring(null)} />}
    </div>
  );
}
