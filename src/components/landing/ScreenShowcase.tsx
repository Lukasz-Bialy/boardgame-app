"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Castle,
  Crown,
  Dices,
  Gift,
  Heart,
  History,
  LayoutDashboard,
  Microscope,
  Shield,
  Shuffle,
  Swords,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Vote,
  Coffee,
  Feather,
  PenLine,
  ScrollText,
  Skull,
  UserPlus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrowserFrame } from "./mock";
import { CollectionScreen, DashboardScreen, PollScreen } from "./screens";
import { CalendarScreen, DrawScreen, GameDetailScreen, HistoryScreen, KebabScreen, SwietaScreen, WishlistScreen } from "./screens-club";
import {
  LigaChartsScreen,
  LigaCountersScreen,
  LigaDeepScreen,
  LigaHabitsScreen,
  LigaHarnasScreen,
  LigaMatchesScreen,
  LigaProgressScreen,
  LigaRolesScreen,
} from "./screens-liga";
import {
  AdvCampaignsScreen,
  AdvCombatScreen,
  AdvCreatorScreen,
  AdvNewCampaignScreen,
  AdvRollScreen,
  AdvSheetScreen,
  AdvStoryScreen,
} from "./screens-przygoda";

const PANEL_HEIGHT = {
  club: "h-[740px] sm:h-[550px]",
  liga: "h-[795px] sm:h-[615px]",
  przygoda: "h-[715px] sm:h-[650px]",
} as const;

type SetKey = keyof typeof PANEL_HEIGHT;

type Tab = { key: string; label: string; icon: LucideIcon; url: string; title: string; text: string; Screen: () => JSX.Element };

