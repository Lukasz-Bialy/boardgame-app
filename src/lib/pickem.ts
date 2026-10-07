import { q, run, uid } from "./db";
import { PLAYERS } from "./users";
import { getTournamentMatches, stageName, type LolMatchEvent, type LolTeam } from "./lolesports";
import {
  seedOf,
  stakeRange,
  START_TOKENS,
  TOKENS_PER_HIT,
  UPSET_MAX_SHARE,
  UPSET_MIN_VOTERS,
  betResult,
  exactBonusOf,
  exactHit,
  halfBonus,
  poolOdds,
  type PickView,
  type Pool,
} from "./pickem-rules";

const nowIso = () => new Date().toISOString();
const makeToken = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/* ───────────────────────── TYPY ───────────────────────── */

export type SlotKind = "winner" | "loser";
export const BEST_OF = [1, 3, 5] as const;

export interface PickemTeam {
  id: string;
  name: string;
  short: string | null;
  logo_url: string | null;
}

// Strona meczu przy zapisie: konkretna drużyna, zwycięzca/przegrany innego meczu albo „do ustalenia”
export type SlotInput = { team_id: string } | { match_id: string; kind: SlotKind } | null;

export interface MatchInput {
  stage: string | null;
  label: string | null;
  starts_at: string;
  best_of: number;
  points: number;
  a: SlotInput;
  b: SlotInput;
  sync: boolean; // mecz z lolesports: czy synchronizacja może go dalej aktualizować
  exact: boolean; // typowanie dokładnego wyniku zamiast samego zwycięzcy (tylko Bo3/Bo5)
}

interface MatchRow {
  id: string;
  tournament_id: string;
  stage: string | null;
  label: string | null;
  starts_at: string;
  best_of: number;
  points: number;
  team_a_id: string | null;
  src_a_match_id: string | null;
  src_a_kind: SlotKind | null;
  team_b_id: string | null;
  src_b_match_id: string | null;
  src_b_kind: SlotKind | null;
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
  ext_id: string | null; // id meczu w lolesports
  locked: number; // 1 = poprawiony ręcznie, synchronizacja go nie rusza
  exact_score: number; // 1 = mecz na dokładny wynik
  prob_a: number | null; // szansa drużyny A z rankingu, zamrożona od startu meczu
  created_at: string;
}

export interface PickemMatch {
  id: string;
  stage: string | null;
  label: string | null;
  starts_at: string;
  best_of: number;
  points: number;
  slotA: SlotInput; // jak strona jest zdefiniowana (do edycji)
  slotB: SlotInput;
  a: string | null; // drużyna po rozwiązaniu drabinki (null = jeszcze nie wiadomo)
  b: string | null;
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
  started: boolean; // po starcie nie da się typować, a typy są jawne
  voters: string[]; // kto już typował (jawne zawsze)
  myPick: string | null;
  myLoserWins: number | null; // mój typ wyniku: ile map wygra przegrany (Bo3/Bo5)
  myStake: number; // moje dodatkowe punkty postawione na typ
  probA: number | null; // szansa drużyny A z rankingu (kurs bazowy); null = brak danych, liczone jak 50%
  pool: Pool | null; // suma stawek na każdą drużynę — tylko po starcie, wcześniej nikt nie zna puli
  picks: Record<string, PickView> | null; // username → typ, tylko po starcie meczu
  exact: boolean; // mecz typowany na dokładny wynik
  exactBonus: number; // bonus za trafiony dokładny wynik (0, gdy mecz nie jest na wynik)
  bonus: number; // dodatkowe punkty za trafienie pod prąd (0 = zwycięzcę typowała większość)
  ext: boolean; // mecz pobrany z lolesports
  locked: boolean; // …ale poprawiony ręcznie i wyłączony z synchronizacji
}

export interface PickemStanding {
  username: string;
  points: number;
  correct: number;
  decided: number; // typy w rozstrzygniętych meczach
  upsets: number; // trafienia pod prąd (z bonusem)
  exact: number; // trafione dokładne wyniki
  bets: number; // bilans zakładów
  wallet: number; // ranking hazardu: żetony na start + za trafienia + bilans zakładów (stawki w meczach bez wyniku jeszcze nie odjęte)
}


export interface PickemTournament {
  id: string;
  token: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  source: "lolesports" | null; // null = mecze dodawane ręcznie
  source_league_id: string | null;
  source_tournament_id: string | null;
  source_start: string | null;
  source_end: string | null;
  synced_at: string | null;
  sync_error: string | null;
  sync_ignore: string; // JSON, patrz ignoreForSync
}

export interface PickemTournamentView extends PickemTournament {
  teams: PickemTeam[];
  matches: PickemMatch[];
  standings: PickemStanding[];
  myWallet: number; // wolne żetony widza (po odjęciu jego stawek w meczach, które jeszcze nie mają wyniku)
  now: string;
}

export interface PickemTournamentListItem extends PickemTournament {
  teams: number;
  matches: number;
  finished: number;
  next_open: string | null; // najbliższy mecz, który jeszcze można typować
  my_missing: number; // otwarte mecze z ustalonymi drużynami, których widz nie obstawił
}

