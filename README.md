# Planszówki — klub

Aplikacja webowa dla 5-osobowej ekipy planszówkowej: kolekcja gier, rozgrywki i statystyki, oceny, ankiety (z linkami do udostępniania), kalendarz spotkań i wishlista.

Stack: **Next.js 15** (App Router) · **TypeScript** · **Tailwind CSS** · **libSQL/Turso** (SQLite) · **jose** (logowanie JWT).

## Funkcje

- **Logowanie** na 5 zahardkodowanych kont (4× user, 1× admin). Cała aplikacja wymaga zalogowania.
- **Kolekcja gier** — nazwa, zdjęcie, liczba graczy, czas gry, opis, liczba rozegranych partii. Dodawanie/edycja/usuwanie tylko dla admina.
- **Rozgrywki** — data, czas trwania, notatka i zajęte miejsca każdego gracza.
- **Oceny** gier w skali 1–10 (każdy gracz osobno, widoczna średnia).
- **Moja historia** — historia partii oraz statystyki zajmowanych miejsc per gra (🥇🥈🥉).
- **Ankiety** — „w co zagrać" (gry z kolekcji + własne opcje) oraz „kiedy się spotkać" (terminy). Głosowanie wielokrotne, wyniki na żywo, **link do udostępniania**, zamykanie/otwieranie i usuwanie przez autora lub admina.
- **Kalendarz** — siatka miesiąca z zaznaczonymi spotkaniami + lista.
- **Wishlista** — gry, które warto kupić (link, zdjęcie, notatka).
- **Przygoda** — gra fabularna w stylu D&D (play by post) z AI jako Mistrzem Gry (Google Gemini): kreator postaci wg SRD 5.1, rundy asynchroniczne (MG odpowiada, gdy wszyscy zagrają, po 24 h albo po „Popchnij fabułę”), animowane kości 3D (rzuca serwer), generowane portrety, sceny i mapy. Wymaga `GEMINI_API_KEY`; obrazki opcjonalnie przez Cloudflare Workers AI — patrz `.env.example`.

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env
# wygeneruj sekret sesji i wklej do .env jako AUTH_SECRET:
openssl rand -base64 32

npm run seed   # (opcjonalnie) przykładowe gry, oceny i rozgrywki
npm run dev
```

Aplikacja ruszy na `http://localhost:3000`. Lokalnie baza to plik `local.db` (SQLite) — nie wymaga niczego więcej.

## Konta (domyślne hasła)

| Login | Widoczna nazwa | Rola | Domyślne hasło |
|---|---|---|---|
| `Bulczy` | Michał | user | `bulczy123` |
| `Chleboldi` | Maciek | user | `chleboldi123` |
| `Eldorida` | Paweł | user | `eldorida123` |
| `Vrenshrrgn` | Miłek | user | `vrenshrrgn123` |
| `Entey` | Łukasz | **admin** | `entey123` |

⚠️ **Zmień hasła przed wdrożeniem.** Możesz to zrobić na dwa sposoby:
- edytując `src/lib/users.ts`, albo
- ustawiając zmienne środowiskowe `PW_BULCZY`, `PW_CHLEBOLDI`, `PW_ELDORIDA`, `PW_VRENSHRRGN`, `PW_ENTEY` (np. w panelu Vercel).

## Wdrożenie na Vercel + Turso

Plikowa baza SQLite nie przetrwa na serverless Vercel, dlatego produkcyjnie używamy **Turso** (ten sam silnik SQLite, ten sam kod — zmienia się tylko adres bazy).

1. Załóż darmową bazę na [turso.tech](https://turso.tech) i pobierz URL + token:
   ```bash
   turso db create planszowki
   turso db show planszowki --url        # -> DATABASE_URL (libsql://...)
   turso db tokens create planszowki     # -> DATABASE_AUTH_TOKEN
   ```
2. W projekcie na Vercel ustaw zmienne środowiskowe:
   - `AUTH_SECRET` — losowy sekret (`openssl rand -base64 32`),
   - `DATABASE_URL` — adres `libsql://...` z Turso,
   - `DATABASE_AUTH_TOKEN` — token z Turso,
   - opcjonalnie `PW_*` — własne hasła kont.
3. Wdróż (push do repo połączonego z Vercel lub `vercel`). Schemat bazy tworzy się automatycznie przy pierwszym zapytaniu.
4. (Opcjonalnie) dane startowe: uruchom `npm run seed` lokalnie z ustawionym `DATABASE_URL`/`DATABASE_AUTH_TOKEN`, by wypełnić bazę Turso.

## Uwaga o linkach do ankiet

Linki do ankiet są „głębokimi" odnośnikami — prowadzą prosto do ankiety, ale aplikacja i tak wymaga zalogowania (zamknięty zestaw 5 kont). To nie są publiczne linki dla osób z zewnątrz.

## Struktura

```
src/
  app/
    (app)/        # strony za logowaniem: dashboard, games, history, polls, calendar, wishlist
    api/          # Route Handlers (mutacje: POST/PUT/PATCH/DELETE)
    login/        # ekran logowania
  components/     # UI + formularze (client components)
  lib/            # auth, db (libSQL), warstwa danych, użytkownicy, typy
  middleware.ts   # ochrona tras + weryfikacja sesji JWT
scripts/seed.mjs  # przykładowe dane
```
