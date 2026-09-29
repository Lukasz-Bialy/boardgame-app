import { Swords, AlertTriangle } from "lucide-react";
import LigaClient, { type LigaView } from "@/components/LigaClient";
import {
  EARLIEST_DAY,
  getClubGames,
  getDdragonVersion,
  GAME_MODES,
  type GameMode,
  LEAGUE_PLAYERS,
  RiotError,
  shiftDay,
  warsawDay,
  warsawDayStart,
  type ClubLeagueData,
} from "@/lib/riot";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 7;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Zakres dat z URL; domyślnie ostatni tydzień (z dzisiejszym dniem włącznie)
function parseRange(od?: string, doDay?: string) {
  const today = warsawDay(Date.now());
  let to = doDay && DAY_RE.test(doDay) && doDay <= today ? doDay : today;
  let from = od && DAY_RE.test(od) ? od : shiftDay(to, -(DEFAULT_DAYS - 1));
  if (from > to) [from, to] = [to, from];
  if (from < EARLIEST_DAY) from = EARLIEST_DAY;
  return { from, to, today };
}

export default async function LigaPage({
  searchParams,
}: {
  searchParams: Promise<{ od?: string; do?: string; gracze?: string; premade?: string; tryb?: string; widok?: string }>;
}) {
  const sp = await searchParams;
  const { from, to, today } = parseRange(sp.od, sp.do);

  const usernames = LEAGUE_PLAYERS.map((p) => p.username);
  const pickedPlayers = (sp.gracze ?? "").split(",").filter((u) => usernames.includes(u));
  const pickedSizes = (sp.premade ?? "")
    .split(",")
    .map(Number)
    .filter((n) => n >= 1 && n <= 5);
  const pickedModes = (sp.tryb ?? "")
    .split(",")
    .filter((m): m is GameMode => (GAME_MODES as readonly string[]).includes(m));
  const view: LigaView = sp.widok === "wykresy" || sp.widok === "analityka" ? sp.widok : "mecze";

  const ver = await getDdragonVersion();
  let data: ClubLeagueData | null = null;
  let error: string | null = null;
  try {
    data = await getClubGames(warsawDayStart(from), warsawDayStart(shiftDay(to, 1)));
  } catch (e) {
    console.error(e);
    error = e instanceof RiotError ? e.message : "Nie udało się pobrać danych z Riot API";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
          <Swords size={26} /> Liga
        </h1>
        <p className="text-sm text-muted">Gry ekipy w League of Legends — wspólne mecze pokazane razem</p>
      </div>

      {error || !data ? (
        <div className="panel flex items-center gap-3 p-6 text-sm text-danger">
          <AlertTriangle size={18} /> {error}
        </div>
      ) : (
        <LigaClient
          data={data}
          ver={ver}
          range={{ from, to, today, earliest: EARLIEST_DAY }}
          initial={{
            players: pickedPlayers.length ? pickedPlayers : usernames,
            sizes: pickedSizes.length ? pickedSizes : [1, 2, 3, 4, 5],
            modes: pickedModes.length ? pickedModes : [...GAME_MODES],
            view,
          }}
        />
      )}
    </div>
  );
}
