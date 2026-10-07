// Uproszczone zasady na bazie SRD 5.1 (CC-BY-4.0, Wizards of the Coast). Wspólne dla serwera i klienta.

export const ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_PL: Record<Ability, { short: string; name: string }> = {
  STR: { short: "SIŁ", name: "Siła" },
  DEX: { short: "ZRE", name: "Zręczność" },
  CON: { short: "KON", name: "Kondycja" },
  INT: { short: "INT", name: "Inteligencja" },
  WIS: { short: "MDR", name: "Mądrość" },
  CHA: { short: "CHA", name: "Charyzma" },
};

export type Scores = Record<Ability, number>;

export const SKILLS: Record<string, Ability> = {
  Atletyka: "STR",
  Akrobatyka: "DEX",
  Skradanie: "DEX",
  "Zręczne dłonie": "DEX",
  "Wiedza tajemna": "INT",
  Historia: "INT",
  Śledztwo: "INT",
  Przyroda: "INT",
  Religia: "INT",
  "Opieka nad zwierzętami": "WIS",
  Intuicja: "WIS",
  Medycyna: "WIS",
  Percepcja: "WIS",
  "Sztuka przetrwania": "WIS",
  Oszustwo: "CHA",
  Zastraszanie: "CHA",
  Występy: "CHA",
  Perswazja: "CHA",
};
export const SKILL_NAMES = Object.keys(SKILLS);

export interface Race {
  id: string;
  name: string;
  en: string; // do promptów obrazków
  bonus: Partial<Scores>;
  blurb: string;
}

export const RACES: Race[] = [
  { id: "human", name: "Człowiek", en: "human", bonus: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, blurb: "Wszechstronny i ambitny. +1 do każdej cechy." },
  { id: "elf", name: "Elf", en: "high elf with pointed ears", bonus: { DEX: 2, INT: 1 }, blurb: "Zwinny, długowieczny, widzi w ciemności." },
  { id: "dwarf", name: "Krasnolud", en: "dwarf with a braided beard", bonus: { CON: 2, WIS: 1 }, blurb: "Twardy jak skała, odporny na trucizny." },
  { id: "halfling", name: "Niziołek", en: "halfling", bonus: { DEX: 2, CHA: 1 }, blurb: "Mały, szczęśliwy i zaskakująco odważny." },
  { id: "gnome", name: "Gnom", en: "gnome tinkerer", bonus: { INT: 2, CON: 1 }, blurb: "Ciekawski wynalazca o bystrym umyśle." },
  { id: "halfelf", name: "Półelf", en: "half-elf", bonus: { CHA: 2, DEX: 1, CON: 1 }, blurb: "Między dwoma światami, urodzony dyplomata." },
  { id: "halforc", name: "Półork", en: "half-orc with small tusks", bonus: { STR: 2, CON: 1 }, blurb: "Silny i nieustępliwy, trudno go powalić." },
  { id: "tiefling", name: "Tiefling", en: "tiefling with horns and a tail", bonus: { CHA: 2, INT: 1 }, blurb: "Piekielne dziedzictwo, odporność na ogień." },
  { id: "dragonborn", name: "Drakonid", en: "dragonborn with scales", bonus: { STR: 2, CHA: 1 }, blurb: "Smocza krew i zionięcie żywiołem." },
];

export interface CharClass {
  id: string;
  name: string;
  en: string;
  hitDie: number;
  saves: Ability[];
  skills: string[];
  // Kolejność standardowego zestawu 15,14,13,12,10,8 — od najważniejszej cechy
  priority: Ability[];
  armor: { base: number; dex: "full" | "max2" | "none"; shield?: boolean; con?: boolean };
  inventory: string[];
  blurb: string;
  icon: string; // nazwa ikony lucide (mapowana w UI)
  color: string; // akcent karty klasy
}

