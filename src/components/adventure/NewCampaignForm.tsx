"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shuffle } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import { TONES } from "@/lib/adventure/rules";

const IDEAS = [
  "Karawana kupiecka zaginęła na przełęczy, a jedyny ocalały woźnica powtarza w kółko jedno słowo: „dzwony”.",
  "W miasteczku od tygodnia nikt nie śni. Burmistrz płaci złotem każdemu, kto odkryje dlaczego.",
  "Stary kartograf umiera i zostawia drużynie mapę do miejsca, którego nie ma na żadnej innej mapie.",
  "Podczas wielkiego jarmarku ktoś ukradł koronę króla — a król twierdzi, że nigdy żadnej nie miał.",
  "Latarnia na klifie zgasła po raz pierwszy od stu lat. Tej samej nocy z morza wyszły… ryby na nogach.",
  "Drużyna budzi się w celi bez pamięci ostatnich trzech dni. Na ścianie wydrapano ich własnym pismem: „Nie ufajcie opatowi”.",
];

export default function NewCampaignForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [tone, setTone] = useState(TONES[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await api("/api/przygoda", "POST", { title, premise, tone });
    setSaving(false);
    if (!res.ok) return setError(res.error ?? "Nie udało się");
    router.push(`/przygoda/${res.data.id}`);
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} /> Nowa przygoda
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nowa przygoda">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Tytuł</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Klątwa Czarnego Młyna" maxLength={80} required />
          </div>
          <div>
            <div className="label">Klimat</div>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`flex flex-col items-start justify-start rounded-xl border p-2.5 text-left transition ${
                    t.id === tone ? "border-gold/70 bg-gold/10" : "border-line/70 bg-panel2/30 hover:bg-panel2"
                  }`}
                >
                  <div className="font-tale text-base font-semibold text-cream">{t.name}</div>
                  <div className="text-[11px] leading-tight text-muted">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0">Pomysł na start (opcjonalnie)</label>
              <button
                type="button"
                onClick={() => setPremise(IDEAS[Math.floor(Math.random() * IDEAS.length)])}
                className="inline-flex items-center gap-1 text-xs text-felt hover:underline"
              >
                <Shuffle size={12} /> losuj
              </button>
            </div>
            <textarea
              className="input min-h-[90px]"
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="Zostaw puste, a Mistrz Gry wymyśli wszystko sam."
              maxLength={1500}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving || !title.trim()}>
              {saving ? "Tworzenie…" : "Utwórz i zbierz drużynę"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
