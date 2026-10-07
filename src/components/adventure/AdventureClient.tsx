"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Compass,
  Dices,
  Feather,
  Flag,
  Hourglass,
  Info,
  MapPin,
  Play,
  RefreshCw,
  Send,
  Skull,
  Swords,
  UserPlus,
} from "lucide-react";
import Modal from "@/components/Modal";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/client";
import { displayNameOf } from "@/lib/users";
import { DICE, TONES, checkLabel, classById, fmtMod } from "@/lib/adventure/rules";
import type { Campaign, Character, Post, Roll, RollData } from "@/lib/adventure/types";
import type { RoundProgress } from "@/lib/adventure/data";
import GenImage from "./GenImage";
import { MapFallback, SceneFallback } from "./art";
import CharacterSheet, { DeathPips, HpBar, PartyCard, Portrait, lifeState } from "./CharacterSheet";
import CharacterCreator from "./CharacterCreator";
import DiceModal from "./DiceModal";
import DeleteAdventure from "./DeleteAdventure";
import { DIE_COLORS } from "./Dice3D";

/* ─── Tekst narracji: akapity, **pogrubienie**, *kursywa* ───────────────── */

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-cream">
            {p.slice(2, -2)}
          </strong>
        ) : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  );
}

function RichText({ text, dropCap = false }: { text: string; dropCap?: boolean }) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={`space-y-3 ${dropCap ? "drop-cap" : ""}`}>
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          <Inline text={p} />
        </p>
      ))}
    </div>
  );
}

function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "przed chwilą";
  if (m < 60) return `${m} min temu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h temu`;
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

/* ─── Ikona kości ─────────────────────────────────────────────────────────── */

const DIE_SHAPES: Record<number, string> = {
  4: "12,2 22,20 2,20",
  6: "4,4 20,4 20,20 4,20",
  8: "12,1 22,12 12,23 2,12",
  10: "12,1 22,10 12,23 2,10",
  12: "12,1 22,8 19,21 5,21 2,8",
  20: "12,1 22,7 22,17 12,23 2,17 2,7",
};

function DieIcon({ sides, size = 22, label }: { sides: number; size?: number; label?: string | number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <polygon points={DIE_SHAPES[sides] ?? DIE_SHAPES[20]} fill={DIE_COLORS[sides] ?? DIE_COLORS[20]} stroke="#F3DFAE" strokeOpacity="0.5" strokeWidth="1" />
      {label !== undefined && (
        <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#F3DFAE" fontFamily="Georgia, serif">
          {label}
        </text>
      )}
    </svg>
  );
}

/* ─── Posty ───────────────────────────────────────────────────────────────── */

