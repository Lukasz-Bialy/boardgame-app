import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Castle,
  Check,
  Dices,
  Gift,
  Heart,
  History,
  Shuffle,
  Swords,
  Trophy,
  UtensilsCrossed,
  Vote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import { Logo, Wordmark } from "@/components/ui";
import ThemeToggle from "@/components/ThemeToggle";
import { AvatarStack, BrowserFrame, MOCK_GAMES, MOCK_USERS, GameCover } from "@/components/landing/mock";
import { DashboardScreen } from "@/components/landing/screens";
import ScreenShowcase from "@/components/landing/ScreenShowcase";
import LoginPopover, { LoginButton } from "@/components/landing/LoginPopover";
import LandingNav from "@/components/landing/LandingNav";

export const dynamic = "force-dynamic";

// Szeryfowy krój narracji z zakładki Przygoda — makiety w sekcji Przygoda używają klasy .font-tale
const tale = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  variable: "--font-tale",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "PawnSpawn — planszówki i gry w jednym klubie",
  description: "Kolekcja gier, wyniki partii, ankiety, kalendarz spotkań i liga ekipy w League of Legends.",
};

type Feature = { icon: LucideIcon; title: string; text: string; accent: "felt" | "gold"; wide?: boolean };

const FEATURES: Feature[] = [
  { icon: Dices, title: "Kolekcja gier", text: "Wszystkie pudełka z okładkami, liczbą graczy, czasem partii i oceną całej ekipy.", accent: "felt", wide: true },
  { icon: History, title: "Historia i statystyki", text: "Każda partia z miejscami graczy. Widać, kto ile razy był na podium.", accent: "gold" },
  { icon: Vote, title: "Ankiety", text: "Wybór gry albo terminu w kilka sekund, z linkiem do udostępnienia.", accent: "felt" },
  { icon: CalendarDays, title: "Kalendarz", text: "Siatka miesiąca z zaplanowanymi wieczorami, żeby nikt nie przegapił spotkania.", accent: "gold" },
  { icon: Swords, title: "Liga", text: "Wspólne mecze w League of Legends: wykresy winrate, podział ról, kontry, nawyki i ranking Harnasia.", accent: "felt" },
  { icon: Castle, title: "Przygoda z AI", text: "Kampania RPG przez posty: AI prowadzi fabułę, rysuje sceny, a kości 3D rzuca serwer.", accent: "gold", wide: true },
  { icon: Shuffle, title: "Losowanie", text: "Kto zaczyna, kto siedzi gdzie i co dziś gramy. Rozstrzyga los.", accent: "felt" },
  { icon: Heart, title: "Wishlista", text: "Gry, które warto kupić, z linkiem i notatką.", accent: "gold" },
  { icon: UtensilsCrossed, title: "Kącik kebabowy", text: "Wspólne zamówienie jedzenia bez przepisywania z czatu.", accent: "felt" },
  { icon: Gift, title: "Święta", text: "Losowanie prezentów, w którym nikt nie trafi na samego siebie.", accent: "gold" },
];

const STEPS = [
  { n: "01", title: "Zaproś ekipę", text: "Każdy dostaje własne konto i awatar. Na zwykły wieczór gier wystarczy kilka osób." },
  { n: "02", title: "Dodaj swoją półkę", text: "Wpisz gry z kolekcji. Oceny, partie i statystyki zbierają się same." },
  { n: "03", title: "Graj, głosuj, wygrywaj", text: "Ankieta wybiera grę, kalendarz pilnuje terminu, a liga liczy punkty." },
];

