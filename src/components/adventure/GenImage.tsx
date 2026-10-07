"use client";

import { useEffect, useState } from "react";
import { Feather, RefreshCw } from "lucide-react";

type State = { kind: "loading" } | { kind: "ready"; url: string } | { kind: "failed" };

// Obrazek generowany przez AI. Pierwsze pobranie uruchamia generowanie (kilka–kilkanaście sekund);
// 503 = ktoś inny właśnie generuje, więc ponawiamy. Bez obrazka pokazujemy grafikę zastępczą.
export default function GenImage({
  id,
  alt,
  fallback,
  className = "",
  loadingLabel = "Mistrz Gry maluje…",
}: {
  id: string | null;
  alt: string;
  fallback: React.ReactNode;
  className?: string;
  loadingLabel?: string;
}) {
  const [state, setState] = useState<State>({ kind: id ? "loading" : "failed" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ kind: "failed" });
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState({ kind: "loading" });

    const load = async (tries: number) => {
      try {
        const res = await fetch(`/api/przygoda/img/${id}`);
        if (cancelled) return;
        if (res.status === 503 && tries < 25) {
          timer = setTimeout(() => load(tries + 1), 3000);
          return;
        }
        if (!res.ok) return setState({ kind: "failed" });
        url = URL.createObjectURL(await res.blob());
        if (!cancelled) setState({ kind: "ready", url });
      } catch {
        if (!cancelled) setState({ kind: "failed" });
      }
    };
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, attempt]);

  async function retry() {
    if (!id) return;
    await fetch(`/api/przygoda/img/${id}`, { method: "POST" });
    setAttempt((a) => a + 1);
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {state.kind === "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.url} alt={alt} className="gen-img-in h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full">{fallback}</div>
      )}
      {state.kind === "loading" && (
        <div className="gen-img-shimmer absolute inset-0 flex items-end justify-center p-3">
          {loadingLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-xs text-[#F3DFAE] backdrop-blur">
              <Feather size={12} className="animate-pulse" /> {loadingLabel}
            </span>
          )}
        </div>
      )}
      {state.kind === "failed" && id && loadingLabel && (
        <button
          onClick={retry}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-[#F3DFAE] opacity-70 backdrop-blur transition hover:opacity-100"
          title="Obrazka nie udało się wygenerować — spróbuj ponownie"
        >
          <RefreshCw size={11} /> obraz
        </button>
      )}
    </div>
  );
}
