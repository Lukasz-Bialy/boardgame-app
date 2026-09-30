// Klient Riot Games API (tylko po stronie serwera — klucz nie trafia do przeglądarki)

import { createHash } from "node:crypto";
import type { InStatement } from "@libsql/client";
import { db, ensureInit, q, run } from "./db";
import { HARNAS_MIN_CLUB, harnasScores } from "./harnas";

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
  score: number | null; // wynik Harnasia 0–100 (null: tryb bez oceny — Arena, remake — albo mecz sprzed nowych statystyk)
  harnas: boolean; // najlepszy z ekipy w tym meczu
  opponent: string | null; // champion rywala z tej samej roli (Summoner's Rift z przypisanymi rolami)
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
  // Najlepszy z ekipy w meczu. null: mecz nie jest oceniany (tryb, remake, mniej niż HARNAS_MIN_CLUB osób z ekipy)
  harnas: { username: string; champion: string; score: number } | null;
  champs: { team: number; champion: string; position: string }[]; // wszyscy gracze meczu (bez Areny)
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

export async function riot<T>(path: string, attempt = 0): Promise<T> {
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

export async function cacheGet<T>(key: string): Promise<{ data: T; updatedAt: number } | null> {
  const rows = await q<{ data: string; updated_at: string }>(
    "SELECT data, updated_at FROM riot_cache WHERE key = ?",
    [key]
  );
  return rows[0] ? { data: JSON.parse(rows[0].data) as T, updatedAt: Date.parse(rows[0].updated_at) } : null;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  await run(
    `INSERT INTO riot_cache (key, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), new Date().toISOString()]
  );
}

const accountPath = (gameName: string, tagLine: string) =>
  `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

export async function getAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
  const key = `account:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
  const cached = await cacheGet<RiotAccount>(key);
  if (cached) return cached.data;
  const acc = await riot<RiotAccount>(accountPath(gameName, tagLine));
  await cacheSet(key, acc);
  return acc;
}

/* ─── Zmiana klucza API ─── */

// Riot szyfruje PUUID osobno dla każdego klucza, więc po zmianie klucza (deweloperski wygasa co 24 h)
// PUUID-y z cache są odrzucane („Exception decrypting”). Przy nowym kluczu pobieramy konta od nowa
// i podmieniamy PUUID-y w zapisanych meczach — zamiast kasować cache, bo starszych meczów Riot już nie odda.
const KEY_META = "meta:api-key";
let keySync: Promise<void> | null = null;

export function syncCacheWithKey(): Promise<void> {
  keySync ??= migrateCacheToKey().catch((e) => {
    keySync = null; // nieudana migracja (np. limit zapytań) — ponów przy następnym wejściu
    throw e;
  });
  return keySync;
}

async function migrateCacheToKey(): Promise<void> {
  const key = process.env.RIOT_API_KEY;
  if (!key) return; // brak klucza zgłosi riot()
  const fingerprint = createHash("sha256").update(key).digest("hex").slice(0, 16);
  if ((await cacheGet<string>(KEY_META))?.data === fingerprint) return;

  // Najpierw wszystkie konta — zapisujemy dopiero na końcu, żeby przerwana migracja nie zgubiła starych PUUID-ów
  const accounts = await q<{ key: string; data: string }>(
    "SELECT key, data FROM riot_cache WHERE key LIKE 'account:%'"
  );
  const fresh: { key: string; acc: RiotAccount | null }[] = [];
  const remap = new Map<string, string>();
  for (const row of accounts) {
    const old = JSON.parse(row.data) as RiotAccount;
    try {
      const acc = await riot<RiotAccount>(accountPath(old.gameName, old.tagLine));
      fresh.push({ key: row.key, acc });
      if (acc.puuid !== old.puuid) remap.set(old.puuid, acc.puuid);
    } catch (e) {
      if (!(e instanceof RiotError && e.status === 404)) throw e;
      fresh.push({ key: row.key, acc: null }); // konto zmieniło Riot ID — pobierze się od nowa
    }
  }

  // Podmiana w samej bazie — bez wczytywania całej historii meczów do pamięci. PUUID (78 znaków)
  // nie wystąpi przypadkiem jako fragment innego tekstu. Szczegóły meczów (analiza) też go trzymają.
  for (const [oldPuuid, newPuuid] of remap) {
    await run(
      `UPDATE riot_cache SET data = REPLACE(data, ?, ?)
       WHERE ((key >= 'match:' AND key < 'match;') OR (key >= 'detail:' AND key < 'detail;')) AND instr(data, ?) > 0`,
      [oldPuuid, newPuuid, oldPuuid]
    );
  }
  // Listy meczów są kluczowane starym PUUID-em — pobiorą się od nowa
  if (remap.size) await run("DELETE FROM riot_cache WHERE key LIKE 'ids:%'");

  for (const { key: k, acc } of fresh) {
    if (acc) await cacheSet(k, acc);
    else await run("DELETE FROM riot_cache WHERE key = ?", [k]);
  }
  await cacheSet(KEY_META, fingerprint);
}

// Najwcześniejszy dzień, od którego Riot filtruje listę meczów po dacie (startTime).
// Sam Riot trzyma ok. 2 lat historii, więc starsze gry i tak nie wrócą.
export const EARLIEST_DAY = "2021-06-16";

const IDS_TTL_MS = 2 * 60 * 1000;
const IDS_PAGE = 100; // maksimum Riot na jedno zapytanie

type IdList = { ids: string[]; complete: boolean };

// Wszystkie strony listy meczów z zakresu. Przy limicie zapytań w połowie — to, co zdążyliśmy pobrać.
async function fetchIdRange(puuid: string, startSec: number, endSec: number): Promise<IdList> {
  const ids: string[] = [];
  for (let start = 0; ; start += IDS_PAGE) {
    let page: string[];
    try {
      page = await riot<string[]>(
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?startTime=${startSec}&endTime=${endSec}&start=${start}&count=${IDS_PAGE}`
      );
    } catch (e) {
      if (e instanceof RiotError && e.status === 429) return { ids, complete: false };
      throw e;
    }
    ids.push(...page);
    if (page.length < IDS_PAGE) return { ids, complete: true };
  }
}

