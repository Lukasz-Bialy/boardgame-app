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
  const newestGame = [...games].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = meetings.filter((m) => m.date >= today).slice(0, 3);
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
        </div>
      </div>

      {/* Wymaga Twojej akcji — tylko gdy są ankiety bez Twojego głosu */}
      {pendingPolls.length > 0 && <ActionPanel polls={pendingPolls} />}

      {/* Statystyki */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          Icon={Dices}
          label="Gier w kolekcji"
          value={games.length}
          accent="felt"
          href="/games"
          footer={
            <StatFooter
              title="Ostatnio dodana"
              value={newestGame?.name}
              sub={newestGame ? ago(newestGame.created_at) : undefined}
              empty="Dodaj pierwszą grę"
            />
          }
        />
        <Stat
          Icon={Trophy}
          label="Rozegranych partii"
          value={totalPlays}
          accent="gold"
          footer={
            <StatFooter
              title="Ostatnia wygrana"
              value={recent[0] ? displayNameOf(recent[0].player) : undefined}
              avatar={recent[0]?.player}
              sub={recent[0] ? `${recent[0].game_name} · ${formatDate(recent[0].played_at)}` : undefined}
              empty="Jeszcze nikt nie wygrał"
            />
          }
        />
        <Stat
          Icon={Vote}
          label="Otwartych ankiet"
          value={openPolls.length}
          accent="felt"
          href="/polls"
          footer={<OpenPollsSummary polls={openPolls} pending={pendingPolls.length} />}
        />
        <Stat
          Icon={CalendarDays}
          label="Nadchodzących spotkań"
          value={upcoming.length}
          accent="gold"
          href="/calendar"
          footer={
            <StatFooter
              title="Najbliższe"
              value={upcoming[0]?.title}
              sub={upcoming[0] ? formatDate(upcoming[0].date) : undefined}
              empty="Nic nie zaplanowano"
            />
          }
        />
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

function Stat({
  Icon,
  label,
  value,
  accent = "felt",
  href,
  footer,
}: {
  Icon: LucideIcon;
  label: string;
  value: number;
  accent?: Accent;
  href?: string;
  footer?: React.ReactNode;
}) {
  const isGold = accent === "gold";
  const className = `panel relative flex flex-col overflow-hidden p-5 ${
    href ? "transition hover:border-felt/40 hover:shadow-glow-felt" : ""
  }`;
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    href ? <Link href={href} className={className}>{children}</Link> : <div className={className}>{children}</div>;
  return (
    <Wrapper>
      {/* Accent gradient top bar */}
      <div
        className={`absolute inset-x-0 top-0 h-[2px] rounded-t-2xl ${
          isGold
            ? "bg-gradient-to-r from-gold/70 via-gold/30 to-transparent"
            : "bg-gradient-to-r from-felt/70 via-felt/30 to-transparent"
        }`}
      />
      {/* Ghost icon */}
      <div
        className="pointer-events-none absolute -bottom-3 -right-3 opacity-[0.055]"
        aria-hidden
      >
        <Icon size={88} />
      </div>
      {/* Content */}
      <div
        className={`relative z-10 mb-3 inline-flex self-start rounded-xl p-2.5 ${
          isGold ? "bg-gold/10 text-gold" : "bg-felt/10 text-felt"
        }`}
      >
        <Icon size={18} />
      </div>
      <div className="relative z-10 font-display text-4xl font-extrabold tracking-tight text-cream tabular-nums">
        {value}
      </div>
      <div className="relative z-10 mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      {footer && <div className="relative z-10 mt-auto pt-4">{footer}</div>}
    </Wrapper>
  );
}

/** Stopka kafelka: jedna konkretna informacja (np. ostatnio dodana gra) albo tekst zastępczy. */
function StatFooter({
  title,
  value,
  sub,
  avatar,
  empty,
}: {
  title: string;
  value?: string;
  sub?: string;
  avatar?: string;
  empty: string;
}) {
  return (
    <div className="border-t border-line/60 pt-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/80">{title}</p>
      {value ? (
        <div className="flex items-center gap-2">
          {avatar && <Avatar username={avatar} size={22} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-cream">{value}</p>
            {sub && <p className="truncate text-xs text-muted">{sub}</p>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </div>
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

/** Stopka kafelka „Otwartych ankiet”: status Twoich głosów + postęp każdej ankiety. */
function OpenPollsSummary({ polls, pending }: { polls: OpenPoll[]; pending: number }) {
  if (polls.length === 0) {
    return <StatFooter title="Status" empty="Brak otwartych ankiet" />;
  }
  const total = PLAYERS.length;
  return (
    <div className="space-y-2.5 border-t border-line/60 pt-3">
      {pending > 0 ? (
        <span className="chip text-gold">
          <BellRing size={11} /> {pending} czeka na Twój głos
        </span>
      ) : (
        <span className="chip text-felt">
          <Check size={11} /> Wszystkie Twoje głosy oddane
        </span>
      )}
      <ul className="space-y-2">
        {polls.slice(0, 3).map((p) => (
          <li key={p.id}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-cream">{p.title}</span>
              <span className="shrink-0 font-mono text-muted tabular-nums">
                {p.voters.length}/{total}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-panel2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-felt to-felt-dark"
                style={{ width: `${(p.voters.length / total) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {polls.length > 3 && <p className="text-xs text-muted">+{polls.length - 3} więcej</p>}
    </div>
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
