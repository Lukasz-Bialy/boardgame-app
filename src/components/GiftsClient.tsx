"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Plus, Eye, EyeOff, Shuffle, Shield, ArrowRight, Users, Wallet } from "lucide-react";
import Modal from "@/components/Modal";
import DeleteButton from "@/components/DeleteButton";
import { Avatar, formatDate } from "@/components/ui";
import { displayNameOf } from "@/lib/users";
import { api } from "@/lib/client";
import type { GiftDrawForUser, GiftPair } from "@/lib/types";

type Player = { username: string; displayName: string };

function pln(grosz: number): string {
  return (grosz / 100).toFixed(2).replace(".", ",") + " zł";
}

function parsePLN(val: string): number {
  const n = parseFloat(val.replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : Math.round(n * 100);
}

/* ─── Mój wynik (odpakowywanie) ───────────────────────────────────────────── */

function MyResult({ receiver }: { receiver: string }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-gold/40 bg-gold-soft/40 p-4 text-left transition hover:border-gold hover:bg-gold-soft/70"
      >
        <span className="xmas-gift-box flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-danger/80 to-danger/50 text-cream shadow-glow-gold">
          <Gift size={28} />
        </span>
        <span>
          <span className="block font-display font-bold text-cream">Kliknij, aby odpakować</span>
          <span className="block text-xs text-muted">
            Sprawdź, komu kupujesz prezent. Upewnij się, że nikt nie zagląda Ci przez ramię!
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="xmas-reveal relative flex items-center gap-4 overflow-hidden rounded-xl border border-felt/40 bg-felt-soft/60 p-4">
      <span className="xmas-confetti" aria-hidden />
      <Avatar username={receiver} size={56} />
      <div className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-widest text-felt/80">
          Kupujesz prezent dla
        </span>
        <span className="block font-display text-2xl font-extrabold text-cream truncate">
          {displayNameOf(receiver)} 🎁
        </span>
      </div>
      <button
        onClick={() => setRevealed(false)}
        className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs"
        title="Ukryj wynik"
      >
        <EyeOff size={14} /> Ukryj
      </button>
    </div>
  );
}

/* ─── Panel administratora ────────────────────────────────────────────────── */

