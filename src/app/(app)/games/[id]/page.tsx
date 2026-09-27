import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Clock, Dices, Star, StickyNote } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getGame, listSessions, getUserRating, listGameRatings } from "@/lib/data-games";
import { players, minutes, formatDate, PlaceBadge, Avatar } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import GameForm from "@/components/GameForm";
import RatingWidget from "@/components/RatingWidget";
import SessionForm from "@/components/SessionForm";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await getSession())!;
  const game = await getGame(id);
  if (!game) notFound();

  const [sessions, myRating, ratings] = await Promise.all([
    listSessions(id),
    getUserRating(id, session.username),
    listGameRatings(id),
  ]);
  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-6">
      <Link href="/games" className="inline-flex items-center gap-1 text-sm text-muted hover:text-felt">
        <ArrowLeft size={15} /> Kolekcja
      </Link>

      {/* Nagłówek */}
      <div className="panel overflow-hidden">
        <div className="grid md:grid-cols-[280px_1fr]">
          <div className="aspect-[16/10] bg-panel2 md:aspect-auto">
            {game.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.image_url} alt={game.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center py-12 text-muted">
                <Dices size={48} />
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="font-display text-3xl font-extrabold tracking-tight">{game.name}</h1>
              {isAdmin && (
                <div className="flex gap-2">
                  <GameForm game={game} />
                  <DeleteButton
                    url={`/api/games/${game.id}`}
                    confirmText={`Usunąć grę „${game.name}" wraz z rozgrywkami i ocenami?`}
                    redirectTo="/games"
                  />
                </div>
              )}
            </div>

            {game.description && <p className="mt-2 text-sm text-muted">{game.description}</p>}

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="chip">
                <Users size={14} /> {players(game.min_players, game.max_players)} graczy
              </span>
              <span className="chip">
                <Clock size={14} /> {minutes(game.play_time)}
              </span>
              <span className="chip font-mono">
                <Dices size={14} /> {game.play_count} rozegranych
              </span>
              <span className="chip font-mono text-gold">
                <Star size={14} fill="currentColor" />{" "}
                {game.avg_rating != null ? `${game.avg_rating} (${game.rating_count})` : "brak ocen"}
              </span>
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <RatingWidget gameId={game.id} myRating={myRating} />
              {ratings.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ratings.map((r) => (
                    <span key={r.username} className="chip">
                      <Avatar username={r.username} size={18} /> {displayNameOf(r.username)}
                      <span className="font-mono text-gold">★{r.score}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rozgrywki */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Rozgrywki</h2>
          <SessionForm gameId={game.id} />
        </div>

        {sessions.length === 0 ? (
          <div className="panel p-8 text-center text-sm text-muted">
            Brak rozgrywek. Dodaj pierwszą, żeby zacząć zbierać statystyki.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const ordered = [...s.placements].sort((a, b) => a.place - b.place);
              const canDelete = isAdmin || s.created_by === session.username;
              return (
                <div key={s.id} className="panel p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{formatDate(s.played_at)}</span>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      {s.duration_min && (
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} /> {minutes(s.duration_min)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        dodał: <Avatar username={s.created_by} size={16} /> {displayNameOf(s.created_by)}
                      </span>
                      {canDelete && (
                        <DeleteButton
                          url={`/api/sessions/${s.id}`}
                          confirmText="Usunąć tę rozgrywkę?"
                          iconOnly
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ordered.map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink/40 px-2.5 py-1.5"
                      >
                        <PlaceBadge place={p.place} />
                        <Avatar username={p.player} size={20} />
                        <span className="text-sm">{displayNameOf(p.player)}</span>
                      </span>
                    ))}
                  </div>
                  {s.note && (
                    <p className="mt-3 inline-flex items-start gap-1.5 text-sm text-muted">
                      <StickyNote size={14} className="mt-0.5 shrink-0" /> {s.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
