"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Trash2, ChevronUp } from "lucide-react";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/client";
import type { ChatMessage } from "@/lib/types";

type Player = { username: string; displayName: string };

const POLL_OPEN_MS = 4000;
const POLL_CLOSED_MS = 20000;
const MAX_LEN = 2000;
const GROUP_GAP_MS = 5 * 60 * 1000; // kolejne wiadomości tej samej osoby w tym oknie — bez powtarzania nagłówka

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Dziś";
  if (d.toDateString() === yesterday.toDateString()) return "Wczoraj";
  return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

function readKey(username: string) {
  return `chat-last-read:${username}`;
}

export default function ChatWidget({
  currentUser,
  isAdmin,
  players,
}: {
  currentUser: string;
  isAdmin: boolean;
  players: Player[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [lastRead, setLastRead] = useState<number | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const openRef = useRef(false);
  const loadedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  messagesRef.current = messages;
  openRef.current = open;

  const nameOf = useCallback(
    (u: string) => players.find((p) => p.username === u)?.displayName ?? u,
    [players]
  );

  /* ─── Pobieranie ─────────────────────────────────────────────────────── */

  const poll = useCallback(async () => {
    const current = messagesRef.current;
    const lastId = current.length ? current[current.length - 1].id : 0;
    const res = await api(`/api/chat${lastId ? `?after=${lastId}` : ""}`, "GET");
    if (!res.ok) return;
    const incoming: ChatMessage[] = res.data.messages ?? [];
    const ids: number[] = res.data.recentIds ?? [];
    setOnline(res.data.online ?? []);

    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      let next = [...prev, ...incoming.filter((m) => !known.has(m.id))];
      // Usunięte wiadomości: w zakresie ostatnich id serwera brakuje ich — wyrzucamy je lokalnie
      const alive = new Set(ids);
      const from = ids.length ? Math.min(...ids) : Infinity;
      next = next.filter((m) => m.id < from || alive.has(m.id));
      if (ids.length === 0) next = [];
      return next;
    });

    if (!loadedRef.current) {
      loadedRef.current = true;
      setHasMore(incoming.length >= 50);
      setLoaded(true);
    }
  }, []);

  // Pętla odpytywania: częściej przy otwartym panelu, wstrzymana gdy karta jest w tle
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      if (document.visibilityState === "visible") await poll().catch(() => {});
      if (!stopped) timer = setTimeout(tick, openRef.current ? POLL_OPEN_MS : POLL_CLOSED_MS);
    }
    tick();
    function onVisible() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        tick();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  // Po otwarciu: od razu odśwież, przewiń na dół, ustaw fokus
  useEffect(() => {
    if (!open) return;
    stickToBottom.current = true;
    poll().catch(() => {});
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      inputRef.current?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, poll]);

  // Nowe wiadomości: przewiń, jeśli użytkownik był na dole
  useEffect(() => {
    if (open && stickToBottom.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, open]);

  /* ─── Nieprzeczytane ─────────────────────────────────────────────────── */

  useEffect(() => {
    try {
      const saved = localStorage.getItem(readKey(currentUser));
      if (saved) setLastRead(Number(saved));
    } catch {}
  }, [currentUser]);

  const maxId = messages.length ? messages[messages.length - 1].id : 0;

  useEffect(() => {
    if (!loaded) return;
    // Pierwsze uruchomienie czatu: nie pokazuj całej historii jako nieprzeczytanej
    const shouldMark = open || lastRead === null;
    if (shouldMark && maxId && maxId !== lastRead) {
      setLastRead(maxId);
      try {
        localStorage.setItem(readKey(currentUser), String(maxId));
      } catch {}
    }
  }, [open, maxId, loaded, lastRead, currentUser]);

  const unread = lastRead === null ? 0 : messages.filter((m) => m.id > lastRead && m.username !== currentUser).length;

  /* ─── Akcje ──────────────────────────────────────────────────────────── */

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    const res = await api("/api/chat", "POST", { body: text });
    setSending(false);
    if (!res.ok) {
      setError(res.error!);
      return;
    }
    setDraft("");
    stickToBottom.current = true;
    setMessages((prev) => (prev.some((m) => m.id === res.data.message.id) ? prev : [...prev, res.data.message]));
    inputRef.current?.focus();
  }

  async function remove(id: number) {
    const res = await api(`/api/chat/${id}`, "DELETE");
    setConfirmDelete(null);
    if (!res.ok) {
      setError(res.error!);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  async function loadOlder() {
    const first = messages[0];
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await api(`/api/chat?before=${first.id}`, "GET");
    setLoadingOlder(false);
    if (!res.ok) return;
    const older: ChatMessage[] = res.data.messages ?? [];
    setHasMore(older.length >= 50);
    stickToBottom.current = false;
    setMessages((prev) => [...older.filter((o) => !prev.some((m) => m.id === o.id)), ...prev]);
    // Zachowaj pozycję przewinięcia po doklejeniu starszych wiadomości
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  /* ─── Widok ──────────────────────────────────────────────────────────── */

  const onlineOthers = online.filter((u) => u !== currentUser);
  const onlineCount = online.length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 rounded-full border border-line/70 bg-surface/90 py-2 pl-3 pr-2.5 shadow-panel backdrop-blur-xl transition hover:border-felt/50 md:bottom-6 md:right-6"
        aria-label={`Otwórz czat${unread ? ` — ${unread} nieprzeczytanych` : ""}`}
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-felt/15 text-felt">
          <MessageCircle size={19} />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ring-2 ring-surface">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
        <span className="text-sm font-semibold text-cream">Czat</span>
        {onlineOthers.length > 0 && (
          <span className="flex -space-x-1.5">
            {onlineOthers.slice(0, 4).map((u) => (
              <span key={u} className="relative rounded-full ring-2 ring-surface">
                <Avatar username={u} size={24} />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-felt ring-2 ring-surface" />
              </span>
            ))}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Czat ekipy"
      className="chat-pop fixed inset-x-2 bottom-2 z-40 flex h-[min(620px,calc(100dvh-5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-panel md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px]"
    >
      {/* Nagłówek */}
      <div className="border-b border-line bg-surface/60 px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2">
          <MessageCircle size={17} className="text-felt" />
          <h2 className="font-display text-base font-bold text-cream">Czat ekipy</h2>
          <span className="text-xs text-muted">
            · {onlineCount} {onlineCount === 1 ? "aktywna osoba" : onlineCount >= 2 && onlineCount <= 4 ? "aktywne osoby" : "aktywnych osób"}
          </span>
          <button onClick={() => setOpen(false)} className="ml-auto text-muted transition hover:text-cream" aria-label="Zamknij czat">
            <X size={18} />
          </button>
        </div>
        {/* Kto jest aktywny */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {players.map((p) => {
            const isOn = online.includes(p.username);
            return (
              <span
                key={p.username}
                title={`${p.displayName} — ${isOn ? "aktywny teraz" : "nieaktywny"}`}
                className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs transition ${
                  isOn ? "border-felt/40 bg-felt/10 text-cream" : "border-line/60 text-muted opacity-60"
                }`}
              >
                <span className="relative">
                  <Avatar username={p.username} size={20} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-panel ${isOn ? "bg-felt" : "bg-muted/60"}`}
                  />
                </span>
                {p.displayName}
              </span>
            );
          })}
        </div>
      </div>

      {/* Wiadomości */}
      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {hasMore && (
          <div className="mb-2 flex justify-center">
            <button onClick={loadOlder} disabled={loadingOlder} className="btn-ghost px-3 py-1 text-xs">
              <ChevronUp size={13} /> {loadingOlder ? "Wczytywanie…" : "Wczytaj starsze"}
            </button>
          </div>
        )}

        {loaded && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <MessageCircle size={32} className="opacity-50" />
            Cisza na czacie. Napisz coś jako pierwszy!
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const mine = m.username === currentUser;
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const grouped =
            !newDay &&
            prev &&
            prev.username === m.username &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS;
          const canDelete = mine || isAdmin;

          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span className="h-px flex-1 bg-line" />
                  {dayLabel(m.created_at)}
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div className={`group flex gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "" : "mt-2.5"}`}>
                <span className="w-7 shrink-0">{!grouped && !mine && <Avatar username={m.username} size={28} />}</span>
                <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  {!grouped && (
                    <span className="mb-0.5 px-1 text-[11px] text-muted">
                      {!mine && <span className="font-semibold text-cream">{nameOf(m.username)} </span>}
                      {timeOf(m.created_at)}
                    </span>
                  )}
                  <div className={`flex items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                    <div
                      title={timeOf(m.created_at)}
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                        mine
                          ? "rounded-tr-md border border-felt/30 bg-felt/15 text-cream"
                          : "rounded-tl-md border border-line/60 bg-panel2 text-cream"
                      }`}
                    >
                      {m.body}
                    </div>
                    {canDelete &&
                      (confirmDelete === m.id ? (
                        <span className="flex shrink-0 items-center gap-1 text-[11px]">
                          <button onClick={() => remove(m.id)} className="font-semibold text-danger hover:underline">
                            Usuń
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-muted hover:text-cream">
                            Anuluj
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(m.id)}
                          className="shrink-0 text-muted opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100"
                          aria-label="Usuń wiadomość"
                          title="Usuń wiadomość"
                        >
                          <Trash2 size={13} />
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pole wiadomości */}
      <div className="border-t border-line bg-surface/60 p-3">
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={Math.min(4, Math.max(1, draft.split("\n").length))}
            placeholder="Napisz wiadomość…"
            title="Enter — wyślij, Shift+Enter — nowa linia"
            className="input max-h-32 flex-1 resize-none py-2"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="btn-primary h-10 w-10 shrink-0 p-0"
            aria-label="Wyślij"
          >
            <Send size={16} />
          </button>
        </div>
        {draft.length > MAX_LEN - 200 && (
          <p className="mt-1 text-right text-[11px] text-muted">
            {draft.length}/{MAX_LEN}
          </p>
        )}
      </div>
    </div>
  );
}
