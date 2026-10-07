import { db, q, run, uid } from "../db";
import { displayNameOf } from "../users";
import {
  ABILITIES,
  ABILITY_PL,
  SKILL_NAMES,
  SKILLS,
  TONES,
  checkLabel,
  checkModifier,
  classById,
  fmtMod,
  hpPerLevel,
  levelForXp,
  mod,
  raceById,
  DEAD,
  DEATH_SAVES_NEEDED,
  STABLE,
  UNCONSCIOUS,
  type Ability,
  type CheckKind,
} from "./rules";
import { rollDie, rollExpr } from "./dice";
import { createImage } from "./images";
import { addPost, getCampaign, listCharacters, listPosts, listRolls, updateCharacter } from "./data";
import type { AppliedChange, Campaign, Character, Enemy, Post, Roll, RollData } from "./types";

const nowIso = () => new Date().toISOString();
const LOCK_STALE_MS = 150_000;

/* ─── Rzuty ───────────────────────────────────────────────────────────────── */

// Rzut przeciw śmierci (SRD): 10+ sukces, 1–9 porażka, naturalna 1 = dwie porażki, naturalna 20 = wstaje z 1 PW.
// 3 sukcesy — postać stabilna (żyje, ale nieprzytomna), 3 porażki — śmierć.
function deathSave(ch: Character, result: number): Pick<Character, "hp" | "conditions" | "death_successes" | "death_failures"> & {
  outcome: "stable" | "dead" | "revived" | null;
} {
  const without = (...drop: string[]) => ch.conditions.filter((x) => !drop.includes(x));
  if (result === 20) {
    return { hp: 1, conditions: without(UNCONSCIOUS, STABLE), death_successes: 0, death_failures: 0, outcome: "revived" };
  }
  const successes = ch.death_successes + (result >= 10 ? 1 : 0);
  const failures = ch.death_failures + (result === 1 ? 2 : result < 10 ? 1 : 0);
  if (failures >= DEATH_SAVES_NEEDED) {
    return { hp: 0, conditions: [...without(UNCONSCIOUS, STABLE), DEAD], death_successes: successes, death_failures: DEATH_SAVES_NEEDED, outcome: "dead" };
  }
  if (successes >= DEATH_SAVES_NEEDED) {
    return { hp: 0, conditions: [...without(STABLE), STABLE], death_successes: 0, death_failures: 0, outcome: "stable" };
  }
  return { hp: 0, conditions: ch.conditions, death_successes: successes, death_failures: failures, outcome: null };
}

// Rozstrzyga test zażądany przez MG. Kość rzuca serwer; zwraca dane do animacji.
export async function resolveRoll(roll: Roll, ch: Character, auto: boolean): Promise<RollData | null> {
  const result = rollDie(20);
  // Zajmujemy rzut atomowo — podwójne kliknięcie nie rzuci dwa razy
  const claim = await db.execute({
    sql: `UPDATE adv_rolls SET result = ?, auto = ?, rolled_at = ? WHERE id = ? AND result IS NULL`,
    args: [result, auto ? 1 : 0, nowIso(), roll.id],
  });
  if (claim.rowsAffected === 0) return null;

  if (roll.kind === "death") {
    const ds = deathSave(ch, result);
    const { outcome, ...patch } = ds;
    await updateCharacter(ch.id, patch);
    const data: RollData = {
      roll_id: roll.id,
      sides: 20,
      result,
      modifier: 0,
      total: result,
      dc: 10,
      success: result >= 10,
      label: checkLabel("death", "CON"),
      auto,
      character_name: ch.name,
      death: { successes: ds.death_successes, failures: ds.death_failures, outcome },
    };
    await addPost({ campaign_id: roll.campaign_id, round: roll.round, author: ch.username, kind: "roll", body: data.label, data: { roll: data } });
    return data;
  }

  const total = result + roll.modifier;
  const isAttack = roll.kind === "attack";
  const success = isAttack && result === 20 ? true : isAttack && result === 1 ? false : total >= roll.dc;

  let damageResult: number | null = null;
  if (isAttack && success && roll.damage) {
    const dmg = rollExpr(roll.damage);
    // Krytyk (naturalna 20) — kości obrażeń rzucane podwójnie
    const extra = result === 20 ? rollExpr(roll.damage.replace(/[+-]\d+$/, "")) : null;
    if (dmg) damageResult = Math.abs(dmg.total) + (extra ? Math.abs(extra.total) : 0);
    await run(`UPDATE adv_rolls SET damage_result = ? WHERE id = ?`, [damageResult, roll.id]);
  }

  const data: RollData = {
    roll_id: roll.id,
    sides: 20,
    result,
    modifier: roll.modifier,
    total,
    dc: roll.dc,
    success,
    label: checkLabel(roll.kind, roll.ability, roll.skill),
    damage: roll.damage,
    damage_result: damageResult,
    auto,
    character_name: ch.name,
  };
  await addPost({
    campaign_id: roll.campaign_id,
    round: roll.round,
    author: ch.username,
    kind: "roll",
    body: roll.reason ?? data.label,
    data: { roll: data },
  });
  return data;
}

