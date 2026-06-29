import { createClient, type Client, type InArgs } from "@libsql/client";

const url = process.env.DATABASE_URL ?? "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

export const db: Client = createClient({ url, authToken });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  min_players INTEGER,
  max_players INTEGER,
  play_time INTEGER,            -- minuty
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  played_at TEXT NOT NULL,      -- YYYY-MM-DD
  duration_min INTEGER,
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS placements (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player TEXT NOT NULL,         -- username
  place INTEGER NOT NULL        -- 1 = pierwsze miejsce
);

CREATE TABLE IF NOT EXISTS ratings (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  score INTEGER NOT NULL,       -- 1..10
  PRIMARY KEY (game_id, username)
);

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'game' | 'date'
  month TEXT,                   -- YYYY-MM (dla ankiet terminowych)
  is_open INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_options (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  game_id TEXT,
  date_value TEXT,              -- YYYY-MM-DD
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  voter TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,           -- YYYY-MM-DD
  title TEXT NOT NULL,
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wishlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  image_url TEXT,
  note TEXT,
  added_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

let initPromise: Promise<void> | null = null;

export function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await db.execute("PRAGMA foreign_keys = ON;");
      await db.executeMultiple(SCHEMA);
    })();
  }
  return initPromise;
}

export async function q<T = Record<string, unknown>>(sql: string, args: InArgs = []): Promise<T[]> {
  await ensureInit();
  const res = await db.execute({ sql, args });
  return res.rows as unknown as T[];
}

export async function run(sql: string, args: InArgs = []): Promise<void> {
  await ensureInit();
  await db.execute({ sql, args });
}

export function uid(): string {
  return crypto.randomUUID();
}
