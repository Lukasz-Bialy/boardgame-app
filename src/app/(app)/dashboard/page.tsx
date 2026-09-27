import Link from "next/link";
import { Dices, Vote, CalendarDays, Trophy, ArrowRight, Star, BellRing, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listGames } from "@/lib/data-games";
import { listOpenPollsWithVoters, listMeetings } from "@/lib/data-misc";
import { Avatar, formatDate } from "@/components/ui";
import { displayNameOf, PLAYERS } from "@/lib/users";
import { q } from "@/lib/db";
import type { Poll } from "@/lib/types";

type OpenPoll = Poll & { voters: string[] };

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = (await getSession())!;
  const [games, openPolls, meetings] = await Promise.all([
    listGames(),
    listOpenPollsWithVoters(),
    listMeetings(),
  ]);

  const totalPlays = games.reduce((a, g) => a + g.play_count, 0);
  const pendingPolls = openPolls.filter((p) => !p.voters.includes(session.username));
  const newestGames = [...games].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  // W kafelku najpierw ankiety czekające na Twój głos
  const pollsForTile = [...pendingPolls, ...openPolls.filter((p) => !pendingPolls.includes(p))].slice(0, 3);
  const today = new Date().toISOString().slice(0, 10);
  const upcomingAll = meetings.filter((m) => m.date >= today);
  const upcoming = upcomingAll.slice(0, 3);
  const topRated = [...games]
    .filter((g) => g.avg_rating != null)
    .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
    .slice(0, 3);

  const recent = await q<{
    game_id: string;
    game_name: string;
    played_at: string;
    player: string;
    place: number;
  }>(`
    SELECT s.game_id, g.name AS game_name, s.played_at, p.player, p.place
    FROM placements p
    JOIN sessions s ON s.id = p.session_id
    JOIN games g ON g.id = s.game_id
    WHERE p.place = 1
    ORDER BY s.played_at DESC, s.created_at DESC
    LIMIT 5
  `);

  return (
    <div className="space-y-8">
      {/* Tło tylko dla Pulpitu — przyciemnione (w jasnym motywie rozjaśnione), żeby panele były czytelne.
          Działa z -z-10, bo tło strony siedzi na <html> (globals.css), nie na <body>. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/backgrounds/mnisi.jpg)" }}
        />
        <div className="page-photo-overlay absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/80 to-ink/95" />
      </div>
      <div className="flex items-center gap-4 pb-[25px]">
        <span className="flex shrink-0 rounded-full p-[3px] bg-gradient-to-br from-felt to-gold shadow-glow-felt">
          <Avatar username={session.username} size={64} />
        </span>
        <div>
          <p className="mb-1 text-sm text-muted">Cześć,</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">{session.displayName} 👋</h1>
          {/* Brak pilnych akcji — zamiast panelu „Mordo, nie zwlekaj” */}
          {pendingPolls.length === 0 && (
            <p className="mt-3 inline-flex items-center gap-3 rounded-full border border-felt/30 bg-felt/10 py-2 pl-3 pr-5 text-lg font-semibold text-felt">
              <span className="cheers" aria-hidden>
                <span className="cheers-mug cheers-left">🍺</span>
                <span className="cheers-mug cheers-right">🍺</span>
                <span className="cheers-spark">✨</span>
              </span>
              Wszystko ogarnięte byku, napij się piwka
            </p>
          )}
        </div>
      </div>

      {/* Wymaga Twojej akcji — tylko gdy są ankiety bez Twojego głosu */}
      {pendingPolls.length > 0 && <ActionPanel polls={pendingPolls} />}

      {/* Statystyki */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat Icon={Dices} label="Gier w kolekcji" value={games.length} accent="felt" href="/games">
          <TileList
            empty="Kolekcja jest pusta — dodaj pierwszą grę."
            items={newestGames.map((g) => ({
              key: g.id,
              href: `/games/${g.id}`,
              leading: g.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <TileIcon accent="felt"><Dices size={16} /></TileIcon>
              ),
              title: g.name,
              sub: `dodana ${ago(g.created_at)}`,
              trailing: <span className="font-mono text-xs text-muted">{g.play_count}× grana</span>,
            }))}
          />
        </Stat>

        <Stat Icon={Trophy} label="Rozegranych partii" value={totalPlays} accent="gold" href="/history">
          <TileList
            empty="Nikt jeszcze nie wygrał — dodaj pierwszą rozgrywkę."
            items={recent.slice(0, 3).map((r, i) => ({
              key: `${r.game_id}-${r.played_at}-${i}`,
              href: `/games/${r.game_id}`,
              leading: <WinnerAvatar username={r.player} />,
              title: displayNameOf(r.player),
              sub: `wygrana w ${r.game_name}`,
              trailing: <span className="text-xs text-muted">{formatDate(r.played_at)}</span>,
            }))}
          />
        </Stat>

        <Stat Icon={Vote} label="Otwartych ankiet" value={openPolls.length} accent="felt" href="/polls">
          {openPolls.length > 0 && (
            <div className="mb-2">
              {pendingPolls.length > 0 ? (
                <span className="chip text-gold">
                  <BellRing size={12} /> {pendingPolls.length} czeka na Twój głos
                </span>
              ) : (
                <span className="chip text-felt">
                  <Check size={12} /> Wszystkie Twoje głosy oddane
                </span>
              )}
            </div>
          )}
          <TileList
            empty="Brak otwartych ankiet."
            items={pollsForTile.map((p) => {
              const waiting = !p.voters.includes(session.username);
              return {
                key: p.id,
                href: `/polls/${p.token}`,
                leading: (
                  <TileIcon accent={p.type === "date" ? "gold" : "felt"}>
                    {p.type === "date" ? <CalendarDays size={16} /> : <Dices size={16} />}
                  </TileIcon>
                ),
                title: p.title,
                sub: <PollProgress voters={p.voters.length} />,
                trailing: waiting ? (
                  <span className="h-2 w-2 rounded-full bg-gold shadow-glow-gold" title="Czeka na Twój głos" />
                ) : (
                  <Check size={14} className="text-felt" aria-label="Zagłosowano" />
                ),
              };
            })}
          />
          {openPolls.length > pollsForTile.length && (
            <p className="mt-1 px-2 text-xs text-muted">+{openPolls.length - pollsForTile.length} więcej</p>
          )}
        </Stat>

        <Stat Icon={CalendarDays} label="Nadchodzących spotkań" value={upcomingAll.length} accent="gold" href="/calendar">
          <TileList
            empty="Nic nie zaplanowano."
            items={upcoming.map((m) => {
              const d = new Date(m.date + "T12:00:00");
              return {
                key: m.id,
                leading: (
                  <span className="flex h-9 w-9 flex-col items-center justify-center rounded-lg bg-gold/10 leading-none">
                    <span className="font-display text-sm font-extrabold text-gold">{d.getDate()}</span>
                    <span className="text-[9px] uppercase text-muted">{d.toLocaleString("pl-PL", { month: "short" })}</span>
                  </span>
                ),
                title: m.title,
                sub: d.toLocaleDateString("pl-PL", { weekday: "long" }),
              };
            })}
          />
        </Stat>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Najwyżej oceniane */}
        <section className="panel p-5">
          <SectionTitle href="/games" label="Najlepiej oceniane" icon={<Star size={14} />} />
          {topRated.length === 0 ? (
            <Empty text="Brak ocen. Wejdź w grę i wystaw ocenę." />
          ) : (
            <ul className="space-y-2.5">
              {topRated.map((g, i) => (
                <li key={g.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel2 font-mono text-xs font-bold text-muted">
                    {i + 1}
                  </span>
                  <Link
                    href={`/games/${g.id}`}
                    className="flex-1 truncate font-medium text-cream transition hover:text-felt"
                  >
                    {g.name}
                  </Link>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-bold text-gold">
                    ★ {g.avg_rating}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Nadchodzące spotkania */}
        <section className="panel p-5">
          <SectionTitle href="/calendar" label="Nadchodzące spotkania" icon={<CalendarDays size={14} />} />
          {upcoming.length === 0 ? (
            <Empty text="Brak zaplanowanych spotkań." />
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((m) => {
                const d = new Date(m.date + "T12:00:00");
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-panel2">
                      <span className="font-display text-base font-extrabold leading-none text-felt">
                        {d.getDate()}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-muted">
                        {d.toLocaleString("pl-PL", { month: "short" })}
                      </span>
                    </div>
                    <span className="font-medium leading-tight text-cream">{m.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Ostatni zwycięzcy */}
        <section className="panel p-5 md:col-span-2 xl:col-span-1">
          <SectionTitle href="/games" label="Ostatnie zwycięstwa" icon={<Trophy size={14} />} />
          {recent.length === 0 ? (
            <Empty text="Nikt jeszcze nie wygrał — dodaj pierwszą rozgrywkę!" />
          ) : (
            <ul className="space-y-3">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar username={r.player} size={32} />
                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-onaccent ring-2 ring-panel">
                      <Trophy size={9} />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
                    <span className="font-semibold text-cream">{displayNameOf(r.player)}</span>
                    <span className="text-muted">wygrał(a) w</span>
                    <Link href={`/games/${r.game_id}`} className="font-medium transition hover:text-felt">
                      {r.game_name}
                    </Link>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{formatDate(r.played_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

type Accent = "felt" | "gold";

/**
 * Kafelek: kompaktowy nagłówek (ikona · nazwa · liczba) + lista szczegółów.
 * Cały kafelek prowadzi do `href` (link nałożony pod treścią), a pozycje listy mają własne linki —
 * zagnieżdżanie <a> w <a> jest niedozwolone, więc treść ma pointer-events-none, a linki pozycji auto.
 */
function Stat({
  Icon,
  label,
  value,
  accent = "felt",
  href,
  children,
}: {
  Icon: LucideIcon;
  label: string;
  value: number;
  accent?: Accent;
  href: string;
  children: React.ReactNode;
}) {
  const isGold = accent === "gold";
  return (
    <div
      className={`panel group/tile relative flex flex-col overflow-hidden p-4 transition ${
        isGold ? "hover:border-gold/40 hover:shadow-glow-gold" : "hover:border-felt/40 hover:shadow-glow-felt"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-[2px] ${
          isGold ? "bg-gradient-to-r from-gold/70 via-gold/30 to-transparent" : "bg-gradient-to-r from-felt/70 via-felt/30 to-transparent"
        }`}
      />
      <Link href={href} aria-label={label} className="absolute inset-0 z-0 rounded-2xl" />

      <div className="pointer-events-none relative z-10 flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isGold ? "bg-gold/10 text-gold" : "bg-felt/10 text-felt"}`}>
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
        <span className="font-display text-2xl font-extrabold tabular-nums text-cream">{value}</span>
        <ArrowRight size={14} className="text-muted transition group-hover/tile:translate-x-0.5 group-hover/tile:text-cream" />
      </div>

      <div className="pointer-events-none relative z-10 mt-3 flex-1 border-t border-line/60 pt-3">{children}</div>
    </div>
  );
}

type TileItem = {
  key: string;
  href?: string;
  leading: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
  trailing?: React.ReactNode;
};

function TileList({ items, empty }: { items: TileItem[]; empty: string }) {
  if (items.length === 0) return <p className="py-2 text-sm text-muted">{empty}</p>;
  return (
    <ul className="-mx-2 space-y-0.5">
      {items.map((it) => {
        const row = (
          <>
            <span className="shrink-0">{it.leading}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-cream">{it.title}</span>
              {it.sub && <span className="block truncate text-xs text-muted">{it.sub}</span>}
            </span>
            {it.trailing && <span className="flex shrink-0 items-center">{it.trailing}</span>}
          </>
        );
        return (
          <li key={it.key}>
            {it.href ? (
              <Link
                href={it.href}
                className="pointer-events-auto flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-panel2"
              >
                {row}
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 px-2 py-1.5">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TileIcon({ accent, children }: { accent: Accent; children: React.ReactNode }) {
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent === "gold" ? "bg-gold/10 text-gold" : "bg-felt/10 text-felt"}`}>
      {children}
    </span>
  );
}

function WinnerAvatar({ username }: { username: string }) {
  return (
    <span className="relative block">
      <Avatar username={username} size={36} />
      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-onaccent ring-2 ring-panel">
        <Trophy size={9} />
      </span>
    </span>
  );
}

function PollProgress({ voters }: { voters: number }) {
  const total = PLAYERS.length;
  return (
    <span className="mt-1 flex items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-felt to-felt-dark"
          style={{ width: `${(voters / total) * 100}%` }}
        />
      </span>
      <span className="font-mono tabular-nums">
        {voters}/{total}
      </span>
    </span>
  );
}

/* ─── Ankiety ─────────────────────────────────────────────────────────────── */

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "dziś";
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}

/** Stos awatarów osób, które zagłosowały, + licznik x/wszystkich. */
function VoterProgress({ voters }: { voters: string[] }) {
  const total = PLAYERS.length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {voters.map((v) => (
          <span key={v} className="rounded-full ring-2 ring-panel">
            <Avatar username={v} size={20} />
          </span>
        ))}
      </div>
      <span className="font-mono text-xs text-muted tabular-nums">
        {voters.length}/{total}
      </span>
    </div>
  );
}

function ActionPanel({ polls }: { polls: OpenPoll[] }) {
  return (
    <section className="panel relative overflow-hidden border-gold/40 p-5">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-gold via-danger/70 to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" aria-hidden />

      <div className="relative mb-4 flex flex-wrap items-center gap-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <BellRing size={19} className="action-bell" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-danger ring-2 ring-panel" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Wymaga Twojej akcji</p>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-cream">Mordo, nie zwlekaj</h2>
        </div>
        <span className="chip text-gold">
          {polls.length} {polls.length === 1 ? "ankieta czeka" : polls.length < 5 ? "ankiety czekają" : "ankiet czeka"} na
          Twój głos
        </span>
      </div>

      <ul className="relative grid gap-2 lg:grid-cols-2">
        {polls.map((p) => (
          <li key={p.id}>
            <Link
              href={`/polls/${p.token}`}
              className="group flex items-center gap-3 rounded-xl border border-line/60 bg-panel2/40 px-3.5 py-3 transition hover:border-gold/50 hover:bg-panel2"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  p.type === "date" ? "bg-gold/10 text-gold" : "bg-felt/10 text-felt"
                }`}
                title={p.type === "date" ? "Termin spotkania" : "W co zagrać"}
              >
                {p.type === "date" ? <CalendarDays size={17} /> : <Dices size={17} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-cream">{p.title}</p>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Avatar username={p.created_by} size={14} /> {displayNameOf(p.created_by)} · {ago(p.created_at)}
                </p>
              </div>
              <div className="hidden sm:block">
                <VoterProgress voters={p.voters} />
              </div>
              <span className="btn-primary shrink-0 px-3 py-1.5 text-xs">
                Zagłosuj <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionTitle({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-felt/10 text-felt">
          {icon}
        </div>
        <h2 className="font-display text-lg font-bold">{label}</h2>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-felt"
      >
        Zobacz <ArrowRight size={12} />
      </Link>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-sm text-muted">{text}</p>;
}
