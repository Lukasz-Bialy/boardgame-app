// Klient Riot Games API (tylko po stronie serwera — klucz nie trafia do przeglądarki)

import { q, run } from "./db";

const REGION = "https://europe.api.riotgames.com"; // routing regionalny dla EUNE

// Konta LoL członków klubu (username z users.ts → Riot ID)
export const LEAGUE_PLAYERS = [
  { username: "Entey", gameName: "Entey", tagLine: "EUNE" },
  { username: "Bulczy", gameName: "Bulczy", tagLine: "EUNE" },
  { username: "Eldorida", gameName: "Eldorida", tagLine: "EUNE" },
  { username: "Chleboldi", gameName: "Chleboldi", tagLine: "EUNE" },
  { username: "Vrenshrrgn", gameName: "Vrenshrrgn", tagLine: "EUNE" },
];

export type RiotAccount = { puuid: string; gameName: string; tagLine: string };

// Występ jednego członka klubu w meczu
export type PlayerPerformance = {
  username: string;
  riotId: string;
  remake: boolean;
  placement: number | null; // tylko Arena (1–8)
  win: boolean;
  champion: string;
  champLevel: number;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  damage: number;
  killParticipation: number; // 0–1
  items: number[]; // 0 = pusty slot
  trinket: number;
  partySize: number; // ilu członków klubu w tej samej drużynie (1 = solo)
  team: number; // id drużyny w meczu (na Arenie: duet/trio) — kto z klubu grał razem
};

// Typ gry do filtrowania: główne kolejki osobno, reszta (normalki, Swiftplay, URF…) jako „inne”
export const GAME_MODES = ["flex", "solo", "draft", "arena", "aram", "inne"] as const;
export type GameMode = (typeof GAME_MODES)[number];

function modeOf(queueId: number, gameMode: string): GameMode {
  if (queueId === 440) return "flex";
  if (queueId === 420) return "solo";
  if (queueId === 400) return "draft";
  if (gameMode === "CHERRY") return "arena";
  if (gameMode === "ARAM") return "aram";
  return "inne";
}

export type LeagueGame = {
  id: string;
  queue: string;
  mode: GameMode;
  arena: boolean;
  endedAt: number; // ms
  duration: number; // s
  // Czas ROZPOCZĘCIA gry w strefie Europe/Warsaw — liczony na serwerze, żeby klient nie zależał od strefy przeglądarki
  day: string; // YYYY-MM-DD
  hour: number; // 0–23
  weekday: number; // 0 = poniedziałek … 6 = niedziela
  startedLabel: string; // np. "28 wrz, 21:14"
  players: PlayerPerformance[]; // tylko członkowie klubu
};

/* ─── Czas w strefie Europe/Warsaw ─── */

