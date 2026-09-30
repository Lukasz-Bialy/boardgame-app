"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

const EXPANDED_KEY = "chat-expanded";

/**
 * Czat ekipy = kanał z serwera Discord osadzony przez WidgetBot (https://widgetbot.io).
 * Iframe ładuje się dopiero przy pierwszym otwarciu, a potem zostaje zamontowany
 * (tylko ukryty), żeby nie przeładowywać Discorda przy każdym otwarciu panelu.
 */
export default function ChatWidget({
  serverId,
  channelId,
  displayName,
}: {
  serverId: string;
  channelId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Okno powiększone na całą stronę; zapamiętywane
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(EXPANDED_KEY) === "1");
    } catch {}
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(EXPANDED_KEY, next ? "1" : "0");
    } catch {}
  }

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // `username` — domyślny nick dla gości WidgetBota (osoby zalogowane do Discorda piszą jako one same)
  const src = `https://e.widgetbot.io/channels/${serverId}/${channelId}?username=${encodeURIComponent(displayName)}`;
  const discordUrl = `https://discord.com/channels/${serverId}/${channelId}`;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 rounded-full border border-line/70 bg-surface/90 py-2 pl-3 pr-4 shadow-panel backdrop-blur-xl transition hover:border-felt/50 md:bottom-6 md:right-6"
          aria-label="Otwórz czat"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-felt/15 text-felt">
            <MessageCircle size={19} />
          </span>
          <span className="text-sm font-semibold text-cream">Czat</span>
        </button>
      )}

      {mounted && (
        <div
          role="dialog"
          aria-label="Czat ekipy"
          aria-hidden={!open}
          className={`${open ? "flex" : "hidden"} chat-pop fixed flex-col overflow-hidden bg-panel ${
            expanded
              ? // Na całą stronę — ponad nawigacją
                "inset-0 z-50"
              : "inset-x-2 bottom-2 z-40 h-[min(620px,calc(100dvh-5rem))] rounded-2xl border border-line shadow-panel md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px]"
          }`}
        >
          <div className="flex items-center gap-2 border-b border-line bg-surface/60 px-4 py-3">
            <MessageCircle size={17} className="text-felt" />
            <h2 className="font-display text-base font-bold text-cream">Czat ekipy</h2>
            <a
              href={discordUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-muted transition hover:text-cream"
              title="Otwórz kanał w Discordzie"
            >
              Discord <ExternalLink size={12} />
            </a>
            <button
              onClick={toggleExpanded}
              className="ml-2 text-muted transition hover:text-cream"
              aria-label={expanded ? "Zmniejsz okno czatu" : "Powiększ okno czatu"}
              title={expanded ? "Zmniejsz" : "Powiększ"}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={() => setOpen(false)} className="ml-2 text-muted transition hover:text-cream" aria-label="Zamknij czat">
              <X size={18} />
            </button>
          </div>
          <iframe
            src={src}
            title="Czat Discord"
            allow="clipboard-write; fullscreen"
            className="w-full flex-1 border-0 bg-panel"
          />
        </div>
      )}
    </>
  );
}
