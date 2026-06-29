// Zahardkodowane konta. Hasła można nadpisać zmiennymi środowiskowymi (patrz .env.example),
// w przeciwnym razie używane są domyślne poniżej. ZMIEŃ JE przed wdrożeniem!

export type Role = "admin" | "user";

export interface AppUser {
  username: string; // login
  displayName: string; // nazwa pokazywana innym
  password: string;
  role: Role;
}

export const USERS: AppUser[] = [
  { username: "Bulczy", displayName: "Michał", password: process.env.PW_BULCZY ?? "bulczy123", role: "admin" },
  { username: "Chleboldi", displayName: "Maciek", password: process.env.PW_CHLEBOLDI ?? "chleboldi123", role: "user" },
  { username: "Eldorida", displayName: "Paweł", password: process.env.PW_ELDORIDA ?? "eldorida123", role: "user" },
  { username: "Vrenshrrgn", displayName: "Miłek", password: process.env.PW_VRENSHRRGN ?? "vrenshrrgn123", role: "user" },
  { username: "Entey", displayName: "Łukasz", password: process.env.PW_ENTEY ?? "entey123", role: "admin" },
];

export function findUserByLogin(username: string): AppUser | undefined {
  const u = username.trim().toLowerCase();
  return USERS.find((x) => x.username.toLowerCase() === u);
}

export function displayNameOf(username: string): string {
  return USERS.find((u) => u.username === username)?.displayName ?? username;
}

// Wszyscy są graczami (także admin).
export const PLAYERS = USERS;
