import { randomInt } from "crypto";

// Kości rzuca wyłącznie serwer — AI dostaje gotowe wyniki, gracz tylko je ogląda (animacja w przeglądarce).
export function rollDie(sides: number): number {
  return randomInt(1, sides + 1);
}

export interface ExprResult {
  total: number;
  rolls: number[];
  text: string; // "2k6+3 → [4, 2] + 3 = 9"
}

// Wyrażenie w stylu "1d8+2", "2k6", "-1d6", "+5". Zwraca null, gdy nie da się go odczytać.
export function rollExpr(expr: string): ExprResult | null {
  const clean = expr.replace(/\s+/g, "").replace(/k/gi, "d");
  const m = clean.match(/^([+-])?(?:(\d{0,2})d(\d{1,3}))?([+-]\d{1,3})?$/i);
  if (!m || (!m[3] && !m[4])) return null;
  const count = m[3] ? Math.min(20, Math.max(1, Number(m[2] || 1))) : 0;
  const sides = m[3] ? Number(m[3]) : 0;
  if (m[3] && (sides < 2 || sides > 100)) return null;
  const flat = m[4] ? Number(m[4]) : 0;
  const rolls = Array.from({ length: count }, () => rollDie(sides));
  const sum = rolls.reduce((a, b) => a + b, 0) + flat;
  const sign = m[1] === "-" ? -1 : 1;
  const dicePart = count ? `${count}k${sides}` : "";
  const flatPart = flat ? (flat > 0 ? `+${flat}` : `${flat}`) : "";
  const detail = count ? `[${rolls.join(", ")}]${flat ? (flat > 0 ? ` + ${flat}` : ` − ${-flat}`) : ""} = ${sum}` : `${sum}`;
  return {
    // Same liczby („-3”, „+5”) przechodzą wprost; z kośćmi wynik nie schodzi poniżej zera przed nadaniem znaku
    total: count ? sign * Math.max(0, sum) : sign * flat,
    rolls,
    text: `${m[1] === "-" ? "−" : ""}${dicePart}${flatPart} → ${detail}`,
  };
}
