import { q, run, uid } from "./db";
import type {
  Poll,
  PollOption,
  PollWithResults,
  PollType,
  Meeting,
  MeetingWithPoll,
  WishlistItem,
} from "./types";

const nowIso = () => new Date().toISOString();

function makeToken(): string {
  // Krótki, czytelny token do linku.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/* ───────────────────────── ANKIETY ───────────────────────── */

export async function listPolls(): Promise<(Poll & { totalVoters: number })[]> {
  return q<Poll & { totalVoters: number }>(`
    SELECT p.*,
      (SELECT COUNT(DISTINCT voter) FROM poll_votes v WHERE v.poll_id = p.id) AS totalVoters
    FROM polls p
    ORDER BY p.created_at DESC
  `);
}

export interface PollInput {
  title: string;
  type: PollType;
  month?: string | null;
  options: { label: string; game_id?: string | null; date_value?: string | null }[];
}

export async function createPoll(input: PollInput, createdBy: string): Promise<string> {
  const id = uid();
  const token = makeToken();
  await run(
    `INSERT INTO polls (id, token, title, type, month, is_open, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, token, input.title, input.type, input.month ?? null, createdBy, nowIso()]
  );
  let sort = 0;
  for (const opt of input.options) {
    await run(
      `INSERT INTO poll_options (id, poll_id, label, game_id, date_value, sort) VALUES (?, ?, ?, ?, ?, ?)`,
      [uid(), id, opt.label, opt.game_id ?? null, opt.date_value ?? null, sort++]
    );
  }
  return token;
}

export async function getPollByToken(
  token: string,
  viewer: string
): Promise<PollWithResults | null> {
  const polls = await q<Poll>(`SELECT * FROM polls WHERE token = ?`, [token]);
  const poll = polls[0];
  if (!poll) return null;

  const options = await q<PollOption>(
    `SELECT * FROM poll_options WHERE poll_id = ? ORDER BY sort ASC`,
    [poll.id]
  );
  const votes = await q<{ option_id: string; voter: string }>(
    `SELECT option_id, voter FROM poll_votes WHERE poll_id = ?`,
    [poll.id]
  );

  const distinctVoters = new Set(votes.map((v) => v.voter));
  const myVotes = votes.filter((v) => v.voter === viewer).map((v) => v.option_id);

  return {
    ...poll,
    totalVoters: distinctVoters.size,
    myVotes,
    options: options.map((o) => {
      const optVotes = votes.filter((v) => v.option_id === o.id);
      return {
        ...o,
        votes: optVotes.length,
        voters: optVotes.map((v) => v.voter),
      };
    }),
  };
}

export async function setVotes(token: string, optionIds: string[], voter: string): Promise<boolean> {
  const polls = await q<Poll>(`SELECT * FROM polls WHERE token = ?`, [token]);
  const poll = polls[0];
  if (!poll || poll.is_open !== 1) return false;

  // Walidacja: opcje muszą należeć do tej ankiety.
  const valid = await q<{ id: string }>(`SELECT id FROM poll_options WHERE poll_id = ?`, [poll.id]);
  const validIds = new Set(valid.map((v) => v.id));
  const chosen = optionIds.filter((id) => validIds.has(id));

  // Zamień głosy użytkownika (głosowanie wielokrotne — checkboxy).
  await run(`DELETE FROM poll_votes WHERE poll_id = ? AND voter = ?`, [poll.id, voter]);
  for (const optionId of chosen) {
    await run(
      `INSERT INTO poll_votes (id, poll_id, option_id, voter, created_at) VALUES (?, ?, ?, ?, ?)`,
      [uid(), poll.id, optionId, voter, nowIso()]
    );
  }
  return true;
}

export async function setPollOpen(token: string, open: boolean): Promise<void> {
  await run(`UPDATE polls SET is_open = ? WHERE token = ?`, [open ? 1 : 0, token]);
}

export async function deletePoll(token: string): Promise<void> {
  await run(`DELETE FROM polls WHERE token = ?`, [token]);
}

/* ───────────────────────── KALENDARZ ───────────────────────── */

export async function listMeetings(): Promise<MeetingWithPoll[]> {
  return q<MeetingWithPoll>(`
    SELECT m.*, p.title AS poll_title, p.is_open AS poll_is_open
    FROM meetings m
    LEFT JOIN polls p ON m.poll_token = p.token
    ORDER BY m.date ASC
  `);
}

export async function createMeeting(
  input: { date: string; title: string; note?: string | null; poll_token?: string | null },
  createdBy: string
): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO meetings (id, date, title, note, poll_token, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.date, input.title, input.note ?? null, input.poll_token ?? null, createdBy, nowIso()]
  );
  return id;
}

export async function linkMeetingPoll(meetingId: string, pollToken: string | null): Promise<void> {
  await run(`UPDATE meetings SET poll_token = ? WHERE id = ?`, [pollToken, meetingId]);
}

export async function getMeetingByPollToken(pollToken: string): Promise<Meeting | null> {
  const rows = await q<Meeting>(`SELECT * FROM meetings WHERE poll_token = ? LIMIT 1`, [pollToken]);
  return rows[0] ?? null;
}

export async function deleteMeeting(id: string): Promise<void> {
  await run(`DELETE FROM meetings WHERE id = ?`, [id]);
}

/* ───────────────────────── WISHLISTA ───────────────────────── */

export async function listWishlist(): Promise<WishlistItem[]> {
  return q<WishlistItem>(`SELECT * FROM wishlist ORDER BY created_at DESC`);
}

export async function addWishlist(
  input: { name: string; url?: string | null; image_url?: string | null; note?: string | null },
  addedBy: string
): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO wishlist (id, name, url, image_url, note, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.url ?? null, input.image_url ?? null, input.note ?? null, addedBy, nowIso()]
  );
  return id;
}

export async function deleteWishlist(id: string): Promise<void> {
  await run(`DELETE FROM wishlist WHERE id = ?`, [id]);
}
