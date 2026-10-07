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

-- ─── Przygoda (play by post z AI jako Mistrzem Gry) ───
CREATE TABLE IF NOT EXISTS adv_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  premise TEXT,                 -- pomysł graczy na przygodę (może być pusty — MG wymyśla)
  tone TEXT NOT NULL,           -- rules.ts TONES
  status TEXT NOT NULL,         -- 'setup' | 'active' | 'ended'
  round INTEGER NOT NULL DEFAULT 0,
  round_started_at TEXT,
  summary TEXT,                 -- kronika pisana przez MG, zastępuje starą historię w kontekście
  location TEXT,
  map_image_id TEXT,
  locations TEXT NOT NULL DEFAULT '[]', -- JSON [{name, image_id}] odwiedzone miejsca
  enemies TEXT NOT NULL DEFAULT '[]',   -- JSON [{name, hp, max_hp, ac, note}] prowadzone przez MG
  gm_lock TEXT,                 -- czas startu tury MG (blokada przed podwójnym wywołaniem)
  gm_error TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adv_characters (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES adv_campaigns(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  race_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  scores TEXT NOT NULL,         -- JSON {STR..CHA} po premiach rasowych
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  ac INTEGER NOT NULL,
  inventory TEXT NOT NULL,      -- JSON string[]
  conditions TEXT NOT NULL DEFAULT '[]',
  look TEXT,                    -- wygląd (do portretu)
  backstory TEXT,
  portrait_image_id TEXT,
  introduced INTEGER NOT NULL DEFAULT 0, -- czy MG już wprowadził postać do opowieści
  death_successes INTEGER NOT NULL DEFAULT 0, -- rzuty przeciw śmierci przy 0 PW (3 = stabilny)
  death_failures INTEGER NOT NULL DEFAULT 0,  -- (3 = martwy)
  created_at TEXT NOT NULL,
  UNIQUE (campaign_id, username)
);

CREATE TABLE IF NOT EXISTS adv_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL REFERENCES adv_campaigns(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  author TEXT NOT NULL,         -- username albo 'gm' / 'system'
  kind TEXT NOT NULL,           -- 'narration' | 'action' | 'roll' | 'system'
  body TEXT NOT NULL,
  image_id TEXT,
  data TEXT,                    -- JSON: zmiany stanu, wynik rzutu
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS adv_posts_campaign ON adv_posts(campaign_id, id);

CREATE TABLE IF NOT EXISTS adv_rolls (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES adv_campaigns(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES adv_characters(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  kind TEXT NOT NULL,           -- 'check' | 'save' | 'attack'
  ability TEXT NOT NULL,
  skill TEXT,
  dc INTEGER NOT NULL,
  reason TEXT,
  damage TEXT,                  -- np. "1d8+3" — rzucane przez serwer przy trafieniu
  modifier INTEGER NOT NULL,
  result INTEGER,               -- surowy k20 (NULL = czeka na rzut)
  damage_result INTEGER,
  auto INTEGER NOT NULL DEFAULT 0, -- rzucony automatycznie, bo gracz nie zdążył
  created_at TEXT NOT NULL,
  rolled_at TEXT
);

-- ─── Pick'em (typowanie meczów turnieju, drabinka dodawana ręcznie) ───
CREATE TABLE IF NOT EXISTS pickem_tournaments (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,   -- do linku /pickem/<token>
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pickem_teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES pickem_tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short TEXT,                   -- skrót, np. T1, GEN
  logo_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pickem_matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES pickem_tournaments(id) ON DELETE CASCADE,
  stage TEXT,                   -- etap do grupowania, np. "Swiss — runda 1", "Ćwierćfinały"
  label TEXT,                   -- np. "Ćwierćfinał 1"
  starts_at TEXT NOT NULL,      -- ISO (UTC); do tej chwili można typować, potem typy są jawne
  best_of INTEGER NOT NULL DEFAULT 1,
  points INTEGER NOT NULL DEFAULT 1, -- punkty za trafiony typ
  -- Strona meczu: konkretna drużyna albo zwycięzca/przegrany innego meczu (drabinka)
  team_a_id TEXT REFERENCES pickem_teams(id) ON DELETE SET NULL,
  src_a_match_id TEXT REFERENCES pickem_matches(id) ON DELETE SET NULL,
  src_a_kind TEXT,              -- 'winner' | 'loser'
  team_b_id TEXT REFERENCES pickem_teams(id) ON DELETE SET NULL,
  src_b_match_id TEXT REFERENCES pickem_matches(id) ON DELETE SET NULL,
  src_b_kind TEXT,
  winner_id TEXT REFERENCES pickem_teams(id) ON DELETE SET NULL,
  score_a INTEGER,
  score_b INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pickem_matches_t ON pickem_matches(tournament_id, starts_at);

CREATE TABLE IF NOT EXISTS pickem_picks (
  match_id TEXT NOT NULL REFERENCES pickem_matches(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  team_id TEXT NOT NULL REFERENCES pickem_teams(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (match_id, username)
);

CREATE TABLE IF NOT EXISTS adv_images (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,           -- 'scene' | 'map' | 'portrait'
  prompt TEXT NOT NULL,
  status TEXT NOT NULL,         -- 'pending' | 'generating' | 'ready' | 'failed'
  mime TEXT,
  data BLOB,
  started_at TEXT,
  created_at TEXT NOT NULL
);
`;

let initPromise: Promise<void> | null = null;

export function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await db.execute("PRAGMA foreign_keys = ON;");
      await db.executeMultiple(SCHEMA);
      // Migracja: kolumna dodana po pierwszym wdrożeniu schematu
      await db.execute("ALTER TABLE meetings ADD COLUMN poll_token TEXT").catch(() => {});
      // Pick'em: turniej może brać mecze z zewnętrznego źródła (lolesports); ext_id = id/kod po stronie źródła
      for (const sql of [
        "ALTER TABLE pickem_tournaments ADD COLUMN source TEXT", // NULL = ręcznie, 'lolesports'
        "ALTER TABLE pickem_tournaments ADD COLUMN source_league_id TEXT",
        "ALTER TABLE pickem_tournaments ADD COLUMN source_tournament_id TEXT",
        "ALTER TABLE pickem_tournaments ADD COLUMN source_start TEXT", // YYYY-MM-DD, zakres dat edycji
        "ALTER TABLE pickem_tournaments ADD COLUMN source_end TEXT",
        "ALTER TABLE pickem_tournaments ADD COLUMN synced_at TEXT",
        "ALTER TABLE pickem_tournaments ADD COLUMN sync_error TEXT",
        "ALTER TABLE pickem_teams ADD COLUMN ext_id TEXT",
        "ALTER TABLE pickem_matches ADD COLUMN ext_id TEXT",
        // 1 = admin poprawił mecz ręcznie, synchronizacja go nie nadpisuje
        "ALTER TABLE pickem_matches ADD COLUMN locked INTEGER NOT NULL DEFAULT 0",
        // JSON ["m:<id meczu>", "t:<kod drużyny>"] — usunięte ręcznie, synchronizacja ich nie przywraca
        "ALTER TABLE pickem_tournaments ADD COLUMN sync_ignore TEXT NOT NULL DEFAULT '[]'",
        // Typ dokładnego wyniku (Bo3/Bo5): ile map wygra przegrany; NULL = tylko zwycięzca
        "ALTER TABLE pickem_picks ADD COLUMN loser_wins INTEGER",
        // 1 = mecz typowany na dokładny wynik (tylko Bo3/Bo5), 0 = tylko zwycięzca
        "ALTER TABLE pickem_matches ADD COLUMN exact_score INTEGER NOT NULL DEFAULT 0",
        // Zakład: dodatkowe punkty postawione na własny typ (0 = bez zakładu)
        "ALTER TABLE pickem_picks ADD COLUMN stake INTEGER NOT NULL DEFAULT 0",
        // Szansa drużyny A z rankingu (kurs bazowy puli); aktualizowana do startu meczu, potem zamrożona
        "ALTER TABLE pickem_matches ADD COLUMN prob_a REAL",
      ]) {
        await db.execute(sql).catch(() => {});
      }
      // Rzuty przeciw śmierci liczone przez serwer. Przy pierwszym dodaniu kolumn przenosimy rzuty,
      // które MG zlecał wcześniej jako zwykłe rzuty obronne „przed śmiercią”
      const addedDeath = await db
        .execute("ALTER TABLE adv_characters ADD COLUMN death_successes INTEGER NOT NULL DEFAULT 0")
        .then(() => true, () => false);
      await db.execute("ALTER TABLE adv_characters ADD COLUMN death_failures INTEGER NOT NULL DEFAULT 0").catch(() => {});
      if (addedDeath) {
        const legacy = `r.kind = 'save' AND r.reason LIKE '%mier%' AND r.character_id = adv_characters.id`;
        await db.executeMultiple(`
          UPDATE adv_characters SET
            death_successes = MIN(2, (SELECT COUNT(*) FROM adv_rolls r WHERE ${legacy} AND r.result >= 10)),
            death_failures = MIN(2, (SELECT COUNT(*) FROM adv_rolls r WHERE ${legacy} AND r.result < 10))
          WHERE hp <= 0;
          UPDATE adv_rolls SET kind = 'death', ability = 'CON', skill = NULL, dc = 10, modifier = 0
          WHERE result IS NULL AND kind = 'save' AND reason LIKE '%mier%'
            AND character_id IN (SELECT id FROM adv_characters WHERE hp <= 0);
        `);
      }
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
