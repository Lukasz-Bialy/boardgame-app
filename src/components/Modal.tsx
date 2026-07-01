"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className={`panel max-h-[92vh] w-full overflow-y-auto rounded-b-none rounded-t-2xl md:rounded-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-5 py-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-cream" aria-label="Zamknij">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
