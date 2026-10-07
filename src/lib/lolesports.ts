// Nieoficjalne API lolesports.com (to samo, z którego korzysta ich strona). Brak dokumentacji i gwarancji —
// klucz jest publiczny, wpisany w kod lolesports.com; można go nadpisać zmienną LOLESPORTS_API_KEY
const BASE = "https://esports-api.lolesports.com/persisted/gw";
const KEY = process.env.LOLESPORTS_API_KEY ?? "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ hl: "en-US", ...params });
  const res = await fetch(`${BASE}/${path}?${qs}`, {
    headers: { "x-api-key": KEY },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`lolesports ${path}: HTTP ${res.status}`);
  return (await res.json()).data as T;
}

export interface LolLeague {
  id: string;
  slug: string;
  name: string;
  region: string;
  image: string;
}

export interface LolTournament {
  id: string;
  slug: string; // np. worlds_2026, lec_2026_summer
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface LolTeam {
  name: string;
  code: string; // "TBD" = jeszcze nieznana
  image: string;
  result: { outcome: "win" | "loss" | "tie" | null; gameWins: number } | null;
}

export interface LolMatchEvent {
  startTime: string;
  state: "unstarted" | "inProgress" | "completed";
  type: string; // 'match' | 'show'
  blockName: string; // etap, np. Swiss, Quarterfinals
  match?: { id: string; teams: LolTeam[]; strategy: { type: string; count: number } };
}

export async function getLeagues(): Promise<LolLeague[]> {
  const d = await get<{ leagues: (LolLeague & { priority?: number })[] }>("getLeagues", {});
  return d.leagues.map(({ id, slug, name, region, image }) => ({ id, slug, name, region, image }));
}

export async function getTournaments(leagueId: string): Promise<LolTournament[]> {
  const d = await get<{ leagues: { tournaments: LolTournament[] }[] }>("getTournamentsForLeague", { leagueId });
  return (d.leagues[0]?.tournaments ?? []).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

const day = 86_400_000;

// Terminarz ligi jest jeden dla wszystkich edycji i stronicowany (pierwsza strona = okolice „teraz”),
// więc chodzimy w obie strony, dopóki strony zahaczają o daty edycji, i filtrujemy mecze po tych datach
export async function getTournamentMatches(leagueId: string, startDate: string, endDate: string): Promise<LolMatchEvent[]> {
  // Zapas na strefy czasowe i mecze tuż po oficjalnym końcu edycji
  const from = Date.parse(startDate) - day;
  const to = Date.parse(endDate) + 2 * day;
  type Page = { schedule: { pages: { older: string | null; newer: string | null }; events: LolMatchEvent[] } };

  const all: LolMatchEvent[] = [];
  const first = await get<Page>("getSchedule", { leagueId });
  all.push(...first.schedule.events);

  for (const dir of ["older", "newer"] as const) {
    let token = first.schedule.pages[dir];
    let edge = first.schedule.events;
    for (let i = 0; token && i < 20; i++) {
      // Strona w całości poza zakresem edycji — dalej w tę stronę nie ma czego szukać
      const times = edge.map((e) => Date.parse(e.startTime));
      if (times.length && (dir === "older" ? Math.min(...times) < from : Math.max(...times) > to)) break;
      const page = await get<Page>("getSchedule", { leagueId, pageToken: token });
      all.push(...page.schedule.events);
      edge = page.schedule.events;
      token = page.schedule.pages[dir];
    }
  }

  const seen = new Set<string>();
  return all.filter((e) => {
    const t = Date.parse(e.startTime);
    if (e.type !== "match" || !e.match || t < from || t > to || seen.has(e.match.id)) return false;
    seen.add(e.match.id);
    return true;
  });
}

// Nazwy etapów po polsku; nieznane zostają w oryginale
const STAGES: Record<string, string> = {
  "Play-Ins": "Play-In",
  "Play-In": "Play-In",
  "Play In Knockouts": "Play-In",
  Swiss: "Swiss",
  Groups: "Faza grupowa",
  "Regular Season": "Sezon zasadniczy",
  Playoffs: "Play-offy",
  Quarterfinals: "Ćwierćfinały",
  Semifinals: "Półfinały",
  Finals: "Finał",
  Final: "Finał",
};

export const stageName = (block: string) => STAGES[block] ?? block;

// „worlds_2026” → „Worlds 2026”, „lec_2026_summer” → „LEC 2026 Summer”
export function tournamentTitle(league: string, slug: string): string {
  const rest = slug
    .split("_")
    .slice(1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return rest ? `${league} ${rest}` : league;
}

export type LolRole = "top" | "jungle" | "mid" | "bottom" | "support" | "none";

export interface LolPlayer {
  nick: string;
  name: string; // imię i nazwisko
  role: LolRole;
  image: string | null;
}

/** Zawodnicy drużyny (po slugu z lolesports) — razem z akademią i rezerwowymi, API ich nie rozróżnia */
export async function getTeamRoster(slug: string): Promise<LolPlayer[]> {
  const d = await get<{ teams: { players: { summonerName: string; firstName: string; lastName: string; role: string; image?: string }[] }[] }>(
    "getTeams",
    { id: slug },
  );
  return (d.teams[0]?.players ?? []).map((p) => ({
    nick: p.summonerName,
    name: `${p.firstName} ${p.lastName}`.trim(),
    role: (["top", "jungle", "mid", "bottom", "support"].includes(p.role) ? p.role : "none") as LolRole,
    image: p.image?.replace(/^http:\/\//, "https://") ?? null,
  }));
}