// Zestawy zdefiniowane tutaj, bo komponentów ekranów nie da się przekazać z serwera jako propsów
const SETS: Record<SetKey, Tab[]> = {
  club: [
    { key: "pulpit", label: "Pulpit", icon: LayoutDashboard, url: "pawnspawn.gg/dashboard", title: "Wszystko na start", text: "Ostatnie zwycięstwa, najwyżej oceniane gry, otwarte ankiety i najbliższe spotkanie na jednym ekranie.", Screen: DashboardScreen },
    { key: "kolekcja", label: "Kolekcja", icon: Dices, url: "pawnspawn.gg/games", title: "Cała półka w jednym miejscu", text: "Liczba graczy, czas partii, średnia ocen ekipy i licznik rozgrywek przy każdym pudełku.", Screen: CollectionScreen },
    { key: "gra", label: "Karta gry", icon: BookOpen, url: "pawnspawn.gg/games/wyspa-kartografow", title: "Oceny i wyniki każdej gry", text: "Każdy wystawia własną ocenę 1–10, a po partii zapisujecie, kto zajął które miejsce.", Screen: GameDetailScreen },
    { key: "historia", label: "Historia", icon: History, url: "pawnspawn.gg/history", title: "Twoje statystyki", text: "Ile partii, ile zwycięstw i jak często stajesz na podium w każdej grze.", Screen: HistoryScreen },
    { key: "ankiety", label: "Ankiety", icon: Vote, url: "pawnspawn.gg/polls/piatek", title: "Koniec z „to w co gramy?”", text: "Głosowanie na grę albo termin, wyniki na żywo i link, który wrzucisz na czat.", Screen: PollScreen },
    { key: "kalendarz", label: "Kalendarz", icon: CalendarDays, url: "pawnspawn.gg/calendar", title: "Terminy w jednym miejscu", text: "Siatka miesiąca ze spotkaniami, a przy spotkaniu podpięta ankieta, w co gracie.", Screen: CalendarScreen },
    { key: "wishlista", label: "Wishlista", icon: Heart, url: "pawnspawn.gg/wishlist", title: "Co kupić następne", text: "Wspólna lista gier do kupienia z linkiem, notatką i informacją, kto ją dodał.", Screen: WishlistScreen },
    { key: "losowanie", label: "Losowanie", icon: Shuffle, url: "pawnspawn.gg/draw", title: "Los rozstrzyga spory", text: "Kto zaczyna, kto gra na jakiej roli albo dowolne własne wartości do rozlosowania.", Screen: DrawScreen },
    { key: "kebab", label: "Kebab", icon: UtensilsCrossed, url: "pawnspawn.gg/kebab", title: "Wspólne zamówienie i rozliczenie", text: "Kto co zamówił, kto zapłacił, ile kto oddaje za dostawę i jak oceniacie lokal.", Screen: KebabScreen },
    { key: "swieta", label: "Święta", icon: Gift, url: "pawnspawn.gg/swieta/prezenty", title: "Losowanie prezentów", text: "Każdy odpakowuje swoją parę i wie tylko, komu kupuje. Nikt nie trafi na siebie.", Screen: SwietaScreen },
  ],
  liga: [
    { key: "mecze", label: "Mecze", icon: Swords, url: "pawnspawn.gg/liga", title: "Wspólne mecze razem", text: "Każda gra ekipy z KDA, CS, udziałem w killach, obrażeniami, przedmiotami i score gracza. Najlepszy z ekipy dostaje Harnasia.", Screen: LigaMatchesScreen },
    { key: "wykresy", label: "Wykresy", icon: BarChart3, url: "pawnspawn.gg/liga?tab=wykresy", title: "Kiedy gracie najlepiej", text: "Mapy cieplne winrate według pory dnia, dnia tygodnia i liczby osób w premade oraz bilans gier dzień po dniu.", Screen: LigaChartsScreen },
    { key: "role", label: "Role", icon: Users, url: "pawnspawn.gg/liga?tab=analityka&sub=role", title: "Rekomendowany podział ról", text: "Kto na której linii najczęściej wygrywa, z szacowanym winrate, pewnością i najlepszymi bohaterami.", Screen: LigaRolesScreen },
    { key: "progres", label: "Progres", icon: TrendingUp, url: "pawnspawn.gg/liga?tab=analityka&sub=progres", title: "Progres na rolach", text: "Porównanie okresów: score, winrate i metryka, która zmieniła się najbardziej, ze średnią kroczącą z 5 gier.", Screen: LigaProgressScreen },
    { key: "kontry", label: "Kontry i linie", icon: Shield, url: "pawnspawn.gg/liga?tab=analityka&sub=kontry", title: "Gdzie tracicie najwięcej", text: "Najsłabsza linia, najtrudniejsi rywale, kandydaci do bana oraz własne picki, które działają i które nie.", Screen: LigaCountersScreen },
    { key: "nawyki", label: "Nawyki", icon: Coffee, url: "pawnspawn.gg/liga?tab=analityka&sub=nawyki", title: "Zmęczenie, tilt i duety", text: "Która gra wieczoru idzie najgorzej, co dzieje się po porażkach, jak długość meczu wpływa na wynik i które duety mają synergię.", Screen: LigaHabitsScreen },
    { key: "analiza", label: "Analiza meczów", icon: Microscope, url: "pawnspawn.gg/liga?tab=analityka&sub=analiza", title: "Co poszło najgorzej", text: "Przewaga złota w czasie, cele mapy kontra rywal oraz słabe i mocne strony drużyny i każdego gracza względem rywala z linii.", Screen: LigaDeepScreen },
    { key: "harnas", label: "Ranking Harnasia", icon: Crown, url: "pawnspawn.gg/liga?tab=harnas", title: "Ranking Harnasia 🍺", text: "Miesięczne podium MVP ekipy: kto najczęściej był najlepszy w meczach, w których grały co najmniej 3 osoby.", Screen: LigaHarnasScreen },
  ],
  przygoda: [
    { key: "kampanie", label: "Kampanie", icon: Castle, url: "pawnspawn.gg/przygoda", title: "Wasze kampanie", text: "Każda przygoda ma okładkę, klimat, miejsce akcji i drużynę. Widać, która czeka na graczy, a która już się skończyła.", Screen: AdvCampaignsScreen },
    { key: "nowa", label: "Nowa przygoda", icon: ScrollText, url: "pawnspawn.gg/przygoda/nowa", title: "Wybierz klimat i zacznij", text: "Klasyczne fantasy, mroczne, z przymrużeniem oka, horror albo intryga. Pomysł na start możesz wpisać, wylosować albo zostawić Mistrzowi Gry.", Screen: AdvNewCampaignScreen },
    { key: "kreator", label: "Kreator postaci", icon: UserPlus, url: "pawnspawn.gg/przygoda/mlyn/postac", title: "Postać w dwie minuty", text: "9 ras i 10 klas według SRD 5.1. Cechy dobierają się same pod klasę, a portret maluje AI na podstawie opisu wyglądu.", Screen: AdvCreatorScreen },
    { key: "opowiesc", label: "Opowieść", icon: Feather, url: "pawnspawn.gg/przygoda/mlyn", title: "AI opowiada, wy decydujecie", text: "Mistrz Gry opisuje świat i maluje sceny, a każdy dopisuje ruch swojej postaci, kiedy ma czas. Po 24 h albo po „Popchnij fabułę” historia rusza dalej.", Screen: AdvStoryScreen },
    { key: "rzut", label: "Rzut kością", icon: Dices, url: "pawnspawn.gg/przygoda/mlyn#rzut", title: "Kości rzuca serwer", text: "Mistrz Gry prosi o test, a premie liczą się same z karty postaci. Kość toczy się w 3D po zielonym suknie i nikt nie może oszukać.", Screen: AdvRollScreen },
    { key: "karta", label: "Karta postaci", icon: PenLine, url: "pawnspawn.gg/przygoda/mlyn/lyra", title: "Karta postaci", text: "KP, punkty życia, cechy z modyfikatorami, umiejętności, doświadczenie i ekwipunek. Wszystko aktualizuje się po każdej rundzie.", Screen: AdvSheetScreen },
    { key: "walka", label: "Walka", icon: Skull, url: "pawnspawn.gg/przygoda/mlyn#walka", title: "Walka i walka o życie", text: "Wrogowie z KP i punktami życia, ataki rozstrzygane przez serwer, a gdy postać pada, rzuty przeciw śmierci decydują, czy przeżyje.", Screen: AdvCombatScreen },
  ],
};

