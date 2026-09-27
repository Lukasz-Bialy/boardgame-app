"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Dices, CalendarDays, Search, Check, Users, Clock, Star } from "lucide-react";
import Modal from "@/components/Modal";
import { api } from "@/lib/client";
import { formatDate, players as playersStr, minutes } from "@/components/ui";

type GameLite = {
  id: string;
  name: string;
  image_url: string | null;
  min_players: number | null;
  max_players: number | null;
  play_time: number | null;
  avg_rating: number | null;
};

type MeetingLite = { id: string; date: string; title: string };

function GameTile({ game, selected, onToggle }: { game: GameLite; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative overflow-hidden rounded-xl border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-felt ${
        selected
          ? "border-felt bg-felt/10 shadow-[0_0_0_1px_rgb(52_165_120/0.4)]"
          : "border-line bg-panel2 hover:border-felt/40"
      }`}
    >
      {/* Okładka */}
      <div className="relative aspect-[16/10] overflow-hidden bg-ink/60">
        {game.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.image_url}
            alt={game.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            <Dices size={28} />
          </div>
        )}

        {/* Overlay zaznaczenia */}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-felt/30">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-felt text-onaccent shadow-lg">
              <Check size={18} strokeWidth={3} />
            </span>
          </div>
        )}

        {/* Ocena */}
        {game.avg_rating != null && (
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-gold backdrop-blur">
            <Star size={10} fill="currentColor" /> {game.avg_rating}
          </span>
        )}
      </div>

      {/* Opis */}
      <div className="p-2.5">
        <p className={`truncate text-sm font-semibold leading-tight ${selected ? "text-felt" : "text-cream"}`}>
          {game.name}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-muted">
          {(game.min_players || game.max_players) && (
            <span className="inline-flex items-center gap-0.5">
              <Users size={10} /> {playersStr(game.min_players, game.max_players)}
            </span>
          )}
          {game.play_time && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={10} /> {minutes(game.play_time)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

const WEEKDAYS = ["ndz", "pon", "wt", "śr", "czw", "pt", "sob"];

export default function PollForm({ games, meetings = [] }: { games: GameLite[]; meetings?: MeetingLite[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [type, setType] = useState<"game" | "date">("game");
  const [title, setTitle] = useState("");
  const [linkedMeetingId, setLinkedMeetingId] = useState<string>("");
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [gameSearch, setGameSearch] = useState("");
  const [customOptions, setCustomOptions] = useState<string[]>([]);
  const [customText, setCustomText] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");

  function reset() {
    setType("game");
    setTitle("");
    setLinkedMeetingId("");
    setSelectedGames([]);
    setGameSearch("");
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

  const filteredGames = gameSearch.trim()
    ? games.filter((g) => g.name.toLowerCase().includes(gameSearch.toLowerCase()))
    : games;

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
    const res = await api("/api/polls", "POST", { title: title.trim(), type, options });
    if (!res.ok) { setSaving(false); return setError(res.error!); }
    if (linkedMeetingId) {
      await api(`/api/meetings/${linkedMeetingId}`, "PATCH", { poll_token: res.data.token });
    }
    setSaving(false);
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

      <Modal open={open} onClose={() => setOpen(false)} title="Nowa ankieta" wide={type === "game"}>
        <div className="space-y-4">
          {/* Typ */}
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

          {/* Tytuł */}
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
              {/* Grid kafelków gier */}
              {games.length === 0 ? (
                <p className="text-sm text-muted">Brak gier w kolekcji.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="label mb-0">
                      Gry z kolekcji
                      {selectedGames.length > 0 && (
                        <span className="ml-2 text-felt">({selectedGames.length} wybranych)</span>
                      )}
                    </label>
                    {selectedGames.length > 0 && (
                      <button
                        onClick={() => setSelectedGames([])}
                        className="text-xs text-muted hover:text-danger transition"
                      >
                        Odznacz wszystkie
                      </button>
                    )}
                  </div>

                  {/* Wyszukiwarka */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      className="input pl-8"
                      placeholder="Szukaj gry…"
                      value={gameSearch}
                      onChange={(e) => setGameSearch(e.target.value)}
                    />
                  </div>

                  {/* Kafelki */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {filteredGames.map((g) => (
                      <GameTile
                        key={g.id}
                        game={g}
                        selected={selectedGames.includes(g.id)}
                        onToggle={() => toggleGame(g.id)}
                      />
                    ))}
                    {filteredGames.length === 0 && (
                      <p className="col-span-3 py-6 text-center text-sm text-muted">
                        Brak wyników dla „{gameSearch}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Własna opcja */}
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

          {/* Powiązane spotkanie */}
          {meetings.length > 0 && (
            <div>
              <label className="label">Powiąż ze spotkaniem (opcjonalnie)</label>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setLinkedMeetingId("")}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition text-left ${
                    linkedMeetingId === ""
                      ? "border-line bg-panel2 text-muted"
                      : "border-line text-muted hover:bg-panel2"
                  }`}
                >
                  <span className="text-xs text-muted">— brak powiązania —</span>
                </button>
                {meetings.map((m) => {
                  const d = new Date(m.date + "T00:00:00");
                  const day = d.getDate();
                  const weekday = WEEKDAYS[d.getDay()];
                  const monthName = d.toLocaleDateString("pl-PL", { month: "short" });
                  const selected = linkedMeetingId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLinkedMeetingId(m.id)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                        selected
                          ? "border-gold/50 bg-gold/10"
                          : "border-line hover:border-gold/30 hover:bg-gold/5"
                      }`}
                    >
                      <div className={`flex w-10 shrink-0 flex-col items-center rounded-lg py-0.5 ${selected ? "bg-gold/20" : "bg-panel2"}`}>
                        <span className={`font-mono text-base font-bold leading-none ${selected ? "text-gold" : "text-cream"}`}>
                          {day}
                        </span>
                        <span className={`text-[10px] uppercase ${selected ? "text-gold/70" : "text-muted"}`}>
                          {weekday}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${selected ? "text-cream" : "text-cream"}`}>
                          {m.title}
                        </p>
                        <p className={`text-xs capitalize ${selected ? "text-gold/70" : "text-muted"}`}>
                          {monthName} {d.getFullYear()}
                        </p>
                      </div>
                      {selected && (
                        <Check size={15} className="shrink-0 text-gold" />
                      )}
                    </button>
                  );
                })}
              </div>
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
