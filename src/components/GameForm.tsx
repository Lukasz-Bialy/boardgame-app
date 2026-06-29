"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import type { Game } from "@/lib/types";

export default function GameForm({ game }: { game?: Game }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({
    name: game?.name ?? "",
    image_url: game?.image_url ?? "",
    min_players: game?.min_players?.toString() ?? "",
    max_players: game?.max_players?.toString() ?? "",
    play_time: game?.play_time?.toString() ?? "",
    description: game?.description ?? "",
  });

  const editing = Boolean(game);

  async function save() {
    setError("");
    if (!f.name.trim()) return setError("Podaj nazwę gry");
    setSaving(true);
    const res = editing
      ? await api(`/api/games/${game!.id}`, "PUT", f)
      : await api("/api/games", "POST", f);
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    setOpen(false);
    if (!editing)
      setF({ name: "", image_url: "", min_players: "", max_players: "", play_time: "", description: "" });
    router.refresh();
  }

  return (
    <>
      {editing ? (
        <button className="btn-ghost" onClick={() => setOpen(true)}>
          <Pencil size={16} /> Edytuj
        </button>
      ) : (
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus size={16} /> Dodaj grę
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edytuj grę" : "Nowa gra"}>
        <div className="space-y-4">
          <div>
            <label className="label">Nazwa *</label>
            <input
              className="input"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="np. Osadnicy z Catanu"
            />
          </div>
          <div>
            <label className="label">Link do okładki (URL)</label>
            <input
              className="input"
              value={f.image_url}
              onChange={(e) => setF({ ...f, image_url: e.target.value })}
              placeholder="https://…/okladka.jpg"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Graczy od</label>
              <input
                type="number"
                min={1}
                className="input"
                value={f.min_players}
                onChange={(e) => setF({ ...f, min_players: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Graczy do</label>
              <input
                type="number"
                min={1}
                className="input"
                value={f.max_players}
                onChange={(e) => setF({ ...f, max_players: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Czas (min)</label>
              <input
                type="number"
                min={1}
                className="input"
                value={f.play_time}
                onChange={(e) => setF({ ...f, play_time: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Opis</label>
            <textarea
              className="input min-h-[80px]"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Zapisywanie…" : editing ? "Zapisz zmiany" : "Dodaj grę"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
