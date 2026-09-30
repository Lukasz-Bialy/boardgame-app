import { Swords } from "lucide-react";
import LigaClient, { type LigaView } from "@/components/LigaClient";
import { EARLIEST_DAY, getDdragonVersion, LEAGUE_PLAYERS } from "@/lib/riot";
import { parsePicks, parseRange } from "@/lib/liga-params";

export const dynamic = "force-dynamic";

// Strona nie pobiera meczów — widoki czytają je z bazy na żądanie (/api/liga/*), a nowe gry
// dociąga z Riot osobna synchronizacja. Dzięki temu wejście na stronę nie ładuje całej historii do pamięci.
export default async function LigaPage({
  searchParams,
}: {
  searchParams: Promise<{ od?: string; do?: string; gracze?: string; premade?: string; tryb?: string; widok?: string }>;
}) {
  const sp = await searchParams;
  const { from, to, today } = parseRange(sp.od, sp.do);
  const view: LigaView = sp.widok === "wykresy" || sp.widok === "analityka" || sp.widok === "harnas" ? sp.widok : "mecze";
  const ver = await getDdragonVersion();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
          <Swords size={26} /> Liga
        </h1>
        <p className="text-sm text-muted">Gry ekipy w League of Legends — wspólne mecze pokazane razem</p>
      </div>

      <LigaClient
        accounts={LEAGUE_PLAYERS.map((p) => ({ username: p.username, riotId: `${p.gameName}#${p.tagLine}`, error: null }))}
        ver={ver}
        range={{ from, to, today, earliest: EARLIEST_DAY }}
        initial={{ ...parsePicks(sp.gracze, sp.premade, sp.tryb), view }}
      />
    </div>
  );
}