/* ───────────────────────── DRABINKA ───────────────────────── */

const slotOf = (team: string | null, src: string | null, kind: SlotKind | null): SlotInput =>
  team ? { team_id: team } : src && kind ? { match_id: src, kind } : null;

// Drużyny obu stron każdego meczu. Strona z innego meczu jest znana dopiero po jego wyniku;
// wynik, którego zwycięzca nie gra już w tym meczu (np. po poprawce wcześniejszego wyniku), się nie liczy
function resolveBracket(rows: MatchRow[]) {
  const byId = new Map(rows.map((m) => [m.id, m]));
  const memo = new Map<string, [string | null, string | null]>();

  function teamsOf(id: string, stack: Set<string>): [string | null, string | null] {
    const hit = memo.get(id);
    if (hit) return hit;
    const m = byId.get(id);
    if (!m || stack.has(id)) return [null, null];
    stack.add(id);
    const side = (team: string | null, src: string | null, kind: SlotKind | null) =>
      team ?? (src && kind ? fromResult(src, kind, stack) : null);
    const res: [string | null, string | null] = [
      side(m.team_a_id, m.src_a_match_id, m.src_a_kind),
      side(m.team_b_id, m.src_b_match_id, m.src_b_kind),
    ];
    stack.delete(id);
    memo.set(id, res);
    return res;
  }

  function fromResult(srcId: string, kind: SlotKind, stack: Set<string>): string | null {
    const s = byId.get(srcId);
    if (!s?.winner_id) return null;
    const [a, b] = teamsOf(srcId, stack);
    if (!a || !b || (s.winner_id !== a && s.winner_id !== b)) return null;
    if (kind === "winner") return s.winner_id;
    return s.winner_id === a ? b : a;
  }

  return (id: string) => teamsOf(id, new Set());
}

const validWinner = (m: MatchRow, a: string | null, b: string | null) =>
  m.winner_id && (m.winner_id === a || m.winner_id === b) ? m.winner_id : null;

/* ───────────────────────── ODCZYT ───────────────────────── */

async function tournamentByToken(token: string) {
  return (await q<PickemTournament>(`SELECT * FROM pickem_tournaments WHERE token = ?`, [token]))[0] ?? null;
}

export async function listTournaments(viewer: string): Promise<PickemTournamentListItem[]> {
  const [ts, teams, rows, mine] = await Promise.all([
    q<PickemTournament>(`SELECT * FROM pickem_tournaments ORDER BY created_at DESC`),
    q<{ tournament_id: string; n: number }>(`SELECT tournament_id, COUNT(*) AS n FROM pickem_teams GROUP BY tournament_id`),
    q<MatchRow>(`SELECT * FROM pickem_matches`),
    q<{ match_id: string }>(`SELECT match_id FROM pickem_picks WHERE username = ?`, [viewer]),
  ]);
  const now = nowIso();
  const picked = new Set(mine.map((p) => p.match_id));
  const resolve = resolveBracket(rows);

  return ts.map((t) => {
    const ms = rows.filter((m) => m.tournament_id === t.id);
    const open = ms.filter((m) => m.starts_at > now && !m.winner_id).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
    return {
      ...t,
      teams: teams.find((x) => x.tournament_id === t.id)?.n ?? 0,
      matches: ms.length,
      finished: ms.filter((m) => validWinner(m, ...resolve(m.id))).length,
      next_open: open[0]?.starts_at ?? null,
      my_missing: open.filter((m) => {
        const [a, b] = resolve(m.id);
        return a && b && !picked.has(m.id);
      }).length,
    };
  });
}

export async function getTournamentView(token: string, viewer: string): Promise<PickemTournamentView | null> {
  const t = await tournamentByToken(token);
  return t ? buildView(t, viewer) : null;
}