export const CLASSES: CharClass[] = [
  {
    id: "fighter", name: "Wojownik", en: "fighter in chain mail with a longsword and shield", hitDie: 10,
    saves: ["STR", "CON"], skills: ["Atletyka", "Percepcja", "Zastraszanie"],
    priority: ["STR", "CON", "DEX", "WIS", "CHA", "INT"],
    armor: { base: 16, dex: "none", shield: true },
    inventory: ["Kolczuga", "Tarcza", "Miecz długi (1k8 cięte)", "Lekka kusza (1k8, 20 bełtów)", "Plecak podróżnika", "Racje na 5 dni"],
    blurb: "Mistrz broni i pancerza. Stoi w pierwszym szeregu.", icon: "sword", color: "#C0673E",
  },
  {
    id: "barbarian", name: "Barbarzyńca", en: "barbarian with a greataxe and fur cloak", hitDie: 12,
    saves: ["STR", "CON"], skills: ["Atletyka", "Zastraszanie", "Sztuka przetrwania"],
    priority: ["STR", "CON", "DEX", "WIS", "CHA", "INT"],
    armor: { base: 10, dex: "full", con: true },
    inventory: ["Topór dwuręczny (1k12 cięte)", "2 oszczepy (1k6)", "Plecak podróżnika", "Racje na 5 dni"],
    blurb: "Szał bitewny i dzika siła. Najwięcej punktów życia.", icon: "axe", color: "#B04A3A",
  },
  {
    id: "rogue", name: "Łotrzyk", en: "rogue in a dark hooded leather armor with daggers", hitDie: 8,
    saves: ["DEX", "INT"], skills: ["Skradanie", "Zręczne dłonie", "Akrobatyka", "Percepcja", "Oszustwo"],
    priority: ["DEX", "CON", "INT", "WIS", "CHA", "STR"],
    armor: { base: 11, dex: "full" },
    inventory: ["Skórzana zbroja", "Rapier (1k8 kłute)", "Krótki łuk (1k6, 20 strzał)", "2 sztylety (1k4)", "Narzędzia złodziejskie"],
    blurb: "Cień, zamki i celne pchnięcie w słaby punkt.", icon: "eye-off", color: "#6B6FA8",
  },
  {
    id: "ranger", name: "Łowca", en: "ranger with a longbow and a green cloak", hitDie: 10,
    saves: ["STR", "DEX"], skills: ["Sztuka przetrwania", "Percepcja", "Skradanie", "Przyroda"],
    priority: ["DEX", "WIS", "CON", "STR", "INT", "CHA"],
    armor: { base: 11, dex: "full" },
    inventory: ["Skórzana zbroja", "Długi łuk (1k8, 20 strzał)", "2 krótkie miecze (1k6)", "Lina (15 m)", "Racje na 5 dni"],
    blurb: "Tropiciel dziczy, niezrównany łucznik.", icon: "crosshair", color: "#5C8A4E",
  },
  {
    id: "wizard", name: "Czarodziej", en: "wizard with a staff and an arcane spellbook", hitDie: 6,
    saves: ["INT", "WIS"], skills: ["Wiedza tajemna", "Historia", "Śledztwo"],
    priority: ["INT", "CON", "DEX", "WIS", "CHA", "STR"],
    armor: { base: 10, dex: "full" },
    inventory: ["Kostur (1k6)", "Księga czarów", "Czar: Ognisty pocisk (1k10, 36 m)", "Czar: Magiczny pocisk (3×1k4+1)", "Czar: Uśpienie", "Czar: Tarcza"],
    blurb: "Uczony magii. Krucha, ale potężna.", icon: "wand", color: "#4A78B8",
  },
  {
    id: "cleric", name: "Kapłan", en: "cleric in armor holding a glowing holy symbol", hitDie: 8,
    saves: ["WIS", "CHA"], skills: ["Religia", "Medycyna", "Intuicja"],
    priority: ["WIS", "CON", "STR", "CHA", "DEX", "INT"],
    armor: { base: 16, dex: "none", shield: true },
    inventory: ["Kolczuga", "Tarcza", "Buława (1k6 obuchowe)", "Symbol święty", "Czar: Leczenie ran (1k8+MDR)", "Czar: Święty płomień (1k8)", "Czar: Błogosławieństwo"],
    blurb: "Wojownik wiary. Leczy i chroni drużynę.", icon: "sun", color: "#D6AA62",
  },
  {
    id: "paladin", name: "Paladyn", en: "paladin in shining plate armor", hitDie: 10,
    saves: ["WIS", "CHA"], skills: ["Atletyka", "Perswazja", "Religia"],
    priority: ["STR", "CHA", "CON", "WIS", "DEX", "INT"],
    armor: { base: 16, dex: "none", shield: true },
    inventory: ["Kolczuga", "Tarcza", "Miecz długi (1k8 cięte)", "5 oszczepów (1k6)", "Symbol święty", "Nałożenie rąk (5 PW leczenia)"],
    blurb: "Święta przysięga, ciężka zbroja i boski gniew.", icon: "shield", color: "#C9A64A",
  },
  {
    id: "bard", name: "Bard", en: "bard with a lute and a feathered hat", hitDie: 8,
    saves: ["DEX", "CHA"], skills: ["Występy", "Perswazja", "Oszustwo", "Intuicja"],
    priority: ["CHA", "DEX", "CON", "WIS", "INT", "STR"],
    armor: { base: 11, dex: "full" },
    inventory: ["Skórzana zbroja", "Rapier (1k8 kłute)", "Lutnia", "Czar: Szyderstwo (1k4 psychiczne)", "Czar: Leczące słowo (1k4+CHA)", "Czar: Uśpienie"],
    blurb: "Czaruje słowem i pieśnią, wspiera drużynę.", icon: "music", color: "#B0629E",
  },
  {
    id: "warlock", name: "Czarnoksiężnik", en: "warlock with eldritch purple magic", hitDie: 8,
    saves: ["WIS", "CHA"], skills: ["Wiedza tajemna", "Oszustwo", "Zastraszanie"],
    priority: ["CHA", "CON", "DEX", "WIS", "INT", "STR"],
    armor: { base: 11, dex: "full" },
    inventory: ["Skórzana zbroja", "Sztylet (1k4)", "Fokus arkanów", "Czar: Mistyczny wybuch (1k10)", "Czar: Urok osobisty", "Pakt z tajemniczym patronem"],
    blurb: "Moc z paktu z istotą nie z tego świata.", icon: "flame", color: "#7A4FA8",
  },
  {
    id: "druid", name: "Druid", en: "druid with a wooden staff and antlers crown", hitDie: 8,
    saves: ["INT", "WIS"], skills: ["Przyroda", "Opieka nad zwierzętami", "Medycyna"],
    priority: ["WIS", "CON", "DEX", "INT", "CHA", "STR"],
    armor: { base: 11, dex: "full", shield: true },
    inventory: ["Skórzana zbroja", "Drewniana tarcza", "Sierp (1k4)", "Fokus druidyczny", "Czar: Ciernisty bicz (1k6)", "Czar: Leczenie ran (1k8+MDR)"],
    blurb: "Strażnik natury. Czary żywiołów i leczenie.", icon: "leaf", color: "#4E8E6A",
  },
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const raceById = (id: string) => RACES.find((r) => r.id === id);
export const classById = (id: string) => CLASSES.find((c) => c.id === id);

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

// Próg PD do osiągnięcia poziomu (indeks = poziom)
export const XP_FOR_LEVEL = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000];
export function levelForXp(xp: number): number {
  let lvl = 1;
  for (let l = 2; l < XP_FOR_LEVEL.length; l++) if (xp >= XP_FOR_LEVEL[l]) lvl = l;
  return lvl;
}

