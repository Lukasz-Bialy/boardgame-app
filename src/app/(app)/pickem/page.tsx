import Link from "next/link";
import { Trophy, Users, Swords, Clock, CircleAlert } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listTournaments } from "@/lib/pickem";
import { formatMatchTime } from "@/lib/pickem-time";
import TournamentForm from "@/components/pickem/TournamentForm";

export const dynamic = "force-dynamic";

export default async function PickemPage() {
  const session = (await getSession())!;
  const tournaments = await listTournaments(session.username);
  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Pick&apos;em</h1>
          <p className="text-sm text-muted">Typujcie zwycięzców meczów — typy odkrywają się, gdy mecz się zaczyna</p>
        </div>
        {isAdmin && <TournamentForm />}
      </div>

      {tournaments.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-12 text-center">
          <Trophy size={40} className="text-muted" />
          <p className="text-muted">
            {isAdmin ? "Nie ma jeszcze turniejów. Załóż pierwszy." : "Nie ma jeszcze turniejów — admin musi jakiś założyć."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/pickem/${t.token}`}
              className="panel group flex flex-col gap-3 p-5 transition hover:border-felt/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`chip ${t.source === "lolesports" ? "text-felt" : "text-gold"}`}>
                  <Trophy size={13} /> {t.source === "lolesports" ? "lolesports" : "Turniej"}
                </span>
                {t.my_missing > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold">
                    <CircleAlert size={13} /> {t.my_missing} do obstawienia
                  </span>
                )}
              </div>
              <h3 className="font-display text-lg font-bold leading-tight group-hover:text-felt">{t.name}</h3>
              {t.description && <p className="line-clamp-2 text-sm text-muted">{t.description}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1 font-mono">
                  <Users size={13} /> {t.teams} drużyn
                </span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Swords size={13} /> {t.finished}/{t.matches} meczów
                </span>
                {t.next_open && (
                  <span className="inline-flex items-center gap-1">
                    <Clock size={13} /> {formatMatchTime(t.next_open)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
