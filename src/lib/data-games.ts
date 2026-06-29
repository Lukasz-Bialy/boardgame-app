import { q, run, uid } from "./db";
import type {
  Game,
  GameWithStats,
  PlaySession,
  Placement,
  PlayerGameStat,
} from "./types";

const nowIso = () => new Date().toISOString();

/* ───────────────────────── GRY ───────────────────────── */

export async function listGames(): Promise<GameWithStats[]> {
  return q<GameWithStats>(`
    SELECT g.*,
      (SELECT COUNT(*) FROM sessions s WHERE s.game_id = g.id) AS play_count,
      (SELECT ROUND(AVG(r.score), 1) FROM ratings r WHERE r.game_id = g.id) AS avg_rating,
      (SELECT COUNT(*) FROM ratings r WHERE r.game_id = g.id) AS rating_count
    FROM games g
    ORDER BY g.name COLLATE NOCASE ASC
  `);
}

export async function getGame(id: string): Promise<GameWithStats | null> {
  const rows = await q<GameWithStats>(
    `
    SELECT g.*,
      (SELECT COUNT(*) FROM sessions s WHERE s.game_id = g.id) AS play_count,
      (SELECT ROUND(AVG(r.score), 1) FROM ratings r WHERE r.game_id = g.id) AS avg_rating,
      (SELECT COUNT(*) FROM ratings r WHERE r.game_id = g.id) AS rating_count
    FROM games g WHERE g.id = ?
  `,
    [id]
  );
  return rows[0] ?? null;
}

export interface GameInput {
  name: string;
  image_url?: string | null;
  min_players?: number | null;
  max_players?: number | null;
  play_time?: number | null;
  description?: string | null;
}

export async function createGame(input: GameInput): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO games (id, name, image_url, min_players, max_players, play_time, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.image_url ?? null,
      input.min_players ?? null,
      input.max_players ?? null,
      input.play_time ?? null,
      input.description ?? null,
      nowIso(),
    ]
  );
  return id;
}

export async function updateGame(id: string, input: GameInput): Promise<void> {
  await run(
    `UPDATE games SET name = ?, image_url = ?, min_players = ?, max_players = ?, play_time = ?, description = ?
     WHERE id = ?`,
    [
      input.name,
      input.image_url ?? null,
      input.min_players ?? null,
      input.max_players ?? null,
      input.play_time ?? null,
      input.description ?? null,
      id,
    ]
  );
}

export async function deleteGame(id: string): Promise<void> {
  await run(`DELETE FROM games WHERE id = ?`, [id]);
}

/* ─────────────────────── ROZGRYWKI ─────────────────────── */

export async function listSessions(gameId: string): Promise<PlaySession[]> {
  const sessions = await q<Omit<PlaySession, "placements">>(
    `SELECT * FROM sessions WHERE game_id = ? ORDER BY played_at DESC, created_at DESC`,
    [gameId]
  );
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);
  const placeholders = ids.map(() => "?").join(",");
  const placements = await q<Placement>(
    `SELECT * FROM placements WHERE session_id IN (${placeholders}) ORDER BY place ASC`,
    ids
  );
  return sessions.map((s) => ({
    ...s,
    placements: placements.filter((p) => p.session_id === s.id),
  }));
}

export interface SessionInput {
  played_at: string;
  duration_min?: number | null;
  note?: string | null;
  placements: { player: string; place: number }[];
}

export async function createSession(
  gameId: string,
  input: SessionInput,
  createdBy: string
): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO sessions (id, game_id, played_at, duration_min, note, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, gameId, input.played_at, input.duration_min ?? null, input.note ?? null, createdBy, nowIso()]
  );
  for (const p of input.placements) {
    await run(`INSERT INTO placements (id, session_id, player, place) VALUES (?, ?, ?, ?)`, [
      uid(),
      id,
      p.player,
      p.place,
    ]);
  }
  return id;
}

export async function getSession(id: string): Promise<PlaySession | null> {
  const rows = await q<Omit<PlaySession, "placements">>(`SELECT * FROM sessions WHERE id = ?`, [id]);
  if (!rows[0]) return null;
  const placements = await q<Placement>(
    `SELECT * FROM placements WHERE session_id = ? ORDER BY place ASC`,
    [id]
  );
  return { ...rows[0], placements };
}

export async function deleteSession(id: string): Promise<void> {
  await run(`DELETE FROM sessions WHERE id = ?`, [id]);
}

/* ──────────────── HISTORIA / STATYSTYKI GRACZA ──────────────── */

export interface PlayerSessionRow {
  session_id: string;
  game_id: string;
  game_name: string;
  played_at: string;
  place: number;
  total_players: number;
}

export async function getPlayerHistory(username: string): Promise<PlayerSessionRow[]> {
  return q<PlayerSessionRow>(
    `
    SELECT s.id AS session_id, s.game_id, g.name AS game_name, s.played_at, p.place,
      (SELECT COUNT(*) FROM placements pp WHERE pp.session_id = s.id) AS total_players
    FROM placements p
    JOIN sessions s ON s.id = p.session_id
    JOIN games g ON g.id = s.game_id
    WHERE p.player = ?
    ORDER BY s.played_at DESC, s.created_at DESC
  `,
    [username]
  );
}

export async function getPlayerStats(username: string): Promise<PlayerGameStat[]> {
  return q<PlayerGameStat>(
    `
    SELECT g.id AS game_id, g.name AS game_name,
      COUNT(*) AS games,
      SUM(CASE WHEN p.place = 1 THEN 1 ELSE 0 END) AS first,
      SUM(CASE WHEN p.place = 2 THEN 1 ELSE 0 END) AS second,
      SUM(CASE WHEN p.place = 3 THEN 1 ELSE 0 END) AS third,
      SUM(CASE WHEN p.place > 3 THEN 1 ELSE 0 END) AS other
    FROM placements p
    JOIN sessions s ON s.id = p.session_id
    JOIN games g ON g.id = s.game_id
    WHERE p.player = ?
    GROUP BY g.id, g.name
    ORDER BY games DESC, g.name COLLATE NOCASE ASC
  `,
    [username]
  );
}

/* ───────────────────────── OCENY ───────────────────────── */

export async function getUserRating(gameId: string, username: string): Promise<number | null> {
  const rows = await q<{ score: number }>(
    `SELECT score FROM ratings WHERE game_id = ? AND username = ?`,
    [gameId, username]
  );
  return rows[0]?.score ?? null;
}

export async function setRating(gameId: string, username: string, score: number): Promise<void> {
  await run(
    `INSERT INTO ratings (game_id, username, score) VALUES (?, ?, ?)
     ON CONFLICT(game_id, username) DO UPDATE SET score = excluded.score`,
    [gameId, username, score]
  );
}

export async function listGameRatings(
  gameId: string
): Promise<{ username: string; score: number }[]> {
  return q<{ username: string; score: number }>(
    `SELECT username, score FROM ratings WHERE game_id = ? ORDER BY score DESC`,
    [gameId]
  );
}

export type { Game };
