"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UtensilsCrossed, Plus, Star, CalendarDays, Trash2, Check, X,
  ChevronDown, ChevronUp, ExternalLink, Package, TrendingUp, ArrowRight, Pencil,
} from "lucide-react";
import Modal from "@/components/Modal";
import DeleteButton from "@/components/DeleteButton";
import { Avatar, formatDate } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import { api } from "@/lib/client";
import type { KebabOrderWithDetails, KebabRestaurantWithStats } from "@/lib/types";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function pln(grosz: number): string {
  return (grosz / 100).toFixed(2).replace(".", ",") + " zł";
}

function parsePLN(val: string): number {
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100);
}

type Player = { username: string; displayName: string };
type MeetingLite = { id: string; date: string; title: string };

const WEEKDAYS = ["ndz", "pon", "wt", "śr", "czw", "pt", "sob"];

/* ─── StarPicker ──────────────────────────────────────────────────────────── */

function StarPicker({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 disabled:cursor-default"
        >
          <Star
            size={16}
            className={s <= (hovered || value) ? "text-gold fill-gold" : "text-muted"}
          />
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={13} className={s <= value ? "text-gold fill-gold" : "text-muted/40"} />
      ))}
    </div>
  );
}

/* ─── Settlement calculator ───────────────────────────────────────────────── */

