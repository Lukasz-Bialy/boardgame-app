// Zasady punktacji Pick'em — bez zależności od bazy, używane i przez serwer, i przez przeglądarkę

// Bonus za trafienie pod prąd: w meczu typowały co najmniej 3 osoby, a na zwycięzcę najwyżej 1/3 z nich.
// Przy 3:2 bonusu nie ma — to prawie rzut monetą
export const UPSET_MIN_VOTERS = 3;
export const UPSET_MAX_SHARE = 1 / 3;

/** +50% punktów meczu, zaokrąglone w górę, minimum 1 */
export const halfBonus = (points: number) => Math.max(1, Math.ceil(points * 0.5));

/** Bonus za dokładny wynik serii; w Bo1 wynik jest zawsze 1:0, więc nie ma czego typować */
export const exactBonusOf = (points: number, bestOf: number) => (bestOf > 1 ? halfBonus(points) : 0);

export type PickView = { team_id: string; loser_wins: number | null; stake?: number };

/** Typ wyniku trafiony: zwycięzca się zgadza, a przegrany wygrał tyle map, ile obstawiono */
export function exactHit(
  m: { winner_id: string | null; score_a: number | null; score_b: number | null },
  p: PickView,
): boolean {
  if (!m.winner_id || p.team_id !== m.winner_id || p.loser_wins === null || m.score_a === null || m.score_b === null) return false;
  return Math.min(m.score_a, m.score_b) === p.loser_wins;
}

/* ───── Zakłady (osobny ranking „hazardu”): żetony stawiane na własny typ, rozliczane pulą ───── */

/** Żetony na start turnieju — żeby pierwsze mecze nie były bez zakładów */
export const START_TOKENS = 2;
/** Żetony za każdy trafiony typ */
export const TOKENS_PER_HIT = 1;
/**
 * Stawka w meczu (no-limit — jak w pokerze, ogranicza tylko portfel): minimum = punkty meczu (każdy typ jest
 * zakładem, jak blind), ale nie więcej, niż gracz ma wolnych żetonów — z pustym portfelem typuje się bez zakładu.
 * Wielka stawka sama psuje sobie kurs, więc nie da się nią rozbić gry
 */
export function stakeRange(points: number, free: number): { min: number; max: number } {
  const max = Math.max(0, Math.floor(free));
  return { min: Math.min(points, max), max };
}

/**
 * Wirtualne żetony dorzucane do każdej puli, rozdzielone między drużyny według szans z rankingu.
 * Wygładzają kurs przy kilku graczach i dają coś do wygrania, gdy wszyscy postawili na tę samą drużynę.
 * Rosną z punktami meczu, bo z nimi rośnie minimalna stawka. Przy zasiewie dużo mniejszym od typowych stawek
 * własna stawka zbyt mocno psuje sobie kurs (sprawdzone symulacją: ~20 na stawki rzędu 1–5)
 */
export const SEED_PER_POINT = 20;
export const seedOf = (points: number) => SEED_PER_POINT * points;

/** Szansa wygrania jednej mapy przy ratingu w skali Elo (tak liczy Global Power Rankings) */
export const eloGameProb = (ra: number, rb: number) => 1 / (1 + 10 ** ((rb - ra) / 400));

/** Szansa wygrania serii BoN przy szansie p na każdą mapę */
export function seriesProb(p: number, bestOf: number): number {
  const need = Math.ceil(bestOf / 2);
  // Wygrane `need` map, przegrany ma ich k < need: C(need-1+k, k) · p^need · (1-p)^k
  let total = 0;
  let comb = 1;
  for (let k = 0; k < need; k++) {
    if (k > 0) comb = (comb * (need - 1 + k)) / k;
    total += comb * p ** need * (1 - p) ** k;
  }
  return total;
}

// Skrajne szanse obcinamy — przy 99% kurs na faworyta byłby równy zero
const clampProb = (p: number | null) => Math.min(0.95, Math.max(0.05, p ?? 0.5));

export type Pool = { a: number; b: number }; // punkty postawione na drużynę A i B

/**
 * Kurs = cała pula ÷ punkty na daną drużynę (z zasiewem). Bez stawek graczy to kurs bazowy, czyli 1/szansa.
 * Trafiony zakład zwraca stawkę × kurs, pudło traci stawkę
 */
export function poolOdds(probA: number | null, seed: number, pool: Pool = { a: 0, b: 0 }): Pool {
  const p = clampProb(probA);
  const total = pool.a + pool.b + seed;
  return { a: total / (pool.a + seed * p), b: total / (pool.b + seed * (1 - p)) };
}

const tenth = (n: number) => Math.round(n * 10) / 10;

/** Bilans zakładu po wyniku: zysk na czysto przy trafieniu, minus stawka przy pudle */
export const betResult = (stake: number, won: boolean, odds: number) => (stake ? tenth(won ? stake * (odds - 1) : -stake) : 0);

const ptsFmt = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
/** Punkty z zakładami bywają ułamkowe: „12”, „12,5” */
export const fmtPts = (n: number) => ptsFmt.format(tenth(n));
/** Kurs do wyświetlenia: „1,35” */
export const fmtOdds = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