// closed = zakres w całości w przeszłości: raz pobrana pełna lista zostaje na zawsze;
// otwarty (sięga do dziś) — odświeżany najwyżej co 2 min. Gdy Riot odmówi — ostatnia znana lista.
async function cachedIdRange(puuid: string, from: number, to: number, closed: boolean): Promise<IdList> {
  const startSec = Math.floor(from / 1000);
  const endSec = Math.floor(to / 1000);
  const key = `ids:${puuid}:${startSec}:${endSec}`;
  const cached = await cacheGet<string[]>(key);
  if (cached && (closed || Date.now() - cached.updatedAt < IDS_TTL_MS)) return { ids: cached.data, complete: true };
  const fresh = await fetchIdRange(puuid, startSec, endSec);
  if (fresh.complete) {
    await cacheSet(key, fresh.ids);
    return fresh;
  }
  return cached ? { ids: cached.data, complete: true } : fresh;
}

// Zakres dzielimy na część sprzed bieżącego miesiąca (zamkniętą — po pobraniu nie kosztuje już zapytań)
// i bieżący miesiąc (odświeżany). Bez tego długi zakres co 2 min pobierałby od nowa całą historię.
async function getMatchIds(puuid: string, from: number, to: number): Promise<IdList> {
  const monthStart = warsawDayStart(warsawDay(Date.now()).slice(0, 8) + "01");
  const parts: Promise<IdList>[] = [];
  if (from < monthStart) parts.push(cachedIdRange(puuid, from, Math.min(to, monthStart), true));
  if (to > monthStart) parts.push(cachedIdRange(puuid, Math.max(from, monthStart), to, false));
  const lists = await Promise.all(parts);
  return { ids: [...new Set(lists.flatMap((l) => l.ids))], complete: lists.every((l) => l.complete) };
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
  // Statystyki do Harnasia — od wersji 2 (złoto, wizja, wardy) i 3 (leczenie, tarcze, CC) zapisu;
  // starsze mecze w cache ich nie mają
  goldEarned?: number;
  visionScore?: number;
  detectorWardsPlaced?: number;
  totalHealsOnTeammates?: number;
  totalDamageShieldedOnTeammates?: number;
  timeCCingOthers?: number;
  item0: number; item1: number; item2: number; item3: number; item4: number; item5: number; item6: number;
};

type RawMatch = {
  metadata: { matchId: string };
  info: {
    v?: number; // wersja zapisu (TRIM_VERSION)
    queueId: number;
    gameMode: string;
    gameDuration: number;
    gameEndTimestamp: number;
    participants: RawParticipant[];
  };
};

// Podbij, gdy trimMatch zaczyna zapisywać nowe pola — starsze wpisy da się wtedy dociągnąć od nowa
const TRIM_VERSION = 3;
const isCurrent = (m: RawMatch) => (m.info.v ?? 1) >= TRIM_VERSION;