// Swobodny rzut dowolną kością (np. dla zabawy albo na prośbę MG w narracji)
export async function freeRoll(campaign: Campaign, ch: Character, sides: number, note: string | null): Promise<RollData> {
  const result = rollDie(sides);
  const data: RollData = { sides, result, modifier: 0, total: result, label: `Rzut k${sides}`, character_name: ch.name };
  await addPost({
    campaign_id: campaign.id,
    round: campaign.round,
    author: ch.username,
    kind: "roll",
    body: note?.trim().slice(0, 200) || data.label,
    data: { roll: data },
  });
  return data;
}

/* ─── Gemini ──────────────────────────────────────────────────────────────── */

const S = { type: "STRING" } as const;
const I = { type: "INTEGER" } as const;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    narration: { ...S, description: "Narracja MG po polsku, 2–4 akapity oddzielone pustą linią" },
    scene_prompt: { ...S, description: "English, 1–2 sentences: visual description of the current scene for an illustration" },
    location: { ...S, description: "Krótka nazwa obecnego miejsca po polsku" },
    location_changed: { type: "BOOLEAN" },
    map_prompt: { ...S, nullable: true, description: "English: top-down map description of the new location (only when location_changed)" },
    roll_requests: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          character: { ...S, description: "Dokładne imię postaci" },
          kind: { type: "STRING", enum: ["check", "save", "attack"] },
          ability: { type: "STRING", enum: [...ABILITIES] },
          skill: { type: "STRING", enum: [...SKILL_NAMES, "brak"] },
          dc: I,
          reason: { ...S, description: "Krótko po polsku, czego dotyczy test" },
          damage: { ...S, nullable: true, description: "Tylko dla attack: kości obrażeń, np. 1d8+3" },
        },
        required: ["character", "kind", "ability", "skill", "dc", "reason"],
      },
    },
    enemy_attacks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          enemy: S,
          target: { ...S, description: "Dokładne imię postaci" },
          attack_bonus: I,
          damage: { ...S, description: "np. 1d6+2" },
        },
        required: ["enemy", "target", "attack_bonus", "damage"],
      },
    },
    changes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          character: S,
          hp: { ...S, nullable: true, description: "Zmiana PW kośćmi: '-1d6', '+2d4+2', '-3'" },
          xp: { ...I, nullable: true },
          items_add: { type: "ARRAY", items: S },
          items_remove: { type: "ARRAY", items: S },
          conditions: { type: "ARRAY", items: S, nullable: true },
        },
        required: ["character"],
      },
    },
    enemies: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: S, hp: I, max_hp: I, ac: I, note: S },
        required: ["name", "hp", "max_hp", "ac"],
      },
    },
    summary: { ...S, description: "Zaktualizowana kronika całej kampanii, po polsku" },
    campaign_over: { type: "BOOLEAN" },
  },
  required: ["narration", "scene_prompt", "location", "location_changed", "roll_requests", "enemy_attacks", "changes", "enemies", "summary"],
};

interface GmOutput {
  narration: string;
  scene_prompt: string;
  location: string;
  location_changed: boolean;
  map_prompt?: string | null;
  roll_requests: { character: string; kind: CheckKind; ability: Ability; skill: string; dc: number; reason: string; damage?: string | null }[];
  enemy_attacks: { enemy: string; target: string; attack_bonus: number; damage: string }[];
  changes: {
    character: string;
    hp?: string | null;
    xp?: number | null;
    items_add?: string[];
    items_remove?: string[];
    conditions?: string[] | null;
  }[];
  enemies: Enemy[];
  summary: string;
  campaign_over?: boolean;
}

export class GmError extends Error {}