function DebtCalculator({ order }: { order: KebabOrderWithDetails }) {
  const router = useRouter();
  const participants = [...new Set(order.items.map((i) => i.username))];
  const n = participants.length;
  const deliveryPerPerson = n > 0 ? order.delivery_cost / n : 0;

  const rows = participants.map((u) => {
    const foodTotal = order.items.filter((i) => i.username === u).reduce((s, i) => s + i.price, 0);
    const total = foodTotal + deliveryPerPerson;
    const isCreditor = order.paid_by === u;
    const isSettled = order.settled_usernames.includes(u);
    return { username: u, foodTotal, total, isCreditor, isSettled };
  });

  async function settle(username: string) {
    await api(`/api/kebab/orders/${order.id}`, "PATCH", { settle: username });
    router.refresh();
  }
  async function unsettle(username: string) {
    await api(`/api/kebab/orders/${order.id}`, "PATCH", { unsettle: username });
    router.refresh();
  }

  const grandTotal = order.items.reduce((s, i) => s + i.price, 0) + order.delivery_cost;
  const outstanding = rows.filter((r) => !r.isCreditor && !r.isSettled).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Rozliczenie</span>
        {order.delivery_cost > 0 && (
          <span className="chip text-muted">
            Dostawa: {pln(order.delivery_cost)} ({n > 0 ? pln(Math.round(deliveryPerPerson)) : "—"}/os.)
          </span>
        )}
        {outstanding === 0 && order.paid_by && (
          <span className="ml-auto chip text-felt">Wszystko rozliczone</span>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.username} className={r.isSettled || r.isCreditor ? "opacity-60" : ""}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar username={r.username} size={24} />
                    <span className="font-medium text-cream">{displayNameOf(r.username)}</span>
                    {r.isCreditor && (
                      <span className="chip text-gold text-[10px]">zapłacił</span>
                    )}
                    {r.isSettled && !r.isCreditor && (
                      <span className="chip text-felt text-[10px]">rozliczono</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {order.delivery_cost > 0 ? (
                    <span className="text-xs text-muted">
                      {pln(r.foodTotal)} + {pln(Math.round(deliveryPerPerson))} ={" "}
                      <span className="text-cream font-semibold">{pln(Math.round(r.total))}</span>
                    </span>
                  ) : (
                    <span className="font-semibold text-cream">{pln(r.foodTotal)}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {order.paid_by && !r.isCreditor && (
                    r.isSettled ? (
                      <button
                        onClick={() => unsettle(r.username)}
                        className="text-xs text-muted hover:text-danger transition"
                        title="Cofnij rozliczenie"
                      >
                        <X size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={() => settle(r.username)}
                        className="btn-ghost py-1 px-2 text-xs gap-1"
                      >
                        <Check size={12} /> Rozlicz
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-panel2/50">
              <td className="px-3 py-2 text-xs font-medium text-muted" colSpan={2}>
                Suma całkowita
              </td>
              <td className="px-3 py-2 text-right font-mono font-bold text-cream">
                {pln(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ─── RatingSection ───────────────────────────────────────────────────────── */

function RatingSection({
  order,
  currentUser,
}: {
  order: KebabOrderWithDetails;
  currentUser: string;
}) {
  const router = useRouter();
  const myItems = order.items.filter((i) => i.username === currentUser);
  const [ratings, setRatings] = useState<Record<string, number>>(
    Object.fromEntries(myItems.map((i) => [i.id, i.rating ?? 0]))
  );
  const [comments, setComments] = useState<Record<string, string>>(
    Object.fromEntries(myItems.map((i) => [i.id, i.comment ?? ""]))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function save(itemId: string) {
    setSaving((s) => ({ ...s, [itemId]: true }));
    await api(`/api/kebab/items/${itemId}`, "PATCH", {
      rating: ratings[itemId] || null,
      comment: comments[itemId]?.trim() || null,
    });
    setSaving((s) => ({ ...s, [itemId]: false }));
    router.refresh();
  }

  if (!myItems.length) return null;

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">Twoja ocena</span>
      {myItems.map((item) => (
        <div key={item.id} className="rounded-xl border border-line bg-panel2/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-cream">{item.item_name}</span>
            <span className="text-xs font-mono text-muted">{pln(item.price)}</span>
          </div>
          <StarPicker
            value={ratings[item.id] ?? 0}
            onChange={(v) => setRatings((r) => ({ ...r, [item.id]: v }))}
          />
          <input
            className="input py-1.5 text-xs"
            placeholder="Komentarz (opcjonalnie)…"
            value={comments[item.id] ?? ""}
            onChange={(e) => setComments((c) => ({ ...c, [item.id]: e.target.value }))}
          />
          <button
            onClick={() => save(item.id)}
            disabled={saving[item.id]}
            className="btn-primary py-1 px-3 text-xs"
          >
            {saving[item.id] ? "Zapisywanie…" : "Zapisz ocenę"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── OrderCard ───────────────────────────────────────────────────────────── */

function OrderCard({
  order,
  players,
  restaurants,
  meetings,
  currentUser,
  highlighted = false,
}: {
  order: KebabOrderWithDetails;
  players: Player[];
  restaurants: KebabRestaurantWithStats[];
  meetings: MeetingLite[];
  currentUser: string;
  highlighted?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (highlighted) setExpanded(true);
  }, [highlighted]);
  const [paidBy, setPaidBy] = useState(order.paid_by ?? "");
  const [savingPayer, setSavingPayer] = useState(false);

  useEffect(() => {
    setPaidBy(order.paid_by ?? "");
  }, [order.paid_by]);

  const d = new Date(order.date + "T00:00:00");
  const hasRatings = order.items.some((i) => i.rating !== null);

  async function savePaidBy() {
    setSavingPayer(true);
    await api(`/api/kebab/orders/${order.id}`, "PATCH", { paid_by: paidBy || null });
    setSavingPayer(false);
    router.refresh();
  }

  const participants = [...new Set(order.items.map((i) => i.username))];

  return (
    <div
      id={`order-${order.id}`}
      className={`panel overflow-hidden transition-all duration-500 ${
        highlighted ? "ring-2 ring-felt/50 shadow-glow-felt" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-panel2 py-1">
          <span className="font-mono text-lg font-bold leading-none text-felt">{d.getDate()}</span>
          <span className="text-[10px] uppercase text-muted">{WEEKDAYS[d.getDay()]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-cream truncate">{order.restaurant_name}</p>
          {order.meeting_title && (
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1 text-xs text-gold/80 hover:text-gold transition"
            >
              <CalendarDays size={11} /> {order.meeting_title}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasRatings && (
            <span className="inline-flex items-center gap-1 text-xs text-gold font-mono">
              <Star size={12} fill="currentColor" />
              {(order.items.filter((i) => i.rating).reduce((s, i) => s + (i.rating ?? 0), 0) /
                order.items.filter((i) => i.rating).length).toFixed(1)}
            </span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-muted hover:text-cream transition"
            title="Edytuj zamówienie"
          >
            <Pencil size={15} />
          </button>
          <DeleteButton
            url={`/api/kebab/orders/${order.id}`}
            confirmText={`Usunąć zamówienie z ${order.restaurant_name}?`}
            iconOnly
          />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-muted hover:text-cream transition"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Pozycje */}
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-panel2/50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Osoba</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Zamówienie</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted">Cena</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Avatar username={item.username} size={22} />
                        <span className="text-cream">{displayNameOf(item.username)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      <div>{item.item_name}</div>
                      {item.rating && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <StarDisplay value={item.rating} />
                          {item.comment && (
                            <span className="text-xs text-muted italic">„{item.comment}"</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-cream">{pln(item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kto zapłacił */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted">Zapłacił(a):</span>
            <select
              className="input py-1 text-xs flex-1 max-w-[180px]"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
              <option value="">— nie ustalono —</option>
              {participants.map((u) => (
                <option key={u} value={u}>{displayNameOf(u)}</option>
              ))}
            </select>
            {paidBy !== (order.paid_by ?? "") && (
              <button onClick={savePaidBy} disabled={savingPayer} className="btn-primary py-1 px-3 text-xs">
                {savingPayer ? "…" : "Zapisz"}
              </button>
            )}
          </div>

          {/* Kalkulator rozliczenia */}
          <DebtCalculator order={order} />

          {/* Notatka */}
          {order.note && (
            <p className="text-xs text-muted italic border-l-2 border-line pl-3">{order.note}</p>
          )}

          {/* Ocena własnych pozycji */}
          <RatingSection key={order.items.map((i) => i.id).join(",")} order={order} currentUser={currentUser} />
        </div>
      )}

      {editing && (
        <OrderFormModal
          restaurants={restaurants}
          players={players}
          meetings={meetings}
          order={order}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/* ─── NewOrderModal ───────────────────────────────────────────────────────── */

type ItemRow = { id?: string; username: string; item_name: string; price_str: string };

function priceStr(grosz: number): string {
  return (grosz / 100).toFixed(2).replace(".", ",");
}

function OrderFormModal({
  restaurants,
  players,
  meetings,
  order,
  onClose,
}: {
  restaurants: KebabRestaurantWithStats[];
  players: Player[];
  meetings: MeetingLite[];
  order?: KebabOrderWithDetails;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = !!order;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [restaurantId, setRestaurantId] = useState(order?.restaurant_id ?? restaurants[0]?.id ?? "");
  const [newRestName, setNewRestName] = useState("");
  const [showNewRest, setShowNewRest] = useState(restaurants.length === 0);
  const [date, setDate] = useState(order?.date ?? today);
  const [meetingId, setMeetingId] = useState(order?.meeting_id ?? "");
  const [delivery, setDelivery] = useState(order ? priceStr(order.delivery_cost) : "0");
  const [note, setNote] = useState(order?.note ?? "");
  const [paidBy, setPaidBy] = useState(order?.paid_by ?? "");
  const [items, setItems] = useState<ItemRow[]>(
    order
      ? order.items.map((i) => ({ id: i.id, username: i.username, item_name: i.item_name, price_str: priceStr(i.price) }))
      : [{ username: players[0]?.username ?? "", item_name: "", price_str: "" }]
  );

  function addRow() {
    setItems((r) => [...r, { username: players[0]?.username ?? "", item_name: "", price_str: "" }]);
  }
  function removeRow(i: number) {
    setItems((r) => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, field: keyof ItemRow, val: string) {
    setItems((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  async function save() {
    setError("");
    let rid = restaurantId;

    if (showNewRest || !rid) {
      if (!newRestName.trim()) { setError("Podaj nazwę restauracji"); return; }
      const res = await api("/api/kebab/restaurants", "POST", { name: newRestName.trim() });
      if (!res.ok) { setError(res.error!); return; }
      rid = res.data.id;
    }

    const parsedItems = items.map((row) => ({
      id: row.id,
      username: row.username,
      item_name: row.item_name.trim(),
      price: parsePLN(row.price_str),
    }));

    if (!date) { setError("Podaj datę zamówienia"); return; }
    if (parsedItems.some((i) => !i.username || !i.item_name || i.price === 0)) {
      setError("Wypełnij wszystkie pozycje (osoba, nazwa, cena > 0)");
      return;
    }

    setSaving(true);
    const payload = {
      restaurant_id: rid,
      date,
      note: note.trim() || null,
      meeting_id: meetingId || null,
      delivery_cost: parsePLN(delivery),
      paid_by: paidBy || null,
      items: parsedItems,
    };
    const res = order
      ? await api(`/api/kebab/orders/${order.id}`, "PUT", payload)
      : await api("/api/kebab/orders", "POST", payload);
    setSaving(false);
    if (!res.ok) { setError(res.error!); return; }
    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edytuj zamówienie" : "Nowe zamówienie"} wide>
      <div className="space-y-4">
        {/* Restauracja */}
        <div>
          <label className="label">Restauracja</label>
          {!showNewRest ? (
            <div className="flex gap-2">
              <select className="input flex-1" value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewRest(true)} className="btn-ghost shrink-0 text-xs">
                <Plus size={14} /> Nowa
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Nazwa restauracji"
                value={newRestName}
                onChange={(e) => setNewRestName(e.target.value)}
                autoFocus
              />
              {restaurants.length > 0 && (
                <button type="button" onClick={() => setShowNewRest(false)} className="btn-ghost shrink-0 text-xs">
                  Wybierz istniejącą
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Koszt dostawy (zł)</label>
            <input
              className="input"
              placeholder="0,00"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
          </div>
        </div>

        {(meetings.length > 0 || order?.meeting_id) && (
          <div>
            <label className="label">Powiąż ze spotkaniem (opcjonalnie)</label>
            <select className="input" value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
              <option value="">— brak —</option>
              {order?.meeting_id && !meetings.some((m) => m.id === order.meeting_id) && (
                <option value={order.meeting_id}>{order.meeting_title ?? "Powiązane spotkanie"}</option>
              )}
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.date} — {m.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Pozycje */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Pozycje</label>
            <button type="button" onClick={addRow} className="btn-ghost py-1 px-2 text-xs gap-1">
              <Plus size={13} /> Dodaj pozycję
            </button>
          </div>
          <div className="space-y-2">
            {items.map((row, i) => (
              <div key={i} className="grid grid-cols-[140px_1fr_90px_32px] gap-2 items-center">
                <select
                  className="input text-xs py-1.5"
                  value={row.username}
                  onChange={(e) => updateRow(i, "username", e.target.value)}
                >
                  {players.map((p) => (
                    <option key={p.username} value={p.username}>{p.displayName}</option>
                  ))}
                </select>
                <input
                  className="input text-xs py-1.5"
                  placeholder="Co zamówił…"
                  value={row.item_name}
                  onChange={(e) => updateRow(i, "item_name", e.target.value)}
                />
                <input
                  className="input text-xs py-1.5"
                  placeholder="Cena zł"
                  value={row.price_str}
                  onChange={(e) => updateRow(i, "price_str", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={items.length === 1}
                  className="rounded-lg p-1.5 text-muted hover:text-danger transition disabled:opacity-30"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Kto zapłacił (opcjonalnie)</label>
          <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            <option value="">— nie ustalono —</option>
            {players.map((p) => (
              <option key={p.username} value={p.username}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Notatka (opcjonalnie)</label>
          <input className="input" placeholder="np. Dodatkowe sosy, zniżka…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Anuluj</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {isEdit
              ? (saving ? "Zapisywanie…" : "Zapisz zmiany")
              : (saving ? "Tworzenie…" : "Utwórz zamówienie")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── RestaurantOrderRow ──────────────────────────────────────────────────── */

function RestaurantOrderRow({
  order,
  onSelect,
}: {
  order: KebabOrderWithDetails;
  onSelect: () => void;
}) {
  const d = new Date(order.date + "T12:00:00");
  const participants = [...new Set(order.items.map((i) => i.username))];
  const totalWithDelivery =
    order.items.reduce((s, i) => s + i.price, 0) + order.delivery_cost;
  const ratedItems = order.items.filter((i) => i.rating !== null);
  const avgRating =
    ratedItems.length > 0
      ? (
          ratedItems.reduce((s, i) => s + (i.rating ?? 0), 0) / ratedItems.length
        ).toFixed(1)
      : null;

  return (
    <div
      onClick={onSelect}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-line/50 bg-panel2/30 px-3 py-2.5 transition hover:border-felt/30 hover:bg-panel2/60"
    >
      <div className="flex w-9 shrink-0 flex-col items-center text-center">
        <span className="font-mono text-sm font-bold leading-none text-felt">{d.getDate()}</span>
        <span className="text-[10px] uppercase text-muted">
          {d.toLocaleString("pl-PL", { month: "short" })}
        </span>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1 min-w-0">
        {participants.map((u) => (
          <Avatar key={u} username={u} size={22} />
        ))}
      </div>
      {avgRating && (
        <span className="flex shrink-0 items-center gap-0.5 font-mono text-xs font-semibold text-gold">
          <Star size={11} fill="currentColor" /> {avgRating}
        </span>
      )}
      <span className="shrink-0 font-mono text-sm font-semibold text-cream">
        {pln(totalWithDelivery)}
      </span>
      <ArrowRight size={14} className="shrink-0 text-muted transition group-hover:text-felt" />
    </div>
  );
}

/* ─── RestaurantCard ──────────────────────────────────────────────────────── */

function RestaurantCard({
  r,
  orders,
  onSelectOrder,
}: {
  r: KebabRestaurantWithStats;
  orders: KebabOrderWithDetails[];
  onSelectOrder: (orderId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasOrders = orders.length > 0;

  return (
    <div
      className={`panel overflow-hidden ${hasOrders ? "cursor-pointer" : ""}`}
      onClick={() => hasOrders && setExpanded((v) => !v)}
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display font-bold text-cream truncate">{r.name}</p>
            {r.address && <p className="text-xs text-muted truncate">{r.address}</p>}
          </div>
          {/* Stop propagation so these actions don't toggle expand */}
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-felt transition"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <DeleteButton
              url={`/api/kebab/restaurants/${r.id}`}
              confirmText={`Usunąć restaurację „${r.name}"?`}
              iconOnly
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            {r.avg_rating != null ? (
              <div className="flex items-center gap-1">
                <StarDisplay value={Math.round(r.avg_rating)} />
                <span className="text-sm font-mono font-semibold text-gold">{r.avg_rating}</span>
              </div>
            ) : (
              <span className="text-xs text-muted">Brak ocen</span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Package size={12} /> {r.order_count}{" "}
              {r.order_count === 1 ? "zamówienie" : "zamówień"}
            </span>
            {r.total_spent > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted font-mono">
                <TrendingUp size={12} /> {pln(r.total_spent)}
              </span>
            )}
          </div>
          {hasOrders && (
            <div className="shrink-0 text-muted">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          )}
        </div>
      </div>

      {/* Historia zamówień */}
      {expanded && hasOrders && (
        <div
          className="border-t border-line/50 bg-panel2/20 p-4 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted/70">
            Historia zamówień
          </span>
          <div className="space-y-2">
            {orders.map((order) => (
              <RestaurantOrderRow
                key={order.id}
                order={order}
                onSelect={() => onSelectOrder(order.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

export default function KebabClient({
  orders,
  restaurants,
  players,
  meetings,
  currentUser,
}: {
  orders: KebabOrderWithDetails[];
  restaurants: KebabRestaurantWithStats[];
  players: Player[];
  meetings: MeetingLite[];
  currentUser: string;
}) {
  const [tab, setTab] = useState<"orders" | "restaurants">("restaurants");
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  function goToOrder(orderId: string) {
    setHighlightedOrderId(orderId);
    setTab("orders");
  }

  useEffect(() => {
    if (!highlightedOrderId) return;
    const el = document.getElementById(`order-${highlightedOrderId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const timer = setTimeout(() => setHighlightedOrderId(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedOrderId, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Kącik kebabowy</h1>
          <p className="text-sm text-muted">Zamówienia z dostawą · rozliczenia · oceny</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewOrder(true)}>
          <Plus size={16} /> Nowe zamówienie
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-line bg-panel2 p-1 w-fit">
        {(["restaurants", "orders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t ? "bg-panel shadow-sm text-cream" : "text-muted hover:text-cream"
            }`}
          >
            {t === "restaurants" ? (
              <span className="flex items-center gap-2"><Star size={15} /> Restauracje</span>
            ) : (
              <span className="flex items-center gap-2"><UtensilsCrossed size={15} /> Zamówienia</span>
            )}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {orders.length === 0 ? (
            <div className="panel flex flex-col items-center gap-3 p-12 text-center xl:col-span-2">
              <UtensilsCrossed size={40} className="text-muted" />
              <p className="text-muted">Brak zamówień. Zacznij od dodania restauracji i pierwszego zamówienia.</p>
              <button className="btn-primary" onClick={() => setShowNewOrder(true)}>
                <Plus size={16} /> Nowe zamówienie
              </button>
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                players={players}
                restaurants={restaurants}
                meetings={meetings}
                currentUser={currentUser}
                highlighted={highlightedOrderId === order.id}
              />
            ))
          )}
        </div>
      )}

      {tab === "restaurants" && (
        <div className="space-y-4">
          {restaurants.length === 0 ? (
            <div className="panel flex flex-col items-center gap-3 p-12 text-center">
              <UtensilsCrossed size={40} className="text-muted" />
              <p className="text-muted">Brak restauracji. Dodaj pierwszą przy tworzeniu zamówienia.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                {restaurants.length} restauracji · posortowane wg średniej oceny
              </p>
              <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {restaurants.map((r) => (
                  <RestaurantCard
                    key={r.id}
                    r={r}
                    orders={orders.filter((o) => o.restaurant_id === r.id)}
                    onSelectOrder={goToOrder}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {showNewOrder && (
        <OrderFormModal
          restaurants={restaurants}
          players={players}
          meetings={meetings}
          onClose={() => setShowNewOrder(false)}
        />
      )}
    </div>
  );
}
