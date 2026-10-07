"use client";

import { useId } from "react";
import { Axe, Crosshair, EyeOff, Flame, Leaf, Music, Shield, Sun, Sword, WandSparkles, type LucideIcon } from "lucide-react";
import { classById, raceById } from "@/lib/adventure/rules";

const CLASS_ICONS: Record<string, LucideIcon> = {
  sword: Sword,
  axe: Axe,
  "eye-off": EyeOff,
  crosshair: Crosshair,
  wand: WandSparkles,
  sun: Sun,
  shield: Shield,
  music: Music,
  flame: Flame,
  leaf: Leaf,
};

export function ClassIcon({ classId, size = 16, className }: { classId: string; size?: number; className?: string }) {
  const Icon = CLASS_ICONS[classById(classId)?.icon ?? "sword"] ?? Sword;
  return <Icon size={size} className={className} />;
}

// Deterministyczny generator liczb z tekstu — ta sama nazwa miejsca daje zawsze tę samą mapę
function rng(seedText: string) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ─── Portret zastępczy: herb klasy na tle w jej kolorze ─────────────────── */

export function PortraitFallback({ classId, raceId, name }: { classId: string; raceId: string; name: string }) {
  const cls = classById(classId);
  const race = raceById(raceId);
  const color = cls?.color ?? "#8A5A12";
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{ background: `radial-gradient(120% 80% at 50% 25%, ${color}66, #1a130e 70%)` }}
    >
      <svg viewBox="0 0 100 120" className="absolute inset-0 h-full w-full opacity-30" preserveAspectRatio="none" aria-hidden>
        <path d="M50 8 L88 22 L84 70 Q76 98 50 112 Q24 98 16 70 L12 22 Z" fill="none" stroke={color} strokeWidth="1.2" />
        <path d="M50 16 L80 27 L77 68 Q70 91 50 103 Q30 91 23 68 L20 27 Z" fill={`${color}22`} stroke={color} strokeWidth="0.5" />
      </svg>
      <ClassIcon classId={classId} size={56} className="relative drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]" />
      <div className="relative mt-3 font-tale text-3xl font-semibold text-[#F3DFAE]">{name.slice(0, 1).toUpperCase()}</div>
      <div className="relative mt-1 text-[10px] uppercase tracking-[0.25em] text-[#F3DFAE]/60">{race?.name}</div>
    </div>
  );
}

/* ─── Mapa zastępcza: wyspa na pergaminie z górami, lasem i szlakiem ────── */

export function MapFallback({ seed }: { seed: string }) {
  const r = rng(seed || "mapa");
  const cx = 200, cy = 150;
  const pts = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    const rad = 95 + r() * 45;
    return [cx + Math.cos(a) * rad * 1.35, cy + Math.sin(a) * rad * 0.85];
  });
  const coast = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + "Z";
  const inside = () => {
    const a = r() * Math.PI * 2, d = r() * 0.7;
    return [cx + Math.cos(a) * 110 * d * 1.2, cy + Math.sin(a) * 80 * d];
  };
  const mountains = Array.from({ length: 7 }, inside);
  const trees = Array.from({ length: 16 }, inside);
  const path = Array.from({ length: 5 }, inside).sort((a, b) => a[0] - b[0]);
  const ink = "#5a3d22";
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="parch" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#efe0bd" />
          <stop offset="100%" stopColor="#c9a86e" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#parch)" />
      <path d={coast} fill="#e3cf9f" stroke={ink} strokeWidth="1.6" />
      <path d={coast} fill="none" stroke={ink} strokeOpacity="0.25" strokeWidth="6" transform={`translate(${cx} ${cy}) scale(1.05) translate(${-cx} ${-cy})`} />
      {trees.map(([x, y], i) => (
        <g key={`t${i}`} transform={`translate(${x} ${y})`}>
          <circle r="4.5" fill="#6f7f4a" stroke={ink} strokeWidth="0.8" />
          <line y1="4" y2="8" stroke={ink} strokeWidth="0.8" />
        </g>
      ))}
      {mountains.map(([x, y], i) => (
        <path key={`m${i}`} d={`M${x - 12} ${y + 8} L${x} ${y - 12} L${x + 12} ${y + 8}`} fill="#d8c08a" stroke={ink} strokeWidth="1.1" />
      ))}
      <path
        d={path.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="#8e2a24"
        strokeWidth="1.6"
        strokeDasharray="4 4"
      />
      <circle cx={path[path.length - 1][0]} cy={path[path.length - 1][1]} r="5" fill="#8e2a24" />
      <g transform="translate(352 252)" stroke={ink} fill="none">
        <circle r="18" strokeWidth="0.8" />
        <path d="M0 -24 L4 0 L0 24 L-4 0 Z" fill={ink} fillOpacity="0.6" />
        <path d="M-24 0 L0 4 L24 0 L0 -4 Z" fill={ink} fillOpacity="0.3" />
      </g>
    </svg>
  );
}

/* ─── Scena zastępcza: pasma gór o zmierzchu ─────────────────────────────── */

const SCENE_PALETTES = [
  ["#2a1c2f", "#6b3a3a", "#d08a4f"],
  ["#10202b", "#284a55", "#b2a57a"],
  ["#1b1410", "#4b3322", "#c79a55"],
  ["#161b2e", "#3b3f6b", "#a37bb0"],
];

export function SceneFallback({ seed }: { seed: string }) {
  const gid = "sky" + useId().replace(/:/g, "");
  const r = rng(seed || "scena");
  const [sky, mid, glow] = SCENE_PALETTES[Math.floor(r() * SCENE_PALETTES.length)];
  const ridge = (base: number, amp: number) => {
    let d = `M0 ${base}`;
    for (let x = 0; x <= 400; x += 20) d += ` L${x} ${(base - r() * amp).toFixed(1)}`;
    return d + " L400 225 L0 225 Z";
  };
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky} />
          <stop offset="70%" stopColor={mid} />
          <stop offset="100%" stopColor={glow} />
        </linearGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#${gid})`} />
      <circle cx={80 + r() * 240} cy={70 + r() * 40} r="22" fill={glow} opacity="0.7" />
      <path d={ridge(150, 60)} fill={mid} opacity="0.55" />
      <path d={ridge(175, 45)} fill={sky} opacity="0.8" />
      <path d={ridge(205, 30)} fill="#0b0806" />
    </svg>
  );
}