async function buildView(t: PickemTournament, viewer: string): Promise<PickemTournamentView> {
  const [teams, rows, picks] = await Promise.all([
    q<PickemTeam>(`SELECT id, name, short, logo_url FROM pickem_teams WHERE tournament_id = ? ORDER BY name COLLATE NOCASE`, [t.id]),
    q<MatchRow>(`SELECT * FROM pickem_matches WHERE tournament_id = ? ORDER BY starts_at, created_at`, [t.id]),
    q<{ match_id: string; username: string; team_id: string; loser_wins: number | null; stake: number }>(
      `SELECT p.match_id, p.username, p.team_id, p.loser_wins, p.stake FROM pickem_picks p
       JOIN pickem_matches m ON m.id = p.match_id WHERE m.tournament_id = ? ORDER BY p.created_at`,
      [t.id],
    ),
  ]);
  const now = nowIso();
  const resolve = resolveBracket(rows);

  // Wyniki liczone dla wszystkich graczy klubu, także tych, którzy jeszcze nic nie obstawili
  const blank = (username: string): PickemStanding => ({ username, points: 0, correct: 0, decided: 0, upsets: 0, exact: 0, bets: 0, wallet: 0 });
  const standings = new Map<string, PickemStanding>(PLAYERS.map((p) => [p.username, blank(p.username)]));
  const standingOf = (u: string) => {
    let s = standings.get(u);
    if (!s) standings.set(u, (s = blank(u)));
    return s;
  };
  // Stawki widza w meczach bez wyniku — zajęte, więc nie do postawienia gdzie indziej
  let myOpenStakes = 0;

  const matches: PickemMatch[] = rows.map((m) => {
    const [a, b] = resolve(m.id);
    // Typ na drużynę, która już nie gra w tym meczu (po poprawce wyniku wcześniejszego meczu), jest nieważny
    const mp = picks.filter((p) => p.match_id === m.id && (p.team_id === a || p.team_id === b));
    const started = m.starts_at <= now;
    const winner = validWinner(m, a, b);
    const backers = mp.filter((p) => p.team_id === winner).length;
    const upset = !!winner && backers > 0 && mp.length >= UPSET_MIN_VOTERS && backers <= mp.length * UPSET_MAX_SHARE;
    const bonus = upset ? halfBonus(m.points) : 0;
    const exactBonus = m.exact_score ? exactBonusOf(m.points, m.best_of) : 0;
    // Typ wyniku, który nie pasuje do formatu (np. po zmianie Bo5 → Bo3), się nie liczy
    const need = Math.ceil(m.best_of / 2);
    const view = (p: (typeof mp)[number]): PickView => ({
      team_id: p.team_id,
      loser_wins: exactBonus && p.loser_wins !== null && p.loser_wins < need ? p.loser_wins : null,
      stake: p.stake,
    });
    const result = { winner_id: winner, score_a: m.score_a, score_b: m.score_b };
    // Pula zakładów: wygrani dzielą stawki przegranych (i zasiew) według kursu z chwili startu
    const pool: Pool = {
      a: mp.filter((p) => p.team_id === a).reduce((sum, p) => sum + p.stake, 0),
      b: mp.filter((p) => p.team_id === b).reduce((sum, p) => sum + p.stake, 0),
    };
    const odds = poolOdds(m.prob_a, seedOf(m.points), pool);

    if (winner) {
      for (const p of mp) {
        const s = standingOf(p.username);
        s.decided++;
        s.bets += betResult(p.stake, p.team_id === winner, winner === a ? odds.a : odds.b);
        if (p.team_id === winner) {
          s.correct++;
          s.points += m.points + bonus;
          if (upset) s.upsets++;
          if (exactHit(result, view(p))) {
            s.points += exactBonus;
            s.exact++;
          }
        }
      }
    } else {
      myOpenStakes += mp.find((p) => p.username === viewer)?.stake ?? 0;
    }
    const mine = mp.find((p) => p.username === viewer);

    return {
      id: m.id,
      stage: m.stage,
      label: m.label,
      starts_at: m.starts_at,
      best_of: m.best_of,
      points: m.points,
      slotA: slotOf(m.team_a_id, m.src_a_match_id, m.src_a_kind),
      slotB: slotOf(m.team_b_id, m.src_b_match_id, m.src_b_kind),
      a,
      b,
      winner_id: winner,
      score_a: winner ? m.score_a : null,
      score_b: winner ? m.score_b : null,
      started,
      voters: mp.map((p) => p.username),
      myPick: mine?.team_id ?? null,
      myLoserWins: mine ? view(mine).loser_wins : null,
      myStake: mine?.stake ?? 0,
      probA: m.prob_a,
      pool: started ? pool : null,
      // Typy innych graczy nie wychodzą z serwera przed startem meczu
      picks: started ? Object.fromEntries(mp.map((p) => [p.username, view(p)])) : null,
      bonus,
      exact: exactBonus > 0,
      exactBonus,
      ext: !!m.ext_id,
      locked: !!m.locked,
    };
  });

  // Zakłady dają ułamki — zaokrąglone do 0,1, żeby nie wyszło 2.9999999
  const tenth = (n: number) => Math.round(n * 10) / 10;
  for (const s of standings.values()) {
    s.bets = tenth(s.bets);
    s.wallet = tenth(START_TOKENS + s.correct * TOKENS_PER_HIT + s.bets);
  }
  const myWallet = tenth(standingOf(viewer).wallet - myOpenStakes);

  return {
    ...t,
    teams,
    matches,
    myWallet,
    standings: [...standings.values()].sort((x, y) => y.points - x.points || y.correct - x.correct || x.decided - y.decided),
    now,
  };
}

/* ───────────────────────── TURNIEJE ───────────────────────── */

export type TournamentSource = { league_id: string; tournament_id: string; start: string; end: string };

