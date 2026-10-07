// Turniej Pick'em do developmentu z prawdziwych danych Worlds 2025 (lolesports): `npm run seed:pickem`
//
// Czas jest przesunięty tak, że „teraz” wypada w trakcie ćwierćfinałów — w jednym turnieju są wszystkie stany:
//   Swiss i 1. ćwierćfinał rozegrane (wyniki + typy graczy, w tym dokładne wyniki i trafienia pod prąd),
//   (faza pucharowa typowana „na wynik”, Swiss na zwycięzcę), ostatni mecz Swiss „w trakcie” (po starcie, bez wyniku), pozostałe ćwierćfinały otwarte do typowania
//   (część graczy już typowała), półfinały i finał jako drabinka „Zwycięzca …” z drużynami do ustalenia.
// Uruchamiany ponownie usuwa poprzednią wersję i buduje ją od nowa względem bieżącej godziny.
// Tylko lokalna baza — testowe typy nie mają prawa trafić na produkcję.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const url = process.env.DATABASE_URL ?? "file:local.db";
if (!url.startsWith("file:")) {
  console.error(`Odmowa: DATABASE_URL wskazuje na zdalną bazę (${url.split("//")[0]}//…). Ten skrypt działa tylko lokalnie.`);
  process.exit(1);
}
const db = createClient({ url });

const TOKEN = "devworlds2025"; // stały link: /pickem/devworlds2025
const NAME = "Worlds 2025 (dane testowe)";
const PLAYERS = ["Bulczy", "Chleboldi", "Eldorida", "Vrenshrrgn", "Entey"];
// Gracze, którzy już typowali otwarte mecze — reszta (m.in. Bulczy) ma co obstawić
const EARLY_BIRDS = ["Chleboldi", "Eldorida", "Vrenshrrgn"];
const STAGE_POINTS = { "Play-In": 1, Swiss: 1, "Ćwierćfinały": 2, "Półfinały": 3, "Finał": 5 };
const STAGES = { "Play In Knockouts": "Play-In", Swiss: "Swiss", Quarterfinals: "Ćwierćfinały", Semifinals: "Półfinały", Finals: "Finał" };

const API = "https://esports-api.lolesports.com/persisted/gw";
const KEY = process.env.LOLESPORTS_API_KEY ?? "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const WORLDS = "98767975604431411";

async function get(path, params) {
  const res = await fetch(`${API}/${path}?${new URLSearchParams({ hl: "en-US", ...params })}`, { headers: { "x-api-key": KEY } });
  if (!res.ok) throw new Error(`lolesports ${path}: HTTP ${res.status}`);
  return (await res.json()).data;
}

// Powtarzalna „losowość” — te same typy przy każdym uruchomieniu
let seed = 2025;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

