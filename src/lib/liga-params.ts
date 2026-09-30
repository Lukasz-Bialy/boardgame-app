// Parametry widoku ligi z URL (strona i API czytają je tak samo)

import { EARLIEST_DAY, GAME_MODES, type GameMode, LEAGUE_PLAYERS, shiftDay, warsawDay, warsawDayStart } from "./riot";
import type { GameFilter } from "./liga-queries";

const DEFAULT_DAYS = 7;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Zakres dat; domyślnie ostatni tydzień (z dzisiejszym dniem włącznie)
export function parseRange(od?: string | null, doDay?: string | null) {
  const today = warsawDay(Date.now());
  let to = doDay && DAY_RE.test(doDay) && doDay <= today ? doDay : today;
  let from = od && DAY_RE.test(od) ? od : shiftDay(to, -(DEFAULT_DAYS - 1));
  if (from > to) [from, to] = [to, from];
  if (from < EARLIEST_DAY) from = EARLIEST_DAY;
  return { from, to, today };
}

// Zakres dni [from, to] jako epoch ms [start, end)
export const rangeMs = (from: string, to: string) => ({
  start: warsawDayStart(from),
  end: warsawDayStart(shiftDay(to, 1)),
});

const USERNAMES = LEAGUE_PLAYERS.map((p) => p.username);

// Brak parametru = wszystko; podany, ale pusty (np. odznaczeni wszyscy gracze) = nic
export function parsePicks(gracze?: string | null, premade?: string | null, tryb?: string | null) {
  const list = (raw: string) => raw.split(",").filter(Boolean);
  return {
    players: gracze == null ? USERNAMES : list(gracze).filter((u) => USERNAMES.includes(u)),
    sizes: premade == null ? [1, 2, 3, 4, 5] : list(premade).map(Number).filter((n) => n >= 1 && n <= 5),
    modes:
      tryb == null
        ? [...GAME_MODES]
        : list(tryb).filter((m): m is GameMode => (GAME_MODES as readonly string[]).includes(m)),
  };
}

// Filtr z zapytania API (te same nazwy parametrów co w adresie strony)
export function filterFromSearch(sp: URLSearchParams): GameFilter {
  const { from, to } = parseRange(sp.get("od"), sp.get("do"));
  const { start, end } = rangeMs(from, to);
  return { from: start, to: end, ...parsePicks(sp.get("gracze"), sp.get("premade"), sp.get("tryb")) };
}
