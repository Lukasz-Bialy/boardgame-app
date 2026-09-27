// Testowe ankiety do podglądu Pulpitu. Tylko dla lokalnej bazy!
//   node scripts/mock-polls.mjs          — dodaje mocki (najpierw usuwa stare)
//   node scripts/mock-polls.mjs --clean  — tylko usuwa mocki
// Mocki rozpoznaje się po tokenie zaczynającym się od "mock-".
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL ?? "file:local.db";
if (!url.startsWith("file:")) {
  console.error(`Odmowa: DATABASE_URL (${url}) nie wskazuje lokalnego pliku.`);
  process.exit(1);
}
const db = createClient({ url });

const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString();

async function clean() {
  const polls = (await db.execute(`SELECT id FROM polls WHERE token LIKE 'mock-%'`)).rows;
  for (const { id } of polls) {
    await db.execute({ sql: `DELETE FROM poll_votes WHERE poll_id = ?`, args: [id] });
    await db.execute({ sql: `DELETE FROM poll_options WHERE poll_id = ?`, args: [id] });
    await db.execute({ sql: `DELETE FROM polls WHERE id = ?`, args: [id] });
  }
  console.log(`Usunięto mocków: ${polls.length}`);
}

// votes: { voter: [indeksy opcji] }
const MOCKS = [
  {
    token: "mock-piatek",
    title: "W co gramy w piątek?",
    type: "game",
    created_by: "Chleboldi",
    created: 2,
    options: ["Terraforming Mars", "Wsiąść do pociągu", "Dune: Imperium", "Everdell"],
    votes: { Chleboldi: [0, 2], Eldorida: [2], Entey: [2, 3] },
  },
  {
    token: "mock-grudzien",
    title: "Termin grudniowego spotkania",
    type: "date",
    month: "2026-12",
    created_by: "Entey",
    created: 0,
    options: ["2026-12-05", "2026-12-12", "2026-12-13", "2026-12-19"],
    // Eldorida głosował we wszystkich otwartych — na jego koncie widać „Wszystko ogarnięte”
    votes: { Entey: [1, 2], Eldorida: [2] },
  },
  {
    token: "mock-sylwester",
    title: "Planszówka na Sylwestra",
    type: "game",
    created_by: "Bulczy",
    created: 5,
    options: ["Codenames", "Dixit", "Tajniacy: Duet", "Wavelength"],
    votes: { Bulczy: [0, 3], Vrenshrrgn: [3], Chleboldi: [1, 3], Eldorida: [0] },
  },
  {
    token: "mock-kebab",
    title: "Kebab czy pizza na następny raz?",
    type: "game",
    created_by: "Vrenshrrgn",
    created: 1,
    options: ["Kebab", "Pizza", "Jedno i drugie"],
    votes: { Vrenshrrgn: [2], Eldorida: [0] },
  },
  {
    token: "mock-pazdziernik",
    title: "Październikowy termin (zamknięta)",
    type: "date",
    month: "2026-10",
    created_by: "Bulczy",
    created: 20,
    closed: true,
    options: ["2026-10-10", "2026-10-17"],
    votes: { Bulczy: [0], Chleboldi: [0], Eldorida: [1], Vrenshrrgn: [0], Entey: [0] },
  },
];

function label(type, value) {
  if (type !== "date") return value;
  return new Date(value + "T12:00:00").toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

async function seed() {
  for (const m of MOCKS) {
    const pollId = randomUUID();
    await db.execute({
      sql: `INSERT INTO polls (id, token, title, type, month, is_open, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [pollId, m.token, m.title, m.type, m.month ?? null, m.closed ? 0 : 1, m.created_by, daysAgo(m.created)],
    });
    const optionIds = [];
    for (const [i, value] of m.options.entries()) {
      const id = randomUUID();
      optionIds.push(id);
      await db.execute({
        sql: `INSERT INTO poll_options (id, poll_id, label, game_id, date_value, sort) VALUES (?, ?, ?, NULL, ?, ?)`,
        args: [id, pollId, label(m.type, value), m.type === "date" ? value : null, i],
      });
    }
    for (const [voter, picks] of Object.entries(m.votes)) {
      for (const idx of picks) {
        await db.execute({
          sql: `INSERT INTO poll_votes (id, poll_id, option_id, voter, created_at) VALUES (?, ?, ?, ?, ?)`,
          args: [randomUUID(), pollId, optionIds[idx], voter, daysAgo(Math.max(0, m.created - 1))],
        });
      }
    }
    console.log(`+ ${m.title} (${Object.keys(m.votes).length} głosujących${m.closed ? ", zamknięta" : ""})`);
  }
}

await clean();
if (!process.argv.includes("--clean")) await seed();