export async function createTournament(
  name: string,
  description: string | null,
  by: string,
  source: TournamentSource | null = null,
): Promise<{ id: string; token: string }> {
  const id = uid();
  const token = makeToken();
  await run(
    `INSERT INTO pickem_tournaments (id, token, name, description, created_by, created_at,
       source, source_league_id, source_tournament_id, source_start, source_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, token, name, description, by, nowIso(), source ? "lolesports" : null, source?.league_id ?? null,
      source?.tournament_id ?? null, source?.start ?? null, source?.end ?? null],
  );
  return { id, token };
}

export async function getTournamentId(token: string): Promise<string | null> {
  return (await tournamentByToken(token))?.id ?? null;
}

export async function updateTournament(id: string, name: string, description: string | null) {
  await run(`UPDATE pickem_tournaments SET name = ?, description = ? WHERE id = ?`, [name, description, id]);
}

export async function deleteTournament(id: string) {
  // Jawnie, bez polegania na ON DELETE CASCADE (PRAGMA foreign_keys nie musi obowiązywać na każdym połączeniu)
  await run(`DELETE FROM pickem_picks WHERE match_id IN (SELECT id FROM pickem_matches WHERE tournament_id = ?)`, [id]);
  await run(`DELETE FROM pickem_matches WHERE tournament_id = ?`, [id]);
  await run(`DELETE FROM pickem_teams WHERE tournament_id = ?`, [id]);
  await run(`DELETE FROM pickem_tournaments WHERE id = ?`, [id]);
}

/* ───────────────────────── DRUŻYNY ───────────────────────── */

export type TeamInput = { name: string; short: string | null; logo_url: string | null };

export async function addTeams(tournamentId: string, teams: TeamInput[]) {
  for (const t of teams) {
    await run(`INSERT INTO pickem_teams (id, tournament_id, name, short, logo_url, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [
      uid(),
      tournamentId,
      t.name,
      t.short,
      t.logo_url,
      nowIso(),
    ]);
  }
}

export async function updateTeam(tournamentId: string, teamId: string, t: TeamInput): Promise<boolean> {
  const res = await q<{ id: string }>(
    `UPDATE pickem_teams SET name = ?, short = ?, logo_url = ? WHERE id = ? AND tournament_id = ? RETURNING id`,
    [t.name, t.short, t.logo_url, teamId, tournamentId],
  );
  return res.length > 0;
}

export async function deleteTeam(tournamentId: string, teamId: string): Promise<boolean> {
  const found = await q<{ ext_id: string | null }>(`SELECT ext_id FROM pickem_teams WHERE id = ? AND tournament_id = ?`, [
    teamId,
    tournamentId,
  ]);
  if (!found.length) return false;
  if (found[0].ext_id) await ignoreForSync(tournamentId, `t:${found[0].ext_id}`);
  await run(`DELETE FROM pickem_picks WHERE team_id = ?`, [teamId]);
  await run(`UPDATE pickem_matches SET team_a_id = NULL WHERE team_a_id = ?`, [teamId]);
  await run(`UPDATE pickem_matches SET team_b_id = NULL WHERE team_b_id = ?`, [teamId]);
  await run(`UPDATE pickem_matches SET winner_id = NULL, score_a = NULL, score_b = NULL WHERE winner_id = ?`, [teamId]);
  await run(`DELETE FROM pickem_teams WHERE id = ?`, [teamId]);
  return true;
}

/* ───────────────────────── MECZE ───────────────────────── */

async function matchRows(tournamentId: string) {
  return q<MatchRow>(`SELECT * FROM pickem_matches WHERE tournament_id = ?`, [tournamentId]);
}

// Sprawdza drużyny i mecze-źródła (muszą być z tego turnieju) oraz czy drabinka nie zapętla się
async function validateMatch(tournamentId: string, input: MatchInput, selfId: string | null): Promise<string | null> {
  const [teams, rows] = await Promise.all([
    q<{ id: string }>(`SELECT id FROM pickem_teams WHERE tournament_id = ?`, [tournamentId]),
    matchRows(tournamentId),
  ]);
  const teamIds = new Set(teams.map((t) => t.id));
  const byId = new Map(rows.map((m) => [m.id, m]));

  for (const s of [input.a, input.b]) {
    if (!s) continue;
    if ("team_id" in s && !teamIds.has(s.team_id)) return "Nie ma takiej drużyny w turnieju";
    if ("match_id" in s) {
      if (s.match_id === selfId) return "Mecz nie może zależeć od samego siebie";
      if (!byId.has(s.match_id)) return "Nie ma takiego meczu w turnieju";
    }
  }
  const a = input.a, b = input.b;
  if (a && b && "team_id" in a && "team_id" in b && a.team_id === b.team_id) return "Drużyna nie może grać sama ze sobą";
  if (a && b && "match_id" in a && "match_id" in b && a.match_id === b.match_id && a.kind === b.kind) {
    return "Obie strony wskazują to samo miejsce w drabince";
  }

  // Zapętlenie: czy któryś mecz-źródło (pośrednio) zależy od edytowanego meczu
  if (selfId) {
    const deps = (m: MatchRow) => [m.src_a_match_id, m.src_b_match_id].filter(Boolean) as string[];
    const seen = new Set<string>();
    const stack = [input.a, input.b].flatMap((s) => (s && "match_id" in s ? [s.match_id] : []));
    while (stack.length) {
      const id = stack.pop()!;
      if (id === selfId) return "Taka drabinka zapętla się (mecz zależałby od samego siebie)";
      if (seen.has(id)) continue;
      seen.add(id);
      const m = byId.get(id);
      if (m) stack.push(...deps(m));
    }
  }
  return null;
}

