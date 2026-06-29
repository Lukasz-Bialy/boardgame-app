"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Dices, CalendarDays } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import { formatDate } from "@/components/ui";

type GameLite = { id: string; name: string };

export default function PollForm({ games }: { games: GameLite[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState<"game" | "date">("game");
  const [title, setTitle] = useState("");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");

  function reset() {
    setType("game");
    setTitle("");
    setSelectedGames([]);
    setCustomOptions([]);
    setCustomText("");
    setDates([]);
    setDateInput("");
    setError("");
  }

  function toggleGame(id: string) {
    setSelectedGames((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function addCustom() {
    const t = customText.trim();
    if (t && !customOptions.includes(t)) setCustomOptions((c) => [...c, t]);
    setCustomText("");
  }
  function addDate() {
    if (dateInput && !dates.includes(dateInput)) setDates((d) => [...d, dateInput].sort());
    setDateInput("");
  }

  async function save() {
    setError("");
    if (!title.trim()) return setError("Podaj tytuł ankiety");

    let options: { label: string; game_id?: string; date_value?: string }[] = [];
    if (type === "game") {
      options = [
        ...selectedGames.map((id) => ({
          label: games.find((g) => g.id === id)?.name ?? "Gra",
          game_id: id,
        })),
        ...customOptions.map((label) => ({ label })),
      ];
    } else {
      options = dates.map((d) => ({ label: formatDate(d), date_value: d }));
    }

    if (options.length < 2) return setError("Dodaj przynajmniej 2 opcje do głosowania");

    setSaving(true);
    const res = await api("/api/polls", "POST", {
      title: title.trim(),
      type,
      options,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error!);
    setOpen(false);
    reset();
    router.push(`/polls/${res.data.token}`);
    router.refresh();
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} /> Utwórz ankietę
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Nowa ankieta">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("game")}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                type === "game" ? "border-felt bg-felt/15 text-felt" : "border-line text-muted"
              }`}
            >
              <Dices size={16} /> W co zagrać
            </button>
            <button
              onClick={() => setType("date")}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                type === "date" ? "border-felt bg-felt/15 text-felt" : "border-line text-muted"
              }`}
            >
              <CalendarDays size={16} /> Kiedy się spotkać
            </button>
          </div>

          <div>
            <label className="label">Tytuł</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "game" ? "np. Wybór gier na piątek" : "np. Terminy w marcu"}
            />
          </div>

          {type === "game" ? (
            <>
              <div>
                <label className="label">Gry z kolekcji</label>
                {games.length === 0 ? (
                  <p className="text-sm text-muted">Brak gier w kolekcji.</p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                    {games.map((g) => (
                      <label
                        key={g.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-panel2"
                      >
                        <input
                          type="checkbox"
                          className="accent-felt"
                          checked={selectedGames.includes(g.id)}
                          onChange={() => toggleGame(g.id)}
                        />
                        <span className="text-sm">{g.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label">Własna opcja (np. gra spoza kolekcji)</label>
                <div className="flex gap-2">
                  <input
                    className="input"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
                    placeholder="np. Cokolwiek nowego"
                  />
                  <button className="btn-ghost shrink-0" onClick={addCustom}>
                    Dodaj
                  </button>
                </div>
                {customOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {customOptions.map((o) => (
                      <span key={o} className="chip">
                        {o}
                        <button
                          onClick={() => setCustomOptions((c) => c.filter((x) => x !== o))}
                          className="text-muted hover:text-danger"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div>
              <label className="label">Proponowane terminy</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="input"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                />
                <button className="btn-ghost shrink-0" onClick={addDate}>
                  Dodaj
                </button>
              </div>
              {dates.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {dates.map((d) => (
                    <span key={d} className="chip">
                      {formatDate(d)}
                      <button
                        onClick={() => setDates((arr) => arr.filter((x) => x !== d))}
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Tworzenie…" : "Utwórz ankietę"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
