import { db, ensureInit, q, run, uid } from "../db";
import {
  applyRace,
  armorClass,
  classById,
  raceById,
  startingHp,
  ABILITIES,
  STANDARD_ARRAY,
  type Scores,
} from "./rules";
import { createImage } from "./images";
import type { Campaign, CampaignListItem, Character, Post, PostKind, Roll } from "./types";

const nowIso = () => new Date().toISOString();

const parse = <T,>(s: unknown, fallback: T): T => {
  if (typeof s !== "string") return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

type Row = Record<string, unknown>;

function toCampaign(r: Row): Campaign {
  return { ...(r as unknown as Campaign), locations: parse(r.locations, []), enemies: parse(r.enemies, []) };
}

function toCharacter(r: Row): Character {
  return {
    ...(r as unknown as Character),
    scores: parse(r.scores, {} as Scores),
    inventory: parse(r.inventory, []),
    conditions: parse(r.conditions, []),
  };
}

function toPost(r: Row): Post {
  return { ...(r as unknown as Post), data: parse(r.data, null) };
}

/* ─── Kampanie ────────────────────────────────────────────────────────────── */

export async function listCampaigns(): Promise<CampaignListItem[]> {
  const rows = await q(`
    SELECT c.*,
      (SELECT MAX(created_at) FROM adv_posts p WHERE p.campaign_id = c.id) AS last_post_at,
      (SELECT COUNT(*) FROM adv_posts p WHERE p.campaign_id = c.id) AS post_count,
      (SELECT image_id FROM adv_posts p WHERE p.campaign_id = c.id AND image_id IS NOT NULL ORDER BY id DESC LIMIT 1) AS cover_image_id
    FROM adv_campaigns c
    ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'setup' THEN 1 ELSE 2 END, c.created_at DESC
  `);
  const chars = await q<{ campaign_id: string; username: string; name: string; portrait_image_id: string | null; class_id: string; race_id: string }>(
    `SELECT campaign_id, username, name, portrait_image_id, class_id, race_id FROM adv_characters ORDER BY created_at`
  );
  return rows.map((r) => ({
    ...toCampaign(r),
    last_post_at: (r.last_post_at as string) ?? null,
    post_count: Number(r.post_count ?? 0),
    cover_image_id: (r.cover_image_id as string) ?? null,
    party: chars.filter((c) => c.campaign_id === r.id),
  }));
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const [r] = await q(`SELECT * FROM adv_campaigns WHERE id = ?`, [id]);
  return r ? toCampaign(r) : null;
}

export async function createCampaign(
  input: { title: string; premise: string | null; tone: string },
  createdBy: string
): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO adv_campaigns (id, title, premise, tone, status, created_by, created_at) VALUES (?, ?, ?, ?, 'setup', ?, ?)`,
    [id, input.title, input.premise, input.tone, createdBy, nowIso()]
  );
  return id;
}

// Całkowite usunięcie przygody: obrazki (sceny, portrety, mapy wszystkich odwiedzonych miejsc), rzuty, posty,
// postacie i sama kampania. Jawnie, w jednej transakcji — nie polegamy na ON DELETE CASCADE, bo PRAGMA foreign_keys
// nie musi obowiązywać na każdym połączeniu (Turso przez HTTP).
export async function deleteCampaign(id: string): Promise<void> {
  const c = await getCampaign(id);
  if (!c) return;
  const imgRows = await q<{ id: string }>(
    `SELECT image_id AS id FROM adv_posts WHERE campaign_id = ? AND image_id IS NOT NULL
     UNION SELECT portrait_image_id FROM adv_characters WHERE campaign_id = ? AND portrait_image_id IS NOT NULL`,
    [id, id]
  );
  const images = [
    ...new Set([...imgRows.map((r) => r.id), c.map_image_id, ...c.locations.map((l) => l.image_id)].filter(Boolean)),
  ] as string[];

  await ensureInit();
  await db.batch(
    [
      ...(images.length
        ? [{ sql: `DELETE FROM adv_images WHERE id IN (${images.map(() => "?").join(",")})`, args: images }]
        : []),
      { sql: `DELETE FROM adv_rolls WHERE campaign_id = ?`, args: [id] },
      { sql: `DELETE FROM adv_posts WHERE campaign_id = ?`, args: [id] },
      { sql: `DELETE FROM adv_characters WHERE campaign_id = ?`, args: [id] },
      { sql: `DELETE FROM adv_campaigns WHERE id = ?`, args: [id] },
    ],
    "write"
  );
}

export async function setCampaignStatus(id: string, status: Campaign["status"]): Promise<void> {
  await run(`UPDATE adv_campaigns SET status = ? WHERE id = ?`, [status, id]);
}

/* ─── Postacie ────────────────────────────────────────────────────────────── */

export async function listCharacters(campaignId: string): Promise<Character[]> {
  const rows = await q(`SELECT * FROM adv_characters WHERE campaign_id = ? ORDER BY created_at`, [campaignId]);
  return rows.map(toCharacter);
}

export async function getCharacter(id: string): Promise<Character | null> {
  const [r] = await q(`SELECT * FROM adv_characters WHERE id = ?`, [id]);
  return r ? toCharacter(r) : null;
}

export interface CharacterInput {
  name: string;
  race_id: string;
  class_id: string;
  base: Scores; // przed premiami rasowymi — musi być permutacją standardowego zestawu
  look: string | null;
  backstory: string | null;
}

export function validateCharacter(input: CharacterInput): string | null {
  if (!input.name?.trim()) return "Podaj imię postaci";
  if (!raceById(input.race_id)) return "Wybierz rasę";
  if (!classById(input.class_id)) return "Wybierz klasę";
  const vals = ABILITIES.map((a) => Number(input.base?.[a])).sort((a, b) => b - a);
  if (vals.join() !== STANDARD_ARRAY.join()) return "Cechy muszą wykorzystać zestaw 15, 14, 13, 12, 10, 8";
  return null;
}

export function portraitPrompt(input: { name: string; race_id: string; class_id: string; look: string | null }): string {
  const race = raceById(input.race_id)!;
  const cls = classById(input.class_id)!;
  return `${race.en} ${cls.en}${input.look ? `, ${input.look}` : ""}`;
}

export async function createCharacter(campaignId: string, username: string, input: CharacterInput): Promise<string> {
  const race = raceById(input.race_id)!;
  const cls = classById(input.class_id)!;
  const scores = applyRace(input.base, race);
  const hp = startingHp(cls, scores);
  const id = uid();
  const portrait = await createImage("portrait", portraitPrompt(input));
  await run(
    `INSERT INTO adv_characters (id, campaign_id, username, name, race_id, class_id, scores, hp, max_hp, ac, inventory,
       look, backstory, portrait_image_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      campaignId,
      username,
      input.name.trim().slice(0, 60),
      race.id,
      cls.id,
      JSON.stringify(scores),
      hp,
      hp,
      armorClass(cls, scores),
      JSON.stringify(cls.inventory),
      input.look?.trim().slice(0, 300) || null,
      input.backstory?.trim().slice(0, 1500) || null,
      portrait,
      nowIso(),
    ]
  );
  return id;
}

