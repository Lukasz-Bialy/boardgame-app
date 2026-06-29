"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";

export default function WishlistForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [note, setNote] = useState("");

  function reset() {
    setName("");
    setUrl("");
    setImageUrl("");
    setNote("");
    setError("");
  }

  async function save() {
    setError("");
    if (!name.trim()) return setError("Podaj nazwę gry");
    setSaving(true);
    const res = await api("/api/wishlist", "POST", {
      name: name.trim(),
      url,
      image_url: imageUrl,
      note,
    });
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
        <Plus size={16} /> Dodaj grę
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Dodaj do wishlisty">
        <div className="space-y-4">
          <div>
            <label className="label">Nazwa gry</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Brass: Birmingham"
            />
          </div>
          <div>
            <label className="label">Link (np. sklep / BGG)</label>
            <input
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="label">Link do zdjęcia (opcjonalnie)</label>
            <input
              className="input"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="label">Notatka (opcjonalnie)</label>
            <textarea
              className="input min-h-20"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="np. Podobno świetna na 4 osoby"
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