// Z pełnej odpowiedzi zostawiamy tylko pola używane na stronie
function trimMatch(m: RawMatch): RawMatch {
  return {
    metadata: { matchId: m.metadata.matchId },
    info: {
      v: TRIM_VERSION,
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
        goldEarned: p.goldEarned,
        visionScore: p.visionScore,
        detectorWardsPlaced: p.detectorWardsPlaced,
        totalHealsOnTeammates: p.totalHealsOnTeammates,
        totalDamageShieldedOnTeammates: p.totalDamageShieldedOnTeammates,
        timeCCingOthers: p.timeCCingOthers,
        item0: p.item0, item1: p.item1, item2: p.item2, item3: p.item3, item4: p.item4, item5: p.item5, item6: p.item6,
      })),
    },
  };
}

// Harnaś jest przyznawany na Summoner's Rift i ARAM-ie; bez Areny, remake'ów i meczów ze starego zapisu
function scoreMatch(m: RawMatch): Map<string, number> | null {
  const { gameMode, participants } = m.info;
  const aram = gameMode === "ARAM";
  if (!aram && gameMode !== "CLASSIC" && gameMode !== "SWIFTPLAY") return null;
  if (!isCurrent(m) || participants.some((p) => p.gameEndedInEarlySurrender)) return null;
  return harnasScores(
    participants.map((p) => ({
      id: p.puuid,
      teamId: p.teamId,
      position: p.teamPosition,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.totalMinionsKilled + p.neutralMinionsKilled,
      damage: p.totalDamageDealtToChampions,
      gold: p.goldEarned ?? 0,
      vision: p.visionScore ?? 0,
      controlWards: p.detectorWardsPlaced ?? 0,
      heal: p.totalHealsOnTeammates ?? 0,
      shield: p.totalDamageShieldedOnTeammates ?? 0,
      cc: p.timeCCingOthers ?? 0,
    })),
    m.info.gameDuration / 60,
    aram
  );
}

function toPerformance(
  m: RawMatch,
  p: RawParticipant,
  arena: boolean,
  who: { username: string; riotId: string },
  clubPuuids: Set<string>,
  scores: Map<string, number> | null,
  harnasPuuid: string | null
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
    score: scores?.get(p.puuid) ?? null,
    harnas: p.puuid === harnasPuuid,
    opponent:
      !arena && p.teamPosition
        ? m.info.participants.find((x) => x.teamId !== p.teamId && x.teamPosition === p.teamPosition)?.championName ??
          null
        : null,
  };
}

/* ─── Mecze przeliczone w bazie ─── */

// Podbij, gdy zmienia się to, co liczy toGame (w tym wzór Harnasia w harnas.ts) — zapisane mecze
// przeliczą się same z surowego zapisu w riot_cache, bez zapytań do Riot API
const DERIVED_VERSION = 1;

type Club = Map<string, { username: string; riotId: string }>; // puuid → członek klubu

// Wersja przeliczenia razem ze składem, z jakim liczono — mecz policzony bez któregoś gracza
// (jego konto chwilowo się nie pobrało) przeliczy się, gdy skład będzie pełny
const dvOf = (club: Club) => `${DERIVED_VERSION}|${[...club.values()].map((c) => c.username).sort().join(",")}`;
const FULL_DV = `${DERIVED_VERSION}|${LEAGUE_PLAYERS.map((p) => p.username).sort().join(",")}`;

function toGame(m: RawMatch, club: Club): LeagueGame {
  const arena = m.info.gameMode === "CHERRY";
  const startedAt = m.info.gameEndTimestamp - m.info.gameDuration * 1000;
  const t = warsawParts(startedAt);
  const clubPuuids = new Set(club.keys());
  // Score liczony w każdym ocenianym meczu (na tle 10 graczy — analityka ról korzysta też z gier solo),
  // a Harnaś tylko w grach, w których grało co najmniej HARNAS_MIN_CLUB osób z ekipy — i tylko spośród nich.
  const members = m.info.participants.filter((p) => club.has(p.puuid));
  const scores = scoreMatch(m);
  // Remis — wygrywa pierwszy w kolejności Riot (stabilnie między przeliczeniami)
  const bestP =
    scores && members.length >= HARNAS_MIN_CLUB
      ? members.reduce((a, b) => (scores.get(b.puuid)! > scores.get(a.puuid)! ? b : a))
      : null;
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
    players: members.map((p) =>
      toPerformance(m, p, arena, club.get(p.puuid)!, clubPuuids, scores, bestP?.puuid ?? null)
    ),
    harnas: bestP
      ? { username: club.get(bestP.puuid)!.username, champion: bestP.championName, score: scores!.get(bestP.puuid)! }
      : null,
    champs: arena
      ? []
      : m.info.participants.map((p) => ({ team: p.teamId, champion: p.championName, position: p.teamPosition })),
  };
}