async function callGemini(system: string, user: string): Promise<GmOutput> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GmError("Brak klucza GEMINI_API_KEY — dodaj go w .env (aistudio.google.com/apikey)");
  // Kolejka modeli: przy przeciążeniu (503) albo wyczerpanym limicie (429) próbujemy następnego —
  // darmowe limity są liczone osobno dla każdego modelu, a wersje „lite” rzadziej bywają przeciążone
  // (stan z 2026-09: 2.5 wycofane, 3.7/3.8 często przeciążone, 3.6 najszybszy; nieistniejące modele (404) są pomijane)
  const models = [
    process.env.GEMINI_MODEL || "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
  ];
  const started = Date.now();

  let lastErr = "";
  for (const model of [...new Set(models)]) {
    // Nie przekraczamy limitu czasu funkcji na Vercelu (maxDuration 60 s)
    const left = 50_000 - (Date.now() - started);
    if (left < 8_000) break;
    const res: Response | null = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      // Zbyt wolny model traktujemy jak przeciążony i przechodzimy do następnego
      signal: AbortSignal.timeout(Math.min(25_000, left)),
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }).catch(() => null);
    if (!res) {
      console.warn(`Gemini ${model}: przekroczony czas, próbuję następnego modelu`);
      lastErr = "Gemini odpowiada zbyt wolno — spróbuj za chwilę.";
      continue;
    }
    if (res.status === 404) {
      lastErr = `Model ${model} niedostępny`;
      continue;
    }
    if (res.status === 429 || res.status === 500 || res.status === 503) {
      console.warn(`Gemini ${model}: ${res.status}, próbuję następnego modelu`);
      lastErr =
        res.status === 429
          ? "Wyczerpany darmowy limit Gemini we wszystkich modelach — spróbuj za kilka minut."
          : "Gemini jest teraz przeciążony — spróbuj za chwilę.";
      continue;
    }
    if (!res.ok) throw new GmError(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts ?? [])
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join("");
    if (!text) throw new GmError(`Gemini nie zwrócił treści (${json?.candidates?.[0]?.finishReason ?? "brak powodu"})`);
    try {
      return JSON.parse(text) as GmOutput;
    } catch {
      throw new GmError("Gemini zwrócił niepoprawny JSON — spróbuj ponownie.");
    }
  }
  throw new GmError(lastErr || "Żaden model Gemini nie odpowiedział");
}

/* ─── Prompt ──────────────────────────────────────────────────────────────── */