const str = (v: unknown, max: number) => {
  const s = String(v ?? "").trim().slice(0, max);
  return s || null;
};

function parseSlot(v: any): SlotInput {
  if (v?.team_id) return { team_id: String(v.team_id) };
  if (v?.match_id && (v.kind === "winner" || v.kind === "loser")) return { match_id: String(v.match_id), kind: v.kind };
  return null;
}

// Treść żądania → MatchInput albo komunikat błędu
export function parseMatchInput(body: any): MatchInput | string {
  const startsAt = new Date(String(body?.starts_at ?? ""));
  if (Number.isNaN(startsAt.getTime())) return "Podaj datę i godzinę meczu";
  const bestOf = Number(body?.best_of);
  const points = Math.round(Number(body?.points ?? 1));
  if (!(BEST_OF as readonly number[]).includes(bestOf)) return "Nieprawidłowy format meczu (Bo1/Bo3/Bo5)";
  if (!(points >= 1 && points <= 100)) return "Punkty za trafienie: od 1 do 100";
  return {
    stage: str(body?.stage, 80),
    label: str(body?.label, 80),
    starts_at: startsAt.toISOString(),
    best_of: bestOf,
    points,
    a: parseSlot(body?.a),
    b: parseSlot(body?.b),
    sync: body?.sync !== false,
    exact: body?.exact === true && bestOf > 1,
  };
}