const TZ = "Europe/Warsaw";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function warsawParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function warsawDay(ms: number): string {
  const p = warsawParts(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

// Początek dnia (00:00 czasu polskiego) jako epoch ms
export function warsawDayStart(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const p = warsawParts(guess);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute) - guess;
  return guess - offset;
}

export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const QUEUES: Record<number, string> = {
  400: "Normal Draft",
  420: "Ranked Solo/Duo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Swiftplay",
  490: "Quickplay",
  700: "Clash",
  900: "URF",
  1700: "Arena",
  1710: "Arena",
  1750: "Arena",
  1900: "URF",
};

export class RiotError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Klucz deweloperski: 20 zapytań/s i 100 na 2 min — ograniczamy równoległość;
// po 429 ponawiamy tylko przy krótkim oczekiwaniu (limit sekundowy)
const MAX_CONCURRENT = 6;
let active = 0;
const waiting: (() => void)[] = [];

async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

async function riot<T>(path: string, attempt = 0): Promise<T> {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new RiotError(0, "Brak RIOT_API_KEY w .env");
  const res = await limited(() => fetch(REGION + path, { headers: { "X-Riot-Token": key }, cache: "no-store" }));
  if (res.status === 429 && attempt < 1) {
    const wait = Number(res.headers.get("Retry-After") ?? 1);
    if (wait <= 2) {
      await new Promise((r) => setTimeout(r, wait * 1000));
      return riot<T>(path, attempt + 1);
    }
  }
  if (!res.ok) {
    const msg =
      res.status === 401 || res.status === 403
        ? "Klucz Riot API jest nieprawidłowy lub wygasł"
        : res.status === 404
        ? "Nie znaleziono gracza"
        : res.status === 429
        ? "Przekroczono limit zapytań Riot API — spróbuj za chwilę"
        : `Riot API zwróciło błąd ${res.status}`;
    throw new RiotError(res.status, msg);
  }
  return res.json();
}

/* ─── Trwały cache w bazie (PUUID i zakończone mecze się nie zmieniają) ─── */

async function cacheGet<T>(key: string): Promise<{ data: T; updatedAt: number } | null> {
  const rows = await q<{ data: string; updated_at: string }>(
    "SELECT data, updated_at FROM riot_cache WHERE key = ?",
    [key]
  );
  return rows[0] ? { data: JSON.parse(rows[0].data) as T, updatedAt: Date.parse(rows[0].updated_at) } : null;
}

async function cacheSet(key: string, value: unknown): Promise<void> {
  await run(
    `INSERT INTO riot_cache (key, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), new Date().toISOString()]
  );
}

export async function getAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
  const key = `account:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
  const cached = await cacheGet<RiotAccount>(key);
  if (cached) return cached.data;
  const acc = await riot<RiotAccount>(
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
  await cacheSet(key, acc);
  return acc;
}

// Lista meczów z zakresu: odświeżana najwyżej co 2 min; zakres zamknięty w przeszłości już się nie zmieni.
// Gdy Riot odmówi — ostatnia znana lista.
const IDS_TTL_MS = 2 * 60 * 1000;
const IDS_PAGE = 100; // maksimum Riot na jedno zapytanie
export const MAX_IDS_PER_PLAYER = 300;

async function getMatchIds(puuid: string, from: number, to: number): Promise<string[]> {
  const startSec = Math.floor(from / 1000);
  const endSec = Math.floor(to / 1000);
  const key = `ids:${puuid}:${startSec}:${endSec}`;
  const cached = await cacheGet<string[]>(key);
  const closed = cached && cached.updatedAt > to + 60 * 60 * 1000; // pobrane godzinę po końcu zakresu
  if (cached && (closed || Date.now() - cached.updatedAt < IDS_TTL_MS)) return cached.data;
  try {
    const ids: string[] = [];
    for (let start = 0; start < MAX_IDS_PER_PLAYER; start += IDS_PAGE) {
      const page = await riot<string[]>(
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?startTime=${startSec}&endTime=${endSec}&start=${start}&count=${IDS_PAGE}`
      );
      ids.push(...page);
      if (page.length < IDS_PAGE) break;
    }
    await cacheSet(key, ids);
    return ids;
  } catch (e) {
    if (cached && e instanceof RiotError && e.status === 429) return cached.data;
    throw e;
  }
}

type RawParticipant = {
  puuid: string;
  teamId: number;
  playerSubteamId?: number;
  placement?: number;
  win: boolean;
  championName: string;
  champLevel: number;
  teamPosition: string;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  totalDamageDealtToChampions: number;
  gameEndedInEarlySurrender: boolean;
  item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number;
};

type RawMatch = {
  metadata: { matchId: string };
  info: {
    queueId: number;
    gameMode: string;
    gameDuration: number;
    gameEndTimestamp: number;
    participants: RawParticipant[];
  };
};

// Z pełnej odpowiedzi zostawiamy tylko pola używane na stronie
function trimMatch(m: RawMatch): RawMatch {
  return {
    metadata: { matchId: m.metadata.matchId },
    info: {
      queueId: m.info.queueId,
      gameMode: m.info.gameMode,
      gameDuration: m.info.gameDuration,
      gameEndTimestamp: m.info.gameEndTimestamp,
      participants: m.info.participants.map((p) => ({
        puuid: p.puuid,
        teamId: p.teamId,
        playerSubteamId: p.playerSubteamId,
        placement: p.placement,
        win: p.win,
        championName: p.championName,
        champLevel: p.champLevel,
        teamPosition: p.teamPosition,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        totalMinionsKilled: p.totalMinionsKilled,
        neutralMinionsKilled: p.neutralMinionsKilled,
        totalDamageDealtToChampions: p.totalDamageDealtToChampions,
        gameEndedInEarlySurrender: p.gameEndedInEarlySurrender,
        item0: p.item0, item1: p.item1, item2: p.item2, item3: p.item3, item4: p.item4, item5: p.item5, item6: p.item6,
      })),
    },
  };
}

async function getMatches(ids: string[]): Promise<{ matches: RawMatch[]; missing: number }> {
  if (ids.length === 0) return { matches: [], missing: 0 };
  const rows = await q<{ key: string; data: string }>(
    `SELECT key, data FROM riot_cache WHERE key IN (${ids.map(() => "?").join(",")})`,
    ids.map((id) => `match:${id}`)
  );
  const byId = new Map(rows.map((r) => [r.key.slice("match:".length), JSON.parse(r.data) as RawMatch]));

  // Po trafieniu na limit 2-minutowy nie pytamy dalej — resztę dociągnie następne odświeżenie
  let rateLimited = false;
  const fetched = await Promise.all(
    ids
      .filter((id) => !byId.has(id))
      .map(async (id) => {
        if (rateLimited) return null;
        try {
          const m = trimMatch(await riot<RawMatch>(`/lol/match/v5/matches/${id}`));
          await cacheSet(`match:${id}`, m);
          return m;
        } catch (e) {
          if (e instanceof RiotError && e.status === 429) rateLimited = true;
          else console.warn(`Riot: nie pobrano meczu ${id}:`, e instanceof Error ? e.message : e);
          return null;
        }
      })
  );
  for (const m of fetched) if (m) byId.set(m.metadata.matchId, m);

  const matches = ids.map((id) => byId.get(id)).filter((m): m is RawMatch => !!m);
  return { matches, missing: ids.length - matches.length };
}

function toPerformance(
  m: RawMatch,
  p: RawParticipant,
  arena: boolean,
  who: { username: string; riotId: string },
  clubPuuids: Set<string>
): PlayerPerformance {
  // Na Arenie drużyną jest duet/trio (playerSubteamId), a nie strona mapy
  const team = m.info.participants.filter((x) =>
    arena ? x.playerSubteamId === p.playerSubteamId : x.teamId === p.teamId
  );
  const teamKills = team.reduce((a, x) => a + x.kills, 0);
  return {
    ...who,
    partySize: team.filter((x) => clubPuuids.has(x.puuid)).length,
    team: arena ? p.playerSubteamId ?? 0 : p.teamId,
    remake: p.gameEndedInEarlySurrender,
    placement: arena && p.placement ? p.placement : null,
    win: p.win,
    champion: p.championName,
    champLevel: p.champLevel,
    position: p.teamPosition,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    damage: p.totalDamageDealtToChampions,
    killParticipation: teamKills ? (p.kills + p.assists) / teamKills : 0,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5],
    trinket: p.item6,
  };
}

export type ClubLeagueData = {
  accounts: { username: string; riotId: string; error: string | null }[];
  games: LeagueGame[];
  missing: number; // mecze, których jeszcze nie udało się pobrać (limit zapytań)
};

// Gry wszystkich członków klubu z zakresu [from, to) (epoch ms); wspólne mecze scalone w jeden wpis
export async function getClubGames(from: number, to: number): Promise<ClubLeagueData> {
  const resolved = await Promise.all(
    LEAGUE_PLAYERS.map(async (lp) => {
      const fallbackId = `${lp.gameName}#${lp.tagLine}`;
      try {
        const acc = await getAccount(lp.gameName, lp.tagLine);
        const ids = await getMatchIds(acc.puuid, from, to);
        return { username: lp.username, riotId: `${acc.gameName}#${acc.tagLine}`, puuid: acc.puuid, ids, error: null };
      } catch (e) {
        const error = e instanceof RiotError ? e.message : "Nie udało się pobrać danych";
        return { username: lp.username, riotId: fallbackId, puuid: "", ids: [] as string[], error };
      }
    })
  );

  // Klucz nieprawidłowy dotyczy wszystkich — zgłoś to jako błąd całej strony
  const authError = resolved.find((r) => r.error?.includes("Klucz"));
  if (authError) throw new RiotError(401, authError.error!);

  const byPuuid = new Map(resolved.filter((r) => r.puuid).map((r) => [r.puuid, r]));
  const clubPuuids = new Set(byPuuid.keys());
  const uniqueIds = [...new Set(resolved.flatMap((r) => r.ids))];
  const { matches, missing } = await getMatches(uniqueIds);

  const games: LeagueGame[] = matches.map((m) => {
    const arena = m.info.gameMode === "CHERRY";
    const startedAt = m.info.gameEndTimestamp - m.info.gameDuration * 1000;
    const t = warsawParts(startedAt);
    return {
      id: m.metadata.matchId,
      queue: QUEUES[m.info.queueId] ?? (arena ? "Arena" : m.info.gameMode),
      mode: modeOf(m.info.queueId, m.info.gameMode),
      arena,
      endedAt: m.info.gameEndTimestamp,
      duration: m.info.gameDuration,
      day: `${t.y}-${pad(t.m)}-${pad(t.d)}`,
      hour: t.hour,
      weekday: t.weekday,
      startedLabel: new Date(startedAt).toLocaleString("pl-PL", {
        timeZone: TZ,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      players: m.info.participants
        .filter((p) => byPuuid.has(p.puuid))
        .map((p) => {
          const r = byPuuid.get(p.puuid)!;
          return toPerformance(m, p, arena, { username: r.username, riotId: r.riotId }, clubPuuids);
        }),
    };
  });
  games.sort((a, b) => b.endedAt - a.endedAt);

  return {
    accounts: resolved.map(({ username, riotId, error }) => ({ username, riotId, error })),
    games,
    missing,
  };
}

// Wersja Data Dragon (obrazki championów i przedmiotów)
export async function getDdragonVersion(): Promise<string> {
  try {
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { next: { revalidate: 86400 } });
    const versions: string[] = await res.json();
    return versions[0];
  } catch {
    return "16.19.1";
  }
}
