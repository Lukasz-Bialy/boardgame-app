import Link from "next/link";
import { Castle, Dices, Feather, Info, MapPin, ScrollText, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listCampaigns } from "@/lib/adventure/data";
import { imageProviderName } from "@/lib/adventure/images";
import { TONES } from "@/lib/adventure/rules";
import NewCampaignForm from "@/components/adventure/NewCampaignForm";
import GenImage from "@/components/adventure/GenImage";
import DeleteAdventure from "@/components/adventure/DeleteAdventure";
import { PortraitFallback, SceneFallback } from "@/components/adventure/art";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Users, title: "Stwórz postać", text: "Wybierz rasę i klasę — elfią łuczniczkę, krasnoludzkiego wojownika… Liczby dobiorą się same." },
  { icon: Feather, title: "Mistrz Gry opisuje", text: "AI prowadzi opowieść: opisuje świat, gra wszystkich napotkanych bohaterów i potwory." },
  { icon: ScrollText, title: "Deklarujesz działanie", text: "Kiedy masz czas, piszesz, co robi Twoja postać. Nie trzeba grać wszystkim naraz." },
  { icon: Dices, title: "Kości rozstrzygają", text: "Gdy wynik jest niepewny, rzucasz k20. Wynik + premia postaci ≥ trudność = sukces." },
];

function ago(iso: string | null): string {
  if (!iso) return "—";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600_000);
  if (h < 1) return "przed chwilą";
  if (h < 24) return `${h} h temu`;
  return `${Math.round(h / 24)} dni temu`;
}

export default async function AdventuresPage() {
  const session = (await getSession())!;
  const campaigns = await listCampaigns();
  const gmConfigured = !!process.env.GEMINI_API_KEY;
  const images = imageProviderName();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Przygoda</h1>
          <p className="text-sm text-muted">Gra fabularna w stylu D&D z AI jako Mistrzem Gry · każdy gra, kiedy ma czas</p>
        </div>
        <NewCampaignForm />
      </div>

      {(!gmConfigured || !images) && (
        <div className="panel flex items-start gap-3 p-4 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-gold" />
          <div className="space-y-1 text-muted">
            {!gmConfigured && (
              <p>
                <b className="text-cream">Brak klucza Gemini.</b> Wygeneruj darmowy klucz na{" "}
                <a className="text-felt underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  aistudio.google.com/apikey
                </a>{" "}
                i dodaj jako <code className="font-mono text-gold">GEMINI_API_KEY</code>.
              </p>
            )}
            {!images && (
              <p>
                <b className="text-cream">Obrazki AI są wyłączone</b> — widać grafiki zastępcze. Żeby generować portrety, sceny i mapy,
                ustaw <code className="font-mono text-gold">CF_ACCOUNT_ID</code> + <code className="font-mono text-gold">CF_API_TOKEN</code>{" "}
                (Cloudflare Workers AI, darmowy dzienny limit) — szczegóły w <code className="font-mono">.env.example</code>.
              </p>
            )}
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="panel overflow-hidden">
          <div className="relative aspect-[21/7] w-full">
            <SceneFallback seed="pierwsza-przygoda" />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-center">
              <Castle size={42} className="text-[#F3DFAE]" />
              <p className="mt-2 font-tale text-2xl text-[#F3DFAE]">Wasza pierwsza przygoda czeka</p>
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold">
                    <s.icon size={16} />
                  </span>
                  <span className="text-xs font-bold text-muted">{i + 1}.</span>
                  <span className="font-tale text-lg font-semibold text-cream">{s.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <div key={c.id} className="relative">
            <Link href={`/przygoda/${c.id}`} className="panel group flex h-full flex-col overflow-hidden transition hover:border-gold/50">
              <div className="relative aspect-video w-full">
                <GenImage id={c.cover_image_id} alt={c.title} className="h-full w-full" fallback={<SceneFallback seed={c.id} />} />
                <span className="absolute left-3 top-3">
                  {c.status === "active" && <span className="chip border-felt/40 bg-black/50 text-felt backdrop-blur">Runda {c.round}</span>}
                  {c.status === "setup" && <span className="chip border-gold/40 bg-black/50 text-gold backdrop-blur">Zbieranie drużyny</span>}
                  {c.status === "ended" && <span className="chip bg-black/50 text-[#F3DFAE] backdrop-blur">Zakończona</span>}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="font-tale text-2xl font-semibold leading-tight text-cream group-hover:text-gold">{c.title}</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="text-gold">{TONES.find((t) => t.id === c.tone)?.name}</span>
                  {c.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {c.location}
                    </span>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex -space-x-2">
                    {c.party.map((p) => (
                      <div key={p.username} title={p.name} className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-panel">
                        <GenImage
                          id={p.portrait_image_id}
                          alt={p.name}
                          className="h-full w-full"
                          loadingLabel=""
                          fallback={<PortraitFallback classId={p.class_id} raceId={p.race_id} name={p.name} />}
                        />
                      </div>
                    ))}
                    {!c.party.length && <span className="text-xs text-muted">brak postaci</span>}
                  </div>
                  <span className="text-xs text-muted">{ago(c.last_post_at ?? c.created_at)}</span>
                </div>
              </div>
            </Link>
            {/* Poza linkiem kafelka, żeby kliknięcia w potwierdzeniu nie otwierały przygody */}
            {(c.created_by === session.username || session.role === "admin") && (
              <div className="absolute right-3 top-3">
                <DeleteAdventure id={c.id} title={c.title} characters={c.party.length} posts={c.post_count} variant="overlay" />
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
