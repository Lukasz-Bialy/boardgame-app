"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";

export default function MeetingForm({ defaultDate }: { defaultDate?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [date, setDate] = useState(defaultDate ?? "");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  function reset() {
    setDate(defaultDate ?? "");
    setTitle("");
    setNote("");
    setError("");
  }

  async function save() {
    setError("");
    if (!date) return setError("Wybierz datę");
    if (!title.trim()) return setError("Podaj nazwę spotkania");
    setSaving(true);
    const res = await api("/api/meetings", "POST", { date, title: title.trim(), note });
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button
        className="btn-primary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus size={16} /> Dodaj spotkanie
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nowe spotkanie">
        <div className="space-y-4">
          <div>
            <label className="label">Data</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Nazwa</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Wieczór planszówkowy u Łukasza"
            />
          </div>
          <div>
            <label className="label">Notatka (opcjonalnie)</label>
            <textarea
              className="input min-h-20"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="np. Zaczynamy o 18:00, przynieście przekąski"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Zapisywanie…" : "Dodaj"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