const SYSTEM = `Jesteś Mistrzem Gry (MG) prowadzącym kampanię fabularną w stylu D&D 5e dla paczki przyjaciół.
Gra toczy się asynchronicznie (play by post): gracze deklarują działania, kiedy mają czas, a ty co turę piszesz jeden post, który rozstrzyga rundę. Piszesz WYŁĄCZNIE po polsku (poza polami *_prompt, które są po angielsku).

NARRACJA
- 2–4 akapity (max ok. 1800 znaków), plastycznie, z klimatem; dialogi NPC w „polskich cudzysłowach”.
- Zwracaj się do postaci po imieniu. Zakończ jasną sytuacją, która zaprasza do działania (np. „Co robicie?”).
- NIGDY nie decyduj za postacie graczy: nie wymyślaj ich słów, decyzji ani działań poza tym, co zadeklarowali. Opisujesz świat i skutki ich deklaracji.
- Postacie graczy, którzy nic nie napisali w tej rundzie, są obecne, ale bierne — nie karz ich za to.
- Nie wpisuj w narracji konkretnych liczb (obrażeń, PW, wyników kości) — pokazuje je interfejs.

KOŚCI I TESTY (rzuca serwer, nie ty)
- Wyniki testów z bieżącej rundy są OSTATECZNE. Opisz skutki zgodnie z sukcesem lub porażką. Porażka to komplikacja, nie koniec opowieści.
- Test zlecaj w roll_requests tylko wtedy, gdy wynik jest niepewny i ma stawkę. Najwyżej 1 test na postać na turę.
- ST (dc): 10 łatwe, 13 średnie, 15 trudne, 18 bardzo trudne, 20+ niemal niemożliwe.
- Zlecając test, NIE opisuj jego wyniku — zatrzymaj akcję tuż przed rozstrzygnięciem. Wynik poznasz w następnej turze.
- skill: nazwa umiejętności z listy albo „brak” (wtedy liczy się sama cecha). kind: check (test), save (rzut obronny), attack (atak).

WALKA
- Gdy postać atakuje: roll_request kind=attack, ability STR (broń wręcz) albo DEX (dystans/finezja), dla czarów cecha czarująca klasy (INT czarodziej; WIS kapłan/druid/łowca; CHA bard/paladyn/czarnoksiężnik); dc = KP celu; damage = kości broni lub czaru z ekwipunku + modyfikator cechy (np. „1d8+3”). Serwer rzuci obrażenia przy trafieniu.
- W następnej turze odejmij zadane obrażenia od PW wrogów w polu enemies; wrogów z 0 PW usuń i opisz ich upadek.
- Ataki wrogów zlecaj w enemy_attacks (attack_bonus zwykle +3…+6, damage np. „1d6+2”). Serwer rzuci atak przeciw KP postaci i odejmie PW. W narracji opisz tylko sam zamach/zagrożenie, nie jego skutek.
- enemies to pełna, aktualna lista wrogów w scenie (pusta poza walką). Dobieraj przeciwników do poziomu i liczby postaci.

STAN POSTACI (w changes, serwer stosuje zmiany)
- hp: leczenie lub obrażenia spoza walki jako wyrażenie kośćmi („+1d8+3”, „-1d4”).
- xp: nagradzaj za pokonanie wrogów i ważne osiągnięcia (ok. 25–100 PD na postać na poziomach 1–3; awans na 2. poziom przy 300 PD).
- items_add / items_remove: zdobyte, zużyte lub utracone przedmioty i złoto (np. „12 sztuk złota”).
- conditions: pełna lista stanów postaci (np. „Zatruty”), podaj tylko gdy się zmienia. Postać z 0 PW jest nieprzytomna.
- W polu character zawsze podawaj DOKŁADNE imię postaci.

0 PW I ŚMIERĆ (obsługuje serwer)
- Postać z 0 PW jest nieprzytomna i nie działa. Rzuty przeciw śmierci zleca i liczy SERWER — nie zlecaj ich w roll_requests i nie zmieniaj stanów Nieprzytomny/Stabilny/Martwy.
- W opisie drużyny widzisz licznik (sukcesy/porażki). Opisz wynik rzutu z tej rundy: sukces — tli się życie; porażka — słabnie; 3 sukcesy — postać ustabilizowana (żyje, ale wciąż nieprzytomna); naturalna 20 — wraca do przytomności z 1 PW; 3 porażki — postać umiera.
- Leczenie (czar, eliksir, Medycyna ST 10 udzielona przez inną postać) przywraca przytomność: daj hp „+…” w changes.
- Ustabilizowana postać sama odzyska przytomność z 1 PW, gdy walka się skończy (pusta lista enemies).
- Jeśli cała drużyna leży, rozstrzygnij sytuację fabularnie: wrogowie np. okradają, porywają albo zostawiają bohaterów, i zakończ walkę (pusta lista enemies), żeby opowieść mogła iść dalej.
- Atakowanie leżącej postaci (enemy_attacks) oznacza porażki rzutów przeciw śmierci — rób to tylko, gdy wróg naprawdę chce dobić ofiarę.

OBRAZY I MIEJSCA
- scene_prompt: po angielsku, 1–2 zdania opisujące kadr obecnej sceny (miejsce, światło, nastrój, postacie opisane wyglądem, bez imion, bez tekstu).
- location: krótka nazwa obecnego miejsca. location_changed=true przy pierwszej scenie i gdy drużyna trafia w nowe miejsce — wtedy map_prompt po angielsku (mapa z lotu ptaka tego miejsca/okolicy).

PAMIĘĆ
- summary: zaktualizowana kronika CAŁEJ kampanii (do ok. 1500 znaków): kluczowe wydarzenia, NPC, zadania, sekrety MG, otwarte wątki. To twoja jedyna pamięć o dawnych wydarzeniach — nie gub niczego ważnego.
- campaign_over=true tylko przy definitywnym końcu przygody (finał albo śmierć całej drużyny).

Treści na poziomie PG-13. Bądź sprawiedliwy, ale nie pobłażliwy — ryzyko ma być prawdziwe.`;

