// Harnaś — tytuł dla najlepszego gracza ekipy w meczu, przyznawany tylko w grach, w których grało
// co najmniej HARNAS_MIN_CLUB osób z ekipy. Moduł bez zależności serwerowych — wzór pokazuje też klient.
// Wyniki są zapisywane w bazie przy pobraniu meczu — po zmianie wzoru podbij DERIVED_VERSION w riot.ts,
// żeby zapisane mecze się przeliczyły.

export const HARNAS_MIN_CLUB = 3;

export type HarnasInput = {
  id: string; // puuid
  teamId: number;
  position: string; // TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY, pusty gdy Riot nie przypisał roli (np. ARAM)
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  damage: number;
  gold: number;
  vision: number;
  controlWards: number;
  heal: number; // leczenie sojuszników
  shield: number; // tarcze na sojusznikach
  cc: number; // timeCCingOthers — czas kontroli tłumu nałożonej na wrogów
};

type MetricKey = "kp" | "kda" | "deaths" | "dmgShare" | "role" | "gold" | "dmgPerGold" | "vision" | "controlWards";

/* Wagi: połączenie tego, jak graczy oceniają analitycy zawodowi (KP, DTH%, DMG%, przewaga złota nad rywalem,
   vision score/min — Oracle's Elixir), z tym, co w meczach ekipy najmocniej wiąże się z wygraną
   (korelacja z wygraną: przewaga złota 0,51, KDA 0,57, farma 0,22, wizja 0,10). Udziały (KP, śmierci,
   obrażenia) same z wygraną się nie wiążą — w drużynie sumują się do 100% — ale mówią, kto niósł drużynę,
   więc zostają, tylko z mniejszą wagą. Ten zestaw podwoił korelację score'u z wygraną (0,19 → 0,37),
   a średni wynik każdej roli dalej wynosi ~50.
   srOnly — na ARAM-ie nie ma linii, wizji ani wardów, więc te składniki pomijamy (wagi reszty się skalują). */
export const HARNAS_METRICS: {
  key: MetricKey;
  label: string;
  hint?: string;
  weight: number;
  srOnly?: boolean;
  lowerBetter?: boolean;
}[] = [
  { key: "gold", label: "Przewaga złota nad rywalem z linii", weight: 20, srOnly: true },
  {
    key: "kda",
    label: "KDA",
    hint: "liczone logarytmicznie z (K+A+1)/(D+1) — mecz bez śmierci nie wystrzeliwuje ponad skalę",
    weight: 15,
  },
  { key: "kp", label: "Udział w killach", weight: 15 },
  {
    key: "role",
    label: "Farma / wsparcie",
    hint: "CS na minutę; support zamiast tego leczenie i tarcze na sojusznikach plus CC na wrogach",
    weight: 15,
  },
  { key: "deaths", label: "Udział w śmierciach drużyny", weight: 10, lowerBetter: true },
  { key: "dmgShare", label: "Udział w obrażeniach drużyny", weight: 10 },
  { key: "vision", label: "Vision score na minutę", weight: 7, srOnly: true },
  { key: "dmgPerGold", label: "Obrażenia na złoto", weight: 5 },
  { key: "controlWards", label: "Control wardy", weight: 3, srOnly: true },
];

/* Typowy wynik na roli: [średnia, odchylenie] ze 134 meczów SR ekipy (268 występów na rolę, wrzesień 2026).
   Każdą statystykę oceniamy względem typowego gracza tej samej roli — support ma naturalnie najwięcej wizji
   i asyst, top najmniejszy udział w killach — więc każda rola ma średnio 50 pkt.
   controlWards — na 30 min gry; support — leczenie+tarcze / 127 + CC / 1,36 (na minutę, względem typowego
   supporta), dzięki czemu enchanter i tank są oceniani w tej samej skali. */
type Base = Record<Exclude<MetricKey, "role"> | "cs" | "support", [number, number]>;
const ROLE_BASE: Record<string, Partial<Base>> = {
  TOP: {
    kp: [0.359, 0.14], kda: [0.493, 0.855], deaths: [0.205, 0.084], dmgShare: [0.233, 0.075], cs: [6.68, 1.41],
    dmgPerGold: [2.08, 0.64], gold: [0, 140], vision: [0.72, 0.24], controlWards: [0.32, 0.79],
  },
  JUNGLE: {
    kp: [0.455, 0.153], kda: [0.841, 0.766], deaths: [0.177, 0.071], dmgShare: [0.177, 0.07], cs: [6.35, 1.25],
    dmgPerGold: [1.53, 0.55], gold: [0, 127], vision: [0.85, 0.28], controlWards: [1.15, 1.69],
  },
  MIDDLE: {
    kp: [0.403, 0.153], kda: [0.621, 0.842], deaths: [0.201, 0.087], dmgShare: [0.232, 0.073], cs: [6.74, 1.38],
    dmgPerGold: [2.1, 0.64], gold: [0, 128], vision: [0.66, 0.29], controlWards: [0.6, 1.12],
  },
  BOTTOM: {
    kp: [0.463, 0.151], kda: [0.704, 0.677], deaths: [0.211, 0.082], dmgShare: [0.228, 0.076], cs: [7.02, 1.22],
    dmgPerGold: [1.8, 0.57], gold: [0, 132], vision: [0.63, 0.24], controlWards: [0.36, 0.7],
  },
  UTILITY: {
    kp: [0.494, 0.134], kda: [0.796, 0.663], deaths: [0.206, 0.073], dmgShare: [0.13, 0.062], support: [2, 1.58],
    dmgPerGold: [1.48, 0.65], gold: [0, 62], vision: [2.15, 0.57], controlWards: [2.69, 2.42],
  },
};
const SUPPORT_SUSTAIN = 127;
const SUPPORT_CC = 1.36;