function AdminPanel({ drawId }: { drawId: string }) {
  const router = useRouter();
  const [pairs, setPairs] = useState<GiftPair[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmRedraw, setConfirmRedraw] = useState(false);
  const [error, setError] = useState("");

  async function loadPairs() {
    setLoading(true);
    setError("");
    const res = await api(`/api/gifts/draws/${drawId}`, "GET");
    setLoading(false);
    if (!res.ok) { setError(res.error!); return; }
    setPairs(res.data.pairs);
  }

  async function doRedraw() {
    setLoading(true);
    setError("");
    const res = await api(`/api/gifts/draws/${drawId}`, "PATCH", { redraw: true });
    setLoading(false);
    setConfirmRedraw(false);
    if (!res.ok) { setError(res.error!); return; }
    if (pairs) await loadPairs();
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-panel2/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
          <Shield size={13} /> Panel administratora
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {pairs ? (
            <button onClick={() => setPairs(null)} className="btn-ghost py-1 px-2.5 text-xs">
              <EyeOff size={13} /> Ukryj pary
            </button>
          ) : (
            <button onClick={loadPairs} disabled={loading} className="btn-ghost py-1 px-2.5 text-xs">
              <Eye size={13} /> Podejrzyj pary
            </button>
          )}
          {confirmRedraw ? (
            <>
              <span className="text-xs text-danger">Wszyscy dostaną nowe wyniki. Na pewno?</span>
              <button onClick={doRedraw} disabled={loading} className="btn-danger py-1 px-2.5 text-xs">
                Tak, losuj
              </button>
              <button onClick={() => setConfirmRedraw(false)} className="btn-ghost py-1 px-2.5 text-xs">
                Anuluj
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmRedraw(true)} className="btn-ghost py-1 px-2.5 text-xs">
              <Shuffle size={13} /> Losuj ponownie
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {pairs && (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {pairs.map((p) => (
                <tr key={p.giver}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar username={p.giver} size={22} />
                      <span className="text-cream">{displayNameOf(p.giver)}</span>
                    </div>
                  </td>
                  <td className="px-1 py-2 text-center text-muted">
                    <ArrowRight size={14} className="inline" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar username={p.receiver} size={22} />
                      <span className="text-cream">{displayNameOf(p.receiver)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── DrawCard ────────────────────────────────────────────────────────────── */

function DrawCard({ draw, isAdmin }: { draw: GiftDrawForUser; isAdmin: boolean }) {
  return (
    <div className="panel overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-danger/70 via-gold/50 to-felt/40" />
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold text-cream truncate">{draw.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Wylosowano {formatDate(draw.created_at.slice(0, 10))}</span>
            {draw.budget != null && (
              <span className="chip text-gold">
                <Wallet size={12} /> Budżet: {pln(draw.budget)}
              </span>
            )}
            <span className="chip">
              <Users size={12} /> {draw.participants.length} os.
            </span>
          </div>
        </div>
        {isAdmin && (
          <DeleteButton
            url={`/api/gifts/draws/${draw.id}`}
            confirmText={`Usunąć losowanie „${draw.title}"? Wyniki przepadną.`}
            iconOnly
          />
        )}
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {draw.participants.map((u) => (
            <span key={u} className="inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-panel2 py-0.5 pl-0.5 pr-2.5 text-xs text-cream">
              <Avatar username={u} size={20} /> {displayNameOf(u)}
            </span>
          ))}
        </div>

        {draw.note && (
          <p className="text-xs text-muted italic border-l-2 border-line pl-3">{draw.note}</p>
        )}

        {draw.my_receiver ? (
          <MyResult key={draw.my_receiver} receiver={draw.my_receiver} />
        ) : (
          <p className="rounded-xl border border-line/60 bg-panel2/30 p-3 text-sm text-muted">
            Nie bierzesz udziału w tym losowaniu.
          </p>
        )}

        {isAdmin && <AdminPanel drawId={draw.id} />}
      </div>
    </div>
  );
}

/* ─── NewDrawModal ────────────────────────────────────────────────────────── */

function NewDrawModal({ players, onClose }: { players: Player[]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(`Święta ${new Date().getFullYear()}`);
  const [budget, setBudget] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>(players.map((p) => p.username));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggle(u: string) {
    setSelected((s) => (s.includes(u) ? s.filter((x) => x !== u) : [...s, u]));
  }

  async function save() {
    setError("");
    if (!title.trim()) { setError("Podaj nazwę losowania"); return; }
    if (selected.length < 3) { setError("Wybierz co najmniej 3 uczestników"); return; }
    setSaving(true);
    const res = await api("/api/gifts/draws", "POST", {
      title: title.trim(),
      budget: parsePLN(budget),
      note: note.trim() || null,
      participants: selected,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error!); return; }
    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title="Nowe losowanie prezentów">
      <div className="space-y-4">
        <div>
          <label className="label">Nazwa</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="label">Budżet na prezent (zł, opcjonalnie)</label>
          <input className="input" placeholder="np. 100" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>

        <div>
          <label className="label">Uczestnicy ({selected.length})</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {players.map((p) => {
              const on = selected.includes(p.username);
              return (
                <button
                  key={p.username}
                  type="button"
                  onClick={() => toggle(p.username)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${
                    on ? "border-felt/60 bg-felt/[0.09] text-cream" : "border-line text-muted hover:border-line hover:bg-panel2"
                  }`}
                >
                  <Avatar username={p.username} size={24} />
                  <span className="flex-1 text-left">{p.displayName}</span>
                  <span
                    className={`h-4 w-4 rounded border ${on ? "border-felt bg-felt" : "border-line"}`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">Notatka (opcjonalnie)</label>
          <input
            className="input"
            placeholder="np. Wymiana prezentów 24.12 u Michała"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <p className="text-xs text-muted">
          Każdy uczestnik zobaczy tylko osobę, której kupuje prezent. Nikt nie wylosuje samego siebie.
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Anuluj</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            <Shuffle size={16} /> {saving ? "Losowanie…" : "Losuj!"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

export default function GiftsClient({
  draws,
  players,
  isAdmin,
}: {
  draws: GiftDrawForUser[];
  players: Player[];
  isAdmin: boolean;
}) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Losowanie „kto komu kupuje prezent” na święta.</p>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> Nowe losowanie
          </button>
        )}
      </div>

      {draws.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-12 text-center">
          <Gift size={40} className="text-muted" />
          <p className="text-muted">
            {isAdmin
              ? "Nie ma jeszcze żadnego losowania. Utwórz pierwsze!"
              : "Nie ma jeszcze żadnego losowania. Administrator wkrótce je przygotuje."}
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {draws.map((d) => <DrawCard key={d.id} draw={d} isAdmin={isAdmin} />)}
        </div>
      )}

      {showNew && <NewDrawModal players={players} onClose={() => setShowNew(false)} />}
    </div>
  );
}
