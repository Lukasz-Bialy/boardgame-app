"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/client";
import { PLAYERS } from "@/lib/users";

const today = () => new Date().toISOString().slice(0, 10);

export default function SessionForm({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [playedAt, setPlayedAt] = useState(today());
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  // mapowanie username -> miejsce (string), pusty = nie grał
  const [places, setPlaces] = useState<Record<string, string>>({});

  function setPlace(username: string, value: string) {
    setPlaces((p) => ({ ...p, [username]: value }));
  }

  async function save() {
    setError("");
    const placements = PLAYERS.map((u) => ({
      player: u.username,
      place: Number(places[u.username]),
    })).filter((p) => Number.isInteger(p.place) && p.place > 0);

    if (placements.length === 0) return setError("Zaznacz miejsca przynajmniej jednego gracza");

    setSaving(true);
    const res = await api(`/api/games/${gameId}/sessions`, "POST", {
      played_at: playedAt,
      duration_min: duration || null,
      note,
      placements,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    setOpen(false);
    setPlaces({});
    setDuration("");
    setNote("");
    setPlayedAt(today());
    router.refresh();
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} /> Dodaj rozgrywkę
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nowa rozgrywka">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data</label>
              <input
                type="date"
                className="input"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Czas gry (min)</label>
              <input
                type="number"
                min={1}
                className="input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="opcjonalnie"
              />
            </div>
          </div>

          <div>
            <label className="label">Kto jakie zajął miejsce</label>
            <p className="mb-2 text-xs text-muted">
              Wpisz miejsce (1 = wygrana). Zostaw puste, jeśli ktoś nie grał.
            </p>
            <div className="space-y-2">
              {PLAYERS.map((u) => (
                <div key={u.username} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    <Avatar username={u.username} size={28} />
                    {u.displayName} <span className="text-muted">({u.username})</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    placeholder="—"
                    className="input w-20 text-center"
                    value={places[u.username] ?? ""}
                    onChange={(e) => setPlace(u.username, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Notatka</label>
            <textarea
              className="input min-h-[60px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="np. emocjonująca końcówka, ktoś rozbił bank…"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz rozgrywkę"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