// Przycięcie skrajności: jedna statystyka (np. 0 śmierci) nie może sama wygrać meczu
const Z_MIN = -2.5;
const Z_MAX = 2.5;
// Wynik: 50 = typowy gracz na tej roli, każde odchylenie standardowe średniej ważonej to 20 pkt
const SCORE_PER_Z = 20;

// Wynik 0–100 dla każdego gracza meczu
export function harnasScores(players: HarnasInput[], minutes: number, aram: boolean): Map<string, number> {
  const min = Math.max(minutes, 1);
  const team = (p: HarnasInput) => players.filter((x) => x.teamId === p.teamId);
  const sum = (list: HarnasInput[], f: (x: HarnasInput) => number) => list.reduce((a, x) => a + f(x), 0);
  const rivalOf = (p: HarnasInput) => players.find((x) => x.teamId !== p.teamId && x.position === p.position);
  // Typowe wartości ról mamy tylko dla Summoner's Rift z pełnym przypisaniem ról. W pozostałych grach
  // (ARAM, gry z botami) porównujemy z resztą meczu.
  const laned = !aram && players.every((p) => ROLE_BASE[p.position] && rivalOf(p));
  const support = (p: HarnasInput) => laned && p.position === "UTILITY";

  const raw = (key: Exclude<MetricKey, "role"> | "cs" | "support", p: HarnasInput): number => {
    switch (key) {
      case "kp": {
        const kills = sum(team(p), (x) => x.kills);
        return kills ? (p.kills + p.assists) / kills : 0;
      }
      case "kda":
        return Math.log((p.kills + p.assists + 1) / (p.deaths + 1));
      case "deaths": {
        const deaths = sum(team(p), (x) => x.deaths);
        return deaths ? p.deaths / deaths : 0;
      }
      case "dmgShare": {
        const dmg = sum(team(p), (x) => x.damage);
        return dmg ? p.damage / dmg : 0;
      }
      case "cs":
        return p.cs / min;
      case "support":
        return (p.heal + p.shield) / min / SUPPORT_SUSTAIN + p.cc / min / SUPPORT_CC;
      case "dmgPerGold":
        return p.damage / Math.max(p.gold, 1);
      case "gold":
        return (p.gold - rivalOf(p)!.gold) / min;
      case "vision":
        return p.vision / min;
      case "controlWards":
        return p.controlWards / (min / 30);
    }
  };

  // Odchylenie od typowego wyniku (w odchyleniach standardowych): na roli albo — bez ról — w obrębie meczu
  const lobby = new Map<string, [number, number]>();
  const z = (key: Exclude<MetricKey, "role"> | "cs" | "support", p: HarnasInput): number => {
    let base = laned ? ROLE_BASE[p.position][key] : undefined;
    if (!base) {
      if (!lobby.has(key)) {
        const vals = players.map((x) => raw(key, x));
        const mean = vals.reduce((a, v) => a + v, 0) / vals.length;
        lobby.set(key, [mean, Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length)]);
      }
      base = lobby.get(key)!;
    }
    const [mean, sd] = base;
    return sd ? Math.min(Z_MAX, Math.max(Z_MIN, (raw(key, p) - mean) / sd)) : 0;
  };

  const scores = new Map<string, number>();
  for (const p of players) {
    let total = 0;
    let weights = 0;
    for (const m of HARNAS_METRICS) {
      if (m.srOnly && !laned) continue;
      let v: number;
      if (m.key === "role") {
        // Bez ról (ARAM) każdy dostaje lepsze z farmy i wsparcia — enchanter nie przegrywa za brak CS
        v = support(p) ? z("support", p) : laned ? z("cs", p) : Math.max(z("cs", p), z("support", p));
      } else {
        v = z(m.key, p);
      }
      total += (m.lowerBetter ? -v : v) * m.weight;
      weights += m.weight;
    }
    const score = 50 + (SCORE_PER_Z * total) / weights;
    scores.set(p.id, Math.round(Math.min(100, Math.max(0, score)) * 10) / 10);
  }
  return scores;
}
