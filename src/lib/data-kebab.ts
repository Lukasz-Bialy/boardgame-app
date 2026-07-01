import { q, run, uid } from "./db";
import type {
  KebabRestaurant,
  KebabRestaurantWithStats,
  KebabOrder,
  KebabItem,
  KebabOrderWithDetails,
} from "./types";

const nowIso = () => new Date().toISOString();

/* ─── Restauracje ─────────────────────────────────────────────────────────── */

export async function listRestaurants(): Promise<KebabRestaurantWithStats[]> {
  return q<KebabRestaurantWithStats>(`
    SELECT r.*,
      COUNT(DISTINCT o.id) AS order_count,
      ROUND(AVG(i.rating), 1) AS avg_rating,
      COALESCE(SUM(i.price), 0) AS total_spent
    FROM kebab_restaurants r
    LEFT JOIN kebab_orders o ON o.restaurant_id = r.id
    LEFT JOIN kebab_items i ON i.order_id = o.id
    GROUP BY r.id
    ORDER BY avg_rating DESC, order_count DESC, r.name COLLATE NOCASE ASC
  `);
}

export async function createRestaurant(
  input: { name: string; address?: string | null; url?: string | null },
  createdBy: string
): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO kebab_restaurants (id, name, address, url, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.address ?? null, input.url ?? null, createdBy, nowIso()]
  );
  return id;
}

export async function deleteRestaurant(id: string): Promise<void> {
  await run(`DELETE FROM kebab_restaurants WHERE id = ?`, [id]);
}

/* ─── Zamówienia ──────────────────────────────────────────────────────────── */

export async function listOrders(): Promise<KebabOrderWithDetails[]> {
  const orders = await q<KebabOrder & { restaurant_name: string; meeting_title: string | null }>(`
    SELECT o.*, r.name AS restaurant_name, m.title AS meeting_title
    FROM kebab_orders o
    JOIN kebab_restaurants r ON r.id = o.restaurant_id
    LEFT JOIN meetings m ON m.id = o.meeting_id
    ORDER BY o.date DESC, o.created_at DESC
  `);
  if (!orders.length) return [];

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => "?").join(",");

  const [allItems, allSettlements] = await Promise.all([
    q<KebabItem>(`SELECT * FROM kebab_items WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`, orderIds),
    q<{ order_id: string; username: string }>(
      `SELECT order_id, username FROM kebab_settlements WHERE order_id IN (${placeholders})`, orderIds
    ),
  ]);

  return orders.map((o) => ({
    ...o,
    items: allItems.filter((i) => i.order_id === o.id),
    settled_usernames: allSettlements.filter((s) => s.order_id === o.id).map((s) => s.username),
  }));
}

export interface OrderInput {
  restaurant_id: string;
  date: string;
  note?: string | null;
  meeting_id?: string | null;
  delivery_cost?: number;
  paid_by?: string | null;
  items: { username: string; item_name: string; price: number }[];
}

export async function createOrder(input: OrderInput, createdBy: string): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO kebab_orders (id, restaurant_id, meeting_id, date, note, delivery_cost, paid_by, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.restaurant_id, input.meeting_id ?? null, input.date,
      input.note ?? null, input.delivery_cost ?? 0, input.paid_by ?? null,
      createdBy, nowIso(),
    ]
  );
  for (const item of input.items) {
    await run(
      `INSERT INTO kebab_items (id, order_id, username, item_name, price, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [uid(), id, item.username, item.item_name, item.price, nowIso()]
    );
  }
  return id;
}

export async function updateOrderPaidBy(id: string, paidBy: string | null): Promise<void> {
  await run(`UPDATE kebab_orders SET paid_by = ? WHERE id = ?`, [paidBy, id]);
}

export async function settleUser(orderId: string, username: string): Promise<void> {
  await run(
    `INSERT OR REPLACE INTO kebab_settlements (order_id, username, settled_at) VALUES (?, ?, ?)`,
    [orderId, username, nowIso()]
  );
}

export async function unsettleUser(orderId: string, username: string): Promise<void> {
  await run(`DELETE FROM kebab_settlements WHERE order_id = ? AND username = ?`, [orderId, username]);
}

export async function deleteOrder(id: string): Promise<void> {
  await run(`DELETE FROM kebab_orders WHERE id = ?`, [id]);
}

/* ─── Pozycje ─────────────────────────────────────────────────────────────── */

export async function addItem(
  orderId: string,
  input: { username: string; item_name: string; price: number }
): Promise<string> {
  const id = uid();
  await run(
    `INSERT INTO kebab_items (id, order_id, username, item_name, price, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, orderId, input.username, input.item_name, input.price, nowIso()]
  );
  return id;
}

export async function rateItem(
  id: string,
  input: { rating?: number | null; comment?: string | null }
): Promise<void> {
  await run(`UPDATE kebab_items SET rating = ?, comment = ? WHERE id = ?`, [
    input.rating ?? null,
    input.comment ?? null,
    id,
  ]);
}

export async function deleteItem(id: string): Promise<void> {
  await run(`DELETE FROM kebab_items WHERE id = ?`, [id]);
}
