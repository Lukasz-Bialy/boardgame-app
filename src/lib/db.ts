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

CREATE TABLE IF NOT EXISTS kebab_restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  url TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kebab_orders (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES kebab_restaurants(id) ON DELETE CASCADE,
  meeting_id TEXT,
  date TEXT NOT NULL,
  note TEXT,
  delivery_cost INTEGER NOT NULL DEFAULT 0,
  paid_by TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kebab_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES kebab_orders(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  item_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  rating INTEGER,
  comment TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kebab_settlements (
  order_id TEXT NOT NULL REFERENCES kebab_orders(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  settled_at TEXT NOT NULL,
  PRIMARY KEY (order_id, username)
);

CREATE TABLE IF NOT EXISTS gift_draws (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  budget INTEGER,               -- grosze
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- rosnące id = kursor do pobierania nowych wiadomości
  username TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS presence (
  username TEXT PRIMARY KEY,
  last_seen TEXT NOT NULL       -- ostatni sygnał z otwartej aplikacji
);

CREATE TABLE IF NOT EXISTS gift_pairs (
  draw_id TEXT NOT NULL REFERENCES gift_draws(id) ON DELETE CASCADE,
  giver TEXT NOT NULL,          -- kto kupuje prezent
  receiver TEXT NOT NULL,       -- dla kogo
  PRIMARY KEY (draw_id, giver)
);

CREATE TABLE IF NOT EXISTS user_passwords (
  username TEXT PRIMARY KEY,
  hash TEXT NOT NULL,           -- "scrypt$<sól hex>$<hash hex>", nigdy jawne hasło
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS riot_cache (
  key TEXT PRIMARY KEY,         -- "match:<id>", "account:<nick>#<tag>", "ids:<puuid>"
  data TEXT NOT NULL,           -- JSON
  updated_at TEXT NOT NULL
);

-- Mecze ligi przeliczone raz przy pobraniu (Harnaś, premade, czas polski) — strona czyta gotowe wiersze
-- zamiast parsować surowe mecze z riot_cache przy każdym wejściu
CREATE TABLE IF NOT EXISTS lol_games (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,  -- epoch ms rozpoczęcia gry (po tym filtruje zakres dat)
  mode TEXT NOT NULL,           -- GameMode
  src_v INTEGER NOT NULL,       -- wersja surowego zapisu (TRIM_VERSION) — starsze nie mają statystyk Harnasia
  dv INTEGER NOT NULL,          -- wersja przeliczenia (DERIVED_VERSION)
  data TEXT NOT NULL            -- LeagueGame (JSON)
);
CREATE INDEX IF NOT EXISTS lol_games_started ON lol_games(started_at);

CREATE TABLE IF NOT EXISTS lol_game_players (
  game_id TEXT NOT NULL REFERENCES lol_games(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  mode TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  remake INTEGER NOT NULL,
  win INTEGER NOT NULL,
  champion TEXT NOT NULL,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  assists INTEGER NOT NULL,
  harnas INTEGER NOT NULL,
  PRIMARY KEY (game_id, username)
);
CREATE INDEX IF NOT EXISTS lol_game_players_user ON lol_game_players(username, started_at);
`;

let initPromise: Promise<void> | null = null;

export function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await db.execute("PRAGMA foreign_keys = ON;");
      await db.executeMultiple(SCHEMA);
      // Migracja: kolumna dodana po pierwszym wdrożeniu schematu
      await db.execute("ALTER TABLE meetings ADD COLUMN poll_token TEXT").catch(() => {});
    })();
  }
  return initPromise;
}

export async function q<T = Record<string, unknown>>(sql: string, args: InArgs = []): Promise<T[]> {
  await ensureInit();
  const res = await db.execute({ sql, args });
  return res.rows.map((row) => ({ ...row })) as unknown as T[];
}

export async function run(sql: string, args: InArgs = []): Promise<void> {
  await ensureInit();
  await db.execute({ sql, args });
}

export function uid(): string {
  return crypto.randomUUID();
}