// Zapis przeliczonego meczu (i opcjonalnie surowego — z niego da się przeliczyć ponownie)
function gameStatements(m: RawMatch, club: Club, withRaw: boolean): InStatement[] {
  const g = toGame(m, club);
  const startedAt = g.endedAt - g.duration * 1000;
  const stmts: InStatement[] = [];
  if (withRaw) {
    stmts.push({
      sql: `INSERT INTO riot_cache (key, data, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      args: [`match:${g.id}`, JSON.stringify(m), new Date().toISOString()],
    });
  }
  stmts.push(
    {
      sql: `INSERT INTO lol_games (id, started_at, mode, src_v, dv, data) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET started_at = excluded.started_at, mode = excluded.mode,
              src_v = excluded.src_v, dv = excluded.dv, data = excluded.data`,
      args: [g.id, startedAt, g.mode, m.info.v ?? 1, dvOf(club), JSON.stringify(g)],
    },
    { sql: "DELETE FROM lol_game_players WHERE game_id = ?", args: [g.id] }
  );
  for (const p of g.players) {
    stmts.push({
      sql: `INSERT INTO lol_game_players
              (game_id, username, started_at, mode, party_size, remake, win, champion, kills, deaths, assists, harnas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        g.id, p.username, startedAt, g.mode, p.partySize, p.remake ? 1 : 0, p.win ? 1 : 0, p.champion,
        p.kills, p.deaths, p.assists, p.harnas ? 1 : 0,
      ],
    });
  }
  return stmts;
}

async function writeBatch(stmts: InStatement[]): Promise<void> {
  if (!stmts.length) return;
  await ensureInit();
  await db.batch(stmts, "write");
}

const chunks = <T,>(list: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, (i + 1) * n));
const placeholders = (list: unknown[]) => list.map(() => "?").join(",");

// Mecze z surowego cache bez aktualnego przeliczenia (pierwsze wdrożenie, nowy DERIVED_VERSION) —
// porcjami, żeby nigdy nie trzymać w pamięci całej historii naraz. Raz na proces, tylko przy pełnym składzie.
const REDERIVE_BATCH = 100;
let rederived: Promise<number> | null = null;

function rederiveOnce(club: Club): Promise<number> {
  rederived ??= (async () => {
    let total = 0;
    for (;;) {
      const rows = await q<{ key: string; data: string }>(
        `SELECT r.key, r.data FROM riot_cache r LEFT JOIN lol_games g ON g.id = substr(r.key, 7)
         WHERE r.key >= 'match:' AND r.key < 'match;' AND (g.id IS NULL OR g.dv IS NOT ?)
         LIMIT ${REDERIVE_BATCH}`,
        [FULL_DV]
      );
      await writeBatch(rows.flatMap((r) => gameStatements(JSON.parse(r.data) as RawMatch, club, false)));
      total += rows.length;
      if (rows.length < REDERIVE_BATCH) return total;
    }
  })().catch((e) => {
    rederived = null; // ponów przy następnej synchronizacji
    throw e;
  });
  return rederived;
}

// Klucz deweloperski: 100 zapytań na 2 min — więcej w jednej synchronizacji i tak by nie przeszło,
// a resztę dociągnie następne wywołanie
const MAX_FETCH_PER_SYNC = 90;

