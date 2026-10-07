"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Dice3D from "./Dice3D";
import { DeathPips } from "./CharacterSheet";
import { fmtMod } from "@/lib/adventure/rules";
import type { RollData } from "@/lib/adventure/types";

// Pełnoekranowy rzut: kość toczy się po stole, potem pojawia się wynik.
// roll === null — czekamy na odpowiedź serwera (kość drży w miejscu).
export default function DiceModal({
  open,
  roll,
  title,
  onClose,
}: {
  open: boolean;
  roll: RollData | null;
  title?: string;
  onClose: () => void;
}) {
  const [landed, setLanded] = useState(false);

  useEffect(() => setLanded(false), [roll, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && landed && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, landed, onClose]);

  if (!open) return null;

  const nat20 = roll?.sides === 20 && roll.result === 20;
  const nat1 = roll?.sides === 20 && roll.result === 1;
  const hasDc = roll?.dc !== undefined && roll?.dc !== null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => landed && onClose()}
    >
      <div
        className="dice-table relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-3xl border border-line p-6 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {landed && (
          <button onClick={onClose} className="absolute right-4 top-4 text-muted hover:text-cream" aria-label="Zamknij">
            <X size={20} />
          </button>
        )}
        <div className="label text-center">{title ?? roll?.label ?? "Rzut"}</div>
        {roll?.character_name && <div className="font-tale text-lg text-cream">{roll.character_name}</div>}

        <div className="relative my-2 flex h-[260px] w-[260px] items-center justify-center">
          <span className="dice-shadow" aria-hidden />
          {roll ? (
            <Dice3D sides={roll.sides} value={roll.result} size={260} onDone={() => setLanded(true)} />
          ) : (
            <div className="dice-wait font-display text-5xl text-gold">?</div>
          )}
          {landed && (nat20 || nat1) && <span className={nat20 ? "dice-burst-gold" : "dice-burst-red"} aria-hidden />}
        </div>

        <div className={`min-h-[118px] text-center transition-all duration-500 ${landed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
          {roll && (
            <>
              {nat20 && <div className="dice-crit text-gold">Naturalna dwudziestka!</div>}
              {nat1 && <div className="dice-crit text-danger">Krytyczna porażka!</div>}
              <div className="font-mono text-lg text-muted">
                k{roll.sides} = <span className="text-cream">{roll.result}</span>
                {roll.modifier !== 0 && (
                  <>
                    {" "}
                    {fmtMod(roll.modifier)} = <span className="font-bold text-cream">{roll.total}</span>
                  </>
                )}
                {hasDc && <span className="text-muted"> · ST {roll.dc}</span>}
              </div>
              {hasDc && (
                <div
                  className={`mt-2 inline-block rounded-full px-5 py-1.5 font-display text-2xl font-extrabold tracking-wide ${
                    roll.success ? "bg-felt/15 text-felt ring-1 ring-felt/40" : "bg-danger/15 text-danger ring-1 ring-danger/40"
                  }`}
                >
                  {roll.success ? "Sukces" : "Porażka"}
                </div>
              )}
              {roll.death && (
                <div className="mt-3 flex flex-col items-center gap-1.5">
                  <DeathPips successes={roll.death.outcome === "stable" ? 3 : roll.death.successes} failures={roll.death.failures} />
                  <div className="font-tale text-lg text-cream">
                    {roll.death.outcome === "revived" && "Wracasz do przytomności z 1 PW!"}
                    {roll.death.outcome === "stable" && "Trzy sukcesy — przeżyjesz. Postać jest stabilna."}
                    {roll.death.outcome === "dead" && "Trzy porażki… postać nie żyje."}
                    {!roll.death.outcome && "Walka o życie trwa — kolejny rzut w następnej rundzie."}
                  </div>
                </div>
              )}
              {roll.damage_result ? (
                <div className="mt-2 text-sm text-cream">
                  Obrażenia ({roll.damage?.replace(/d/g, "k")}): <span className="font-mono font-bold text-gold">{roll.damage_result}</span>
                </div>
              ) : null}
              {roll.auto && <div className="mt-1 text-xs text-muted">rzut automatyczny</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
