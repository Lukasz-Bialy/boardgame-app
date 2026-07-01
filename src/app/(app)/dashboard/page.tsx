import Link from "next/link";
import { Dices, Vote, CalendarDays, Trophy, ArrowRight, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listGames } from "@/lib/data-games";
import { listPolls, listMeetings } from "@/lib/data-misc";
import { formatDate } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = (await getSession())!;
  const [games, polls, meetings] = await Promise.all([listGames(), listPolls(), listMeetings()]);

  const totalPlays = games.reduce((a, g) => a + g.play_count, 0);
  const openPolls = polls.filter((p) => p.is_open === 1);
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
      <div className="border-b border-line/40 pb-6">
        <p className="mb-1 text-sm text-muted">Cześć,</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{session.displayName} 👋</h1>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat Icon={Dices} label="Gier w kolekcji" value={games.length} accent="felt" />
        <Stat Icon={Trophy} label="Rozegranych partii" value={totalPlays} accent="gold" />
        <Stat Icon={Vote} label="Otwartych ankiet" value={openPolls.length} accent="felt" />
        <Stat Icon={CalendarDays} label="Nadchodzących spotkań" value={upcoming.length} accent="gold" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
        <section className="panel p-5 md:col-span-2">
          <SectionTitle href="/games" label="Ostatnie zwycięstwa" icon={<Trophy size={14} />} />
          {recent.length === 0 ? (
            <Empty text="Nikt jeszcze nie wygrał — dodaj pierwszą rozgrywkę!" />
          ) : (
            <ul className="space-y-3">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                    <Trophy size={14} />
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
}: {
  Icon: LucideIcon;
  label: string;
  value: number;
  accent?: Accent;
}) {
  const isGold = accent === "gold";
  return (
    <div className="panel relative overflow-hidden p-5">
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
        className={`relative z-10 mb-3 inline-flex rounded-xl p-2.5 ${
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