function NarrationPost({ post, innerRef }: { post: Post; innerRef?: React.Ref<HTMLElement> }) {
  const changes = post.data?.changes ?? [];
  return (
    <article ref={innerRef} className="panel gm-post scroll-mt-28 overflow-hidden">
      <GenImage
        id={post.image_id}
        alt="Ilustracja sceny"
        className="aspect-video w-full"
        fallback={<SceneFallback seed={`${post.campaign_id}-${post.id}`} />}
      />
      <div className="p-5 md:p-7">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Feather size={13} />
          </span>
          <span className="font-semibold uppercase tracking-widest text-gold">Mistrz Gry</span>
          <span suppressHydrationWarning>· {timeAgo(post.created_at)}</span>
        </div>
        {post.data?.location && (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm text-gold">
            <MapPin size={14} /> {post.data.location}
          </div>
        )}
        <div className="font-tale text-[18px] leading-relaxed text-cream/95 md:text-[19px]">
          <RichText text={post.body} dropCap />
        </div>
        {changes.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-line/60 pt-4">
            {changes.map((c, i) => (
              <span
                key={i}
                className={`chip !inline-block text-left ${
                  c.tone === "good" ? "border-felt/40 text-felt" : c.tone === "bad" ? "border-danger/40 text-danger" : "text-muted"
                }`}
              >
                <b className="font-semibold text-cream">{c.character}:</b> {c.text}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function ActionPost({ post, ch }: { post: Post; ch?: Character }) {
  const color = ch ? classById(ch.class_id)?.color : undefined;
  return (
    <div className="flex gap-3 pl-1 md:pl-6">
      <div className="portrait-frame h-12 w-10 shrink-0 rounded-lg">
        {ch ? <Portrait ch={ch} className="h-full w-full rounded-[7px]" /> : <Avatar username={post.author} size={40} />}
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-line/70 bg-panel/80 px-4 py-3" style={color ? { borderLeftColor: color, borderLeftWidth: 3 } : undefined}>
        <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="font-tale text-[15px] font-semibold text-cream">{ch?.name ?? displayNameOf(post.author)}</span>
          <span>({displayNameOf(post.author)})</span>
          <span suppressHydrationWarning>· {timeAgo(post.created_at)}</span>
        </div>
        <div className="font-tale text-[16px] leading-relaxed text-cream/90">
          <RichText text={post.body} />
        </div>
      </div>
    </div>
  );
}

function RollPost({ post, onReplay }: { post: Post; onReplay: (r: RollData) => void }) {
  const r = post.data?.roll;
  if (!r) return null;
  const hasDc = r.dc !== undefined && r.dc !== null;
  return (
    <div className="flex justify-center">
      <button
        onClick={() => onReplay(r)}
        className="group inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-line/70 bg-panel2/60 px-3 py-1.5 text-sm transition hover:border-gold/50"
        title="Odtwórz rzut"
      >
        <DieIcon sides={r.sides} label={r.result} />
        <span className="font-semibold text-cream">{r.character_name}</span>
        <span className="text-muted">{r.label}</span>
        <span className="font-mono text-xs text-muted">
          {r.result}
          {r.modifier ? ` ${fmtMod(r.modifier)} = ${r.total}` : ""}
          {hasDc ? ` vs ST ${r.dc}` : ""}
        </span>
        {hasDc && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${r.success ? "bg-felt/15 text-felt" : "bg-danger/15 text-danger"}`}>
            {r.success ? "sukces" : "porażka"}
          </span>
        )}
        {r.damage_result ? <span className="text-xs text-gold">obrażenia {r.damage_result}</span> : null}
        {r.death?.outcome === "stable" && <span className="text-xs font-semibold text-felt">ustabilizowany</span>}
        {r.death?.outcome === "revived" && <span className="text-xs font-semibold text-felt">wraca z 1 PW</span>}
        {r.death?.outcome === "dead" && <span className="text-xs font-semibold text-danger">nie żyje</span>}
        {r.death && !r.death.outcome && <DeathPips successes={r.death.successes} failures={r.death.failures} size="sm" />}
        {r.auto && <span className="text-[11px] text-muted">(auto)</span>}
        {post.body && post.body !== r.label && <span className="w-full text-center text-xs italic text-muted md:w-auto">„{post.body}”</span>}
      </button>
    </div>
  );
}

/* ─── Główny widok ────────────────────────────────────────────────────────── */

type DiceState = { open: boolean; roll: RollData | null; title?: string };

export default function AdventureClient({
  campaign,
  characters,
  posts,
  rolls,
  progress,
  me,
  isAdmin,
  gmBusy,
  gmConfigured,
  imagesEnabled,
}: {
  campaign: Campaign;
  characters: Character[];
  posts: Post[];
  rolls: Roll[];
  progress: RoundProgress;
  me: string;
  isAdmin: boolean;
  gmBusy: boolean;
  gmConfigured: boolean;
  imagesEnabled: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [remoteBusy, setRemoteBusy] = useState(gmBusy);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [mapView, setMapView] = useState<{ name: string; image_id: string | null } | null>(null);
  const [dice, setDice] = useState<DiceState>({ open: false, roll: null });
  const [helpOpen, setHelpOpen] = useState(false);

  const myChar = characters.find((c) => c.username === me);
  const canManage = campaign.created_by === me || isAdmin;
  const busy = working || remoteBusy;
  const lastId = posts.length ? posts[posts.length - 1].id : 0;
  const pendingRolls = rolls.filter((r) => r.result === null);
  const myPending = myChar ? pendingRolls.filter((r) => r.character_id === myChar.id) : [];
  const tone = TONES.find((t) => t.id === campaign.tone);

  useEffect(() => setRemoteBusy(gmBusy), [gmBusy]);

  // Tura MG. force=false — serwer sam sprawdza, czy runda jest gotowa (wszyscy zagrali / minął termin)
  const advance = useCallback(
    async (force: boolean) => {
      setWorking(true);
      setError(null);
      const res = await api(`/api/przygoda/${campaign.id}/advance`, "POST", { force });
      setWorking(false);
      if (!res.ok && force) setError(res.error ?? "Nie udało się");
      router.refresh();
    },
    [campaign.id, router]
  );

  // Odpytywanie: nowe posty innych graczy i tura MG uruchomiona przez kogoś innego
  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      const res = await api(`/api/przygoda/${campaign.id}/state`, "GET");
      if (!res.ok) return;
      setRemoteBusy(res.data.busy);
      if (res.data.lastPostId !== lastId || res.data.status !== campaign.status) router.refresh();
    };
    const t = setInterval(tick, busy ? 4000 : 10000);
    return () => clearInterval(t);
  }, [campaign.id, campaign.status, lastId, busy, router]);

  // Termin rundy minął, a ktoś już zagrał — rozstrzygamy przy pierwszym wejściu na stronę
  const deadlineTriggered = useRef(false);
  useEffect(() => {
    if (deadlineTriggered.current || campaign.status !== "active" || busy) return;
    if (progress.deadlinePassed && progress.contributions > 0) {
      deadlineTriggered.current = true;
      advance(false);
    }
  }, [campaign.status, progress.deadlinePassed, progress.contributions, busy, advance]);

  // Przewiń do najnowszej narracji MG przy wejściu i po każdej nowej turze
  const lastNarration = useMemo(() => [...posts].reverse().find((p) => p.kind === "narration"), [posts]);
  const narrationRef = useRef<HTMLElement>(null);
  const seenNarration = useRef<number | null>(null);
  useEffect(() => {
    if (!lastNarration || seenNarration.current === lastNarration.id) return;
    const first = seenNarration.current === null;
    seenNarration.current = lastNarration.id;
    // Przy pierwszym wejściu przewijamy tylko, jeśli po narracji nic nie ma (inaczej lepiej zobaczyć nowe wpisy)
    if (first && posts[posts.length - 1]?.id !== lastNarration.id) {
      window.scrollTo({ top: document.body.scrollHeight });
      return;
    }
    narrationRef.current?.scrollIntoView({ behavior: first ? "auto" : "smooth", block: "start" });
  }, [lastNarration, posts]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const res = await api(`/api/przygoda/${campaign.id}/posts`, "POST", { body: text });
    setSending(false);
    if (!res.ok) return setError(res.error ?? "Nie udało się wysłać");
    setText("");
    router.refresh();
    advance(false);
  }

  async function rollPending(r: Roll) {
    setDice({ open: true, roll: null, title: checkLabel(r.kind, r.ability, r.skill) });
    const res = await api(`/api/przygoda/${campaign.id}/rolls/${r.id}`, "POST");
    if (!res.ok) {
      setDice({ open: false, roll: null });
      return alert(res.error);
    }
    setDice({ open: true, roll: res.data.roll });
    advance(false);
  }

  async function freeRoll(sides: number) {
    setDice({ open: true, roll: null, title: `Rzut k${sides}` });
    const res = await api(`/api/przygoda/${campaign.id}/roll`, "POST", { sides });
    if (!res.ok) {
      setDice({ open: false, roll: null });
      return alert(res.error);
    }
    setDice({ open: true, roll: res.data.roll });
  }

  async function endCampaign(status: "ended" | "active") {
    if (status === "ended" && !confirm("Zakończyć przygodę? Można ją potem wznowić.")) return;
    const res = await api(`/api/przygoda/${campaign.id}`, "PATCH", { status });
    if (!res.ok) return alert(res.error);
    router.refresh();
  }

  const charOf = (username: string) => characters.find((c) => c.username === username);
  const statusOf = (c: Character): "acted" | "waiting" | "roll" | null => {
    if (campaign.status !== "active") return null;
    if (pendingRolls.some((r) => r.character_id === c.id)) return "roll";
    return progress.acted.includes(c.username) ? "acted" : "waiting";
  };
  const sheetChar = characters.find((c) => c.id === sheetId);
  const deadline = campaign.round_started_at ? new Date(campaign.round_started_at).getTime() + 24 * 3600_000 : null;
  const hoursLeft = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 3600_000)) : null;

  return (
    <div className="adventure space-y-5">
      {/* Nagłówek */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href="/przygoda" className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-cream">
            <ArrowLeft size={13} /> Wszystkie przygody
          </Link>
          <h1 className="font-tale text-4xl font-semibold leading-tight tracking-tight text-cream">{campaign.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {tone && <span className="chip text-gold">{tone.name}</span>}
            {campaign.status === "active" && <span className="chip">Runda {campaign.round}</span>}
            {campaign.status === "setup" && <span className="chip text-felt">Zbieranie drużyny</span>}
            {campaign.status === "ended" && <span className="chip">Zakończona</span>}
            {campaign.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {campaign.location}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {campaign.status === "active" && (
              <button onClick={() => endCampaign("ended")} className="btn-ghost py-1.5 text-xs">
                <Flag size={14} /> Zakończ
              </button>
            )}
            {campaign.status === "ended" && (
              <button onClick={() => endCampaign("active")} className="btn-ghost py-1.5 text-xs">
                <Play size={14} /> Wznów
              </button>
            )}
            <DeleteAdventure id={campaign.id} title={campaign.title} characters={characters.length} posts={posts.length} />
          </div>
        )}
      </div>

      {!gmConfigured && (
        <div className="panel flex items-start gap-3 border-danger/40 p-4 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-danger" />
          <div>
            Brak klucza <code className="font-mono text-gold">GEMINI_API_KEY</code> — Mistrz Gry nie może pisać. Klucz za darmo:{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-felt underline">
              aistudio.google.com/apikey
            </a>
            , potem dopisz go do <code className="font-mono">.env</code> (lokalnie) albo zmiennych w Vercelu.
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ─── Opowieść ─── */}
        <div className="min-w-0 space-y-4">
          {campaign.status === "setup" && (
            <div className="panel overflow-hidden">
              <div className="aspect-[21/9] w-full">
                <SceneFallback seed={campaign.id} />
              </div>
              <div className="space-y-4 p-6">
                <h2 className="font-tale text-2xl font-semibold text-cream">Zbierzcie drużynę</h2>
                <p className="text-sm leading-relaxed text-muted">
                  Każdy gracz tworzy jedną postać. Gdy będziecie gotowi, ktoś z drużyny klika <b className="text-cream">Rozpocznij</b>, a
                  Mistrz Gry napisze scenę otwarcia. Spóźnialscy mogą dołączyć w dowolnym momencie.
                </p>
                {campaign.premise && (
                  <blockquote className="border-l-2 border-gold/60 pl-4 font-tale text-lg italic text-cream/90">{campaign.premise}</blockquote>
                )}
                <div className="flex flex-wrap gap-2">
                  {!myChar && (
                    <button onClick={() => setCreatorOpen(true)} className="btn-primary">
                      <UserPlus size={16} /> Stwórz postać
                    </button>
                  )}
                  {(myChar || isAdmin) && (
                    <button onClick={() => advance(true)} disabled={busy || !characters.length || !gmConfigured} className={myChar ? "btn-primary" : "btn-ghost"}>
                      <Play size={16} /> {busy ? "Mistrz Gry pisze…" : `Rozpocznij przygodę (${characters.length} ${characters.length === 1 ? "postać" : "postacie"})`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {posts.map((p, i) => {
            const newRound = p.kind === "narration" && (i === 0 || posts[i - 1].round !== p.round);
            return (
              <Fragment key={p.id}>
                {newRound && (
                  <div className="round-divider">
                    <span>{p.round === 1 ? "Początek opowieści" : `Runda ${p.round}`}</span>
                  </div>
                )}
                {p.kind === "narration" && <NarrationPost post={p} innerRef={p.id === lastNarration?.id ? narrationRef : undefined} />}
                {p.kind === "action" && <ActionPost post={p} ch={charOf(p.author)} />}
                {p.kind === "roll" && <RollPost post={p} onReplay={(r) => setDice({ open: true, roll: { ...r } })} />}
                {p.kind === "system" && <div className="text-center text-xs italic text-muted">{p.body}</div>}
              </Fragment>
            );
          })}

          {busy && (
            <div className="panel flex items-center gap-4 p-5">
              <span className="quill-writing inline-flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Feather size={22} />
              </span>
              <div>
                <div className="font-tale text-lg text-cream">Mistrz Gry pisze dalszy ciąg…</div>
                <div className="text-xs text-muted">Zwykle trwa to kilkanaście sekund.</div>
              </div>
              <span className="typing-dots ml-auto" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </div>
          )}

          {!busy && (campaign.gm_error || error) && (
            <div className="panel flex flex-wrap items-center gap-3 border-danger/40 p-4 text-sm">
              <Info size={18} className="text-danger" />
              <span className="flex-1 text-cream">{error ?? campaign.gm_error}</span>
              {campaign.status !== "ended" && (
                <button onClick={() => advance(true)} className="btn-ghost py-1.5 text-xs">
                  <RefreshCw size={13} /> Spróbuj ponownie
                </button>
              )}
            </div>
          )}

          {/* ─── Twoja kolej ─── */}
          {campaign.status === "active" && !busy && (
            <div className="space-y-3">
              {myPending.map((r) => (
                <div key={r.id} className={`roll-request panel flex flex-wrap items-center gap-4 p-4 ${r.kind === "death" ? "!border-danger/60" : ""}`}>
                  <DieIcon sides={20} size={40} />
                  <div className="min-w-0 flex-1">
                    {r.kind === "death" && myChar ? (
                      <>
                        <div className="label !mb-0.5 !text-danger">Twoja postać umiera — walka o życie</div>
                        <div className="font-tale text-lg text-cream">Rzut przeciw śmierci</div>
                        <p className="text-sm text-muted">
                          Rzuć k20: <b className="text-cream">10 lub więcej</b> to sukces. <b className="text-cream">3 sukcesy</b> — przeżyjesz,{" "}
                          <b className="text-cream">3 porażki</b> — śmierć. Naturalna 20 od razu stawia na nogi z 1 PW, naturalna 1 to dwie porażki.
                        </p>
                        <div className="mt-1.5">
                          <DeathPips successes={myChar.death_successes} failures={myChar.death_failures} />
                        </div>
                      </>
                    ) : (
                      <>
                    <div className="label !mb-0.5 text-gold">Mistrz Gry prosi o rzut</div>
                    <div className="font-tale text-lg text-cream">
                      {checkLabel(r.kind, r.ability, r.skill)} <span className="text-muted">· ST {r.dc}</span>
                    </div>
                    {r.reason && <div className="text-sm text-muted">{r.reason}</div>}
                    <div className="mt-0.5 font-mono text-xs text-muted">
                      k20 {fmtMod(r.modifier)}
                      {r.damage ? ` · obrażenia ${r.damage.replace(/d/g, "k")}` : ""}
                    </div>
                      </>
                    )}
                  </div>
                  <button onClick={() => rollPending(r)} className="btn-primary px-5 py-2.5 text-base">
                    <Dices size={18} /> Rzuć k20
                  </button>
                </div>
              ))}

              {myChar && lifeState(myChar) === "dead" ? (
                <div className="panel flex flex-wrap items-center gap-3 border-danger/40 p-4 text-sm">
                  <Skull size={20} className="text-danger" />
                  <span className="flex-1 text-cream">
                    {myChar.name} nie żyje. Możesz usunąć postać w jej karcie i stworzyć nową — Mistrz Gry wprowadzi ją do opowieści.
                  </span>
                  <button onClick={() => setSheetId(myChar.id)} className="btn-ghost py-1.5 text-xs">
                    Karta postaci
                  </button>
                </div>
              ) : myChar ? (
                <form onSubmit={send} className="panel p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="portrait-frame h-9 w-8 shrink-0 rounded-md">
                        <Portrait ch={myChar} className="h-full w-full rounded-[5px]" />
                      </div>
                      <div className="text-sm">
                        <div className="font-tale text-base font-semibold text-cream">Co robi {myChar.name}?</div>
                        <div className="text-xs text-muted">
                          {progress.acted.includes(me) ? "Deklaracja na tę rundę już jest — możesz coś dopisać." : "Twoja deklaracja na tę rundę"}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setHelpOpen((v) => !v)} className="text-xs text-muted hover:text-cream">
                      <Info size={14} className="mr-1 inline" />
                      Jak grać?
                    </button>
                  </div>
                  {helpOpen && (
                    <ul className="mb-3 space-y-1 rounded-xl border border-line/60 bg-panel2/40 p-3 text-xs leading-relaxed text-muted">
                      <li>• Opisz, <b className="text-cream">co próbuje zrobić</b> Twoja postać: „Przeszukuję biurko w poszukiwaniu listów”.</li>
                      <li>• Możesz mówić w jej imieniu: „Mówię do strażnika: «Przepuść nas, mamy glejt»”.</li>
                      <li>• Nie opisuj skutku — o tym, czy się udało, zdecyduje Mistrz Gry, czasem prosząc o rzut kością.</li>
                      <li>• Gdy wszyscy zagrają (albo po 24 h), Mistrz Gry pisze dalszy ciąg. Można też go popchnąć przyciskiem.</li>
                    </ul>
                  )}
                  <textarea
                    className="input min-h-[96px] font-tale !text-[16px] leading-relaxed"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
                    }}
                    placeholder={myChar.hp > 0 ? "Opisz działanie albo słowa postaci…" : "Twoja postać jest nieprzytomna — możesz opisać jej myśli albo poczekać na pomoc drużyny."}
                    maxLength={2000}
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-muted">Ctrl+Enter wysyła</span>
                    <button className="btn-primary" disabled={sending || !text.trim()}>
                      <Send size={15} /> {sending ? "Wysyłanie…" : "Wyślij"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="panel flex flex-wrap items-center gap-3 p-4">
                  <UserPlus size={20} className="text-gold" />
                  <span className="flex-1 text-sm text-cream">Nie masz jeszcze postaci w tej przygodzie.</span>
                  <button onClick={() => setCreatorOpen(true)} className="btn-primary">
                    Dołącz do drużyny
                  </button>
                </div>
              )}

              {/* Stan rundy */}
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line/60 bg-panel/50 px-4 py-3 text-sm">
                <Hourglass size={16} className="text-gold" />
                <div className="flex-1 text-muted">
                  {progress.waitingFor.length ? (
                    <>
                      Czekamy na:{" "}
                      {progress.waitingFor.map((u, i) => (
                        <span key={u} className="text-cream">
                          {charOf(u)?.name ?? displayNameOf(u)}
                          {i < progress.waitingFor.length - 1 ? ", " : ""}
                        </span>
                      ))}
                      {progress.contributions > 0 && hoursLeft !== null && (
                        <span> · Mistrz Gry rozstrzygnie sam za ~{hoursLeft} h</span>
                      )}
                    </>
                  ) : (
                    "Wszyscy zagrali — Mistrz Gry zaraz odpowie."
                  )}
                </div>
                {(progress.contributions > 0 || isAdmin) && (
                  <button onClick={() => advance(true)} disabled={!gmConfigured} className="btn-ghost py-1.5 text-xs" title="Nie czekaj na resztę — MG rozstrzyga teraz, zaległe rzuty wykona automatycznie">
                    <Play size={13} /> Popchnij fabułę
                  </button>
                )}
              </div>
            </div>
          )}

          {campaign.status === "ended" && posts.length > 0 && (
            <div className="round-divider">
              <span>Koniec przygody</span>
            </div>
          )}
        </div>

        {/* ─── Panel boczny ─── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <section className="panel overflow-hidden">
            <button
              className="relative block aspect-[4/3] w-full"
              onClick={() => campaign.location && setMapView({ name: campaign.location, image_id: campaign.map_image_id })}
              aria-label="Powiększ mapę"
            >
              <GenImage
                id={campaign.map_image_id}
                alt={`Mapa: ${campaign.location ?? ""}`}
                className="h-full w-full"
                loadingLabel="Rysowanie mapy…"
                fallback={<MapFallback seed={campaign.location ?? campaign.id} />}
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-left">
                <span className="flex items-center gap-1.5 font-tale text-lg text-[#F3DFAE]">
                  <Compass size={16} /> {campaign.location ?? "Nieznane ziemie"}
                </span>
              </span>
            </button>
            {campaign.locations.length > 1 && (
              <div className="flex flex-wrap gap-1 p-3">
                {campaign.locations.map((l, i) => (
                  <button
                    key={`${l.name}-${i}`}
                    onClick={() => setMapView(l)}
                    className={`chip !py-0.5 text-[11px] hover:text-cream ${i === campaign.locations.length - 1 ? "text-gold" : ""}`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="panel p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="label !mb-0">Drużyna</h2>
              {!myChar && campaign.status !== "ended" && (
                <button onClick={() => setCreatorOpen(true)} className="text-xs text-felt hover:underline">
                  + dołącz
                </button>
              )}
            </div>
            <div className="space-y-2">
              {characters.map((c) => (
                <PartyCard key={c.id} ch={c} status={statusOf(c)} onOpen={() => setSheetId(c.id)} />
              ))}
              {!characters.length && <p className="px-1 text-sm text-muted">Jeszcze nikogo. Stwórz pierwszą postać!</p>}
            </div>
          </section>

          {campaign.enemies.length > 0 && (
            <section className="panel border-danger/30 p-3">
              <h2 className="label mb-2 inline-flex items-center gap-1.5 px-1 !text-danger">
                <Swords size={12} /> Wrogowie
              </h2>
              <div className="space-y-2">
                {campaign.enemies.map((e, i) => (
                  <div key={i} className="rounded-xl border border-line/60 bg-panel2/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cream">
                        <Skull size={13} className="text-danger" /> {e.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted">KP {e.ac}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <HpBar hp={e.hp} max={e.max_hp} enemy thin />
                      <span className="shrink-0 font-mono text-[10px] text-muted">
                        {e.hp}/{e.max_hp}
                      </span>
                    </div>
                    {e.note && <div className="mt-1 text-[11px] text-muted">{e.note}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {myChar && campaign.status === "active" && (
            <section className="panel p-3">
              <h2 className="label mb-2 px-1">Rzut swobodny</h2>
              <div className="grid grid-cols-6 gap-1.5">
                {DICE.map((d) => (
                  <button
                    key={d}
                    onClick={() => freeRoll(d)}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-line/60 bg-panel2/40 py-1.5 text-[11px] font-semibold text-muted transition hover:-translate-y-0.5 hover:border-gold/50 hover:text-cream"
                  >
                    <DieIcon sides={d} size={24} />k{d}
                  </button>
                ))}
              </div>
            </section>
          )}

          {campaign.summary && (
            <details className="panel group p-4">
              <summary className="label !mb-0 flex cursor-pointer list-none items-center gap-1.5">
                <BookOpen size={12} /> Kronika drużyny
                <span className="ml-auto text-[10px] normal-case tracking-normal text-muted group-open:hidden">pokaż</span>
              </summary>
              <p className="mt-3 whitespace-pre-line font-tale text-[15px] leading-relaxed text-cream/90">{campaign.summary}</p>
            </details>
          )}
        </aside>
      </div>

      <Modal open={!!sheetChar} onClose={() => setSheetId(null)} title="Karta postaci" wide>
        {sheetChar && (
          <CharacterSheet
            ch={sheetChar}
            canEdit={sheetChar.username === me || isAdmin}
            imagesEnabled={imagesEnabled}
            onDeleted={() => setSheetId(null)}
          />
        )}
      </Modal>

      <Modal open={creatorOpen} onClose={() => setCreatorOpen(false)} title="Nowa postać" wide>
        <CharacterCreator campaignId={campaign.id} onDone={() => setCreatorOpen(false)} />
      </Modal>

      <Modal open={!!mapView} onClose={() => setMapView(null)} title={mapView?.name ?? "Mapa"} wide>
        {mapView && (
          <GenImage
            id={mapView.image_id}
            alt={`Mapa: ${mapView.name}`}
            className="aspect-[4/3] w-full rounded-xl"
            loadingLabel="Rysowanie mapy…"
            fallback={<MapFallback seed={mapView.name} />}
          />
        )}
      </Modal>

      <DiceModal open={dice.open} roll={dice.roll} title={dice.title} onClose={() => setDice({ open: false, roll: null })} />
    </div>
  );
}
