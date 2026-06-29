// Wypełnia bazę przykładowymi danymi: `npm run seed`
// Działa lokalnie (file:local.db) oraz na Turso (DATABASE_URL + DATABASE_AUTH_TOKEN).
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Minimalne wczytanie .env (bez zależności).
try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // brak .env — używamy lokalnej bazy
}

const db = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT NOT NULL, image_url TEXT, min_players INTEGER, max_players INTEGER, play_time INTEGER, description TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE, played_at TEXT NOT NULL, duration_min INTEGER, note TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS placements (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, player TEXT NOT NULL, place INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ratings (game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE, username TEXT NOT NULL, score INTEGER NOT NULL, PRIMARY KEY (game_id, username));
CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, title TEXT NOT NULL, type TEXT NOT NULL, month TEXT, is_open INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS poll_options (id TEXT PRIMARY KEY, poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE, label TEXT NOT NULL, game_id TEXT, date_value TEXT, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS poll_votes (id TEXT PRIMARY KEY, poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE, option_id TEXT NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE, voter TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, date TEXT NOT NULL, title TEXT NOT NULL, note TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS wishlist (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT, image_url TEXT, note TEXT, added_by TEXT NOT NULL, created_at TEXT NOT NULL);
`;

const now = () => new Date().toISOString();
const id = () => randomUUID();

const GAMES = [
  {
    name: "Catan",
    image_url:
      "https://images.unsplash.com/photo-1606503153255-59d8b8b82176?auto=format&fit=crop&w=800&q=60",
    min: 3,
    max: 4,
    time: 90,
    desc: "Klasyk handlu i osadnictwa. Budujcie drogi, osady i miasta.",
  },
  {
    name: "Wsiąść do Pociągu",
    image_url:
      "https://images.unsplash.com/photo-1473445730015-841f29a9490b?auto=format&fit=crop&w=800&q=60",
    min: 2,
    max: 5,
    time: 60,
    desc: "Łączcie miasta trasami kolejowymi i zbierajcie punkty za bilety.",
  },
  {
    name: "Carcassonne",
    image_url:
      "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=800&q=60",
    min: 2,
    max: 5,
    time: 45,
    desc: "Układajcie kafelki krajobrazu i rozstawiajcie meeple.",
  },
];

const PLAYERS = ["Bulczy", "Chleboldi", "Eldorida", "Vrenshrrgn", "Entey"];

async function main() {
  await db.execute("PRAGMA foreign_keys = ON;");
  await db.executeMultiple(SCHEMA);

  const existing = await db.execute("SELECT COUNT(*) AS c FROM games");
  if (Number(existing.rows[0].c) > 0) {
    console.log("Baza zawiera już gry — pomijam seedowanie.");
    return;
  }

  for (const g of GAMES) {
    const gid = id();
    await db.execute({
      sql: `INSERT INTO games (id, name, image_url, min_players, max_players, play_time, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [gid, g.name, g.image_url, g.min, g.max, g.time, g.desc, now()],
    });

    // Oceny od wszystkich graczy (7–9).
    for (const p of PLAYERS) {
      await db.execute({
        sql: `INSERT INTO ratings (game_id, username, score) VALUES (?, ?, ?)`,
        args: [gid, p, 7 + Math.floor(Math.random() * 3)],
      });
    }

    // Jedna przykładowa rozgrywka.
    const sid = id();
    await db.execute({
      sql: `INSERT INTO sessions (id, game_id, played_at, duration_min, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [sid, gid, "2026-06-14", g.time, "Pierwsza partia w nowym składzie", "Entey", now()],
    });
    const shuffled = [...PLAYERS].sort(() => Math.random() - 0.5);
    let place = 1;
    for (const p of shuffled) {
      await db.execute({
        sql: `INSERT INTO placements (id, session_id, player, place) VALUES (?, ?, ?, ?)`,
        args: [id(), sid, p, place++],
      });
    }
  }

  // Przykładowe spotkanie i wishlista.
  await db.execute({
    sql: `INSERT INTO meetings (id, date, title, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id(), "2026-07-04", "Planszówki u Łukasza", "Start 18:00, przynieście przekąski", "Entey", now()],
  });
  await db.execute({
    sql: `INSERT INTO wishlist (id, name, url, image_url, note, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id(), "Brass: Birmingham", "https://boardgamegeek.com/boardgame/224517", null, "Podobno najlepsza gra ekonomiczna", "Chleboldi", now()],
  });

  console.log("Gotowe! Dodano przykładowe gry, oceny, rozgrywki, spotkanie i wishlistę.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
