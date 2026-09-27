import { randomInt } from "crypto";
import { q, run, uid } from "./db";
import type { GiftDraw, GiftDrawForUser, GiftPair } from "./types";

const nowIso = () => new Date().toISOString();

/**
 * Losowy nieporządek (derangement): nikt nie losuje samego siebie.
 * Tasowanie Fishera-Yatesa na kryptograficznym RNG, powtarzane aż do braku punktów stałych
 * (średnio ~2,7 próby) — daje rozkład jednostajny po wszystkich poprawnych przydziałach.
 */
function drawPairs(participants: string[]): GiftPair[] {
  for (;;) {
    const receivers = [...participants];
    for (let i = receivers.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
    }
    if (receivers.every((r, i) => r !== participants[i])) {
      return participants.map((giver, i) => ({ giver, receiver: receivers[i] }));
    }
  }
}

async function savePairs(drawId: string, pairs: GiftPair[]): Promise<void> {
  await run(`DELETE FROM gift_pairs WHERE draw_id = ?`, [drawId]);
  for (const p of pairs) {
    await run(`INSERT INTO gift_pairs (draw_id, giver, receiver) VALUES (?, ?, ?)`, [drawId, p.giver, p.receiver]);
  }
}

/** Zwraca losowania z perspektywy użytkownika — wyłącznie jego własny wynik. */
export async function listDrawsForUser(username: string): Promise<GiftDrawForUser[]> {
  const draws = await q<GiftDraw>(`SELECT * FROM gift_draws ORDER BY created_at DESC`);
  if (!draws.length) return [];

  const [givers, mine] = await Promise.all([
    q<{ draw_id: string; giver: string }>(`SELECT draw_id, giver FROM gift_pairs ORDER BY giver`),
    q<{ draw_id: string; receiver: string }>(`SELECT draw_id, receiver FROM gift_pairs WHERE giver = ?`, [username]),
  ]);

  return draws.map((d) => ({
    ...d,
    participants: givers.filter((g) => g.draw_id === d.id).map((g) => g.giver),
    my_receiver: mine.find((m) => m.draw_id === d.id)?.receiver ?? null,
  }));
}

/** Pełna lista par — tylko dla panelu administratora. */
export async function listPairs(drawId: string): Promise<GiftPair[]> {
  return q<GiftPair>(`SELECT giver, receiver FROM gift_pairs WHERE draw_id = ? ORDER BY giver`, [drawId]);
}

export async function createDraw(
  input: { title: string; budget: number | null; note: string | null; participants: string[] },
  createdBy: string
): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO gift_draws (id, title, budget, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.title, input.budget, input.note, createdBy, nowIso()]
  );
  await savePairs(id, drawPairs(input.participants));
  return id;
}

/** Losuje ponownie wśród tych samych uczestników. */
export async function redraw(drawId: string): Promise<void> {
  const participants = (await listPairs(drawId)).map((p) => p.giver);
  await savePairs(drawId, drawPairs(participants));
}

export async function deleteDraw(id: string): Promise<void> {
  await run(`DELETE FROM gift_pairs WHERE draw_id = ?`, [id]);
  await run(`DELETE FROM gift_draws WHERE id = ?`, [id]);
}
