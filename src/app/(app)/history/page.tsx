import Link from "next/link";
import { Trophy, History as HistoryIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getPlayerHistory, getPlayerStats } from "@/lib/data-games";
import { formatDate, PlaceBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = (await getSession())!;
  const [history, stats] = await Promise.all([
    getPlayerHistory(session.username),
    getPlayerStats(session.username),
  ]);

  const totalGames = history.length;
  const wins = history.filter((h) => h.place === 1).length;
  const winRate = totalGames ? Math.round((wins / totalGames) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Moja historia</h1>
        <p className="text-sm text-muted">Twoje partie i statystyki zajmowanych miejsc</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="panel p-4">
          <div className="font-mono text-2xl font-bold">{totalGames}</div>
          <div className="text-xs text-muted">rozegranych partii</div>
        </div>
        <div className="panel p-4">
          <div className="font-mono text-2xl font-bold text-gold">{wins}</div>
          <div className="text-xs text-muted">zwycięstw</div>
        </div>
        <div className="panel p-4">
          <div className="font-mono text-2xl font-bold text-felt">{winRate}%</div>
          <div className="text-xs text-muted">skuteczność</div>
        </div>
      </div>

      {/* Statystyki per gra */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
          <Trophy size={18} /> Miejsca wg gry
        </h2>
        {stats.length === 0 ? (
          <div className="panel p-8 text-center text-sm text-muted">
            Nie masz jeszcze żadnych rozegranych partii.
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Gra</th>
                  <th className="px-3 py-3 text-center font-medium">Partie</th>
                  <th className="px-3 py-3 text-center font-medium">🥇</th>
                  <th className="px-3 py-3 text-center font-medium">🥈</th>
                  <th className="px-3 py-3 text-center font-medium">🥉</th>
                  <th className="px-3 py-3 text-center font-medium">poza podium</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.game_id} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/games/${s.game_id}`} className="font-medium hover:text-felt">
                        {s.game_name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center font-mono">{s.games}</td>
                    <td className="px-3 py-3 text-center font-mono text-gold">{s.first}</td>
                    <td className="px-3 py-3 text-center font-mono">{s.second}</td>
                    <td className="px-3 py-3 text-center font-mono">{s.third}</td>
                    <td className="px-3 py-3 text-center font-mono text-muted">{s.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pełna historia */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
          <HistoryIcon size={18} /> Wszystkie partie
        </h2>
        {history.length === 0 ? (
          <div className="panel p-8 text-center text-sm text-muted">Brak partii do pokazania.</div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <Link
                key={h.session_id + h.game_id}
                href={`/games/${h.game_id}`}
                className="panel flex items-center justify-between gap-3 p-3 transition hover:border-felt/40"
              >
                <span className="flex items-center gap-3">
                  <PlaceBadge place={h.place} />
                  <span className="font-medium">{h.game_name}</span>
                  <span className="text-xs text-muted">z {h.total_players} graczami</span>
                </span>
                <span className="text-xs text-muted">{formatDate(h.played_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
