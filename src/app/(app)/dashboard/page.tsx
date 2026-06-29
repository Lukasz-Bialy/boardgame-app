import Link from "next/link";
import { Dices, Vote, CalendarDays, Trophy, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listGames } from "@/lib/data-games";
import { listPolls, listMeetings } from "@/lib/data-misc";
import { formatDate, PlaceBadge } from "@/components/ui";
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
      <div>
        <p className="text-sm text-muted">Cześć,</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{session.displayName} 👋</h1>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<Dices size={18} />} label="Gier w kolekcji" value={games.length} />
        <Stat icon={<Trophy size={18} />} label="Rozegranych partii" value={totalPlays} />
        <Stat icon={<Vote size={18} />} label="Otwartych ankiet" value={openPolls.length} />
        <Stat icon={<CalendarDays size={18} />} label="Nadchodzących spotkań" value={upcoming.length} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Najwyżej oceniane */}
        <section className="panel p-5">
          <SectionTitle href="/games" label="Najlepiej oceniane" />
          {topRated.length === 0 ? (
            <Empty text="Brak ocen. Wejdź w grę i wystaw ocenę." />
          ) : (
            <ul className="space-y-2">
              {topRated.map((g, i) => (
                <li key={g.id} className="flex items-center justify-between gap-3">
                  <Link href={`/games/${g.id}`} className="flex items-center gap-3 hover:text-felt">
                    <span className="font-mono text-muted">{i + 1}.</span>
                    <span className="font-medium">{g.name}</span>
                  </Link>
                  <span className="chip font-mono text-gold">★ {g.avg_rating}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Nadchodzące spotkania */}
        <section className="panel p-5">
          <SectionTitle href="/calendar" label="Nadchodzące spotkania" />
          {upcoming.length === 0 ? (
            <Empty text="Brak zaplanowanych spotkań." />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className="font-medium">{m.title}</span>
                  <span className="chip">{formatDate(m.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Ostatni zwycięzcy */}
        <section className="panel p-5 md:col-span-2">
          <SectionTitle href="/games" label="Ostatnie zwycięstwa" />
          {recent.length === 0 ? (
            <Empty text="Nikt jeszcze nie wygrał — dodaj pierwszą rozgrywkę!" />
          ) : (
            <ul className="space-y-2">
              {recent.map((r, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <PlaceBadge place={1} />
                    <span className="font-semibold text-cream">{displayNameOf(r.player)}</span>
                    <span className="text-muted">w</span>
                    <Link href={`/games/${r.game_id}`} className="hover:text-felt">
                      {r.game_name}
                    </Link>
                  </span>
                  <span className="text-muted">{formatDate(r.played_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="panel p-4">
      <div className="mb-2 inline-flex rounded-lg bg-felt/15 p-2 text-felt">{icon}</div>
      <div className="font-mono text-2xl font-bold text-cream">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function SectionTitle({ href, label }: { href: string; label: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-lg font-bold">{label}</h2>
      <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted hover:text-felt">
        Zobacz <ArrowRight size={12} />
      </Link>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-sm text-muted">{text}</p>;
}
