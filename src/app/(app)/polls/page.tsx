import Link from "next/link";
import { Dices, CalendarDays, BarChart3, Users, Lock } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listPolls, listMeetings } from "@/lib/data-misc";
import { listGames } from "@/lib/data-games";
import { formatDate } from "@/components/ui";
import PollForm from "@/components/PollForm";

export const dynamic = "force-dynamic";

export default async function PollsPage() {
  await getSession();
  const today = new Date().toISOString().slice(0, 10);
  const [polls, games, allMeetings] = await Promise.all([listPolls(), listGames(), listMeetings()]);
  const gameLite = games.map((g) => ({
    id: g.id,
    name: g.name,
    image_url: g.image_url,
    min_players: g.min_players,
    max_players: g.max_players,
    play_time: g.play_time,
    avg_rating: g.avg_rating,
  }));
  const upcomingMeetings = allMeetings
    .filter((m) => m.date >= today)
    .map((m) => ({ id: m.id, date: m.date, title: m.title }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Ankiety</h1>
          <p className="text-sm text-muted">
            Głosujcie, w co zagrać i kiedy się spotkać · {polls.length}{" "}
            {polls.length === 1 ? "ankieta" : "ankiet"}
          </p>
        </div>
        <PollForm games={gameLite} meetings={upcomingMeetings} />
      </div>

      {polls.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-12 text-center">
          <BarChart3 size={40} className="text-muted" />
          <p className="text-muted">Nie ma jeszcze żadnych ankiet. Utwórz pierwszą.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {polls.map((p) => (
            <Link
              key={p.id}
              href={`/polls/${p.token}`}
              className="panel group flex flex-col gap-3 p-5 transition hover:border-felt/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`chip ${
                    p.type === "date" ? "text-gold" : "text-felt"
                  }`}
                >
                  {p.type === "date" ? (
                    <>
                      <CalendarDays size={13} /> Termin
                    </>
                  ) : (
                    <>
                      <Dices size={13} /> W co zagrać
                    </>
                  )}
                </span>
                {p.is_open === 1 ? (
                  <span className="text-xs font-medium text-felt">otwarta</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                    <Lock size={11} /> zamknięta
                  </span>
                )}
              </div>

              <h3 className="font-display text-lg font-bold leading-tight group-hover:text-felt">
                {p.title}
              </h3>

              <div className="mt-auto flex items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1 font-mono">
                  <Users size={13} /> {p.totalVoters}{" "}
                  {p.totalVoters === 1 ? "głos" : "głosów"}
                </span>
                <span>· {formatDate(p.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