export function defaultScores(cls: CharClass): Scores {
  const s = {} as Scores;
  cls.priority.forEach((a, i) => (s[a] = STANDARD_ARRAY[i]));
  return s;
}

export function applyRace(base: Scores, race: Race): Scores {
  const s = { ...base };
  for (const a of ABILITIES) s[a] = Math.min(20, s[a] + (race.bonus[a] ?? 0));
  return s;
}

export function armorClass(cls: CharClass, s: Scores): number {
  const d = mod(s.DEX);
  const dex = cls.armor.dex === "full" ? d : cls.armor.dex === "max2" ? Math.min(2, d) : 0;
  return cls.armor.base + dex + (cls.armor.con ? mod(s.CON) : 0) + (cls.armor.shield ? 2 : 0);
}

export function startingHp(cls: CharClass, s: Scores): number {
  return Math.max(1, cls.hitDie + mod(s.CON));
}

// Średni przyrost PW na poziom (zasada „stałej wartości” z SRD)
export function hpPerLevel(cls: CharClass, s: Scores): number {
  return Math.max(1, cls.hitDie / 2 + 1 + mod(s.CON));
}

// "death" — rzut przeciw śmierci przy 0 PW: zleca go serwer (nie AI), bez modyfikatora, ST 10
export type CheckKind = "check" | "save" | "attack" | "death";

// Stany postaci ustawiane przez serwer
export const UNCONSCIOUS = "Nieprzytomny";
export const STABLE = "Stabilny";
export const DEAD = "Martwy";
export const DEATH_SAVES_NEEDED = 3;

export interface Sheet {
  class_id: string;
  level: number;
  scores: Scores;
}

// Modyfikator liczony po stronie serwera — AI nie podaje go samo, żeby nie mogło „dopisać” bonusu
export function checkModifier(sheet: Sheet, kind: CheckKind, ability: Ability, skill?: string | null): number {
  const cls = classById(sheet.class_id);
  const pb = profBonus(sheet.level);
  const abil = skill && SKILLS[skill] ? SKILLS[skill] : ability;
  const base = mod(sheet.scores[abil]);
  if (kind === "death") return 0;
  if (kind === "save") return base + (cls?.saves.includes(abil) ? pb : 0);
  if (kind === "attack") return base + pb;
  return base + (skill && cls?.skills.includes(skill) ? pb : 0);
}

export function checkLabel(kind: CheckKind, ability: Ability, skill?: string | null): string {
  const abil = skill && SKILLS[skill] ? SKILLS[skill] : ability;
  if (kind === "death") return "Rzut przeciw śmierci";
  if (kind === "save") return `Rzut obronny: ${ABILITY_PL[abil].name}`;
  if (kind === "attack") return `Atak (${ABILITY_PL[abil].short})`;
  return skill && SKILLS[skill] ? `${skill} (${ABILITY_PL[abil].short})` : `Test: ${ABILITY_PL[abil].name}`;
}

export const DICE = [4, 6, 8, 10, 12, 20] as const;

export const TONES = [
  { id: "classic", name: "Klasyczne fantasy", hint: "heroiczna przygoda, lochy, smoki, karczmy" },
  { id: "dark", name: "Mroczne fantasy", hint: "ponury świat, trudne wybory, groza w tle" },
  { id: "funny", name: "Z przymrużeniem oka", hint: "humor, absurdalne sytuacje, barwni NPC" },
  { id: "horror", name: "Horror", hint: "napięcie, niewyjaśnione zjawiska, strach" },
  { id: "mystery", name: "Kryminał / intryga", hint: "śledztwo, spiski, dworskie intrygi" },
];
