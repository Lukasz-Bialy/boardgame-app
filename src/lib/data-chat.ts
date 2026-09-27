import { q, run } from "./db";
import type { ChatMessage } from "./types";

/** Po ilu sekundach bez sygnału użytkownik przestaje być „aktywny”. */
export const ONLINE_THRESHOLD_SEC = 75;
export const MAX_MESSAGE_LENGTH = 2000;
const PAGE = 50;

const toMessage = (r: ChatMessage): ChatMessage => ({ ...r, id: Number(r.id) });

/** Ostatnie wiadomości (rosnąco po id). */
export async function listRecent(): Promise<ChatMessage[]> {
  const rows = await q<ChatMessage>(`SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?`, [PAGE]);
  return rows.map(toMessage).reverse();
}

/** Wiadomości nowsze niż `afterId` — do odpytywania. */
export async function listAfter(afterId: number): Promise<ChatMessage[]> {
  const rows = await q<ChatMessage>(`SELECT * FROM chat_messages WHERE id > ? ORDER BY id ASC LIMIT 200`, [afterId]);
  return rows.map(toMessage);
}

/** Starsze wiadomości przed `beforeId` — przewijanie historii. */
export async function listBefore(beforeId: number): Promise<ChatMessage[]> {
  const rows = await q<ChatMessage>(`SELECT * FROM chat_messages WHERE id < ? ORDER BY id DESC LIMIT ?`, [beforeId, PAGE]);
  return rows.map(toMessage).reverse();
}

/** Id ostatnich 100 wiadomości — klient usuwa u siebie te z tego zakresu, których już nie ma (usunięte). */
export async function recentIds(): Promise<number[]> {
  const rows = await q<{ id: number }>(`SELECT id FROM chat_messages ORDER BY id DESC LIMIT 100`);
  return rows.map((r) => Number(r.id));
}

export async function addMessage(username: string, body: string): Promise<ChatMessage> {
  const created_at = new Date().toISOString();
  await run(`INSERT INTO chat_messages (username, body, created_at) VALUES (?, ?, ?)`, [username, body, created_at]);
  const [row] = await q<ChatMessage>(
    `SELECT * FROM chat_messages WHERE username = ? AND created_at = ? ORDER BY id DESC LIMIT 1`,
    [username, created_at]
  );
  return toMessage(row);
}

export async function getMessage(id: number): Promise<ChatMessage | null> {
  const [row] = await q<ChatMessage>(`SELECT * FROM chat_messages WHERE id = ?`, [id]);
  return row ? toMessage(row) : null;
}

export async function deleteMessage(id: number): Promise<void> {
  await run(`DELETE FROM chat_messages WHERE id = ?`, [id]);
}

export async function touchPresence(username: string): Promise<void> {
  await run(
    `INSERT INTO presence (username, last_seen) VALUES (?, ?)
     ON CONFLICT(username) DO UPDATE SET last_seen = excluded.last_seen`,
    [username, new Date().toISOString()]
  );
}

export async function listOnline(): Promise<string[]> {
  const since = new Date(Date.now() - ONLINE_THRESHOLD_SEC * 1000).toISOString();
  const rows = await q<{ username: string }>(`SELECT username FROM presence WHERE last_seen >= ?`, [since]);
  return rows.map((r) => r.username);
}
