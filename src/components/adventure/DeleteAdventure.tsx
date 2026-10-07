"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";

// Całkowite usunięcie przygody — nieodwracalne, więc trzeba przepisać jej tytuł
export default function DeleteAdventure({
  id,
  title,
  characters,
  posts,
  variant = "button",
}: {
  id: string;
  title: string;
  characters: number;
  posts: number;
  variant?: "button" | "overlay";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === title.trim().toLowerCase();

  function openModal() {
    setTyped("");
    setError(null);
    setOpen(true);
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    const res = await api(`/api/przygoda/${id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Nie udało się usunąć");
    setOpen(false);
    router.push("/przygoda");
    router.refresh();
  }

  return (
    <>
      {variant === "overlay" ? (
        <button
          onClick={openModal}
          className="rounded-full bg-black/55 p-2 text-[#F3DFAE] opacity-80 backdrop-blur transition hover:bg-danger hover:text-white hover:opacity-100"
          aria-label={`Usuń przygodę ${title}`}
          title="Usuń przygodę"
        >
          <Trash2 size={14} />
        </button>
      ) : (
        <button onClick={openModal} className="btn-danger py-1.5 text-xs">
          <Trash2 size={14} /> Usuń przygodę
        </button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Usunąć przygodę na zawsze?">
          <form onSubmit={remove} className="space-y-4">
            <p className="text-sm leading-relaxed text-cream">
              Zniknie <b>„{title}”</b> razem ze wszystkim: {characters} {characters === 1 ? "postacią" : "postaciami"}, {posts}{" "}
              {posts === 1 ? "wpisem" : "wpisami"} historii, rzutami, kroniką oraz wszystkimi portretami, scenami i mapami.
            </p>
            <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              Tego nie da się cofnąć. Jeśli chcecie tylko przestać grać, użyjcie „Zakończ” — przygoda zostanie w archiwum.
            </p>
            <div>
              <label className="label">Wpisz tytuł przygody, żeby potwierdzić</label>
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={title} autoFocus />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                Anuluj
              </button>
              <button className="btn-danger" disabled={!matches || busy}>
                <Trash2 size={15} /> {busy ? "Usuwanie…" : "Usuń na zawsze"}
              </button>
            </div>
          </form>
      </Modal>
    </>
  );
}