export function parseTeamInput(v: any): TeamInput | null {
  const name = str(v?.name, 60);
  if (!name) return null;
  const logo = str(v?.logo_url, 500);
  return { name, short: str(v?.short, 8), logo_url: logo && /^https?:\/\//i.test(logo) ? logo : null };
}

function slotCols(s: SlotInput): [string | null, string | null, SlotKind | null] {
  if (!s) return [null, null, null];
  if ("team_id" in s) return [s.team_id, null, null];
  return [null, s.match_id, s.kind];
}

export async function createMatch(tournamentId: string, input: MatchInput): Promise<string | null> {
  const err = await validateMatch(tournamentId, input, null);
  if (err) return err;
  await run(
    `INSERT INTO pickem_matches (id, tournament_id, stage, label, starts_at, best_of, points, exact_score,
       team_a_id, src_a_match_id, src_a_kind, team_b_id, src_b_match_id, src_b_kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid(), tournamentId, input.stage, input.label, input.starts_at, input.best_of, input.points, input.exact ? 1 : 0, ...slotCols(input.a), ...slotCols(input.b), nowIso()],
  );
  return null;
}

export async function updateMatch(tournamentId: string, matchId: string, input: MatchInput): Promise<string | null> {
  const found = await q(`SELECT id FROM pickem_matches WHERE id = ? AND tournament_id = ?`, [matchId, tournamentId]);
  if (!found.length) return "Nie znaleziono meczu";
  const err = await validateMatch(tournamentId, input, matchId);
  if (err) return err;
  await run(
    `UPDATE pickem_matches SET stage = ?, label = ?, starts_at = ?, best_of = ?, points = ?, exact_score = ?,
       team_a_id = ?, src_a_match_id = ?, src_a_kind = ?, team_b_id = ?, src_b_match_id = ?, src_b_kind = ?, locked = ?
     WHERE id = ?`,
    [input.stage, input.label, input.starts_at, input.best_of, input.points, input.exact ? 1 : 0, ...slotCols(input.a), ...slotCols(input.b),
      input.sync ? 0 : 1, matchId],
  );
  return null;
}

// Zapamiętuje usunięty ręcznie mecz/drużynę z lolesports, żeby synchronizacja ich nie przywróciła
async function ignoreForSync(tournamentId: string, key: string) {
  await run(`UPDATE pickem_tournaments SET sync_ignore = json_insert(COALESCE(sync_ignore, '[]'), '$[#]', ?) WHERE id = ?`, [
    key,
    tournamentId,
  ]);
}

export async function deleteMatch(tournamentId: string, matchId: string): Promise<boolean> {
  const found = await q<{ ext_id: string | null }>(`SELECT ext_id FROM pickem_matches WHERE id = ? AND tournament_id = ?`, [
    matchId,
    tournamentId,
  ]);
  if (!found.length) return false;
  if (found[0].ext_id) await ignoreForSync(tournamentId, `m:${found[0].ext_id}`);
  await run(`DELETE FROM pickem_picks WHERE match_id = ?`, [matchId]);
  // Mecze, które brały stąd zwycięzcę/przegranego, wracają do „do ustalenia”
  await run(`UPDATE pickem_matches SET src_a_match_id = NULL, src_a_kind = NULL WHERE src_a_match_id = ?`, [matchId]);
  await run(`UPDATE pickem_matches SET src_b_match_id = NULL, src_b_kind = NULL WHERE src_b_match_id = ?`, [matchId]);
  await run(`DELETE FROM pickem_matches WHERE id = ?`, [matchId]);
  return true;
}

export async function setResult(
  tournamentId: string,
  matchId: string,
  result: { winner_id: string; score_a: number | null; score_b: number | null } | null,
): Promise<string | null> {
  const rows = await matchRows(tournamentId);
  if (!rows.some((m) => m.id === matchId)) return "Nie znaleziono meczu";
  // Wynik wpisany lub usunięty ręcznie wyłącza mecz z synchronizacji — inaczej API by go nadpisało
  if (!result) {
    await run(`UPDATE pickem_matches SET winner_id = NULL, score_a = NULL, score_b = NULL, locked = 1 WHERE id = ?`, [matchId]);
    return null;
  }
  const [a, b] = resolveBracket(rows)(matchId);
  if (!a || !b) return "Obie drużyny tego meczu muszą być znane";
  if (result.winner_id !== a && result.winner_id !== b) return "Zwycięzca musi grać w tym meczu";
  await run(`UPDATE pickem_matches SET winner_id = ?, score_a = ?, score_b = ?, locked = 1 WHERE id = ?`, [
    result.winner_id,
    result.score_a,
    result.score_b,
    matchId,
  ]);
  return null;
}

/* ───────────────────────── TYPY ───────────────────────── */

export async function setPick(
  tournamentId: string,
  matchId: string,
  username: string,
  teamId: string | null,
  loserWins: number | null = null,
  stake: number | null = null, // null = bez zmiany stawki
): Promise<string | null> {
  const rows = await matchRows(tournamentId);
  const m = rows.find((x) => x.id === matchId);
  if (!m) return "Nie znaleziono meczu";
  // Termin głosowania = start meczu, sprawdzany po stronie serwera
  if (m.starts_at <= nowIso()) return "Mecz już się zaczął — typowanie zamknięte";
  if (m.winner_id) return "Mecz ma już wynik";
  if (!teamId) {
    await run(`DELETE FROM pickem_picks WHERE match_id = ? AND username = ?`, [matchId, username]);
    return null;
  }
  const [a, b] = resolveBracket(rows)(matchId);
  if (!a || !b) return "Drużyny tego meczu nie są jeszcze znane";
  if (teamId !== a && teamId !== b) return "Ta drużyna nie gra w tym meczu";
  // Mecz na wynik: wynik obowiązkowy; mecz na zwycięzcę: wyniku się nie typuje
  const exactMode = !!m.exact_score && m.best_of > 1;
  if (exactMode && loserWins === null) return "Ten mecz typuje się na dokładny wynik — wybierz wynik";
  if (loserWins !== null) {
    if (!exactMode) return "W tym meczu typuje się tylko zwycięzcę";
    if (!Number.isInteger(loserWins) || loserWins < 0 || loserWins >= Math.ceil(m.best_of / 2)) return "Nieprawidłowy wynik";
  }
  if (stake !== null && !(Number.isInteger(stake) && stake >= 0)) return "Nieprawidłowa stawka";
  // Stawiać można tylko żetony, które się ma (obecna stawka w tym meczu wraca do puli wolnych).
  // Minimum = punkty meczu (albo wszystko, co gracz ma); bez stawki w żądaniu zostaje obecna, podniesiona do minimum
  const t = (await q<PickemTournament>(`SELECT * FROM pickem_tournaments WHERE id = ?`, [tournamentId]))[0];
  const v = await buildView(t, username);
  const current = v.matches.find((x) => x.id === matchId)?.myStake ?? 0;
  const free = v.myWallet + current;
  const { min, max } = stakeRange(m.points, free);
  const finalStake = stake ?? Math.min(max, Math.max(current, min));
  if (finalStake > max) return `Masz tylko ${Math.max(0, Math.floor(free))} wolnych żetonów`;
  if (finalStake < min) return `W tym meczu stawka to co najmniej ${min} żet.`;
  await run(
    `INSERT INTO pickem_picks (match_id, username, team_id, loser_wins, stake, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (match_id, username) DO UPDATE SET
       team_id = excluded.team_id, loser_wins = excluded.loser_wins, stake = excluded.stake, created_at = excluded.created_at`,
    [matchId, username, teamId, loserWins, finalStake, nowIso()],
  );
  return null;
}

/** Szanse z rankingu dla meczów przed startem; po starcie kurs bazowy jest zamrożony */
export async function saveBaseProbs(updates: { id: string; probA: number }[]) {
  const now = nowIso();
  for (const u of updates) {
    await run(`UPDATE pickem_matches SET prob_a = ? WHERE id = ? AND starts_at > ?`, [u.probA, u.id, now]);
  }
}

/* ───────────────────────── SYNCHRONIZACJA (lolesports) ───────────────────────── */

const SYNC_EVERY_MS = 10 * 60_000;
const DAY_MS = 86_400_000;

// Automatyczne odświeżenie przy wejściu na stronę: co 10 min, aż do kilku dni po końcu edycji
export function syncDue(t: PickemTournament): boolean {
  if (t.source !== "lolesports") return false;
  if (!t.synced_at) return true;
  const last = Date.parse(t.synced_at);
  if (Date.now() - last < SYNC_EVERY_MS) return false;
  return !(t.source_end && last > Date.parse(t.source_end) + 3 * DAY_MS);
}

const httpsUrl = (u: string | null | undefined) => (u ? u.replace(/^http:\/\//i, "https://") : null);
const nearestBo = (n: number) => (n >= 5 ? 5 : n >= 3 ? 3 : 1);

export type SyncSummary = { added: number; updated: number; teams: number };

// force = ręczne „Synchronizuj”; bez niego tylko gdy minął interwał (i nikt inny właśnie nie synchronizuje)
export async function syncTournament(tournamentId: string, force = false): Promise<SyncSummary | string> {
  const now = nowIso();
  const claim = await q<PickemTournament>(
    `UPDATE pickem_tournaments SET synced_at = ?
     WHERE id = ? AND source = 'lolesports' AND (? OR synced_at IS NULL OR synced_at < ?) RETURNING *`,
    [now, tournamentId, force ? 1 : 0, new Date(Date.now() - SYNC_EVERY_MS).toISOString()],
  );
  const t = claim[0];
  if (!t) return force ? "Ten turniej nie jest powiązany z lolesports" : { added: 0, updated: 0, teams: 0 };
  if (!t.source_league_id || !t.source_start || !t.source_end) return "Brak danych edycji lolesports";

  let events: LolMatchEvent[];
  try {
    events = await getTournamentMatches(t.source_league_id, t.source_start, t.source_end);
  } catch (e) {
    const msg = `Nie udało się pobrać danych z lolesports (${e instanceof Error ? e.message : e})`;
    await run(`UPDATE pickem_tournaments SET sync_error = ? WHERE id = ?`, [msg, tournamentId]);
    return msg;
  }

  const summary: SyncSummary = { added: 0, updated: 0, teams: 0 };
  let ignored = new Set<string>();
  try {
    ignored = new Set(JSON.parse(t.sync_ignore || "[]"));
  } catch {}

  // Drużyny po kodzie z API; drużynę dodaną wcześniej ręcznie z tym samym skrótem łączymy zamiast dublować
  const teams = await q<{ id: string; ext_id: string | null; short: string | null; name: string }>(
    `SELECT id, ext_id, short, name FROM pickem_teams WHERE tournament_id = ?`,
    [tournamentId],
  );
  const teamByExt = new Map(teams.filter((x) => x.ext_id).map((x) => [x.ext_id!, x.id]));
  async function teamId(lt: LolTeam | undefined): Promise<string | null> {
    if (!lt?.code || lt.code === "TBD" || ignored.has(`t:${lt.code}`)) return null;
    const known = teamByExt.get(lt.code);
    if (known) return known;
    const manual = teams.find(
      (x) => !x.ext_id && (x.short?.toUpperCase() === lt.code.toUpperCase() || x.name.toLowerCase() === lt.name.toLowerCase()),
    );
    let id = manual?.id;
    if (id) {
      await run(`UPDATE pickem_teams SET ext_id = ?, logo_url = COALESCE(logo_url, ?) WHERE id = ?`, [lt.code, httpsUrl(lt.image), id]);
    } else {
      id = uid();
      await run(
        `INSERT INTO pickem_teams (id, tournament_id, name, short, logo_url, ext_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, tournamentId, lt.name, lt.code, httpsUrl(lt.image), lt.code, now],
      );
      summary.teams++;
    }
    teamByExt.set(lt.code, id);
    return id;
  }

  const rows = await matchRows(tournamentId);
  const byExt = new Map(rows.filter((m) => m.ext_id).map((m) => [m.ext_id!, m]));
  // Nowe mecze dziedziczą punkty z meczów tego samego etapu (admin ustawia wagę raz na etap)
  const stagePoints = new Map(rows.filter((m) => m.stage).map((m) => [m.stage!, m.points]));
  // …i to samo z trybem typowania (na zwycięzcę / na dokładny wynik)
  const stageExact = new Map(rows.filter((m) => m.stage).map((m) => [m.stage!, m.exact_score]));

  for (const e of events) {
    const lm = e.match!;
    const ex = byExt.get(lm.id);
    // Usunięty ręcznie albo poprawiony ręcznie — zostaje tak, jak ustawił admin
    if (ignored.has(`m:${lm.id}`) || ex?.locked) continue;
    const [ta, tb] = lm.teams;
    const a = await teamId(ta);
    const b = await teamId(tb);
    const bestOf = nearestBo(lm.strategy?.count ?? 1);
    const startsAt = new Date(e.startTime).toISOString();
    const stage = stageName(e.blockName);
    let winner: string | null = null;
    if (e.state === "completed" && a && b) {
      winner = ta?.result?.outcome === "win" ? a : tb?.result?.outcome === "win" ? b : null;
    }
    const sa = winner ? ta?.result?.gameWins ?? null : null;
    const sb = winner ? tb?.result?.gameWins ?? null : null;

    if (!ex) {
      await run(
        `INSERT INTO pickem_matches (id, tournament_id, stage, label, starts_at, best_of, points, exact_score,
           team_a_id, team_b_id, winner_id, score_a, score_b, ext_id, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid(), tournamentId, stage, startsAt, bestOf, stagePoints.get(stage) ?? 1, bestOf > 1 ? stageExact.get(stage) ?? 0 : 0,
          a, b, winner, sa, sb, lm.id, now],
      );
      summary.added++;
      continue;
    }

    // API rozstrzyga tam, gdzie coś wie; przy „TBD” zostaje ustawienie admina (np. zwycięzca meczu X).
    // Godziny nie ruszamy po starcie meczu — opóźniona transmisja otworzyłaby typowanie i schowała typy
    const next = {
      starts_at: ex.starts_at <= now ? ex.starts_at : startsAt,
      best_of: bestOf,
      team_a_id: a ?? ex.team_a_id,
      src_a_match_id: a ? null : ex.src_a_match_id,
      src_a_kind: a ? null : ex.src_a_kind,
      team_b_id: b ?? ex.team_b_id,
      src_b_match_id: b ? null : ex.src_b_match_id,
      src_b_kind: b ? null : ex.src_b_kind,
      winner_id: winner ?? ex.winner_id,
      score_a: winner ? sa : ex.score_a,
      score_b: winner ? sb : ex.score_b,
    };
    const changed = (Object.keys(next) as (keyof typeof next)[]).some((k) => next[k] !== ex[k]);
    if (!changed) continue;
    await run(
      `UPDATE pickem_matches SET starts_at = ?, best_of = ?, team_a_id = ?, src_a_match_id = ?, src_a_kind = ?,
         team_b_id = ?, src_b_match_id = ?, src_b_kind = ?, winner_id = ?, score_a = ?, score_b = ? WHERE id = ?`,
      [next.starts_at, next.best_of, next.team_a_id, next.src_a_match_id, next.src_a_kind, next.team_b_id,
        next.src_b_match_id, next.src_b_kind, next.winner_id, next.score_a, next.score_b, ex.id],
    );
    summary.updated++;
  }

  await run(`UPDATE pickem_tournaments SET sync_error = NULL WHERE id = ?`, [tournamentId]);
  return summary;
}

/* ───────────────────────── PULPIT ───────────────────────── */

export interface OpenPickemMatch {
  id: string;
  token: string; // turniej
  tournament: string;
  label: string | null;
  stage: string | null;
  starts_at: string;
  best_of: number;
  points: number;
  a: PickemTeam;
  b: PickemTeam;
  voters: string[];
  picked: boolean; // widz już typował
  exact: boolean; // typowany na dokładny wynik
}

// Mecze, które da się teraz typować (drużyny znane, przed startem, bez wyniku), ze wszystkich turniejów
export async function listOpenMatches(viewer: string): Promise<OpenPickemMatch[]> {
  const now = nowIso();
  const [ts, teams, rows, picks] = await Promise.all([
    q<PickemTournament>(`SELECT * FROM pickem_tournaments`),
    q<PickemTeam & { tournament_id: string }>(`SELECT id, tournament_id, name, short, logo_url FROM pickem_teams`),
    q<MatchRow>(`SELECT * FROM pickem_matches`),
    q<{ match_id: string; username: string; team_id: string }>(
      `SELECT p.match_id, p.username, p.team_id FROM pickem_picks p
       JOIN pickem_matches m ON m.id = p.match_id WHERE m.starts_at > ? AND m.winner_id IS NULL ORDER BY p.created_at`,
      [now],
    ),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const resolve = resolveBracket(rows);
  const out: OpenPickemMatch[] = [];

  for (const m of rows) {
    if (m.starts_at <= now || m.winner_id) continue;
    const t = ts.find((x) => x.id === m.tournament_id);
    const [a, b] = resolve(m.id);
    const ta = a ? teamById.get(a) : undefined;
    const tb = b ? teamById.get(b) : undefined;
    if (!t || !ta || !tb) continue;
    const voters = picks.filter((p) => p.match_id === m.id && (p.team_id === a || p.team_id === b)).map((p) => p.username);
    out.push({
      id: m.id,
      token: t.token,
      tournament: t.name,
      label: m.label,
      stage: m.stage,
      starts_at: m.starts_at,
      best_of: m.best_of,
      points: m.points,
      a: { id: ta.id, name: ta.name, short: ta.short, logo_url: ta.logo_url },
      b: { id: tb.id, name: tb.name, short: tb.short, logo_url: tb.logo_url },
      voters,
      picked: voters.includes(viewer),
      exact: !!m.exact_score && m.best_of > 1,
    });
  }
  return out.sort((x, y) => x.starts_at.localeCompare(y.starts_at));
}

/** Turnieje z lolesports, które warto odświeżyć (np. przy wejściu na pulpit) */
export async function tournamentsDueForSync(): Promise<string[]> {
  const ts = await q<PickemTournament>(`SELECT * FROM pickem_tournaments WHERE source = 'lolesports'`);
  return ts.filter(syncDue).map((t) => t.id);
}