async function main() {
  const cols = (await db.execute("PRAGMA table_info(pickem_picks)")).rows.map((r) => r.name);
  if (!cols.includes("loser_wins")) {
    console.error("Brak tabel Pick'em w najnowszej wersji — otwórz raz aplikację (npm run dev), żeby utworzyła schemat.");
    process.exit(1);
  }

  // Mecze Worlds 2025: terminarz ligi jest stronicowany, idziemy wstecz do początku edycji
  const ed = (await get("getTournamentsForLeague", { leagueId: WORLDS })).leagues[0].tournaments.find((t) => t.slug === "worlds_2025");
  const from = Date.parse(ed.startDate) - 86_400_000;
  const to = Date.parse(ed.endDate) + 2 * 86_400_000;
  let page = (await get("getSchedule", { leagueId: WORLDS })).schedule;
  const events = [...page.events];
  for (let i = 0; i < 20 && page.pages.older && Math.min(...page.events.map((e) => Date.parse(e.startTime))) > from; i++) {
    page = (await get("getSchedule", { leagueId: WORLDS, pageToken: page.pages.older })).schedule;
    events.push(...page.events);
  }
  const matches = events
    .filter((e) => e.type === "match" && e.match && Date.parse(e.startTime) >= from && Date.parse(e.startTime) <= to)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  console.log(`Pobrano ${matches.length} meczów Worlds 2025`);

  // Przesunięcie czasu: 2. ćwierćfinał startuje za 2 h
  const qfs = matches.filter((e) => e.blockName === "Quarterfinals");
  const shift = Date.now() + 2 * 3600_000 - Date.parse(qfs[1].startTime);
  const at = (e) => new Date(Date.parse(e.startTime) + shift).toISOString();
  const lastSwiss = matches.filter((e) => e.blockName === "Swiss").at(-1);

  // Czyszczenie poprzedniej wersji
  const old = (await db.execute({ sql: "SELECT id FROM pickem_tournaments WHERE token = ?", args: [TOKEN] })).rows[0];
  if (old) {
    await db.execute({ sql: "DELETE FROM pickem_picks WHERE match_id IN (SELECT id FROM pickem_matches WHERE tournament_id = ?)", args: [old.id] });
    await db.execute({ sql: "DELETE FROM pickem_matches WHERE tournament_id = ?", args: [old.id] });
    await db.execute({ sql: "DELETE FROM pickem_teams WHERE tournament_id = ?", args: [old.id] });
    await db.execute({ sql: "DELETE FROM pickem_tournaments WHERE id = ?", args: [old.id] });
  }

  const tid = randomUUID();
  const now = new Date().toISOString();
  // Źródło „ręcznie”: synchronizacja z lolesports nie cofnie przesuniętych godzin
  await db.execute({
    sql: `INSERT INTO pickem_tournaments (id, token, name, description, created_by, created_at) VALUES (?, ?, ?, ?, 'Bulczy', ?)`,
    args: [tid, TOKEN, NAME, "Prawdziwe mecze Worlds 2025 z przesuniętymi datami — do testów. Generuje: npm run seed:pickem", now],
  });

  const teamIds = new Map();
  for (const e of matches) {
    for (const t of e.match.teams) {
      if (t.code === "TBD" || teamIds.has(t.code)) continue;
      const id = randomUUID();
      teamIds.set(t.code, id);
      await db.execute({
        sql: `INSERT INTO pickem_teams (id, tournament_id, name, short, logo_url, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, tid, t.name, t.code, t.image?.replace(/^http:/, "https:") ?? null, now],
      });
    }
  }

  const nowMs = Date.now();
  const winnerOf = new Map(); // id meczu → kod prawdziwego zwycięzcy
  const counts = { done: 0, live: 0, open: 0, bracket: 0, picks: 0 };

  for (const e of matches) {
    const id = randomUUID();
    const [ta, tb] = e.match.teams;
    const stage = STAGES[e.blockName] ?? e.blockName;
    const startsAt = at(e);
    const bestOf = e.match.strategy.count;
    const points = STAGE_POINTS[stage] ?? 1;
    // Faza pucharowa „na wynik”, Swiss i Play-In „na zwycięzcę”
    const exact = bestOf > 1 && ["Ćwierćfinały", "Półfinały", "Finał"].includes(stage);
    const realWinner = ta.result?.outcome === "win" ? ta : tb;
    const realLoser = realWinner === ta ? tb : ta;
    const past = Date.parse(startsAt) <= nowMs;
    const live = e === lastSwiss; // „w trakcie”: po starcie, bez wyniku
    const startsFinal = live ? new Date(nowMs - 30 * 60_000).toISOString() : startsAt;
    const decided = past && !live;

    // Półfinały i finał: strony jako zwycięzcy wcześniejszych meczów (drabinka), dopóki te nie są rozstrzygnięte
    let slotA = { team: teamIds.get(ta.code), src: null };
    let slotB = { team: teamIds.get(tb.code), src: null };
    if (!past && (stage === "Półfinały" || stage === "Finał")) {
      const link = (code) => {
        const src = [...winnerOf].findLast(([, w]) => w === code);
        return src ? { team: null, src: src[0] } : { team: teamIds.get(code), src: null };
      };
      slotA = link(ta.code);
      slotB = link(tb.code);
      counts.bracket++;
    }
    await db.execute({
      sql: `INSERT INTO pickem_matches (id, tournament_id, stage, label, starts_at, best_of, points, exact_score,
              team_a_id, src_a_match_id, src_a_kind, team_b_id, src_b_match_id, src_b_kind, winner_id, score_a, score_b, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, tid, stage,
        stage === "Ćwierćfinały" ? `Ćwierćfinał ${qfs.indexOf(e) + 1}` : stage === "Półfinały" ? `Półfinał ${counts.bracket}` : null,
        startsFinal, bestOf, points, exact ? 1 : 0,
        slotA.team, slotA.src, slotA.src ? "winner" : null,
        slotB.team, slotB.src, slotB.src ? "winner" : null,
        decided ? teamIds.get(realWinner.code) : null,
        decided ? ta.result.gameWins : null,
        decided ? tb.result.gameWins : null,
        now,
      ],
    });
    winnerOf.set(id, realWinner.code);

    // Typy: w rozegranych i trwającym meczu wszyscy, w otwartych tylko „ranne ptaszki”; mecze z drabinki — nikt
    const known = slotA.team && slotB.team;
    if (!known) continue;
    const voters = past ? PLAYERS : EARLY_BIRDS;
    if (decided) counts.done++;
    else if (live) counts.live++;
    else counts.open++;
    const need = Math.ceil(bestOf / 2);
    for (const u of voters) {
      // ~65% trafień, czasem typ wyniku
      const team = rand() < 0.65 ? realWinner : realLoser;
      const loserWins = exact ? Math.floor(rand() * need) : null;
      await db.execute({
        sql: `INSERT INTO pickem_picks (match_id, username, team_id, loser_wins, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: [id, u, teamIds.get(team.code), loserWins, new Date(Date.parse(startsFinal) - 3600_000).toISOString()],
      });
      counts.picks++;
    }
  }

  console.log(
    `Gotowe: ${teamIds.size} drużyn · rozegrane ${counts.done} · w trakcie ${counts.live} · do typowania ${counts.open}` +
      ` · w drabince ${counts.bracket} · typów ${counts.picks}`,
  );
  console.log(`Link: /pickem/${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
