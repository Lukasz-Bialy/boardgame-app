import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getTournamentView, saveBaseProbs, syncDue, syncTournament } from "@/lib/pickem";
import { eloGameProb, seriesProb } from "@/lib/pickem-rules";
import { getGpr, refreshGpr, type GprTeam } from "@/lib/gpr";
import PickemClient from "@/components/pickem/PickemClient";
import type { TournamentRanking } from "@/components/pickem/PowerRanking";

export const dynamic = "force-dynamic";

// Ranking pokazujemy przy turniejach LoL: z lolesports albo wpisanych ręcznie, jeśli drużyny pasują do rankingu
const MIN_MATCHED = 3;

export default async function PickemTournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ widok?: string }>;
}) {
  const { token } = await params;
  const { widok } = await searchParams;
  const session = (await getSession())!;
  const view = await getTournamentView(token, session.username);
  if (!view) notFound();

  // Turniej z lolesports odświeża się po wyświetleniu strony, bez czekania na odpowiedź API
  const syncing = syncDue(view);
  if (syncing) after(() => syncTournament(view.id).then(() => {}, console.error));

  let ranking: TournamentRanking | null = null;
  let rankingError: string | null = null;
  if (view.teams.length) {
    const gpr = await getGpr();
    if (gpr.stale) after(() => refreshGpr().then(() => {}));
    rankingError = gpr.error;
    if (gpr.data) {
      const byCode = new Map(gpr.data.teams.map((t) => [t.code.toUpperCase(), t]));
      const byTeam: Record<string, GprTeam> = {};
      for (const t of view.teams) {
        const g = (t.short && byCode.get(t.short.toUpperCase())) || gpr.data.teams.find((x) => x.name.toLowerCase() === t.name.toLowerCase());
        if (g) byTeam[t.id] = g;
      }
      if (view.source === "lolesports" || Object.keys(byTeam).length >= MIN_MATCHED) ranking = { updated: gpr.data.updated, byTeam };

      // Kurs bazowy zakładów: szansa serii z GPR (skala Elo), odświeżana do startu meczu, potem zamrożona
      const changed: { id: string; probA: number }[] = [];
      for (const m of view.matches) {
        const ga = m.a ? byTeam[m.a] : undefined;
        const gb = m.b ? byTeam[m.b] : undefined;
        if (m.started || !ga || !gb) continue;
        const probA = Math.round(seriesProb(eloGameProb(ga.score, gb.score), m.best_of) * 1000) / 1000;
        if (probA === m.probA) continue;
        m.probA = probA;
        changed.push({ id: m.id, probA });
      }
      if (changed.length) after(() => saveBaseProbs(changed).catch(console.error));
    } else if (view.source !== "lolesports") {
      rankingError = null; // turniej innej gry — bez zakładki i bez komunikatu
    }
  }
  const showRanking = !!ranking || (view.source === "lolesports" && !!rankingError);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");

  return (
    <div className="space-y-6">
      <Link href="/pickem" className="inline-flex items-center gap-1 text-sm text-muted hover:text-felt">
        <ArrowLeft size={15} /> Pick&apos;em
      </Link>
      <PickemClient
        view={view}
        me={session.username}
        isAdmin={session.role === "admin"}
        syncing={syncing}
        shareUrl={`${proto}://${host}/pickem/${view.token}`}
        ranking={showRanking ? { data: ranking, error: rankingError } : null}
        initialTab={
          widok === "harmonogram"
            ? "schedule"
            : widok === "historia"
              ? "history"
              : widok === "zasady"
                ? "rules"
                : showRanking && widok === "ranking"
                  ? "ranking"
                  : "matches"
        }
      />
    </div>
  );
}