export async function updateCharacter(
  id: string,
  patch: Partial<Pick<
    Character,
    "hp" | "max_hp" | "xp" | "level" | "inventory" | "conditions" | "introduced" | "portrait_image_id" | "look" | "backstory" | "death_successes" | "death_failures"
  >>
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = ?`);
    args.push(Array.isArray(v) ? JSON.stringify(v) : (v as string | number | null));
  }
  if (!sets.length) return;
  await run(`UPDATE adv_characters SET ${sets.join(", ")} WHERE id = ?`, [...args, id]);
}

export async function deleteCharacter(id: string): Promise<void> {
  const ch = await getCharacter(id);
  if (ch?.portrait_image_id) await run(`DELETE FROM adv_images WHERE id = ?`, [ch.portrait_image_id]);
  await run(`DELETE FROM adv_characters WHERE id = ?`, [id]);
}

/* ─── Posty i rzuty ───────────────────────────────────────────────────────── */

export async function listPosts(campaignId: string, limit = 400): Promise<Post[]> {
  const rows = await q(
    `SELECT * FROM (SELECT * FROM adv_posts WHERE campaign_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC`,
    [campaignId, limit]
  );
  return rows.map(toPost);
}

export async function addPost(p: {
  campaign_id: string;
  round: number;
  author: string;
  kind: PostKind;
  body: string;
  image_id?: string | null;
  data?: unknown;
}): Promise<void> {
  await run(
    `INSERT INTO adv_posts (campaign_id, round, author, kind, body, image_id, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.campaign_id, p.round, p.author, p.kind, p.body, p.image_id ?? null, p.data ? JSON.stringify(p.data) : null, nowIso()]
  );
}

export async function lastPostId(campaignId: string): Promise<number> {
  const [r] = await q<{ id: number | null }>(`SELECT MAX(id) AS id FROM adv_posts WHERE campaign_id = ?`, [campaignId]);
  return Number(r?.id ?? 0);
}

export async function listRolls(campaignId: string, round: number): Promise<Roll[]> {
  return q<Roll>(`SELECT * FROM adv_rolls WHERE campaign_id = ? AND round = ? ORDER BY created_at`, [campaignId, round]);
}

export async function getRoll(id: string): Promise<Roll | null> {
  const [r] = await q<Roll>(`SELECT * FROM adv_rolls WHERE id = ?`, [id]);
  return r ?? null;
}

/* ─── Postęp rundy ────────────────────────────────────────────────────────── */

export interface RoundProgress {
  acted: string[]; // usernames, które coś napisały w tej rundzie
  waitingFor: string[]; // postacie bez akcji albo z nierzuconym testem
  pendingRolls: number;
  contributions: number;
  allDone: boolean;
  deadlinePassed: boolean;
}

export const ROUND_DEADLINE_H = 24;

export function roundProgress(campaign: Campaign, chars: Character[], posts: Post[], rolls: Roll[]): RoundProgress {
  const inRound = posts.filter((p) => p.round === campaign.round && (p.kind === "action" || p.kind === "roll"));
  const acted = [...new Set(inRound.filter((p) => p.kind === "action").map((p) => p.author))];
  const pending = rolls.filter((r) => r.result === null);
  // Postać z 0 PW nie działa — czekamy tylko na jej rzut przeciw śmierci (jeśli jest)
  const waitingFor = chars
    .filter((c) => (c.hp > 0 && !acted.includes(c.username)) || pending.some((r) => r.character_id === c.id))
    .map((c) => c.username);
  const started = campaign.round_started_at ? new Date(campaign.round_started_at).getTime() : Date.now();
  return {
    acted,
    waitingFor,
    pendingRolls: pending.length,
    contributions: inRound.length,
    allDone: chars.length > 0 && waitingFor.length === 0,
    deadlinePassed: Date.now() - started > ROUND_DEADLINE_H * 3600_000,
  };
}
