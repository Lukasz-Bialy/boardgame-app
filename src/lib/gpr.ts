import { q, run } from "./db";

// Global Power Rankings z lolesports.com. Publiczne API ich nie udostępnia (zapytanie GraphQL jest tylko
// po stronie ich serwera), więc czytamy dane osadzone w HTML strony /gpr — kruche z natury, dlatego
// wynik trzymamy w riot_cache i przy błędzie pokazujemy ostatnią zapisaną wersję
const PAGE = "https://lolesports.com/en-GB/gpr";
const CACHE_KEY = "gpr:v2"; // nowa wersja klucza przy zmianie kształtu danych
const TTL_MS = 6 * 3600_000;

export interface GprTeam {
  code: string;
  name: string;
  image: string | null;
  league: string | null;
  rank: number;
  prevRank: number | null;
  score: number;
  wins: number; // bilans meczów w sezonie
  losses: number;
  gameWins: number;
  gameLosses: number;
  history: { date: string; rank: number; score: number }[]; // od najstarszego
  slug: string; // id drużyny w API lolesports (skład: getTeams)
  avgOpponentScore: number | null; // średni GPR rywali w sezonie — jak trudny był terminarz
  tournaments: GprTournament[]; // turnieje sezonu, od najnowszego
}

export interface GprTournament {
  name: string;
  league: string | null;
  start: string;
  state: string; // completed | inProgress | unstarted
  wins: number;
  losses: number;
  placement: number | null;
  teams: number; // liczba drużyn w turnieju
}

export interface GprData {
  updated: string; // kiedy lolesports przeliczył ranking
  fetched: string; // kiedy pobraliśmy
  teams: GprTeam[];
}

// Wycina tablicę JSON zaczynającą się od `"teamGPR":[` — dopasowanie nawiasów z pominięciem napisów
function extractArray(html: string, key: string): unknown[] | null {
  const at = html.indexOf(`"${key}":[`);
  if (at < 0) return null;
  const start = html.indexOf("[", at);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === '"') {
      for (i++; i < html.length && html[i] !== '"'; i++) if (html[i] === "\\") i++;
      continue;
    }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
  }
  return null;
}

type Raw = {
  teamMatchRecord?: { wins: number; losses: number };
  teamGameRecord?: { wins: number; losses: number };
  currentTeamGPR?: { gprScore: number; rank: number; dateCalculated: string } | null;
  previousTeamGPR?: { rank: number } | null;
  teamGPRHistory?: { gprScore: number; rank: number; dateCalculated: string }[];
  averageOpponentGPR?: number | null;
  team?: { id: string; slug: string; code: string; name: string; image?: string; homeLeague?: { name: string } | null };
  tournaments?: {
    tournamentRecord?: { wins: number; losses: number };
    tournament?: {
      name: string;
      startTime: string;
      state: string;
      league?: { name: string } | null;
      teams?: { id: string }[];
      standings?: { team: { id: string }; placement: number }[];
    };
  }[];
};

async function fetchGpr(): Promise<GprData> {
  const res = await fetch(PAGE, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arr = extractArray(await res.text(), "teamGPR") as Raw[] | null;
  if (!arr?.length) throw new Error("nie znaleziono rankingu na stronie (zmieniła się jej budowa?)");

  const teams: GprTeam[] = arr
    .filter((t) => t.team?.code && t.currentTeamGPR)
    .map((t) => ({
      code: t.team!.code,
      name: t.team!.name,
      image: t.team!.image?.replace(/^http:\/\//, "https://") ?? null,
      league: t.team!.homeLeague?.name ?? null,
      rank: t.currentTeamGPR!.rank,
      prevRank: t.previousTeamGPR?.rank ?? null,
      score: t.currentTeamGPR!.gprScore,
      wins: t.teamMatchRecord?.wins ?? 0,
      losses: t.teamMatchRecord?.losses ?? 0,
      gameWins: t.teamGameRecord?.wins ?? 0,
      gameLosses: t.teamGameRecord?.losses ?? 0,
      history: (t.teamGPRHistory ?? [])
        .map((h) => ({ date: h.dateCalculated, rank: h.rank, score: h.gprScore }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      slug: t.team!.slug,
      avgOpponentScore: t.averageOpponentGPR ?? null,
      tournaments: (t.tournaments ?? [])
        .filter((x) => x.tournament)
        .map(({ tournament: tr, tournamentRecord: rec }) => ({
          name: tr!.name,
          league: tr!.league?.name ?? null,
          start: tr!.startTime,
          state: tr!.state,
          wins: rec?.wins ?? 0,
          losses: rec?.losses ?? 0,
          placement: tr!.standings?.find((s) => s.team.id === t.team!.id)?.placement ?? null,
          teams: tr!.teams?.length ?? 0,
        }))
        .sort((a, b) => b.start.localeCompare(a.start)),
    }))
    .sort((a, b) => a.rank - b.rank);

  const updated = arr.map((t) => t.currentTeamGPR?.dateCalculated).filter(Boolean).sort().at(-1) ?? new Date().toISOString();
  return { updated: updated!, fetched: new Date().toISOString(), teams };
}

async function readCache(): Promise<GprData | null> {
  const row = (await q<{ data: string }>(`SELECT data FROM riot_cache WHERE key = ?`, [CACHE_KEY]))[0];
  try {
    const data = row ? (JSON.parse(row.data) as GprData) : null;
    // Zapis w starszym kształcie (sprzed dodania pól podglądu drużyny) — jak brak danych, pobieramy od nowa
    return data?.teams?.[0]?.tournaments ? data : null;
  } catch {
    return null;
  }
}

/** Odświeża ranking i zapisuje go; zwraca błąd jako tekst zamiast wyrzucać */
export async function refreshGpr(): Promise<GprData | string> {
  try {
    const data = await fetchGpr();
    await run(
      `INSERT INTO riot_cache (key, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [CACHE_KEY, JSON.stringify(data), data.fetched],
    );
    return data;
  } catch (e) {
    console.error("GPR:", e);
    return `Nie udało się pobrać power rankingu z lolesports (${e instanceof Error ? e.message : e})`;
  }
}

/**
 * Ranking z pamięci podręcznej. stale = warto odświeżyć w tle (np. przez after()).
 * Przy pustej pamięci pobiera od razu — tylko pierwsze wejście czeka na lolesports.
 */
export async function getGpr(): Promise<{ data: GprData | null; stale: boolean; error: string | null }> {
  const cached = await readCache();
  if (cached) return { data: cached, stale: Date.now() - Date.parse(cached.fetched) > TTL_MS, error: null };
  const fresh = await refreshGpr();
  return typeof fresh === "string" ? { data: null, stale: false, error: fresh } : { data: fresh, stale: false, error: null };
}
