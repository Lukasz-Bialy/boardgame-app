import { redirect } from "next/navigation";

// Logowanie wysuwa się teraz z landingu (components/landing/LoginPopover.tsx).
// Ten adres zostaje dla starych linków i zakładek.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  redirect(from ? `/?login&from=${encodeURIComponent(from)}` : "/?login");
}
