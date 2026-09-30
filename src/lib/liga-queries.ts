// Odczyt meczów ligi z bazy (przeliczonych przy zapisie w riot.ts) — widoki pobierają tylko to, co pokazują,
// zamiast całej historii z zakresu przy każdym wejściu na stronę

import { q } from "./db";
import type { GameMode, LeagueGame } from "./riot";

export type GameFilter = {
  from: number; // epoch ms rozpoczęcia gry, [from, to)
  to: number;
  players: string[];
  sizes: number[]; // premade 1–5
  modes: GameMode[];
};

// Statystyki karty gracza (bez remake'ów), jak w PlayerCard
export type PlayerCardStat = {
  username: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  crowns: number;
  top: string | null; // najczęściej grany champion
};

const ph = (list: unknown[]) => list.map(() => "?").join(",");

// Warunek na występ członka klubu (alias p) — ten sam, którym filtruje lista meczów
function perfWhere(f: GameFilter, p: string) {
  return {
    sql: `${p}.started_at >= ? AND ${p}.started_at < ? AND ${p}.mode IN (${ph(f.modes)})
          AND ${p}.username IN (${ph(f.players)}) AND MIN(${p}.party_size, 5) IN (${ph(f.sizes)})`,
    args: [f.from, f.to, ...f.modes, ...f.players, ...f.sizes],
  };
}

const emptyFilter = (f: GameFilter) => !f.players.length || !f.sizes.length || !f.modes.length;

// Strona listy meczów (najnowsze najpierw) — mecz jest na liście, gdy gra w nim ktoś z wybranych graczy
export async function queryGamesPage(
  f: GameFilter,
  offset: number,
  limit: number
): Promise<{ total: number; games: LeagueGame[] }> {
  if (emptyFilter(f)) return { total: 0, games: [] };
  const w = perfWhere(f, "p");
  const [count] = await q<{ n: number }>(
    `SELECT COUNT(DISTINCT p.game_id) AS n FROM lol_game_players p WHERE ${w.sql}`,
    w.args
  );
  if (!limit) return { total: Number(count.n), games: [] };
  const rows = await q<{ data: string }>(
    `SELECT g.data FROM lol_games g
     WHERE g.id IN (SELECT p.game_id FROM lol_game_players p WHERE ${w.sql})
     ORDER BY g.started_at DESC, g.id DESC LIMIT ? OFFSET ?`,
    [...w.args, limit, offset]
  );
  return { total: Number(count.n), games: rows.map((r) => JSON.parse(r.data) as LeagueGame) };
}

// Karty graczy liczone w bazie (agregacja zamiast wczytywania meczów)
export async function queryPlayerCards(f: GameFilter): Promise<PlayerCardStat[]> {
  if (emptyFilter(f)) return [];
  const w = perfWhere(f, "p");
  const [totals, champs] = await Promise.all([
    q<Omit<PlayerCardStat, "top">>(
      `SELECT p.username, COUNT(*) AS games, SUM(p.win) AS wins, SUM(p.kills) AS kills, SUM(p.deaths) AS deaths,
              SUM(p.assists) AS assists, SUM(p.harnas) AS crowns
       FROM lol_game_players p WHERE ${w.sql} AND p.remake = 0 GROUP BY p.username`,
      w.args
    ),
    q<{ username: string; champion: string; n: number }>(
      `SELECT p.username, p.champion, COUNT(*) AS n
       FROM lol_game_players p WHERE ${w.sql} AND p.remake = 0
       GROUP BY p.username, p.champion ORDER BY n DESC, MAX(p.started_at) DESC`,
      w.args
    ),
  ]);
  const top = new Map<string, string>();
  for (const c of champs) if (!top.has(c.username)) top.set(c.username, c.champion);
  return totals.map((t) => ({
    username: t.username,
    games: Number(t.games),
    wins: Number(t.wins),
    kills: Number(t.kills),
    deaths: Number(t.deaths),
    assists: Number(t.assists),
    crowns: Number(t.crowns),
    top: top.get(t.username) ?? null,
  }));
}

// Wszystkie mecze z zakresu jako gotowy JSON — porcjami, bez parsowania, żeby długi zakres
// („Wszystko”) nie trafiał do pamięci serwera w całości. Tylko dla zakładek, które liczą w przeglądarce.
const STREAM_PAGE = 500;

export function streamGamesJson(from: number, to: number): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let cursor: { started: number; id: string } | null = null;
  let first = true;
  let done = false;
  return new ReadableStream({
    async pull(ctl) {
      if (done) return ctl.close();
      const rows: { id: string; started_at: number; data: string }[] = await q<{
        id: string;
        started_at: number;
        data: string;
      }>(
        `SELECT id, started_at, data FROM lol_games
         WHERE started_at >= ? AND started_at < ?${cursor ? " AND (started_at < ? OR (started_at = ? AND id < ?))" : ""}
         ORDER BY started_at DESC, id DESC LIMIT ${STREAM_PAGE}`,
        cursor ? [from, to, cursor.started, cursor.started, cursor.id] : [from, to]
      );
      const body = rows.map((r) => r.data).join(",");
      ctl.enqueue(enc.encode((first ? "[" : body ? "," : "") + body));
      first = false;
      if (rows.length < STREAM_PAGE) {
        ctl.enqueue(enc.encode("]"));
        done = true;
      } else {
        const last = rows[rows.length - 1];
        cursor = { started: Number(last.started_at), id: last.id };
      }
    },
  });
}

// Mecze miesiąca do rankingu Harnasia (tylko pola, których używa ranking)
export async function queryHarnasGames(from: number, to: number) {
  const rows = await q<{ data: string }>(
    "SELECT data FROM lol_games WHERE started_at >= ? AND started_at < ? ORDER BY started_at DESC, id DESC",
    [from, to]
  );
  return rows.map((r) => {
    const g = JSON.parse(r.data) as LeagueGame;
    return {
      id: g.id,
      queue: g.queue,
      mode: g.mode,
      startedLabel: g.startedLabel,
      harnas: g.harnas,
      players: g.players.map((p) => ({
        username: p.username,
        champion: p.champion,
        win: p.win,
        score: p.score,
        harnas: p.harnas,
      })),
    };
  });
}
