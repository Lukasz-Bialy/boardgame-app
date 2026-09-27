import Link from "next/link";
import { Dices, Users, Clock, Star } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listGames } from "@/lib/data-games";
import { players, minutes } from "@/components/ui";
import GameForm from "@/components/GameForm";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const session = (await getSession())!;
  const games = await listGames();
  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Kolekcja gier</h1>
          <p className="text-sm text-muted">{games.length} gier · kliknij, by zobaczyć szczegóły</p>
        </div>
        {isAdmin && <GameForm />}
      </div>

      {games.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-12 text-center">
          <Dices size={40} className="text-muted" />
          <p className="text-muted">
            {isAdmin ? "Kolekcja jest pusta. Dodaj pierwszą grę." : "Kolekcja jest jeszcze pusta."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((g) => (
            <Link
              key={g.id}
              href={`/games/${g.id}`}
              className="panel group overflow-hidden transition hover:border-felt/50"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-panel2">
                {g.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.image_url}
                    alt={g.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <Dices size={36} />
                  </div>
                )}
                {g.avg_rating != null && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-gold backdrop-blur">
                    <Star size={12} fill="currentColor" /> {g.avg_rating}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-bold leading-tight group-hover:text-felt">
                  {g.name}
                </h3>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Users size={13} /> {players(g.min_players, g.max_players)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={13} /> {minutes(g.play_time)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Dices size={13} /> {g.play_count} {g.play_count === 1 ? "partia" : "partii"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