function charLine(c: Character): string {
  const race = raceById(c.race_id);
  const cls = classById(c.class_id);
  const stats = ABILITIES.map((a) => `${ABILITY_PL[a].short} ${c.scores[a]}(${fmtMod(mod(c.scores[a]))})`).join(", ");
  return [
    `- ${c.name} (gracz: ${displayNameOf(c.username)}) — ${race?.name} ${cls?.name}, poziom ${c.level}, PD ${c.xp}`,
    `  PW ${c.hp}/${c.max_hp}, KP ${c.ac}; ${stats}`,
    `  Biegłości: ${cls?.skills.join(", ")}; rzuty obronne: ${cls?.saves.map((a) => ABILITY_PL[a].short).join(", ")}`,
    `  Ekwipunek: ${c.inventory.join("; ") || "—"}`,
    c.conditions.length ? `  Stany: ${c.conditions.join(", ")}` : null,
    c.hp <= 0 && !c.conditions.includes(DEAD) && !c.conditions.includes(STABLE)
      ? `  UMIERA: rzuty przeciw śmierci — sukcesy ${c.death_successes}/3, porażki ${c.death_failures}/3`
      : null,
    c.look ? `  Wygląd: ${c.look}` : null,
    c.backstory ? `  Historia: ${c.backstory}` : null,
    !c.introduced ? `  [NOWA POSTAĆ — wprowadź ją do opowieści w tej turze]` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function postLine(p: Post, chars: Character[]): string {
  const who = chars.find((c) => c.username === p.author)?.name ?? displayNameOf(p.author);
  if (p.kind === "narration") return `[MG]: ${p.body}`;
  if (p.kind === "system") return `[Info]: ${p.body}`;
  if (p.kind === "roll" && p.data?.roll) return `[Rzut ${who}]: ${rollLine(p.data.roll)}`;
  return `[${who}]: ${p.body}`;
}

function rollLine(r: RollData): string {
  if (r.death) {
    const outcome =
      r.death.outcome === "revived"
        ? "NATURALNA 20 — odzyskuje przytomność z 1 PW"
        : r.death.outcome === "stable"
          ? "3 SUKCESY — postać ustabilizowana, przeżyje (nadal nieprzytomna)"
          : r.death.outcome === "dead"
            ? "3 PORAŻKI — POSTAĆ UMIERA"
            : `sukcesy ${r.death.successes}/3, porażki ${r.death.failures}/3`;
    return `Rzut przeciw śmierci — k20=${r.result} → ${r.success ? "sukces" : "porażka"}${r.result === 1 ? " (naturalna 1 = dwie porażki)" : ""}; ${outcome}${r.auto ? " [rzut automatyczny]" : ""}`;
  }
  const base = `${r.label} — k${r.sides}=${r.result}${r.modifier ? ` ${fmtMod(r.modifier)}` : ""} = ${r.total}`;
  if (r.dc === undefined) return base;
  let s = `${base} vs ST ${r.dc} → ${r.success ? "SUKCES" : "PORAŻKA"}`;
  if (r.result === 20) s += " (naturalna 20!)";
  if (r.result === 1) s += " (naturalna 1!)";
  if (r.damage_result) s += `, zadane obrażenia: ${r.damage_result}`;
  if (r.auto) s += " [rzut automatyczny — gracz nie zdążył]";
  return s;
}

function buildUserPrompt(c: Campaign, chars: Character[], posts: Post[], opening: boolean): string {
  const tone = TONES.find((t) => t.id === c.tone) ?? TONES[0];
  const history = posts.filter((p) => p.round < c.round).slice(-14);
  const current = posts.filter((p) => p.round === c.round && p.kind !== "narration");

  const parts = [
    `KAMPANIA: ${c.title}`,
    `Klimat: ${tone.name} (${tone.hint})`,
    `Pomysł graczy: ${c.premise?.trim() || "(brak — wymyśl coś intrygującego)"}`,
    "",
    `KRONIKA DOTĄD:\n${c.summary?.trim() || "(to początek kampanii)"}`,
    "",
    `OBECNE MIEJSCE: ${c.location ?? "(jeszcze nieustalone)"}`,
    `WROGOWIE W SCENIE: ${c.enemies.length ? JSON.stringify(c.enemies) : "brak"}`,
    "",
    `DRUŻYNA:\n${chars.map(charLine).join("\n")}`,
    `Dostępne umiejętności: ${SKILL_NAMES.map((s) => `${s} (${ABILITY_PL[SKILLS[s]].short})`).join(", ")}`,
  ];

  if (opening) {
    parts.push(
      "",
      "To PIERWSZA scena kampanii. Przedstaw świat i sytuację startową z wyrazistym zaczepieniem fabularnym, wprowadź wszystkie postacie. Nie zlecaj jeszcze testów. location_changed=true."
    );
  } else {
    parts.push(
      "",
      `OSTATNIE WYDARZENIA (chronologicznie):\n${history.map((p) => postLine(p, chars)).join("\n\n") || "(brak)"}`,
      "",
      `TA RUNDA — deklaracje graczy i wyniki rzutów (rozstrzygnij je teraz):\n${
        current.map((p) => postLine(p, chars)).join("\n") || "(nikt nic nie zadeklarował — popchnij fabułę do przodu)"
      }`
    );
  }
  return parts.join("\n");
}

/* ─── Zastosowanie odpowiedzi MG ──────────────────────────────────────────── */

function findChar(chars: Character[], name: string | undefined): Character | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return (
    chars.find((c) => c.name.toLowerCase() === n) ??
    chars.find((c) => c.username.toLowerCase() === n) ??
    chars.find((c) => c.name.toLowerCase().split(/\s+/)[0] === n.split(/\s+/)[0])
  );
}

type HpState = Pick<Character, "hp" | "conditions" | "death_successes" | "death_failures">;

// Zmiana PW z pilnowaniem stanów: spadek do 0 = nieprzytomny, każde leczenie budzi i zeruje rzuty przeciw śmierci
function withHp(c: Character, delta: number): HpState {
  const hp = Math.max(0, Math.min(c.max_hp, c.hp + delta));
  if (hp > 0) {
    return { hp, conditions: c.conditions.filter((x) => x !== UNCONSCIOUS && x !== STABLE), death_successes: 0, death_failures: 0 };
  }
  // Nowe obrażenia przy 0 PW wybijają ze stabilizacji
  const conditions = [...c.conditions.filter((x) => x !== STABLE && x !== UNCONSCIOUS), UNCONSCIOUS];
  return { hp, conditions, death_successes: c.death_successes, death_failures: c.death_failures };
}

const isDead = (c: Character) => c.conditions.includes(DEAD);

async function applyOutput(c: Campaign, chars: Character[], out: GmOutput, newRound: number): Promise<AppliedChange[]> {
  const applied: AppliedChange[] = [];
  // Pracujemy na kopiach, żeby kilka zmian tej samej postaci się sumowało
  const state = new Map(chars.map((ch) => [ch.id, { ...ch }]));
  const touched = new Set<string>();

  for (const atk of out.enemy_attacks ?? []) {
    const t = findChar([...state.values()], atk.target);
    if (!t || isDead(t)) continue;
    const bonus = Math.max(-2, Math.min(12, Math.round(Number(atk.attack_bonus) || 0)));
    const d20 = rollDie(20);
    const hit = d20 === 20 || (d20 !== 1 && d20 + bonus >= t.ac);
    // Trafienie przy wyniku ≥ KP (remis wygrywa atakujący); naturalna 20 trafia zawsze, naturalna 1 zawsze pudłuje
    const nat = d20 === 20 ? ", naturalna 20" : d20 === 1 ? ", naturalna 1" : "";
    const roll = `atak ${d20}${fmtMod(bonus)}=${d20 + bonus} ${hit ? "≥" : "<"} KP ${t.ac}${nat}`;
    if (!hit) {
      applied.push({ character: t.name, text: `${atk.enemy} atakuje (${roll}) — pudło`, tone: "good" });
      continue;
    }
    if (t.hp <= 0) {
      // Trafienie leżącej postaci = porażka rzutu przeciw śmierci (krytyk = dwie)
      const failures = Math.min(DEATH_SAVES_NEEDED, t.death_failures + (d20 === 20 ? 2 : 1));
      t.death_failures = failures;
      t.conditions = t.conditions.filter((x) => x !== STABLE);
      if (failures >= DEATH_SAVES_NEEDED) t.conditions = [...t.conditions.filter((x) => x !== UNCONSCIOUS), DEAD];
      touched.add(t.id);
      applied.push({
        character: t.name,
        text: `${atk.enemy} dobija leżącego (${roll}) — ${failures >= DEATH_SAVES_NEEDED ? "postać ginie" : `porażka przeciw śmierci ${failures}/${DEATH_SAVES_NEEDED}`}`,
        tone: "bad",
      });
      continue;
    }
    const dmgExpr = rollExpr(atk.damage) ? atk.damage.replace(/^[+-]/, "") : "1d4";
    const dmg = rollExpr(dmgExpr)!;
    // Krytyk: kości obrażeń rzucane drugi raz (bez stałej premii)
    const crit = d20 === 20 ? rollExpr(dmgExpr.replace(/[+-]\d+$/, "")) : null;
    const total = Math.abs(dmg.total) + (crit ? Math.abs(crit.total) : 0);
    Object.assign(t, withHp(t, -total));
    touched.add(t.id);
    applied.push({
      character: t.name,
      text: `${atk.enemy} trafia${crit ? " krytycznie" : ""} (${roll}) — obrażenia ${dmg.text}${
        crit ? `, krytyk +${Math.abs(crit.total)}` : ""
      } → −${total} PW`,
      tone: "bad",
    });
  }

  for (const ch of out.changes ?? []) {
    const t = findChar([...state.values()], ch.character);
    if (!t || isDead(t)) continue;
    if (ch.hp) {
      const r = rollExpr(ch.hp);
      if (r && r.total !== 0) {
        const before = t.hp;
        Object.assign(t, withHp(t, r.total));
        touched.add(t.id);
        const diff = t.hp - before;
        applied.push({
          character: t.name,
          text: `${diff >= 0 ? "+" : "−"}${Math.abs(diff)} PW (${r.text})`,
          tone: diff >= 0 ? "good" : "bad",
        });
      }
    }
    if (ch.xp && ch.xp > 0) {
      const xp = Math.min(ch.xp, 2000);
      t.xp += xp;
      touched.add(t.id);
      applied.push({ character: t.name, text: `+${xp} PD`, tone: "good" });
      const lvl = levelForXp(t.xp);
      if (lvl > t.level) {
        const cls = classById(t.class_id)!;
        const gain = hpPerLevel(cls, t.scores) * (lvl - t.level);
        t.level = lvl;
        t.max_hp += gain;
        t.hp += gain;
        applied.push({ character: t.name, text: `Awans na poziom ${lvl}! (+${gain} maks. PW)`, tone: "good" });
      }
    }
    for (const item of ch.items_add ?? []) {
      if (!item.trim()) continue;
      t.inventory = [...t.inventory, item.trim().slice(0, 120)];
      touched.add(t.id);
      applied.push({ character: t.name, text: `Zdobywa: ${item.trim()}`, tone: "good" });
    }
    for (const item of ch.items_remove ?? []) {
      const needle = item.trim().toLowerCase();
      const exact = t.inventory.findIndex((i) => i.toLowerCase() === needle);
      const fuzzy =
        exact >= 0 ? exact : t.inventory.findIndex((i) => i.toLowerCase().includes(needle) || needle.includes(i.toLowerCase()));
      if (fuzzy < 0) continue;
      applied.push({ character: t.name, text: `Traci: ${t.inventory[fuzzy]}`, tone: "neutral" });
      t.inventory = t.inventory.filter((_, i) => i !== fuzzy);
      touched.add(t.id);
    }
    if (Array.isArray(ch.conditions)) {
      // Stanami życia (nieprzytomny / stabilny / martwy) zarządza serwer — AI ich nie zmienia
      const managed = [UNCONSCIOUS, STABLE, DEAD];
      const next = [
        ...ch.conditions.map((x) => x.trim()).filter((x) => x && !managed.includes(x)).slice(0, 8),
        ...t.conditions.filter((x) => managed.includes(x)),
      ];
      if (next.join() !== t.conditions.join()) {
        t.conditions = next;
        touched.add(t.id);
        if (next.length) applied.push({ character: t.name, text: `Stan: ${next.join(", ")}`, tone: "neutral" });
      }
    }
  }

  // Ustabilizowana postać odzyskuje przytomność (1 PW), gdy w scenie nie ma już wrogów
  const combatOver = !(out.enemies ?? []).some((e) => e?.name && Number(e.hp) > 0);
  if (combatOver) {
    for (const t of state.values()) {
      if (t.hp > 0 || isDead(t) || !t.conditions.includes(STABLE)) continue;
      Object.assign(t, withHp(t, 1));
      touched.add(t.id);
      applied.push({ character: t.name, text: "Odzyskuje przytomność (1 PW)", tone: "good" });
    }
  }

  for (const t of state.values()) {
    if (touched.has(t.id) || !t.introduced) {
      await updateCharacter(t.id, {
        hp: t.hp,
        max_hp: t.max_hp,
        xp: t.xp,
        level: t.level,
        inventory: t.inventory,
        conditions: t.conditions,
        death_successes: t.death_successes,
        death_failures: t.death_failures,
        introduced: 1,
      });
    }
  }

  // Testy na następną rundę — modyfikator liczy serwer z karty postaci
  const asked = new Set<string>();
  for (const rr of out.roll_requests ?? []) {
    const t = findChar([...state.values()], rr.character);
    // Postaciom z 0 PW rzuty przeciw śmierci zleca serwer niżej — prośby AI dla nich pomijamy
    if (!t || asked.has(t.id) || t.hp <= 0) continue;
    const ability = (ABILITIES as readonly string[]).includes(rr.ability) ? rr.ability : "DEX";
    const skill = rr.skill && SKILLS[rr.skill] ? rr.skill : null;
    const kind: CheckKind = ["check", "save", "attack"].includes(rr.kind) ? rr.kind : "check";
    const dc = Math.max(5, Math.min(30, Math.round(Number(rr.dc) || 12)));
    const damage = kind === "attack" && rr.damage && rollExpr(rr.damage) ? rr.damage.replace(/\s+/g, "") : null;
    asked.add(t.id);
    await run(
      `INSERT INTO adv_rolls (id, campaign_id, character_id, round, kind, ability, skill, dc, reason, damage, modifier, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid(),
        c.id,
        t.id,
        newRound,
        kind,
        ability,
        skill,
        dc,
        rr.reason?.slice(0, 200) ?? null,
        damage,
        checkModifier(t, kind, ability, skill),
        nowIso(),
      ]
    );
  }

  // Rzut przeciw śmierci co rundę dla każdej leżącej postaci, która nie jest stabilna ani martwa
  for (const t of state.values()) {
    if (t.hp > 0 || isDead(t) || t.conditions.includes(STABLE)) continue;
    await run(
      `INSERT INTO adv_rolls (id, campaign_id, character_id, round, kind, ability, skill, dc, reason, damage, modifier, created_at)
       VALUES (?, ?, ?, ?, 'death', 'CON', NULL, 10, ?, NULL, 0, ?)`,
      [uid(), c.id, t.id, newRound, "Walka o życie: 10 lub więcej to sukces", nowIso()]
    );
  }

  return applied;
}

/* ─── Tura MG ─────────────────────────────────────────────────────────────── */

export type GmTurnResult = { ok: true } | { ok: false; busy?: boolean; error?: string };

export async function runGmTurn(campaignId: string): Promise<GmTurnResult> {
  const now = new Date();
  const claim = await db.execute({
    sql: `UPDATE adv_campaigns SET gm_lock = ?, gm_error = NULL
          WHERE id = ? AND status != 'ended' AND (gm_lock IS NULL OR gm_lock < ?)`,
    args: [now.toISOString(), campaignId, new Date(now.getTime() - LOCK_STALE_MS).toISOString()],
  });
  if (claim.rowsAffected === 0) return { ok: false, busy: true };

  try {
    const c = (await getCampaign(campaignId))!;
    let chars = await listCharacters(campaignId);
    if (!chars.length) throw new GmError("Drużyna jest pusta — stwórzcie najpierw postacie.");
    const opening = c.status === "setup";

    // Gracze, którzy nie zdążyli rzucić, dostają rzut automatyczny — gra nie stoi przez nieobecnych
    if (!opening) {
      for (const r of (await listRolls(c.id, c.round)).filter((r) => r.result === null)) {
        const ch = chars.find((x) => x.id === r.character_id);
        if (ch) await resolveRoll(r, ch, true);
      }
      // Rzut przeciw śmierci zmienia kartę postaci — wczytujemy świeży stan, żeby go nie nadpisać
      chars = await listCharacters(campaignId);
    }

    const posts = await listPosts(c.id, 60);
    const out = await callGemini(SYSTEM, buildUserPrompt(c, chars, posts, opening));
    if (!out?.narration?.trim()) throw new GmError("MG nie napisał narracji — spróbuj ponownie.");

    const newRound = c.round + 1;
    const changes = await applyOutput(c, chars, out, newRound);

    const location = out.location?.trim().slice(0, 80) || c.location;
    const moved = !!location && (opening || out.location_changed || !c.map_image_id) && location !== c.location;
    let mapImage = c.map_image_id;
    let locations = c.locations;
    if (moved) {
      mapImage = await createImage("map", out.map_prompt?.trim() || `fantasy region around ${location}`);
      locations = [...c.locations, { name: location!, image_id: mapImage }].slice(-30);
    }

    const sceneImage = await createImage("scene", out.scene_prompt ?? "");
    await addPost({
      campaign_id: c.id,
      round: newRound,
      author: "gm",
      kind: "narration",
      body: out.narration.trim(),
      image_id: sceneImage,
      data: { changes, location: moved ? location : null },
    });

    const enemies = (out.enemies ?? [])
      .filter((e) => e?.name && Number(e.hp) > 0)
      .slice(0, 12)
      .map((e) => ({
        name: String(e.name).slice(0, 60),
        hp: Math.round(Number(e.hp)),
        max_hp: Math.max(Math.round(Number(e.max_hp) || 1), Math.round(Number(e.hp))),
        ac: Math.round(Number(e.ac) || 12),
        note: e.note ? String(e.note).slice(0, 120) : undefined,
      }));

    await run(
      `UPDATE adv_campaigns SET status = ?, round = ?, round_started_at = ?, summary = ?, location = ?, map_image_id = ?,
         locations = ?, enemies = ?, gm_lock = NULL, gm_error = NULL WHERE id = ?`,
      [
        out.campaign_over ? "ended" : "active",
        newRound,
        nowIso(),
        out.summary?.trim().slice(0, 4000) || c.summary,
        location,
        mapImage,
        JSON.stringify(locations),
        JSON.stringify(enemies),
        c.id,
      ]
    );
    return { ok: true };
  } catch (e) {
    console.error("Tura MG nie powiodła się:", e);
    const msg = e instanceof GmError ? e.message : "Mistrz Gry się zawiesił — spróbuj ponownie.";
    await run(`UPDATE adv_campaigns SET gm_lock = NULL, gm_error = ? WHERE id = ?`, [msg, campaignId]);
    return { ok: false, error: msg };
  }
}

// MG właśnie pisze (blokada świeża) — UI pokazuje „Mistrz Gry pisze…”
export async function isGmBusy(campaignId: string): Promise<boolean> {
  const [r] = await q<{ gm_lock: string | null }>(`SELECT gm_lock FROM adv_campaigns WHERE id = ?`, [campaignId]);
  return !!r?.gm_lock && Date.now() - new Date(r.gm_lock).getTime() < LOCK_STALE_MS;
}