export default async function Home() {
  if (await getSession()) redirect("/dashboard");

  return (
    <div className={`overflow-x-clip ${tale.variable}`}>
      {/* ─── Belka ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 px-4 pt-4">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 rounded-2xl border border-line/60 bg-surface/70 px-4 py-2.5 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={68} />
            <Wordmark className="text-lg" />
          </Link>
          <LandingNav />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <LoginButton header className="btn-primary">
              Zaloguj się
            </LoginButton>
          </div>
        </nav>
      </header>

      <main>
        {/* ─── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="landing-rise inline-flex items-center gap-2 rounded-full border border-line bg-panel/70 py-1 pl-1 pr-3 text-xs text-muted">
              <span className="rounded-full bg-felt-soft px-2 py-0.5 font-semibold text-felt">Nowość</span>
              Przygoda RPG z AI jako Mistrzem Gry
            </span>
            <h1 className="landing-rise mt-6 font-display text-5xl font-extrabold leading-[1.02] tracking-tight [animation-delay:80ms] sm:text-7xl">
              Klub planszówkowy
              <br />
              <span className="bg-gradient-to-r from-felt via-felt to-gold bg-clip-text text-transparent">w jednej aplikacji</span>
            </h1>
            <p className="landing-rise mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted [animation-delay:160ms]">
              Kolekcja gier, wyniki partii, ankiety, kalendarz spotkań i liga. Mniej ustalania na czacie, więcej czasu przy stole.
            </p>
            <div className="landing-rise mt-9 flex flex-col items-center justify-center gap-3 [animation-delay:240ms] sm:flex-row">
              <LoginButton className="btn-primary px-6 py-3 text-base">
                Wejdź do klubu <ArrowRight size={18} />
              </LoginButton>
              <a href="#ekrany" className="btn-ghost px-6 py-3 text-base">
                Zobacz widoki
              </a>
            </div>
            <div className="landing-rise mt-8 flex items-center justify-center gap-3 text-sm text-muted [animation-delay:320ms]">
              <AvatarStack size={30} />
              <span>
                <b className="text-cream">5 graczy</b> · 312 rozegranych partii
              </span>
            </div>
          </div>

          {/* Makieta pulpitu z pływającymi kartami */}
          <div className="landing-rise relative mx-auto mt-16 max-w-5xl [animation-delay:400ms]">
            <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-10 -z-10 rounded-[3rem] bg-gradient-to-b from-felt/20 via-gold/10 to-transparent blur-3xl" />
            <BrowserFrame url="pawnspawn.gg/dashboard">
              <DashboardScreen />
            </BrowserFrame>

            <div className="landing-float absolute -left-12 top-40 hidden w-56 rounded-2xl border border-line bg-panel/95 p-3.5 shadow-panel backdrop-blur lg:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Nowa ankieta</p>
              <p className="mt-1 text-sm font-semibold">Kiedy gramy w tym tygodniu?</p>
              <div className="mt-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-felt-soft px-2 py-1 text-felt">
                  <span className="flex items-center gap-1.5"><Check size={12} /> Piątek, 19:00</span>
                  <b>4</b>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-panel2 px-2 py-1 text-muted">
                  <span>Sobota, 17:00</span>
                  <b>2</b>
                </div>
              </div>
            </div>

            <div className="landing-float absolute -right-6 bottom-16 hidden w-60 items-center gap-3 rounded-2xl border border-line bg-panel/95 p-3.5 shadow-panel backdrop-blur [animation-delay:-3s] lg:flex">
              <GameCover game={MOCK_GAMES[3]} className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  <Trophy size={11} /> Zwycięstwo
                </p>
                <p className="truncate text-sm font-semibold">{MOCK_USERS[3].name} · {MOCK_GAMES[3].name}</p>
                <p className="text-xs text-muted">+24 pkt w lidze</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Pasek gier ──────────────────────────────────────────────────── */}
        <section aria-label="Przykładowe gry" className="border-y border-line/60 bg-surface/40 py-6">
          <div className="landing-marquee flex w-max gap-4">
            {[...MOCK_GAMES, ...MOCK_GAMES].map((g, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line/60 bg-panel/60 py-2 pl-2 pr-4" aria-hidden={i >= MOCK_GAMES.length}>
                <GameCover game={g} className="h-9 w-9 rounded-lg" />
                <span className="whitespace-nowrap text-sm font-semibold">{g.name}</span>
                <span className="whitespace-nowrap font-mono text-xs text-muted">{g.players} os.</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Możliwości ─────────────────────────────────────────────────────── */}
        <section id="funkcje" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
          <div className="max-w-2xl">
            <p className="label !text-felt">Możliwości</p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Wszystko, czego potrzebuje stół</h2>
            <p className="mt-4 text-lg text-muted">Dziesięć modułów, jedno logowanie. Używasz tych, które pasują do Waszej ekipy.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <article
                  key={f.title}
                  className={`panel group relative overflow-hidden p-6 transition duration-300 hover:-translate-y-1 ${f.accent === "felt" ? "hover:border-felt/50" : "hover:border-gold/50"} ${f.wide ? "lg:col-span-2" : ""}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${f.accent === "felt" ? "from-felt/70 via-felt/30" : "from-gold/70 via-gold/30"} to-transparent`} />
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${f.accent === "felt" ? "bg-felt-soft text-felt" : "bg-gold-soft text-gold"}`}>
                    <Icon size={21} />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
                  <Icon size={110} aria-hidden className="absolute -bottom-6 -right-6 opacity-[0.05] transition duration-500 group-hover:rotate-6 group-hover:opacity-[0.09]" />
                </article>
              );
            })}
          </div>
        </section>

        {/* ─── Widoki ──────────────────────────────────────────────────────── */}
        <section id="ekrany" className="scroll-mt-24 border-y border-line/60 bg-surface/40 py-24">
          <div className="mx-auto max-w-6xl px-4">
            <p className="label !text-felt">Widoki</p>
            <h2 className="max-w-2xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Zajrzyj do środka</h2>
            <p className="mb-12 mt-4 max-w-2xl text-lg text-muted">Każdy moduł klubu ma swój ekran. Kliknij zakładkę albo poczekaj, a ekrany zmienią się same.</p>
            <ScreenShowcase set="club" />
          </div>
        </section>

        {/* ─── Liga ────────────────────────────────────────────────────────── */}
        <section id="liga" className="relative scroll-mt-24 py-24">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(800px_400px_at_50%_0%,rgb(var(--c-gold)/0.10),transparent_70%)]" />
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="label !text-gold">League of Legends</p>
              <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Analityka, która wie, czemu przegraliście</h2>
              <p className="mt-4 text-lg text-muted">
                Mecze ekipy pobierane automatycznie z Riot API. Do tego wykresy winrate, podział ról, progres, kontry, nawyki,
                analiza meczów minuta po minucie i miesięczny ranking MVP.
              </p>
            </div>
            <dl className="mx-auto mb-12 mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["8", "widoków analityki"],
                ["0–100", "score gracza w meczu"],
                ["9", "metryk w score Harnasia"],
                ["4", "filtry: daty, gracze, premade, typ gry"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-2xl border border-line bg-panel/70 p-4 text-center">
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-display text-3xl font-extrabold tabular-nums text-gold">{v}</dd>
                  <dd className="mt-1 text-[11px] uppercase tracking-wider text-muted">{l}</dd>
                </div>
              ))}
            </dl>
            <ScreenShowcase set="liga" />
          </div>
        </section>

        {/* ─── Przygoda ───────────────────────────────────────────────────── */}
        <section id="przygoda" className="relative scroll-mt-24 border-y border-line/60 bg-surface/40 py-24">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(800px_400px_at_50%_0%,rgb(var(--c-gold)/0.08),transparent_70%)]" />
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="label !text-gold">Przygoda RPG</p>
              <h2 className="font-tale text-4xl font-semibold tracking-tight sm:text-6xl">Sesja D&amp;D, na którą każdy ma czas</h2>
              <p className="mt-4 text-lg text-muted">
                Gra fabularna przez posty z AI jako Mistrzem Gry. Mistrz opowiada i maluje sceny, każdy dopisuje ruch swojej postaci,
                kiedy może, a kości i zasady liczy serwer, więc nikt nie oszuka wyniku.
              </p>
            </div>
            <dl className="mx-auto mb-12 mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["9 · 10", "ras i klas wg SRD 5.1"],
                ["k4–k20", "kości 3D rzucane przez serwer"],
                ["24 h", "na ruch w rundzie"],
                ["5", "klimatów kampanii"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-2xl border border-line bg-panel/70 p-4 text-center">
                  <dt className="sr-only">{l}</dt>
                  <dd className="font-tale text-3xl font-semibold tabular-nums text-gold">{v}</dd>
                  <dd className="mt-1 text-[11px] uppercase tracking-wider text-muted">{l}</dd>
                </div>
              ))}
            </dl>
            <ScreenShowcase set="przygoda" />
          </div>
        </section>

        {/* ─── Jak zacząć ───────────────────────────────────────────────── */}
        <section id="jak" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
          <div className="text-center">
            <p className="label !text-felt">Jak zacząć</p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Trzy kroki do pierwszej partii</h2>
          </div>
          <div className="relative mt-14">
            <div aria-hidden className="absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" />
            <ol className="relative grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-panel font-mono text-lg font-bold text-felt shadow-panel">
                    {s.n}
                  </span>
                  <h3 className="mt-6 font-display text-xl font-bold">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>

          <dl className="mt-20 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["48", "gier w kolekcji"],
              ["312", "zapisanych partii"],
              ["27", "rozstrzygniętych ankiet"],
              ["1", "wspólny stół"],
            ].map(([v, l]) => (
              <div key={l} className="panel p-6 text-center">
                <dt className="sr-only">{l}</dt>
                <dd className="font-display text-4xl font-extrabold tabular-nums">{v}</dd>
                <dd className="mt-1 text-[11px] uppercase tracking-wider text-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ─── CTA ─────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="panel relative overflow-hidden px-6 py-16 text-center sm:px-16">
            <div aria-hidden className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-felt/20 blur-3xl" />
            <div aria-hidden className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
            <Dices aria-hidden size={160} className="landing-float absolute -right-6 top-6 hidden opacity-[0.06] sm:block" />
            <div className="relative">
              <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Stół już rozłożony</h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-muted">Zaloguj się i sprawdź, co ekipa zaplanowała na najbliższy wieczór.</p>
              <LoginButton className="btn-primary mt-8 px-7 py-3 text-base">
                Zaloguj się <ArrowRight size={18} />
              </LoginButton>
            </div>
          </div>
        </section>
      </main>

      <Suspense>
        <LoginPopover />
      </Suspense>

      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row">
          <span className="flex items-center gap-2">
            <Logo size={45} /> <Wordmark /> · planszówki i gry w jednym klubie
          </span>
          <span className="text-xs">Na zrzutach ekranów są przykładowe dane i fikcyjni gracze.</span>
        </div>
      </footer>
    </div>
  );
}
