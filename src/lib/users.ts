// Zahardkodowane konta. Hasła startowe pochodzą ze zmiennych środowiskowych PW_* (patrz .env.example).
// Domyślne hasła poniżej działają tylko lokalnie — są jawne w repo, więc na produkcji konto bez PW_*
// (i bez hasła zmienionego w aplikacji) nie da się zalogować.

export type Role = "admin" | "user";

const devDefault = (password: string) => (process.env.NODE_ENV === "production" ? "" : password);

export interface AppUser {
  username: string; // login
  displayName: string; // nazwa pokazywana innym
  password: string;
  role: Role;
}

export const USERS: AppUser[] = [
  { username: "Bulczy", displayName: "Michał", password: process.env.PW_BULCZY ?? devDefault("bulczy123"), role: "admin" },
  { username: "Chleboldi", displayName: "Maciek", password: process.env.PW_CHLEBOLDI ?? devDefault("chleboldi123"), role: "user" },
  { username: "Eldorida", displayName: "Paweł", password: process.env.PW_ELDORIDA ?? devDefault("eldorida123"), role: "user" },
  { username: "Vrenshrrgn", displayName: "Miłek", password: process.env.PW_VRENSHRRGN ?? devDefault("vrenshrrgn123"), role: "user" },
  { username: "Entey", displayName: "Łukasz", password: process.env.PW_ENTEY ?? devDefault("entey123"), role: "admin" },
];

export function findUserByLogin(username: string): AppUser | undefined {
  const u = username.trim().toLowerCase();
  return USERS.find((x) => x.username.toLowerCase() === u);
}

// Zdjęcia profilowe w public/avatars (256×256, kadr na twarz).
const AVATARS: Record<string, string> = {
  Bulczy: "/avatars/michal.jpg",
  Chleboldi: "/avatars/macius.jpg",
  Eldorida: "/avatars/pawel.jpg",
  Vrenshrrgn: "/avatars/milek.jpg",
  Entey: "/avatars/lukasz.jpg",
};

export function avatarOf(username: string): string | undefined {
  return AVATARS[username];
}

export function displayNameOf(username: string): string {
  return USERS.find((u) => u.username === username)?.displayName ?? username;
}

// Wszyscy są graczami (także admin).
export const PLAYERS = USERS;