export default function ScreenShowcase({ set }: { set: SetKey }) {
  const tabs = SETS[set];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Automatyczne przełączanie co kilka sekund, dopóki ktoś sam nie kliknie zakładki
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setActive((a) => (a + 1) % tabs.length), 6500);
    return () => window.clearInterval(t);
  }, [paused, tabs.length]);

  const tab = tabs[active];
  const Screen = tab.Screen;

  const pills = (
    <div role="tablist" aria-label="Ekrany aplikacji" className={`flex flex-wrap gap-2 ${set !== "club" ? "justify-center" : ""}`}>
      {tabs.map((t, i) => {
        const Icon = t.icon;
        const on = i === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => {
              setActive(i);
              setPaused(true);
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
              on
                ? set !== "club"
                  ? "border-gold/60 bg-gold-soft text-gold"
                  : "border-felt/60 bg-felt-soft text-felt"
                : "border-line bg-panel/60 text-muted hover:text-cream"
            }`}
          >
            <Icon size={14} />
            {t.label}
          </button>
        );
      })}
    </div>
  );

  const progress = (
    <div className="flex gap-1.5" aria-hidden>
      {tabs.map((t, i) => (
        <span key={t.key} className={`h-1 rounded-full transition-all duration-500 ${i === active ? `w-8 ${set !== "club" ? "bg-gold" : "bg-felt"}` : "w-2.5 bg-line"}`} />
      ))}
    </div>
  );

  const frame = (
    <div className="relative">
      <div
        aria-hidden
        className={`absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br blur-2xl ${set !== "club" ? "from-gold/15 via-transparent to-felt/15" : "from-felt/15 via-transparent to-gold/15"}`}
      />
      <BrowserFrame url={tab.url}>
        {/* Stała wysokość okna (zmierzona dla najwyższego ekranu zestawu), żeby przy przełączaniu nic nie skakało */}
        <div key={tab.key} role="tabpanel" className={`landing-fade overflow-hidden ${PANEL_HEIGHT[set]}`}>
          <Screen />
        </div>
      </BrowserFrame>
    </div>
  );

  if (set !== "club") {
    return (
      <div>
        {pills}
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)]">
          <div key={tab.key} className="landing-fade min-h-[12rem] lg:sticky lg:top-28 lg:min-h-0">
            <p className="font-mono text-xs text-muted">
              {String(active + 1).padStart(2, "0")} / {String(tabs.length).padStart(2, "0")}
            </p>
            <h3 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{tab.title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{tab.text}</p>
            <div className="mt-6">{progress}</div>
          </div>
          {frame}
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        {pills}
        <div key={tab.key} className="landing-fade mt-8 min-h-[14rem] sm:min-h-[15rem]">
          <h3 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{tab.title}</h3>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{tab.text}</p>
        </div>
        <div className="mt-8">{progress}</div>
      </div>
      {frame}
    </div>
  );
}