// Zapisuje brakujące mecze z listy. upgrade — mecze zapisane starszą wersją (bez statystyk Harnasia)
// pobieramy ponownie; póki się nie uda, zostaje stary zapis, a mecz liczy się do brakujących.
async function storeMatches(ids: string[], club: Club, upgrade: boolean): Promise<{ added: number; missing: number }> {
  const known = new Map<string, number>(); // id → wersja surowego zapisu
  for (const part of chunks(ids, 500)) {
    const rows = await q<{ id: string; src_v: number }>(
      `SELECT id, src_v FROM lol_games WHERE id IN (${placeholders(part)})`,
      part
    );
    for (const r of rows) known.set(r.id, Number(r.src_v));
  }
  const todo = ids.filter((id) => !known.has(id) || (upgrade && known.get(id)! < TRIM_VERSION));

  // Surowy zapis może już być w cache — wtedy przeliczamy bez zapytań do Riot
  let added = 0;
  const fromRiot: string[] = [];
  for (const part of chunks(todo, REDERIVE_BATCH)) {
    const rows = await q<{ key: string; data: string }>(
      `SELECT key, data FROM riot_cache WHERE key IN (${placeholders(part)})`,
      part.map((id) => `match:${id}`)
    );
    const raw = new Map(rows.map((r) => [r.key.slice("match:".length), JSON.parse(r.data) as RawMatch]));
    const stmts: InStatement[] = [];
    for (const id of part) {
      const m = raw.get(id);
      if (m && !known.has(id)) {
        stmts.push(...gameStatements(m, club, false));
        added++;
      }
      if (!m || (upgrade && !isCurrent(m))) fromRiot.push(id);
    }
    await writeBatch(stmts);
  }

  // Z Riot — najnowsze najpierw (w tej kolejności przychodzą listy). Po limicie 2-minutowym nie pytamy dalej.
  const queue = fromRiot.slice(0, MAX_FETCH_PER_SYNC);
  let fetched = 0;
  let rateLimited = false;
  const worker = async () => {
    for (let id = queue.shift(); id && !rateLimited; id = queue.shift()) {
      try {
        const m = trimMatch(await riot<RawMatch>(`/lol/match/v5/matches/${id}`));
        await writeBatch(gameStatements(m, club, true));
        fetched++;
      } catch (e) {
        if (e instanceof RiotError && e.status === 429) rateLimited = true;
        else console.warn(`Riot: nie pobrano meczu ${id}:`, e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: MAX_CONCURRENT }, worker));
  return { added: added + fetched, missing: fromRiot.length - fetched };
}

export type LeagueAccount = { username: string; riotId: string; error: string | null };

export type SyncResult = {
  accounts: LeagueAccount[];
  added: number; // ile meczów zapisano/przeliczono — klient odświeża wtedy widok
  missing: number; // mecze, których jeszcze nie udało się pobrać (limit zapytań)
  incomplete: boolean; // lista meczów któregoś gracza jeszcze niepełna (limit zapytań)
};

// Równoległe wywołania dla tego samego zakresu (kilka otwartych kart) dzielą jedną synchronizację
const inflight = new Map<string, Promise<SyncResult>>();

// Dociąga z Riot mecze wszystkich członków klubu z zakresu [from, to) (epoch ms) i zapisuje je przeliczone.
// Samych meczów nie zwraca — widoki czytają gotowe wiersze z bazy (liga-queries.ts).
export function syncClubGames(from: number, to: number, { upgrade = false } = {}): Promise<SyncResult> {
  const key = `${from}:${to}:${upgrade}`;
  let p = inflight.get(key);
  if (!p) {
    p = doSync(from, to, upgrade).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

async function doSync(from: number, to: number, upgrade: boolean): Promise<SyncResult> {
  await syncCacheWithKey();
  const resolved = await Promise.all(
    LEAGUE_PLAYERS.map(async (lp) => {
      const fallbackId = `${lp.gameName}#${lp.tagLine}`;
      try {
        const acc = await getAccount(lp.gameName, lp.tagLine);
        const { ids, complete } = await getMatchIds(acc.puuid, from, to);
        return {
          username: lp.username,
          riotId: `${acc.gameName}#${acc.tagLine}`,
          puuid: acc.puuid,
          ids,
          complete,
          error: null,
        };
      } catch (e) {
        const error = e instanceof RiotError ? e.message : "Nie udało się pobrać danych";
        return { username: lp.username, riotId: fallbackId, puuid: "", ids: [] as string[], complete: true, error };
      }
    })
  );

  // Klucz nieprawidłowy dotyczy wszystkich — zgłoś to jako błąd całej strony
  const authError = resolved.find((r) => r.error?.includes("Klucz"));
  if (authError) throw new RiotError(401, authError.error!);

  const club: Club = new Map(
    resolved.filter((r) => r.puuid).map((r) => [r.puuid, { username: r.username, riotId: r.riotId }])
  );
  const rederivedCount = dvOf(club) === FULL_DV ? await rederiveOnce(club) : 0;
  const { added, missing } = await storeMatches([...new Set(resolved.flatMap((r) => r.ids))], club, upgrade);

  return {
    accounts: resolved.map(({ username, riotId, error }) => ({ username, riotId, error })),
    added: added + rederivedCount,
    missing,
    incomplete: resolved.some((r) => !r.complete),
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
